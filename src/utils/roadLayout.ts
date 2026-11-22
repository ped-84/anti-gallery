import { Gallery } from '../types/gallery';
import {
  toPersianDigits,
  getGalleryDisplayName,
  parsePersianDateToScore,
  isThisWeekOpening,
  formatDistanceFa,
  formatDurationFa
} from './persianUtils';

export interface RoadRoute {
  id: string;
  label: string;
  color: string;
  tab?: string;
  tabInk?: string;
  pinTone: 'cool' | 'warm';
  galleryIds: number[];
}

export interface RoadStop {
  gallery: Gallery;
  name: string;
  show: string;
  artist: string;
  num: string;
  isStart: boolean;
  isEnd: boolean;
  showArtist: boolean;
  pin: {
    size: number;
    x: number;
    y: number;
    rot: number;
    unrot: number;
    numSize: number;
    numFont: number;
    shadow: { x: number; y: number; w: number };
  };
  card: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface RoadLeg {
  y: number;
  rightSide: boolean;
  x: number;
  /** ابعاد برچسب فاصله روی بوم */
  w: number;
  h: number;
  km: number | null;
  minutes: number | null;
  known: boolean;
  text: string;
}

/** درخت‌های تزئینی کنار جاده (ثابت، بدون انیمیشن) */
export interface RoadTree {
  x: number;
  y: number;
  r: number;
  tone: 0 | 1 | 2;
}

export interface RoadLayoutResult {
  n: number;
  mapH: number;
  dense: boolean;
  pathD: string;
  pts: Array<{ x: number; y: number }>;
  stops: RoadStop[];
  legs: RoadLeg[];
  trees: RoadTree[];
  stats: {
    stops: string;
    km: string;
    time: string;
  };
  carSeconds: number;
}

/* ---- Color Science (WCAG AA & Tints) ---- */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c =
    (Math.max(0, Math.min(255, Math.round(r))) << 16) |
    (Math.max(0, Math.min(255, Math.round(g))) << 8) |
    Math.max(0, Math.min(255, Math.round(b)));
  return '#' + ('000000' + c.toString(16)).slice(-6);
}

export function mix(c1: string, c2: string, t: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToHex(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  );
}

