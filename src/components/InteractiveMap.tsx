import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Gallery, RouteOptimizationResult } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName, parsePersianDateToScore, isThisWeekOpening } from '../utils/persianUtils';
import { Navigation, Compass, Layers, Car, ShieldAlert } from 'lucide-react';

interface InteractiveMapProps {
  galleries: Gallery[];
  selectedGalleries: Gallery[];
  routeResult: RouteOptimizationResult | null;
  onToggleGallery: (gallery: Gallery) => void;
  onSelectForDetails?: (gallery: Gallery) => void;
  onSetStartGallery?: (galleryId: number) => void;
  activeGalleryId?: number | null;
  isDarkMode?: boolean;
}

const DEFAULT_NESHAN_WEB_KEY = 'web.cd0b84e26a35496f87485087bce939da';

export function getNeshanWebKey(): string {
  // 1. Runtime config injected via /api/config or window.__ARTGASHT_CONFIG__
  if (typeof window !== 'undefined' && (window as any).__ARTGASHT_CONFIG__?.neshanKey) {
    return (window as any).__ARTGASHT_CONFIG__.neshanKey;
  }
  // 2. Vite build-time environment variable (e.g. VITE_NESHAN_WEB_KEY)
  const envKey = (import.meta as any).env?.VITE_NESHAN_WEB_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  // 3. Fallback default
  return DEFAULT_NESHAN_WEB_KEY;
}

