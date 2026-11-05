import { Gallery, RouteLeg, RouteOptimizationResult } from '../types/gallery';
import { isInTehranTrafficZone, TRAFFIC_MODELS, TrafficCondition, getGalleryDisplayName } from './persianUtils';

/**
 * Calculates haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Solves the Traveling Salesperson Problem (TSP) using exact brute force for N <= 9
 * or 2-opt heuristic for larger sets to find the minimum distance ordering.
 */
export function solveTspOrder(
  points: { lat: number; lng: number }[],
  isRoundTrip: boolean = false,
  fixStart: boolean = true
): number[] {
  const n = points.length;
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];

  // Precompute distance matrix
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        dist[i][j] = haversineDistance(
          points[i].lat,
          points[i].lng,
          points[j].lat,
          points[j].lng
        );
      }
    }
  }

  const getRouteDist = (route: number[]): number => {
    let sum = 0;
    for (let i = 0; i < route.length - 1; i++) {
      sum += dist[route[i]][route[i + 1]];
    }
    if (isRoundTrip && route.length > 0) {
      sum += dist[route[route.length - 1]][route[0]];
    }
    return sum;
  };

  if (n <= 9) {
    let bestDist = Infinity;
    let bestRoute: number[] = [];

    const indicesToPermute = fixStart
      ? Array.from({ length: n - 1 }, (_, i) => i + 1)
      : Array.from({ length: n }, (_, i) => i);

    const permute = (arr: number[], m: number[] = []) => {
      if (arr.length === 0) {
        const fullRoute = fixStart ? [0, ...m] : m;
        const d = getRouteDist(fullRoute);
        if (d < bestDist) {
          bestDist = d;
          bestRoute = fullRoute;
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    };

    permute(indicesToPermute);
    return bestRoute;
  }

  // 2-opt refinement for N > 9
  const visited = new Set<number>();
  const route: number[] = [0];
  visited.add(0);

  while (route.length < n) {
    const last = route[route.length - 1];
    let nearest = -1;
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited.has(i)) {
        const d = dist[last][i];
        if (d < minDist) {
          minDist = d;
          nearest = i;
        }
      }
    }
    if (nearest !== -1) {
      visited.add(nearest);
      route.push(nearest);
    } else {
      break;
    }
  }

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50) {
    improved = false;
    iterations++;
    const startIdx = fixStart ? 1 : 0;
    for (let i = startIdx; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const newRoute = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        if (getRouteDist(newRoute) < getRouteDist(route) - 0.001) {
          route.splice(0, route.length, ...newRoute);
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Optimizes the route among selected art galleries, factoring in Tehran traffic models.
 */
export async function optimizeGalleryRoute(
  galleries: Gallery[],
  options: {
    mode?: 'driving' | 'walking';
    isRoundTrip?: boolean;
    trafficCondition?: TrafficCondition;
    customStart?: { name: string; lat: number; lng: number };
  } = {}
): Promise<RouteOptimizationResult> {
  const mode = options.mode || 'driving';
  const isRoundTrip = options.isRoundTrip ?? false;
  const trafficCondition = options.trafficCondition || 'peak';
  const trafficMultiplier = mode === 'walking' ? 1.0 : TRAFFIC_MODELS[trafficCondition].multiplier;

  if (galleries.length === 0) {
    throw new Error('لطفاً حداقل یک گالری را برای مسیریابی انتخاب کنید.');
  }

  // Count how many stops are inside Tehran's Central Traffic Zone
  let trafficZoneWarningsCount = 0;
  galleries.forEach((g) => {
    if (isInTehranTrafficZone(g.address, g.lat, g.lng)) {
      trafficZoneWarningsCount++;
    }
  });

  const allPoints: { name: string; lat: number; lng: number; isCustom?: boolean; gallery?: Gallery }[] = [];
  if (options.customStart) {
    allPoints.push({
      name: options.customStart.name,
      lat: options.customStart.lat,
      lng: options.customStart.lng,
      isCustom: true
    });
  }
  galleries.forEach((g) => {
    allPoints.push({
      name: getGalleryDisplayName(g),
      lat: g.lat,
      lng: g.lng,
      gallery: g
    });
  });

  // Try OSRM Trip API first
  try {
    const coordsStr = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmMode = mode === 'walking' ? 'walking' : 'driving';
    const tripUrl = `https://router.project-osrm.org/trip/v1/${osrmMode}/${coordsStr}?overview=full&geometries=geojson&steps=true&roundtrip=${isRoundTrip}&source=first`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(tripUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
        const trip = data.trips[0];
        const waypoints = data.waypoints as { waypoint_index: number; trips_index: number }[];

        const orderedPointsWithIndex = waypoints
          .map((wp, originalIdx) => ({
            originalIdx,
            orderIdx: wp.waypoint_index,
            point: allPoints[originalIdx]
          }))
          .sort((a, b) => a.orderIdx - b.orderIdx);

        const orderedGalleries = orderedPointsWithIndex
          .map((item) => item.point.gallery)
          .filter((g): g is Gallery => !!g);

        const geometryCoords: [number, number][] = (trip.geometry?.coordinates || []).map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const legs: RouteLeg[] = (trip.legs || []).map((leg: any, idx: number) => {
          const from = orderedPointsWithIndex[idx]?.point.name || `توقف ${idx + 1}`;
          const nextIdx = (idx + 1) % orderedPointsWithIndex.length;
          const to = orderedPointsWithIndex[nextIdx]?.point.name || `توقف ${idx + 2}`;

          const baseDurMin = Math.max(1, Math.round((leg.duration || 0) / 60));
          const durWithTrafficMin = Math.max(1, Math.round(baseDurMin * trafficMultiplier));

          return {
            fromName: from,
            toName: to,
            distanceKm: parseFloat(((leg.distance || 0) / 1000).toFixed(2)),
            durationMin: baseDurMin,
            durationWithTrafficMin: durWithTrafficMin,
            summary: leg.summary || '',
            steps: []
          };
        });

        const totalDistKm = parseFloat(((trip.distance || 0) / 1000).toFixed(2));
        const totalDurationMin = Math.max(1, Math.round((trip.duration || 0) / 60));
        const totalDurationWithTrafficMin = Math.max(1, Math.round(totalDurationMin * trafficMultiplier));

        return {
          orderedGalleries,
          totalDistanceKm: totalDistKm,
          totalDurationMin,
          totalDurationWithTrafficMin,
          trafficMultiplier,
          trafficCondition,
          trafficZoneWarningsCount,
          legs,
          geometryCoords,
          isRoundTrip,
          mode,
          originPoint: options.customStart,
          algorithmUsed: 'osrm-trip'
        };
      }
    }
  } catch (err) {
    console.warn('OSRM trip request failed or timed out, falling back to offline TSP matrix:', err);
  }

  // --- Fallback: Offline Matrix TSP Solver ---
  const optimizedOrderIndices = solveTspOrder(
    allPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    isRoundTrip,
    true
  );

  const orderedPoints = optimizedOrderIndices.map((i) => allPoints[i]);
  const orderedGalleries = orderedPoints
    .map((p) => p.gallery)
    .filter((g): g is Gallery => !!g);

  const avgSpeedKmH = mode === 'walking' ? 4.5 : 24;
  const legs: RouteLeg[] = [];
  let totalDistanceKm = 0;
  const geometryCoords: [number, number][] = [];

  for (let i = 0; i < orderedPoints.length - 1; i++) {
    const p1 = orderedPoints[i];
    const p2 = orderedPoints[i + 1];
    const dist = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.35;
    const durMin = Math.max(2, Math.round((dist / avgSpeedKmH) * 60));
    const durWithTraffic = Math.max(2, Math.round(durMin * trafficMultiplier));
    totalDistanceKm += dist;

    legs.push({
      fromName: p1.name,
      toName: p2.name,
      distanceKm: parseFloat(dist.toFixed(2)),
      durationMin: durMin,
      durationWithTrafficMin: durWithTraffic,
      summary: `خیابان‌های شهری`
    });

    geometryCoords.push([p1.lat, p1.lng]);
    geometryCoords.push([(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2]);
  }

  const lastP = orderedPoints[orderedPoints.length - 1];
  geometryCoords.push([lastP.lat, lastP.lng]);

  if (isRoundTrip && orderedPoints.length > 1) {
    const pFirst = orderedPoints[0];
    const dist = haversineDistance(lastP.lat, lastP.lng, pFirst.lat, pFirst.lng) * 1.35;
    const durMin = Math.max(2, Math.round((dist / avgSpeedKmH) * 60));
    const durWithTraffic = Math.max(2, Math.round(durMin * trafficMultiplier));
    totalDistanceKm += dist;

    legs.push({
      fromName: lastP.name,
      toName: pFirst.name,
      distanceKm: parseFloat(dist.toFixed(2)),
      durationMin: durMin,
      durationWithTrafficMin: durWithTraffic,
      summary: 'بازگشت به نقطه آغاز'
    });
    geometryCoords.push([pFirst.lat, pFirst.lng]);
  }

  const totalBaseDur = Math.round((totalDistanceKm / avgSpeedKmH) * 60);

  return {
    orderedGalleries,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    totalDurationMin: totalBaseDur,
    totalDurationWithTrafficMin: Math.round(totalBaseDur * trafficMultiplier),
    trafficMultiplier,
    trafficCondition,
    trafficZoneWarningsCount,
    legs,
    geometryCoords,
    isRoundTrip,
    mode,
    originPoint: options.customStart,
    algorithmUsed: 'tsp-matrix'
  };
}

/**
 * Deep links for Google Maps, Neshan, Balad, Waze
 */
export function buildGoogleMapsUrl(
  orderedGalleries: Gallery[],
  origin?: { lat: number; lng: number }
): string {
  if (orderedGalleries.length === 0) return '';
  const startPoint = origin
    ? `${origin.lat},${origin.lng}`
    : `${orderedGalleries[0].lat},${orderedGalleries[0].lng}`;
  const destinationPoint = `${orderedGalleries[orderedGalleries.length - 1].lat},${orderedGalleries[orderedGalleries.length - 1].lng}`;
  const waypoints = orderedGalleries
    .slice(origin ? 0 : 1, -1)
    .map((g) => `${g.lat},${g.lng}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startPoint)}&destination=${encodeURIComponent(destinationPoint)}`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  return url;
}

export function buildNeshanUrl(gallery: Gallery): string {
  return `https://neshan.org/maps/@${gallery.lat},${gallery.lng},16z`;
}

export function buildBaladUrl(gallery: Gallery): string {
  return `https://balad.ir/location?latitude=${gallery.lat}&longitude=${gallery.lng}`;
}

export function buildWazeUrl(gallery: Gallery): string {
  return `https://waze.com/ul?ll=${gallery.lat},${gallery.lng}&navigate=yes`;
}

export function exportToGpx(
  title: string,
  orderedGalleries: Gallery[],
  coords: [number, number][]
): string {
  const waypointsXml = orderedGalleries
    .map(
      (g, idx) => `  <wpt lat="${g.lat}" lon="${g.lng}">
    <name>توقف ${idx + 1}: ${escapeXml(getGalleryDisplayName(g))}</name>
    <desc>${escapeXml(g.addressFa || g.address)}</desc>
  </wpt>`
    )
    .join('\n');

  const trackPointsXml = coords
    .map((pt) => `      <trkpt lat="${pt[0]}" lon="${pt[1]}"></trkpt>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Art Gallery Route Optimizer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <desc>مسیر بهینه گالری‌گردی هنری تهران</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypointsXml}
  <trk>
    <name>${escapeXml(title)} Track</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