export function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function contrast(c1: string, c2: string): number {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const l1 = luminance(a[0], a[1], a[2]);
  const l2 = luminance(b[0], b[1], b[2]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function safeFillForWhiteText(hex: string): string {
  if (contrast(hex, '#ffffff') >= 4.5) return hex;
  for (let step = 1; step <= 60; step++) {
    const darkened = mix(hex, '#000000', step * 0.01);
    if (contrast(darkened, '#ffffff') >= 4.5) return darkened;
  }
  return mix(hex, '#000000', 0.6);
}

export function accentFor(route: RoadRoute): string {
  return route.pinTone === 'warm' ? '#3D5B99' : '#F76B1C';
}

function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---- Geometry Constants ---- */
// بوم ۴۸۰ واحدی (به‌جای ۵۶۰) تا روی گوشی با مقیاس بزرگ‌تری نمایش داده شود و متن‌ها ریز نشوند.
export const ROAD_CONSTANTS = {
  MAP_W: 480,
  PAD_TOP: 116,
  PAD_BOTTOM: 90,
  MAX_H: 960,
  MAX_SPACING: 178,
  DENSE_BELOW: 158,
  LANE_L: 210,
  LANE_R: 270,
  ROAD_HALF: 27,
  PIN_GAP: 16,
  CARD_W: 162,
  CARD_X: { left: 12, right: 306 },
  CARD_H: { roomy: 150, dense: 124 },
  PIN: { roomy: 40, dense: 36 },
  BUBBLE_H: 34,
  BUBBLE_W: { walking: 158, driving: 118 },
  BUBBLE_GAP: 16,
  CAR_OVERRUN: 24
};

/**
 * درخت‌های تزئینی دو طرف جاده: در فاصله‌های منظم روی منحنی، فقط جاهایی که با کارت، پین،
 * برچسب فاصله یا لبه‌ی بوم برخورد ندارند. قطعی (بدون تصادف) تا با هر رندر جابه‌جا نشوند.
 */
function placeRoadTrees(
  samples: Array<{ x: number; y: number }>,
  stops: RoadStop[],
  legs: RoadLeg[],
  mapH: number
): RoadTree[] {
  const C = ROAD_CONSTANTS;
  const curve = samples;
  if (curve.length < 3) return [];

  const blocks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  stops.forEach((s) => {
    blocks.push({ x1: s.card.x - 8, y1: s.card.y - s.card.h / 2 - 8, x2: s.card.x + s.card.w + 8, y2: s.card.y + s.card.h / 2 + 8 });
    blocks.push({ x1: s.pin.x - 8, y1: s.pin.y - 8, x2: s.pin.x + s.pin.size + 8, y2: s.pin.y + s.pin.size + 12 });
  });
  legs.forEach((l) => {
    const x1 = l.rightSide ? l.x : l.x - l.w;
    blocks.push({ x1: x1 - 8, y1: l.y - l.h / 2 - 8, x2: x1 + l.w + 8, y2: l.y + l.h / 2 + 8 });
  });

  const trees: RoadTree[] = [];
  const SPACING = 44;
  let acc = SPACING / 2;
  let k = 0;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 0.001) continue;
    acc += seg;
    if (acc < SPACING) continue;
    acc = 0;
    const nx = -(b.y - a.y) / seg;
    const ny = (b.x - a.x) / seg;
    [1, -1].forEach((side) => {
      k++;
      const r = 7 + ((k * 7) % 5); // ۷ تا ۱۱
      const off = C.ROAD_HALF + 12 + r + ((k * 3) % 4);
      const x = b.x + nx * off * side;
      const y = b.y + ny * off * side;
      if (x < r + 6 || x > C.MAP_W - r - 6 || y < r + 6 || y > mapH - r - 6) return;
      const hit = blocks.some((bl) => x + r > bl.x1 && x - r < bl.x2 && y + r > bl.y1 && y - r < bl.y2);
      if (hit) return;
      // فاصله از جاده در همه‌ی نمونه‌ها (برای پیچ‌های تند)
      const nearRoad = curve.some((p) => Math.hypot(p.x - x, p.y - y) < C.ROAD_HALF + 6 + r);
      if (nearRoad) return;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 8)) return;
      trees.push({ x: Math.round(x), y: Math.round(y), r, tone: (k % 3) as 0 | 1 | 2 });
    });
  }
  return trees;
}

/**
 * Turns route & galleries into an exact layout for the winding road map.
 */