// Tehran Central Traffic Zone Polygon Coordinates (محدوده رسمی طرح ترافیک تهران)
const TEHRAN_TRAFFIC_ZONE_GEOJSON: any = {
  type: 'Feature',
  properties: { name: 'محدوده طرح ترافیک تهران' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [51.3885, 35.7275], // تقاطع کارگر و فاطمی/مطهری
        [51.4130, 35.7280], // تقاطع مطهری و ولیعصر
        [51.4430, 35.7265], // تقاطع مطهری و شریعتی / پل سیدخندان
        [51.4485, 35.7005], // میدان امام حسین / خیابان مازندران
        [51.4460, 35.6600], // هفده شهریور تقاطع شوش
        [51.4150, 35.6580], // شوش / میدان راه‌آهن
        [51.3880, 35.6620], // شوش تقاطع کارگر جنوبی
        [51.3900, 35.7005], // میدان انقلاب
        [51.3885, 35.7275]  // بستن چندضلعی
      ]
    ]
  }
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  galleries,
  selectedGalleries,
  routeResult,
  onToggleGallery,
  onSelectForDetails,
  onSetStartGallery,
  activeGalleryId,
  isDarkMode = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showTrafficZone, setShowTrafficZone] = useState(true);
  const [mapFilterMode, setMapFilterMode] = useState<'all' | 'active-only' | 'openings-only'>('all');

  // Compute maximum Persian opening score for the current Friday cycle
  const maxOpeningScore = useMemo(() => {
    const scores = galleries
      .map((g) => parsePersianDateToScore(g.activeExhibition?.openingDate))
      .filter((s) => s > 0);
    return scores.length > 0 ? Math.max(...scores) : 0;
  }, [galleries]);

  // Aggregate galleries by physical building / venue coordinates
  const mapKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const venueMap = useMemo(() => {
    const map = new Map<string, Gallery[]>();
    galleries.forEach((g) => {
      const key = mapKey(g.lat, g.lng);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return map;
  }, [galleries]);

  // Count venues by category for map declutter filter tabs
  const { openingsCount, activeCount, allCount } = useMemo(() => {
    let openings = 0;
    let active = 0;
    venueMap.forEach((vg) => {
      if (vg.some((g) => isThisWeekOpening(g.activeExhibition?.openingDate, maxOpeningScore))) {
        openings++;
      }
      if (vg.some((g) => Boolean(g.activeExhibition || g.posterImage))) {
        active++;
      }
    });
    return {
      openingsCount: openings,
      activeCount: active,
      allCount: venueMap.size
    };
  }, [venueMap, maxOpeningScore]);

  // 1. Initialize Neshan Vector Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const purgeNeshanWatermarks = () => {
      if (!mapContainerRef.current) return;
      const selectors = [
        '.mapboxgl-ctrl-bottom-left',
        '.mapboxgl-ctrl-bottom-right',
        '.mapboxgl-ctrl-top-left',
        '.mapboxgl-ctrl-top-right',
        '.mapboxgl-ctrl-attrib',
        '.mapboxgl-ctrl-attrib-inner',
        '.mapboxgl-ctrl-attrib-button',
        '.mapboxgl-compact',
        '.mapboxgl-ctrl-logo',
        'a.mapboxgl-ctrl-logo',
        '.neshan-watermark',
        '.neshan-logo',
        'a[href*="neshan.org"]',
        'a[href*="mapbox.com"]',
        'a[href*="openstreetmap.org"]',
        '[class*="mapboxgl-ctrl"]'
      ];
      selectors.forEach((sel) => {
        mapContainerRef.current?.querySelectorAll(sel).forEach((el: any) => {
          el.style.display = 'none';
          el.remove();
        });
      });

      // Also search by text content for any stubborn OSM or Neshan text nodes
      const allDivs = mapContainerRef.current.querySelectorAll('div, a, span');
      allDivs.forEach((el: any) => {
        const text = el.textContent || '';
        if (text.includes('OSM') || text.includes('©') || text.includes('Neshan') || text.includes('نشان')) {
          // If this is an attribution overlay (not user legend or popup)
          if (!el.closest('.clay-card') && !el.closest('.mapboxgl-popup') && !el.closest('.cursor-pointer')) {
            el.style.display = 'none';
            el.remove();
          }
        }
      });
    };

    const initNeshanMap = () => {
      const nmp = (window as any).nmp_mapboxgl;
      if (!nmp || !mapContainerRef.current) return;

      try {
        const map = new nmp.Map({
          mapType: isDarkMode ? nmp.Map.mapTypes.neshanVectorNight : nmp.Map.mapTypes.neshanVector,
          container: mapContainerRef.current,
          zoom: 12.8,
          pitch: 0,
          center: [51.415, 35.725], // [lng, lat] Tehran Center
          minZoom: 10,
          maxZoom: 19,
          trackResize: true,
          mapKey: getNeshanWebKey(),
          poi: true,
          traffic: true,
          attributionControl: false
        });

        map.on('load', () => {
          mapInstanceRef.current = map;
          setIsMapReady(true);
          map.resize();
          purgeNeshanWatermarks();

          // Add Tehran Central Traffic Zone Layer
          try {
            map.addSource('tehran-traffic-zone', {
              type: 'geojson',
              data: TEHRAN_TRAFFIC_ZONE_GEOJSON
            });

            // Fill Layer
            map.addLayer({
              id: 'tehran-traffic-zone-fill',
              type: 'fill',
              source: 'tehran-traffic-zone',
              paint: {
                'fill-color': '#EF4444',
                'fill-opacity': 0.08
              }
            });

            // Border Layer
            map.addLayer({
              id: 'tehran-traffic-zone-border',
              type: 'line',
              source: 'tehran-traffic-zone',
              paint: {
                'line-color': '#DC2626',
                'line-width': 2,
                'line-dasharray': [3, 2],
                'line-opacity': 0.85
              }
            });
          } catch (e) {
            console.warn('[Neshan] Traffic zone layer init note:', e);
          }
        });

        map.on('render', () => {
          purgeNeshanWatermarks();
        });
        map.on('sourcedata', () => {
          purgeNeshanWatermarks();
        });
        map.on('styledata', () => {
          purgeNeshanWatermarks();
        });
      } catch (err) {
        console.error('[Neshan] Map init error:', err);
      }
    };

    let mutationObserver: MutationObserver | null = null;
    if (mapContainerRef.current && window.MutationObserver) {
      mutationObserver = new MutationObserver(() => {
        purgeNeshanWatermarks();
      });
      mutationObserver.observe(mapContainerRef.current, {
        childList: true,
        subtree: true
      });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    if ((window as any).nmp_mapboxgl) {
      initNeshanMap();
    } else {
      const interval = setInterval(() => {
        if ((window as any).nmp_mapboxgl) {
          clearInterval(interval);
          initNeshanMap();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    // Secondary watermark purge timer to catch delayed SDK injections
    const purgeInterval = setInterval(purgeNeshanWatermarks, 200);
    const purgeTimeout = setTimeout(() => clearInterval(purgeInterval), 6000);

    return () => {
      clearInterval(purgeInterval);
      clearTimeout(purgeTimeout);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Synchronize Dark / Light Mode with Neshan Style
  useEffect(() => {
    const map = mapInstanceRef.current;
    const nmp = (window as any).nmp_mapboxgl;
    if (!map || !nmp || !isMapReady) return;

    try {
      map.setMapType(isDarkMode ? nmp.Map.mapTypes.neshanVectorNight : nmp.Map.mapTypes.neshanVector);
    } catch (e) {
      console.warn('[Neshan] Style change note:', e);
    }
  }, [isDarkMode, isMapReady]);

  // 3. Toggle Traffic Zone Visibility
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const visibility = showTrafficZone ? 'visible' : 'none';
    if (map.getLayer('tehran-traffic-zone-fill')) {
      map.setLayoutProperty('tehran-traffic-zone-fill', 'visibility', visibility);
    }
    if (map.getLayer('tehran-traffic-zone-border')) {
      map.setLayoutProperty('tehran-traffic-zone-border', 'visibility', visibility);
    }
  }, [showTrafficZone, isMapReady]);

  // 4. Toggle Traffic Layer Visibility
  const handleToggleTraffic = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const nextState = !showTrafficLayer;
    setShowTrafficLayer(nextState);
    if (typeof map.toggleTrafficLayer === 'function') {
      map.toggleTrafficLayer(nextState);
    }
  };

  // 5. Update Markers and Route on Neshan Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const nmp = (window as any).nmp_mapboxgl;
    if (!map || !nmp || !isMapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const selectedIds = new Set(selectedGalleries.map((g) => g.id));
    const orderedIds = routeResult ? routeResult.orderedGalleries.map((g) => g.id) : [];
    const orderIndexMap = new Map<number, number>();
    orderedIds.forEach((id, idx) => orderIndexMap.set(id, idx + 1));

    // Bounds calculator
    const bounds = new nmp.LngLatBounds();
    let hasValidBounds = false;

    // 5.1 Render Route Line
    try {
      if (routeResult && routeResult.geometryCoords.length > 0) {
        // Mapbox uses [lng, lat]
        const coordinates = routeResult.geometryCoords.map((c) => [c[1], c[0]]);

        const routeGeoJson: any = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        };

        if (map.getSource('optimized-route')) {
          map.getSource('optimized-route').setData(routeGeoJson);
        } else {
          map.addSource('optimized-route', {
            type: 'geojson',
            data: routeGeoJson
          });

          // Route casing
          map.addLayer({
            id: 'optimized-route-casing',
            type: 'line',
            source: 'optimized-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#1E3A8A',
              'line-width': 7,
              'line-opacity': 0.45
            }
          });

          // Main line
          map.addLayer({
            id: 'optimized-route-line',
            type: 'line',
            source: 'optimized-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#F76B1C',
              'line-width': 4.5
            }
          });
        }

        coordinates.forEach((coord: number[]) => {
          if (coord.length >= 2) {
            bounds.extend([coord[0], coord[1]]);
            hasValidBounds = true;
          }
        });
      } else {
        // Remove existing route if cleared
        if (map.getLayer('optimized-route-line')) map.removeLayer('optimized-route-line');
        if (map.getLayer('optimized-route-casing')) map.removeLayer('optimized-route-casing');
        if (map.getSource('optimized-route')) map.removeSource('optimized-route');
      }
    } catch (e) {
      console.warn('[Neshan] Route update note:', e);
    }

    // 5.2 Render Origin / Starting Point Marker if available
    if (routeResult?.originPoint) {
      const origin = routeResult.originPoint;
      const el = document.createElement('div');
      el.className = 'cursor-pointer select-none';
      el.title = `${origin.name} (مبدأ حرکت شما)`;

      el.innerHTML = `
        <div class="relative flex flex-col items-center group -translate-y-2">
          <div class="absolute -top-1 w-10 h-10 rounded-full bg-emerald-500/35 animate-ping pointer-events-none"></div>
          <div class="w-9 h-9 rounded-full bg-emerald-600 text-white border-2 border-white flex items-center justify-center shadow-xl transition-transform duration-150 ease-out hover:scale-115 active:scale-95 origin-center z-10">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 2l7 19-7-4-7 4 7-19z"></path>
            </svg>
          </div>
          <div class="mt-1 bg-emerald-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md border border-emerald-500/50 whitespace-nowrap pointer-events-none">
            ${origin.name}
          </div>
        </div>
      `;

      const originMarker = new nmp.Marker({ element: el })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);

      markersRef.current.push(originMarker);
      bounds.extend([origin.lng, origin.lat]);
      hasValidBounds = true;
    }

    // 5.3 Render Gallery Markers (Aggregating co-located spaces into single venue markers)
    venueMap.forEach((venueGalleries) => {
      // Find the representative gallery for this venue marker:
      // Priority 1: Has route order
      // Priority 2: Is selected
      // Priority 3: Has active exhibition / poster
      // Priority 4: First entry
      const orderedSpace = venueGalleries.find((g) => orderIndexMap.has(g.id));
      const selectedSpace = venueGalleries.find((g) => selectedIds.has(g.id));
      const activeSpace = venueGalleries.find((g) => Boolean(g.activeExhibition || g.posterImage));
      const representative = orderedSpace || selectedSpace || activeSpace || venueGalleries[0];

      const siblings = venueGalleries.filter((g) => g.id !== representative.id);
      const gallery: Gallery = {
        ...representative,
        siblingSpaces: siblings.length > 0 ? siblings : representative.siblingSpaces
      };

      const isSelected = selectedIds.has(gallery.id);
      const orderNum = orderIndexMap.get(gallery.id);
      const isFocused = venueGalleries.some((g) => activeGalleryId === g.id);

      const hasOpeningThisWeek = venueGalleries.some((g) =>
        isThisWeekOpening(g.activeExhibition?.openingDate, maxOpeningScore)
      );
      const activeSpacesCount = venueGalleries.filter((g) => Boolean(g.activeExhibition || g.posterImage)).length;
      const hasExhibition = activeSpacesCount > 0;

      // Smart Decluttering: filter markers based on active mapFilterMode
      // Selected tour destinations and route waypoints are NEVER hidden!
      const isPartOfRoute = isSelected || orderNum !== undefined;
      if (!isPartOfRoute) {
        if (mapFilterMode === 'openings-only' && !hasOpeningThisWeek) {
          return;
        }
        if (mapFilterMode === 'active-only' && !hasExhibition) {
          return;
        }
      }

      const el = document.createElement('div');
      // Keep outer marker element free of any CSS transforms so Mapbox geolocation positioning never glitches!
      el.className = 'cursor-pointer select-none';
      const galleryDisplayName = getGalleryDisplayName(gallery);
      const multiBadgeText = activeSpacesCount > 1 ? ` (${toPersianDigits(activeSpacesCount)} نمایشگاه فعال همزمان)` : '';

      let statusTooltip = ' (بین دو دوره نمایشگاه)';
      if (hasOpeningThisWeek) {
        statusTooltip = ' (🔥 افتتاحیه این هفته)';
      } else if (hasExhibition) {
        statusTooltip = ' (نمایشگاه فعال)';
      }

      el.title = `${galleryDisplayName}${multiBadgeText}${statusTooltip} (کلیک برای جزئیات کامل و افزودن به مسیر)`;

      // Clicking any marker opens the full darkened overlay modal directly
      el.onclick = (e) => {
        e.stopPropagation();
        if (onSelectForDetails) {
          onSelectForDetails(gallery);
        }
      };

      if (orderNum !== undefined) {
        const isFirst = orderNum === 1;
        const isLast = orderNum === orderedIds.length && !routeResult?.isRoundTrip;
        const bgClass = isFirst
          ? 'bg-[#3D5B99] text-white border-2 border-white'
          : isLast
          ? 'bg-[#F76B1C] text-white border-2 border-white'
          : 'bg-[#1e335a] text-white border-2 border-[#A3C2E4]';

        el.innerHTML = `
          <div class="relative">
            <div class="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-xs shadow-xl ${bgClass} transition-transform duration-150 ease-out hover:scale-110 active:scale-95 origin-center">
              ${toPersianDigits(orderNum)}
            </div>
            ${activeSpacesCount > 1 ? `
              <span class="absolute -top-1.5 -right-1.5 bg-[#F76B1C] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                ${toPersianDigits(activeSpacesCount)}
              </span>
            ` : ''}
          </div>
        `;
      } else if (isSelected) {
        el.innerHTML = `
          <div class="relative">
            <div class="w-[30px] h-[30px] rounded-full bg-[#3D5B99] text-white border-2 border-white flex items-center justify-center shadow-lg transition-transform duration-150 ease-out hover:scale-110 active:scale-95 origin-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            ${activeSpacesCount > 1 ? `
              <span class="absolute -top-1.5 -right-1.5 bg-[#F76B1C] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                ${toPersianDigits(activeSpacesCount)}
              </span>
            ` : ''}
          </div>
        `;
      } else if (hasOpeningThisWeek) {
        // State 1: Fresh Opening This Week (High priority, fiery orange glow + white pulse dot)
        el.innerHTML = `
          <div class="relative">
            <div class="w-[26px] h-[26px] rounded-full bg-[#F76B1C] text-white border-2 border-white flex items-center justify-center shadow-lg ring-2 ring-[#F76B1C]/50 ${
              isFocused ? 'ring-4 ring-[#1e335a]' : ''
            } transition-transform duration-150 ease-out hover:scale-125 active:scale-95 origin-center animate-pulse">
              <div class="w-2.5 h-2.5 rounded-full bg-white shadow-xs"></div>
            </div>
            ${activeSpacesCount > 1 ? `
              <span class="absolute -top-1.5 -right-1.5 bg-[#1e335a] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                ${toPersianDigits(activeSpacesCount)}
              </span>
            ` : ''}
          </div>
        `;
      } else if (hasExhibition) {
        // State 2: Active Ongoing Exhibition (Solid deep navy with orange center dot)
        el.innerHTML = `
          <div class="relative">
            <div class="w-[22px] h-[22px] rounded-full ${
              isFocused
                ? 'bg-[#1e335a] border-2 border-white ring-2 ring-[#F76B1C]'
                : 'bg-[#3D5B99] text-white border-2 border-white'
            } flex items-center justify-center shadow-md opacity-95 transition-transform duration-150 ease-out hover:scale-125 active:scale-95 origin-center">
              <div class="w-2 h-2 rounded-full bg-[#F76B1C]"></div>
            </div>
            ${activeSpacesCount > 1 ? `
              <span class="absolute -top-1.5 -right-1.5 bg-[#F76B1C] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                ${toPersianDigits(activeSpacesCount)}
              </span>
            ` : ''}
          </div>
        `;
      } else {
        // State 3: Inactive / Between Cycles (Pale muted soft-blue with white dot)
        el.innerHTML = `
          <div class="relative">
            <div class="w-[18px] h-[18px] rounded-full ${
              isFocused
                ? 'bg-[#A3C2E4] border-2 border-[#1e335a] ring-2 ring-[#F76B1C]'
                : 'bg-[#A3C2E4]/80 text-[#1e335a] border border-white'
            } flex items-center justify-center shadow-2xs opacity-75 transition-transform duration-150 ease-out hover:scale-125 active:scale-95 origin-center">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `;
      }

      const marker = new nmp.Marker({ element: el })
        .setLngLat([gallery.lng, gallery.lat])
        .addTo(map);

      markersRef.current.push(marker);

      if (isSelected || (routeResult && orderNum !== undefined)) {
        bounds.extend([gallery.lng, gallery.lat]);
        hasValidBounds = true;
      }
    });

    if (hasValidBounds) {
      try {
        map.fitBounds(bounds, { padding: 45, maxZoom: 15 });
      } catch (e) {
        console.warn('[Neshan] fitBounds note:', e);
      }
    }
  }, [galleries, selectedGalleries, routeResult, activeGalleryId, isMapReady, mapFilterMode, maxOpeningScore, venueMap]);

  // Recenter controls
  const handleRecenterCluster = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({ center: [51.415, 35.725], zoom: 12.8, essential: true });
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('موقعیت‌یاب در مرورگر شما پشتیبانی نمی‌شود.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({ center: [longitude, latitude], zoom: 15, essential: true });
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      }
    );
  };

  return (
    <div className="clay-card relative w-full h-full min-h-[360px] sm:min-h-[420px] overflow-hidden border border-[#E1E1E1] dark:border-stone-800 shadow-md">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full overflow-hidden" />

      {/* Floating Action Controls (placed at top-[68px] on mobile to never overlap top declutter tabs) */}
      <div className="absolute top-[68px] sm:top-4 left-3.5 sm:left-4 z-10 flex flex-col gap-2">
        {/* Toggle Live Traffic */}
        <button
          onClick={handleToggleTraffic}
          title={showTrafficLayer ? 'خاموش کردن ترافیک زنده' : 'روشن کردن ترافیک زنده تهران'}
          className={`clay-button w-10 h-10 flex items-center justify-center transition-all ${
            showTrafficLayer ? 'bg-emerald-600 text-white' : 'clay-base text-[#3D5B99] dark:text-[#A3C2E4]'
          }`}
        >
          <Car className="w-4 h-4" />
        </button>

        {/* Toggle Tehran Traffic Zone Overlay */}
        <button
          onClick={() => setShowTrafficZone(!showTrafficZone)}
          title={showTrafficZone ? 'مخفی کردن محدوده طرح ترافیک' : 'نمایش محدوده طرح ترافیک تهران'}
          className={`clay-button w-10 h-10 flex items-center justify-center transition-all ${
            showTrafficZone ? 'bg-rose-500 text-white' : 'clay-base text-[#3D5B99] dark:text-[#A3C2E4]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
        </button>

        {/* Locate Me */}
        <button
          onClick={handleLocateUser}
          title="موقعیت من"
          className="clay-button clay-base w-10 h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all"
        >
          <Navigation className="w-4 h-4" />
        </button>

        {/* Recenter on Tehran */}
        <button
          onClick={handleRecenterCluster}
          title="مرکز گالری‌های تهران"
          className="clay-button clay-base w-10 h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Map Declutter Toggle Bar (خلوت‌سازی هوشمند نقشه) */}
      <div className="absolute top-3.5 right-3.5 z-10 clay-card bg-white/95 dark:bg-[#151922]/95 backdrop-blur-md p-1 rounded-2xl border border-[#E1E1E1] dark:border-stone-800 shadow-md flex items-center gap-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMapFilterMode('openings-only')}
          className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
            mapFilterMode === 'openings-only'
              ? 'bg-[#F76B1C] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="فقط نمایش گالری‌های دارای افتتاحیه این هفته (خلوت‌ترین حالت)"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>افتتاحیه‌ها</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-md ${
              mapFilterMode === 'openings-only'
                ? 'bg-white/25 text-white'
                : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {toPersianDigits(openingsCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMapFilterMode('active-only')}
          className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
            mapFilterMode === 'active-only'
              ? 'bg-[#3D5B99] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="نمایش تمام گالری‌های دارای نمایشگاه فعال"
        >
          <span className="w-2 h-2 rounded-full bg-[#F76B1C]" />
          <span>همه فعال‌ها</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-md ${
              mapFilterMode === 'active-only'
                ? 'bg-white/25 text-white'
                : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {toPersianDigits(activeCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMapFilterMode('all')}
          className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
            mapFilterMode === 'all'
              ? 'bg-[#1e335a] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="نمایش تمام نگارخانه‌ها (شامل بین دو دوره)"
        >
          <span>همه</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-md ${
              mapFilterMode === 'all'
                ? 'bg-white/25 text-white'
                : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {toPersianDigits(allCount)}
          </span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3.5 right-3.5 z-10 clay-card bg-white/95 dark:bg-[#161a22]/95 px-3 py-1.5 text-[11px] text-stone-600 dark:text-stone-300 hidden md:flex items-center gap-3 border border-[#E1E1E1] dark:border-stone-800">
        {routeResult?.originPoint && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
            <span>مبدأ حرکت</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e335a] text-white text-[8px] font-bold flex items-center justify-center">۱</span>
          <span>در برنامه گشت</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F76B1C] ring-2 ring-[#F76B1C]/40 border border-white inline-block animate-pulse"></span>
          <span className="font-bold text-[#F76B1C]">افتتاحیه این هفته</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3D5B99] border border-white inline-block"></span>
          <span>نمایشگاه فعال</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A3C2E4] border border-white inline-block"></span>
          <span>بین دو دوره</span>
        </div>
        {showTrafficZone && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/30 border border-rose-500 inline-block"></span>
            <span>طرح ترافیک</span>
          </div>
        )}
        {showTrafficLayer && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>ترافیک زنده</span>
          </div>
        )}
      </div>
    </div>
  );
};
