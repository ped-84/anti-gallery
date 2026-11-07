import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from './persianUtils';

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
  km: number | null;
  minutes: number | null;
  known: boolean;
  text: string;
}

export interface RoadLayoutResult {
  n: number;
  mapH: number;
  dense: boolean;
  pathD: string;
  pts: Array<{ x: number; y: number }>;
  stops: RoadStop[];
  legs: RoadLeg[];
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
export const ROAD_CONSTANTS = {
  MAP_W: 560,
  PAD_TOP: 72,
  PAD_BOTTOM: 72,
  MAX_H: 840,
  MAX_SPACING: 170,
  DENSE_BELOW: 150,
  LANE_L: 245,
  LANE_R: 315,
  ROAD_HALF: 27,
  PIN_GAP: 16,
  CARD_W: 134,
  CARD_H: { roomy: 124, dense: 100 },
  PIN: { roomy: 40, dense: 34 },
  BUBBLE_H: 26,
  BUBBLE_GAP: 24,
  CAR_OVERRUN: 24
};

/**
 * Turns route & galleries into an exact layout for the winding road map.
 */
export function computeRoadLayout(
  route: RoadRoute,
  allGalleries: Gallery[]
): RoadLayoutResult {
  const C = ROAD_CONSTANTS;

  // Resolve Gallery objects in visiting order
  const resolvedGalleries: Gallery[] = route.galleryIds
    .map((id) => allGalleries.find((g) => g.id === id))
    .filter((g): g is Gallery => Boolean(g));

  const n = resolvedGalleries.length;

  // Real Driving/Walking Legs (km + minutes)
  const legData: Array<[number, number] | null> = [];
  for (let i = 0; i < n - 1; i++) {
    const a = resolvedGalleries[i];
    const b = resolvedGalleries[i + 1];
    if (a && b) {
      // Direct haversine distance with 1.25 urban street factor
      const straight = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const urbanKm = parseFloat((straight * 1.25).toFixed(2));
      const mins = Math.max(2, Math.round(urbanKm * 4 + 2));
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

  pts.forEach((p) => samples.push({ x: p.x, y: p.y }));
  if (pts.length > 0) {
    samples.push({ x: pts[0].x, y: 0 });
    samples.push({ x: pts[n - 1].x, y: mapH });
    d += ' L ' + pts[n - 1].x + ' ' + (mapH + C.CAR_OVERRUN);
  }

  // Pins + Gallery Cards
  const stops: RoadStop[] = resolvedGalleries.map((gallery, i) => {
    const p = pts[i];
    const left = i % 2 === 0;
    const cx = left ? p.x - off : p.x + off;
    const activeEx = gallery.activeExhibition;
    const artist = activeEx?.artist?.trim() === 'نمایشگاه گروهی' ? 'گروهی از هنرمندان' : (activeEx?.artist || 'هنرمندان معاصر');

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
        x: cx - size / 2,
        y: p.y - size / 2,
        rot: left ? -135 : 45,
        unrot: left ? 135 : -45,
        numSize: Math.round(size * 0.55),
        numFont: dense ? 11 : 12,
        shadow: {
          x: cx - Math.round(size * 0.4),
          y: p.y + Math.round(size / 2) + 2,
          w: Math.round(size * 0.8)
        }
      },
      card: {
        x: left ? 12 : Math.round(C.LANE_R + off + size / 2 + 10),
        y: p.y,
        w: C.CARD_W,
        h: dense ? C.CARD_H.dense : C.CARD_H.roomy
      }
    };
  });

  // Distance Bubbles
  const legs: RoadLeg[] = legData.map((lg, i) => {
    const y = Math.round((pts[i].y + pts[i + 1].y) / 2);
    const rightSide = (i + 1) % 2 === 1;
    let edge = rightSide ? -1e9 : 1e9;

    samples.forEach((p) => {
      const dy = Math.max(0, Math.abs(p.y - y) - C.BUBBLE_H / 2);
      if (dy >= C.ROAD_HALF) return;
      const reach = Math.sqrt(C.ROAD_HALF * C.ROAD_HALF - dy * dy);
      edge = rightSide ? Math.max(edge, p.x + reach) : Math.min(edge, p.x - reach);
    });

    const km = lg ? lg[0] : null;
    const minutes = lg ? lg[1] : null;

    return {
      y,
      rightSide,
      x: Math.round(rightSide ? edge + C.BUBBLE_GAP : edge - C.BUBBLE_GAP),
      km,
      minutes,
      known: Boolean(lg),
      text: lg
        ? dense
          ? `${toPersianDigits(km!)} کیلومتر`
          : `${toPersianDigits(km!)} کیلومتر · ~${toPersianDigits(minutes!)} دقیقه`
        : '[فاصله]'
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
  const h = Math.floor(totalTime / 60);
  const m = totalTime % 60;
  const timeText = (h ? `${toPersianDigits(h)} ساعت${m ? ' و ' : ''}` : '') + (m ? `${toPersianDigits(m)} دقیقه` : '');

  return {
    n,
    mapH,
    dense,
    pathD: d,
    pts,
    stops,
    legs,
    stats: {
      stops: `${toPersianDigits(n)} گالری`,
      km: knownAll ? `${toPersianDigits(kmTotal.toFixed(2))} کیلومتر` : '[مسافت]',
      time: knownAll ? `حدود ${timeText}` : '[زمان کل]'
    },
    carSeconds: Math.max(6, (n + 1) * 2.6)
  };
}

/**
 * 6 Curated Master Routes for Tehran
 */
export const CURATED_ROAD_ROUTES: RoadRoute[] = [
  {
    id: 'karimkhan',
    label: 'معاصر کریم‌خان',
    color: '#3D5B99',
    pinTone: 'cool',
    galleryIds: [65, 18, 1003, 952, 443, 24] // O, Shirin, Karshio, Bashgah, Ev, Homa (6 stops)
  },
  {
    id: 'beheshti-motahari',
    label: 'بهشتی و مطهری',
    color: '#E58B2E',
    tab: '#F76B1C',
    tabInk: '#1f2a44',
    pinTone: 'warm',
    galleryIds: [8, 467, 25, 938] // Arya, Asr, Hoor, Boostan (4 stops)
  },
  {
    id: 'museum-laleh',
    label: 'موزه معاصر و پارک لاله',
    color: '#00A892',
    pinTone: 'cool',
    galleryIds: [1014, 263, 43] // 33, TMoCA, Laleh (3 stops)
  },
  {
    id: 'elahiyeh-fereshteh',
    label: 'الهیه و فرشته',
    color: '#6D01AD',
    pinTone: 'cool',
    galleryIds: [1005, 1023, 28, 225] // Kyman, Dastan +2, Basement, Did (4 stops)
  },
  {
    id: 'vanak-zafar',
    label: 'ونک و ظفر',
    color: '#BF1932',
    pinTone: 'warm',
    galleryIds: [26, 551, 1026] // Vali, Parallel Circuit, Zhour-A (3 stops)
  },
  {
    id: 'lolagar-enghelab',
    label: 'تاریخی لولاگر و مرکز',
    color: '#979DB1',
    tab: '#979DB1',
    tabInk: '#ffffff',
    pinTone: 'cool',
    galleryIds: [1020, 405, 487, 196] // Aartmaart, In/Ja, Soo, Iranshahr (4 stops)
  }
];

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
    s.includes('موزه') ||
    s.includes('لاله')
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