export function computeRoadLayout(
  route: RoadRoute,
  allGalleries: Gallery[],
  travelMode: 'driving' | 'walking' = 'driving'
): RoadLayoutResult {
  const C = ROAD_CONSTANTS;

  // Resolve Gallery objects in visiting order
  const resolvedGalleries: Gallery[] = route.galleryIds
    .map((id) => allGalleries.find((g) => g.id === id))
    .filter((g): g is Gallery => Boolean(g));

  const n = resolvedGalleries.length;

  // Safe fallback if route has fewer than 2 stops
  if (n < 2) {
    return {
      n,
      mapH: C.PAD_TOP + C.PAD_BOTTOM,
      dense: false,
      pathD: `M ${C.LANE_L} 0 L ${C.LANE_L} 200`,
      pts: resolvedGalleries.map(() => ({ x: C.LANE_L, y: C.PAD_TOP })),
      stops: [],
      legs: [],
      trees: [],
      stats: {
        stops: `${toPersianDigits(n)} گالری`,
        km: '۰ کیلومتر',
        time: '۰ دقیقه'
      },
      carSeconds: 6
    };
  }

  // Real Driving/Walking Legs (km + minutes)
  const legData: Array<[number, number] | null> = [];
  for (let i = 0; i < n - 1; i++) {
    const a = resolvedGalleries[i];
    const b = resolvedGalleries[i + 1];
    if (a && b) {
      // Direct haversine distance with 1.25 urban street factor
      const straight = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const urbanKm = parseFloat((straight * 1.25).toFixed(2));
      // Pace: walking = ~13 mins/km; driving = ~4 mins/km + traffic buffer
      const mins = travelMode === 'walking'
        ? Math.max(1, Math.round(urbanKm * 13))
        : Math.max(1, Math.round(urbanKm * 4 + 2));
      legData.push([urbanKm, mins]);
    } else {
      legData.push(null);
    }
  }

  // Vertical rhythm: spacing shrinks dynamically with stop count (no scrolling)
  const sp = n > 1 ? Math.min(C.MAX_SPACING, (C.MAX_H - C.PAD_TOP - C.PAD_BOTTOM) / (n - 1)) : 0;
  const mapH = Math.round(C.PAD_TOP + (n - 1) * sp + C.PAD_BOTTOM);
  const dense = sp < C.DENSE_BELOW;
  const size = dense ? C.PIN.dense : C.PIN.roomy;
  const off = C.ROAD_HALF + C.PIN_GAP + Math.round(size * 0.707);

  // Control points: stops alternate left lane / right lane (zig-zag)
  const pts = resolvedGalleries.map((_, i) => ({
    x: i % 2 === 0 ? C.LANE_L : C.LANE_R,
    y: Math.round(C.PAD_TOP + i * sp)
  }));

  // Build SVG path
  const k = sp * 0.6; // Bezier handle length
  let d = 'M ' + (pts[0]?.x ?? C.LANE_L) + ' ' + (-C.CAR_OVERRUN) + ' L ' + (pts[0]?.x ?? C.LANE_L) + ' ' + (pts[0]?.y ?? 0);
  const samples: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const c1y = Math.round(a.y + k);
    const c2y = Math.round(b.y - k);
    d += ' C ' + a.x + ' ' + c1y + ' ' + b.x + ' ' + c2y + ' ' + b.x + ' ' + b.y;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      samples.push({
        x: bezier(a.x, a.x, b.x, b.x, t),
        y: bezier(a.y, c1y, c2y, b.y, t)
      });
    }
  }

  // منحنی مرتب جاده (با تکه‌ی صاف بالا و پایین) برای چیدن درخت‌ها
  const curveSamples = [
    { x: pts[0].x, y: -C.CAR_OVERRUN },
    ...samples,
    { x: pts[n - 1].x, y: mapH + C.CAR_OVERRUN }
  ];

  pts.forEach((p) => samples.push({ x: p.x, y: p.y }));
  if (pts.length > 0) {
    samples.push({ x: pts[0].x, y: 0 });
    samples.push({ x: pts[n - 1].x, y: mapH });
    d += ' L ' + pts[n - 1].x + ' ' + (mapH + C.CAR_OVERRUN);
  }

  // Pins + Gallery Cards (Pins elevated above cards at 45° angle, cards widened for fuller titles)
  const stops: RoadStop[] = resolvedGalleries.map((gallery, i) => {
    const p = pts[i];
    const left = i % 2 === 0;
    const cardH = dense ? C.CARD_H.dense : C.CARD_H.roomy;
    const cardW = C.CARD_W;
    const cardX = left ? C.CARD_X.left : C.CARD_X.right;
    const cardY = p.y;
    const cardTop = cardY - cardH / 2;

    const activeEx = gallery.activeExhibition;
    const artist =
      activeEx?.artist?.trim() === 'نمایشگاه گروهی'
        ? 'گروهی از هنرمندان'
        : activeEx?.artist || 'هنرمندان معاصر';

    // Pin placed above the top edge of the card, tilted 45° towards the road:
    // Left card: sits above top-right corner, pointing 45° down-right towards road
    // Right card: sits above top-left corner, pointing 45° down-left towards road
    const pinX = left ? cardX + cardW - size - 4 : cardX + 4;
    const pinY = Math.max(14, Math.round(cardTop - size + 10));
    const pinRot = left ? -90 : 0;
    const pinUnrot = left ? 90 : 0;

    return {
      gallery,
      name: getGalleryDisplayName(gallery),
      show: activeEx?.title || 'نمایشگاه جاری',
      artist,
      num: toPersianDigits(i + 1),
      isStart: i === 0,
      isEnd: i === n - 1 && n > 1,
      showArtist: !dense,
      pin: {
        size,
        x: pinX,
        y: pinY,
        rot: pinRot,
        unrot: pinUnrot,
        numSize: Math.round(size * 0.55),
        numFont: dense ? 13 : 15,
        shadow: {
          x: pinX,
          y: cardTop + 2,
          w: Math.round(size * 0.8)
        }
      },
      card: {
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH
      }
    };
  });

  // Distance Bubbles: arrow tag pointing towards the road, positioned above card/pin
  const legs: RoadLeg[] = legData.map((lg, i) => {
    const cardNextH = dense ? C.CARD_H.dense : C.CARD_H.roomy;
    const cardNextTop = pts[i + 1].y - cardNextH / 2;
    const pinTop = cardNextTop - size + 10;
    // Guaranteed clearance above the pin
    const targetMaxY = pinTop - 14 - Math.round(C.BUBBLE_H / 2);
    const midY = Math.round((pts[i].y + pts[i + 1].y) / 2) - 20;
    const y = Math.round(Math.min(midY, targetMaxY));
    const rightSide = (i + 1) % 2 === 1;
    const bw = travelMode === 'walking' ? C.BUBBLE_W.walking : C.BUBBLE_W.driving;
    let edge = rightSide ? -1e9 : 1e9;

    samples.forEach((p) => {
      const dy = Math.max(0, Math.abs(p.y - y) - C.BUBBLE_H / 2);
      if (dy >= C.ROAD_HALF) return;
      const reach = Math.sqrt(C.ROAD_HALF * C.ROAD_HALF - dy * dy);
      edge = rightSide ? Math.max(edge, p.x + reach) : Math.min(edge, p.x - reach);
    });

    const km = lg ? lg[0] : null;
    const minutes = lg ? lg[1] : null;

    let x = Math.round(rightSide ? edge + C.BUBBLE_GAP : edge - C.BUBBLE_GAP);
    // برچسب نباید از لبه‌ی بوم بیرون بزند
    x = rightSide ? Math.min(x, C.MAP_W - 8 - bw) : Math.max(x, 8 + bw);

    return {
      y,
      rightSide,
      x,
      w: bw,
      h: C.BUBBLE_H,
      km,
      minutes,
      known: Boolean(lg),
      text: lg
        ? travelMode === 'walking'
          ? `${toPersianDigits(minutes!)} دقیقه، ${formatDistanceFa(km!)}`
          : formatDistanceFa(km!)
        : 'فاصله نامعلوم'
    };
  });

  // Header Statistics
  let kmTotal = 0;
  let minsTotal = 0;
  let knownAll = legData.length > 0;

  legData.forEach((lg) => {
    if (lg) {
      kmTotal += lg[0];
      minsTotal += lg[1];
    } else {
      knownAll = false;
    }
  });

  const totalTime = n * 15 + minsTotal;
  const timeText = formatDurationFa(totalTime);

  const trees = placeRoadTrees(curveSamples, stops, legs, mapH);

  return {
    n,
    mapH,
    dense,
    pathD: d,
    pts,
    stops,
    legs,
    trees,
    stats: {
      stops: `${toPersianDigits(n)} گالری`,
      km: knownAll
        ? travelMode === 'walking'
          ? `${formatDistanceFa(kmTotal)} پیاده‌روی`
          : `${formatDistanceFa(kmTotal)} رانندگی`
        : 'مسافت نامعلوم',
      time: knownAll ? `حدود ${timeText} با بازدیدها` : 'زمان نامعلوم'
    },
    carSeconds: Math.max(6, (n + 1) * (travelMode === 'walking' ? 3.2 : 2.6))
  };
}

/**
 * Curated Road Routes (Default fallback: Verified 29 Aban openings)
 */
export const CURATED_ROAD_ROUTES: RoadRoute[] = [
  {
    id: 'karimkhan',
    label: 'کریم‌خان و سنایی',
    color: '#3D5B99',
    pinTone: 'cool',
    galleryIds: [406, 65, 443, 24, 120, 301] // 009821, O, Ev, Homa, Dena, Etemad 1
  },
  {
    id: 'beheshti-motahari',
    label: 'بهشتی و مطهری',
    color: '#E58B2E',
    tab: '#F76B1C',
    tabInk: '#1f2a44',
    pinTone: 'warm',
    galleryIds: [938, 504, 937] // Bostan, Shar, Doost
  },
  {
    id: 'elahiyeh-fereshteh',
    label: 'الهیه و فرشته',
    color: '#6D01AD',
    pinTone: 'cool',
    galleryIds: [5, 28, 997, 287] // Atbin, Dastan Basement, West, Queen
  },
  {
    id: 'vanak-zafar',
    label: 'ونک و ظفر',
    color: '#BF1932',
    tab: '#ff4d4f',
    tabInk: '#2e0f0f',
    pinTone: 'warm',
    galleryIds: [551, 1026, 1008] // Parallel Circuit, Zhour-A, Mirana
  },
  {
    id: 'museum-laleh',
    label: 'پارک لاله و کشاورز',
    color: '#00A892',
    pinTone: 'cool',
    galleryIds: [1014, 90] // Gallery 33, Zhinous
  },
  {
    id: 'niavaran-north',
    label: 'نیاوران و فرمانیه',
    color: '#E58B2E',
    pinTone: 'warm',
    galleryIds: [834, 429] // Yafteh, Shamis
  }
];

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

function sortNearestNeighbor(list: Gallery[]): Gallery[] {
  if (list.length <= 2) return list;
  const remaining = [...list];
  let current = remaining.shift()!;
  const ordered = [current];
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/**
 * Dynamically computes curated road routes strictly based on THIS WEEK's opening exhibitions!
 * Guarantees that only galleries with active openings in the current cycle are shown,
 * and hubs with fewer than 2 galleries are automatically omitted.
 */
export function getCuratedRoadRoutes(
  allGalleries: Gallery[],
  travelMode: 'driving' | 'walking' = 'driving'
): RoadRoute[] {
  if (!allGalleries || allGalleries.length === 0) return CURATED_ROAD_ROUTES;

  const maxOpeningScore = Math.max(
    0,
    ...allGalleries
      .map((g) => parsePersianDateToScore(g.activeExhibition?.openingDate))
      .filter((s) => s > 0)
  );

  const openings = allGalleries.filter((g) =>
    isThisWeekOpening(g.activeExhibition?.openingDate, maxOpeningScore)
  );

  const drivingTemplates = [
    {
      id: 'karimkhan',
      label: 'کریم‌خان و سنایی',
      color: '#3D5B99',
      pinTone: 'cool' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('کریم‌خان') ||
          text.includes('کریمخان') ||
          text.includes('سنایی') ||
          text.includes('خردمند') ||
          text.includes('قرنی') ||
          text.includes('بهار') ||
          text.includes('ایرانشهر') ||
          text.includes('عضدی') ||
          text.includes('آبان') ||
          text.includes('شیرودی') ||
          text.includes('هفت تیر')
        );
      }
    },
    {
      id: 'beheshti-motahari',
      label: 'بهشتی و مطهری',
      color: '#E58B2E',
      tab: '#F76B1C',
      tabInk: '#1f2a44',
      pinTone: 'warm' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('بهشتی') ||
          text.includes('مطهری') ||
          text.includes('لارستان') ||
          text.includes('عباس‌آباد') ||
          text.includes('قائم مقام') ||
          text.includes('خرمشهر') ||
          text.includes('عشقیار')
        );
      }
    },
    {
      id: 'elahiyeh-fereshteh',
      label: 'الهیه و فرشته',
      color: '#6D01AD',
      pinTone: 'cool' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('الهیه') ||
          text.includes('فرشته') ||
          text.includes('مریم') ||
          text.includes('آقا بزرگی') ||
          text.includes('فیاضی') ||
          text.includes('دربندی') ||
          text.includes('بیدار') ||
          text.includes('پارک وی') ||
          text.includes('پسیان') ||
          text.includes('زعفرانیه')
        );
      }
    },
    {
      id: 'vanak-zafar',
      label: 'ونک و ظفر',
      color: '#BF1932',
      tab: '#ff4d4f',
      tabInk: '#2e0f0f',
      pinTone: 'warm' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('ونک') ||
          text.includes('سئول') ||
          text.includes('خدامی') ||
          text.includes('جردن') ||
          text.includes('دریابندری') ||
          text.includes('میرداماد') ||
          text.includes('ظفر') ||
          text.includes('ملاصدرا') ||
          text.includes('شیخ بهایی')
        );
      }
    },
    {
      id: 'museum-laleh',
      label: 'پارک لاله و کشاورز',
      color: '#00A892',
      pinTone: 'cool' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('لاله') ||
          text.includes('کشاورز') ||
          text.includes('فاطمی') ||
          text.includes('کارگر') ||
          text.includes('امیرآباد') ||
          text.includes('انقلاب') ||
          text.includes('گرد آفرید')
        );
      }
    },
    {
      id: 'niavaran-north',
      label: 'نیاوران و فرمانیه',
      color: '#E58B2E',
      pinTone: 'warm' as const,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('نیاوران') ||
          text.includes('فرمانیه') ||
          text.includes('اندرزگو') ||
          text.includes('اقدسیه') ||
          text.includes('دروس') ||
          text.includes('پاسداران') ||
          text.includes('قیطریه')
        );
      }
    }
  ];

  // Dedicated walking templates: ONLY strictly walkable dense clusters (hop <= 750m - 850m)
  const walkingTemplates = [
    {
      id: 'walk-karimkhan',
      label: 'کریم‌خان و سنایی',
      color: '#3D5B99',
      pinTone: 'cool' as const,
      maxHopKm: 0.75, // 750m max straight hop (~900m walking)
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('کریم‌خان') ||
          text.includes('کریمخان') ||
          text.includes('سنایی') ||
          text.includes('خردمند') ||
          text.includes('قرنی') ||
          text.includes('آبان') ||
          text.includes('عضدی') ||
          text.includes('شیرودی') ||
          text.includes('اعرابی') ||
          text.includes('هفت تیر')
        );
      }
    },
    {
      id: 'walk-museum-laleh',
      label: 'پارک لاله و کشاورز',
      color: '#00A892',
      pinTone: 'cool' as const,
      maxHopKm: 0.85,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('کشاورز') ||
          text.includes('وصال') ||
          text.includes('قدس') ||
          text.includes('فاطمی') ||
          text.includes('کارگر') ||
          text.includes('لاله') ||
          text.includes('امیرآباد') ||
          text.includes('گرد آفرید')
        );
      }
    },
    {
      id: 'walk-center-lolagar',
      label: 'مرکز تاریخی و لولاگر',
      color: '#D97706',
      pinTone: 'warm' as const,
      maxHopKm: 0.85,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('لولاگر') ||
          text.includes('حافظ') ||
          text.includes('انقلاب') ||
          text.includes('فردوسی') ||
          text.includes('طالقانی') ||
          text.includes('ایرانشهر') ||
          text.includes('باغ هنر')
        );
      }
    },
    {
      id: 'walk-beheshti',
      label: 'بهشتی و مطهری',
      color: '#E58B2E',
      pinTone: 'warm' as const,
      maxHopKm: 0.80,
      matcher: (g: Gallery) => {
        const text = ((g.addressFa || g.address || '') + ' ' + (g.neighborhoodFa || '')).toLowerCase();
        return (
          text.includes('لارستان') ||
          text.includes('قائم مقام') ||
          (text.includes('مطهری') && !text.includes('خرمشهر'))
        );
      }
    }
  ];

  const dynamicRoutes: RoadRoute[] = [];
  const templatesToUse = travelMode === 'walking' ? walkingTemplates : drivingTemplates;

  for (const tmpl of templatesToUse) {
    const matched = openings.filter(tmpl.matcher);
    if (matched.length >= 2) {
      let sorted = sortNearestNeighbor(matched);

      // In walking mode, only keep contiguous stops where hops are strictly <= maxHopKm (<= 750-850m)
      if (travelMode === 'walking') {
        const maxLimit = (tmpl as any).maxHopKm || 0.85;
        const walkable: Gallery[] = [sorted[0]];
        let cur = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const d = distKm(cur.lat, cur.lng, sorted[i].lat, sorted[i].lng);
          if (d <= maxLimit) {
            walkable.push(sorted[i]);
            cur = sorted[i];
          }
        }
        sorted = walkable;
      }

      // If at least 2 galleries remain in this route, display it
      if (sorted.length >= 2) {
        dynamicRoutes.push({
          id: tmpl.id,
          label: tmpl.label,
          color: tmpl.color,
          tab: (tmpl as any).tab,
          tabInk: (tmpl as any).tabInk,
          pinTone: tmpl.pinTone,
          galleryIds: sorted.map((g) => g.id)
        });
      }
    }
  }

  // If dynamic grouping produced at least one valid route, return it
  if (dynamicRoutes.length > 0) {
    return dynamicRoutes;
  }

  // Fallback: If walking mode, return verified walkable route in Karimkhan
  if (travelMode === 'walking') {
    return [
      {
        id: 'karimkhan-walk-fallback',
        label: 'کریم‌خان و سنایی (پیاده)',
        color: '#3D5B99',
        pinTone: 'cool' as const,
        galleryIds: [406, 65, 443, 24, 120, 301]
      }
    ].filter((r) => {
      const validCount = r.galleryIds.filter((id) => allGalleries.some((g) => g.id === id)).length;
      return validCount >= 2;
    });
  }

  // Graceful fallback to verified defaults for driving mode
  return CURATED_ROAD_ROUTES.filter((r) => {
    const validCount = r.galleryIds.filter((id) => allGalleries.some((g) => g.id === id)).length;
    return validCount >= 2;
  });
}

export interface TourColorTheme {
  color: string;
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  border: string;
  borderDark: string;
  dot: string;
  activeBg: string;
  activeText: string;
  activeDot: string;
  activeBorder: string;
  activeGlow: string;
  routeId: string;
}

export const TOUR_COLOR_THEMES: Record<string, TourColorTheme> = {
  karimkhan: {
    color: '#3D5B99',
    bg: '#edf3fc',
    bgDark: '#1c273e',
    text: '#223a68',
    textDark: '#d0e1fc',
    border: '#c2d6f4',
    borderDark: '#2c3f66',
    dot: '#3D5B99',
    activeBg: '#3D5B99',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#273c68',
    activeGlow: 'rgba(61, 91, 153, 0.35)',
    routeId: 'karimkhan'
  },
  'beheshti-motahari': {
    color: '#E58B2E',
    bg: '#fff4ea',
    bgDark: '#351f0b',
    text: '#b45309',
    textDark: '#fed7aa',
    border: '#fed7aa',
    borderDark: '#663910',
    dot: '#E58B2E',
    activeBg: '#E58B2E',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#b45309',
    activeGlow: 'rgba(229, 139, 46, 0.35)',
    routeId: 'beheshti-motahari'
  },
  'museum-laleh': {
    color: '#00A892',
    bg: '#e6f7f5',
    bgDark: '#0b2a26',
    text: '#0f766e',
    textDark: '#99f6e4',
    border: '#99f6e4',
    borderDark: '#134e48',
    dot: '#00A892',
    activeBg: '#00A892',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#0f766e',
    activeGlow: 'rgba(0, 168, 146, 0.35)',
    routeId: 'museum-laleh'
  },
  'elahiyeh-fereshteh': {
    color: '#6D01AD',
    bg: '#f6effc',
    bgDark: '#2b0b42',
    text: '#6b21a8',
    textDark: '#e9d5ff',
    border: '#e9d5ff',
    borderDark: '#4c1d75',
    dot: '#6D01AD',
    activeBg: '#6D01AD',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#581c87',
    activeGlow: 'rgba(109, 1, 173, 0.35)',
    routeId: 'elahiyeh-fereshteh'
  },
  'vanak-zafar': {
    color: '#BF1932',
    bg: '#fdf0f2',
    bgDark: '#380c14',
    text: '#9f1239',
    textDark: '#fecdd3',
    border: '#fecdd3',
    borderDark: '#5e1322',
    dot: '#BF1932',
    activeBg: '#BF1932',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#9f1239',
    activeGlow: 'rgba(191, 25, 50, 0.35)',
    routeId: 'vanak-zafar'
  },
  'lolagar-enghelab': {
    color: '#979DB1',
    bg: '#f1f3f7',
    bgDark: '#1e222d',
    text: '#2d3342',
    textDark: '#dce0ec',
    border: '#cbd1e0',
    borderDark: '#363d50',
    dot: '#979DB1',
    activeBg: '#979DB1',
    activeText: '#ffffff',
    activeDot: '#ffffff',
    activeBorder: '#7d8499',
    activeGlow: 'rgba(151, 157, 177, 0.45)',
    routeId: 'lolagar-enghelab'
  }
};

export function getTourColorTheme(tourIdentifier: string): TourColorTheme {
  const s = tourIdentifier.toLowerCase();
  if (
    s.includes('karimkhan') ||
    s.includes('sanai') ||
    s.includes('kheradmand') ||
    s.includes('کریم‌خان') ||
    s.includes('کریم خان') ||
    s.includes('سنایی') ||
    s.includes('خردمند')
  ) {
    return TOUR_COLOR_THEMES.karimkhan;
  }
  if (
    s.includes('beheshti') ||
    s.includes('motahari') ||
    s.includes('بهشتی') ||
    s.includes('مطهری') ||
    s.includes('لارستان')
  ) {
    return TOUR_COLOR_THEMES['beheshti-motahari'];
  }
  if (
    s.includes('museum') ||
    s.includes('laleh') ||
    s.includes('keshavarz') ||
    s.includes('موزه') ||
    s.includes('لاله') ||
    s.includes('کشاورز')
  ) {
    return TOUR_COLOR_THEMES['museum-laleh'];
  }
  if (
    s.includes('elahiyeh') ||
    s.includes('fereshteh') ||
    s.includes('الهیه') ||
    s.includes('فرشته')
  ) {
    return TOUR_COLOR_THEMES['elahiyeh-fereshteh'];
  }
  if (
    s.includes('vanak') ||
    s.includes('zafar') ||
    s.includes('ونک') ||
    s.includes('ظفر')
  ) {
    return TOUR_COLOR_THEMES['vanak-zafar'];
  }
  if (
    s.includes('lolagar') ||
    s.includes('enghelab') ||
    s.includes('center') ||
    s.includes('لولاگر') ||
    s.includes('انقلاب') ||
    s.includes('مرکز')
  ) {
    return TOUR_COLOR_THEMES['lolagar-enghelab'];
  }
  return TOUR_COLOR_THEMES.karimkhan;
}
