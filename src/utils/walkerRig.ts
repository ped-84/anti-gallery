/**
 * کاراکتر پیاده‌روی نقشه‌ی گشت‌ها (نمای از بالا) — بدون وابستگی به React.
 *
 * دختری با ژاکت نارنجی، جین و کتانی صورتی که روی جاده راه می‌رود:
 * - کاراکتر رو به +x ساخته می‌شود و جهت فقط با یک transform روی root عوض می‌شود.
 * - گام به مسافت وصل است (نه زمان)، پس پاها روی زمین سر نمی‌خورند.
 * - جهت با کمی پیش‌دستی و هموارسازی نمایی دنبال پیچ‌ها می‌رود.
 * - دم‌اسبی با فنر و میرایی شبیه‌سازی می‌شود.
 * - روی المان متحرک هیچ filter یا انیمیشن CSS نیست (علت صفحه‌ی سفید v1.163).
 */

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const RAD2DEG = 180 / Math.PI;

const SKIN = '#f3c2a8';
const JEANS = '#4a7fb8';
const SHOE = '#f08aa6';
const HAIR = '#a8622f';

const STRIDE = 9.2; // دامنه‌ی حرکت پا
const ARM = 6.6; // دامنه‌ی حرکت دست

// دم‌اسبی: زنجیره‌ی چهار تکه با فنر و میرایی، در قاب مختصات سر
const HAIR_BASE = -3.0;
const HAIR_SEG = 2.9;
const HAIR_W = [2.4, 3.6, 3.3, 2.4, 1.1];
const HAIR_K = [55, 42, 34, 28];
const HAIR_C = [6.5, 5.5, 4.8, 4.2];

const SHIRT_ID = 'agw-shirt';
const HAIR_ID = 'agw-hair';

type Attrs = Record<string, string | number>;
type Pt = [number, number];

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const f2 = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

/** منحنی نرم از میان نقاط (درجه‌ی دو، با نقطه‌های میانی) */
function smooth(pts: Pt[], first: boolean): string {
  let d = first ? `M${f2(pts[0])}` : '';
  for (let i = 1; i < pts.length - 1; i++) {
    const m: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    d += ` Q${f2(pts[i])} ${f2(m)}`;
  }
  return `${d} L${f2(pts[pts.length - 1])}`;
}

function ensureDefs(svg: SVGSVGElement) {
  if (svg.querySelector(`#${SHIRT_ID}`)) return;
  const defs = el('defs', {}, svg);
  const shirt = el('linearGradient', { id: SHIRT_ID, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffa76a' }, shirt);
  el('stop', { offset: 0.5, 'stop-color': '#F76B1C' }, shirt);
  el('stop', { offset: 1, 'stop-color': '#d4520c' }, shirt);
  const hair = el('radialGradient', { id: HAIR_ID, cx: 0.4, cy: 0.35, r: 0.8 }, defs);
  el('stop', { offset: 0, 'stop-color': '#d49a60' }, hair);
  el('stop', { offset: 1, 'stop-color': '#9a5628' }, hair);
}

// کفش کتانی از بالا: زیره‌ی سفید، روکش صورتی، نوک روشن‌تر، پاشنه‌ی تیره‌تر و بند
const SOLE =
  'M-3.2 0 C-3.2 -1.3 -2 -1.7 -0.5 -1.6 C0.9 -1.5 2.1 -1.8 3.0 -1.0 C3.7 -0.5 3.7 0.5 3.0 1.0 C2.1 1.8 0.9 1.5 -0.5 1.6 C-2 1.7 -3.2 1.3 -3.2 0 Z';

function makeShoe(parent: Element) {
  const g = el('g', {}, parent);
  el('path', { d: SOLE, fill: '#ffffff', stroke: '#c9d1e2', 'stroke-width': 0.45 }, g);
  const up = el('g', { transform: 'scale(0.84 0.68)' }, g);
  el('path', { d: SOLE, fill: SHOE }, up);
  el('ellipse', { cx: 2.2, cy: 0, rx: 1.15, ry: 1.0, fill: '#f9c3d2' }, up);
  el('ellipse', { cx: -2.3, cy: 0, rx: 0.8, ry: 1.0, fill: '#d96488' }, up);
  [-0.5, 0.2, 0.9].forEach((x) => {
    el(
      'line',
      { x1: x, y1: -0.65, x2: x, y2: 0.65, stroke: '#ffffff', 'stroke-width': 0.35, 'stroke-linecap': 'round', opacity: 0.95 },
      g
    );
  });
  return g;
}

interface Leg {
  side: number;
  thigh: SVGLineElement;
  shoe: SVGGElement;
}
interface Arm {
  side: number;
  sleeve: SVGLineElement;
  fore: SVGLineElement;
  hand: SVGCircleElement;
}
interface HairState {
  a: number[];
  v: number[];
  prev: number | null;
  path: SVGPathElement;
  hi: SVGPathElement;
}
interface Walker {
  root: SVGGElement;
  body: SVGGElement;
  hips: SVGGElement;
  torso: SVGGElement;
  head: SVGGElement;
  legs: Leg[];
  arms: Arm[];
  hair: HairState;
}

function createWalker(parent: Element): Walker {
  const root = el('g', {}, parent);
  // هاله‌ی روشن تا روی جاده‌ی تیره دیده شود (سایه داخل SVG، بدون filter)
  el('ellipse', { cx: 0.8, cy: 0.6, rx: 11, ry: 9, fill: '#ffffff', opacity: 0.3 }, root);

  const body = el('g', {}, root);

  const hips = el('g', {}, body);
  const legs: Leg[] = [1, -1].map((side) => {
    const g = el('g', {}, hips);
    return {
      side,
      thigh: el('line', { stroke: JEANS, 'stroke-width': 4.4, 'stroke-linecap': 'round' }, g),
      shoe: makeShoe(g)
    };
  });

  const torso = el('g', {}, body);
  const arms: Arm[] = [1, -1].map((side) => {
    const g = el('g', {}, torso);
    return {
      side,
      sleeve: el('line', { stroke: '#F76B1C', 'stroke-width': 4.4, 'stroke-linecap': 'round' }, g),
      fore: el('line', { stroke: SKIN, 'stroke-width': 2.8, 'stroke-linecap': 'round' }, g),
      hand: el('circle', { r: 2, fill: SKIN }, g)
    };
  });
  el('rect', { x: -4.4, y: -7.2, width: 8.8, height: 14.4, rx: 4.2, fill: `url(#${SHIRT_ID})` }, torso);
  el(
    'path',
    { d: 'M-3.4 -5.2 Q0 -7.8 3.4 -5.2', fill: 'none', stroke: 'rgba(255,255,255,.5)', 'stroke-width': 1.1, 'stroke-linecap': 'round' },
    torso
  );
  el('line', { x1: 0, y1: -6.6, x2: 0, y2: 6.6, stroke: '#c4490a', 'stroke-width': 0.7, opacity: 0.45 }, torso);

  const head = el('g', {}, body);
  const tail = el('path', { fill: HAIR, stroke: HAIR, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, head);
  const tailHi = el(
    'path',
    { fill: 'none', stroke: '#f0c590', 'stroke-width': 0.7, 'stroke-linecap': 'round', opacity: 0.4 },
    head
  );
  el('ellipse', { cx: 0.3, cy: -3.6, rx: 0.9, ry: 1.3, fill: SKIN }, head);
  el('ellipse', { cx: 0.3, cy: 3.6, rx: 0.9, ry: 1.3, fill: SKIN }, head);
  el('ellipse', { cx: 2.9, cy: 0, rx: 2.0, ry: 2.7, fill: SKIN }, head);
  el('ellipse', { cx: 0.3, cy: 0, rx: 4.1, ry: 3.6, fill: `url(#${HAIR_ID})` }, head);
  el(
    'path',
    { d: 'M2.0 -2.6 Q-0.8 -2.8 -3.0 -0.6', fill: 'none', stroke: '#8a4a22', 'stroke-width': 0.55, opacity: 0.35, 'stroke-linecap': 'round' },
    head
  );
  el(
    'path',
    { d: 'M2.0 2.6 Q-0.8 2.8 -3.0 0.6', fill: 'none', stroke: '#8a4a22', 'stroke-width': 0.55, opacity: 0.35, 'stroke-linecap': 'round' },
    head
  );
  el('ellipse', { cx: -0.6, cy: -1.3, rx: 1.9, ry: 0.8, fill: '#fff', opacity: 0.1 }, head);
  el('ellipse', { cx: HAIR_BASE - 0.2, cy: 0, rx: 0.7, ry: 1.7, fill: '#7a3f1c' }, head); // کش مو

  return {
    root,
    body,
    hips,
    torso,
    head,
    legs,
    arms,
    hair: { a: [0, 0, 0, 0], v: [0, 0, 0, 0], prev: null, path: tail, hi: tailHi }
  };
}

function updateHair(w: Walker, dt: number, headWorld: number, phase: number, amp: number) {
  const h = w.hair;
  const dH = h.prev === null ? 0 : clamp(wrap(headWorld - h.prev), -0.5, 0.5);
  h.prev = headWorld;

  if (dt > 0) {
    // وقتی سر می‌چرخد، دم‌اسبی جا می‌ماند و نسبت به سر عقب می‌افتد
    h.a[0] -= dH * 0.9;
    h.a[1] -= dH * 0.35;
    h.a[2] -= dH * 0.25;
    h.a[3] -= dH * 0.2;
    // تاب نرم با هر قدم؛ فاز هر تکه کمی عقب‌تر است تا موج در طول دم‌اسبی برود
    const sub = 2;
    const d = dt / sub;
    for (let n = 0; n < sub; n++) {
      for (let i = 0; i < 4; i++) {
        const tgt = 0.5 * amp * Math.sin(phase + 0.7 - 1.1 * i);
        const acc = -HAIR_K[i] * (h.a[i] - tgt) - HAIR_C[i] * h.v[i];
        h.v[i] += acc * d;
        h.a[i] = clamp(h.a[i] + h.v[i] * d, -0.95, 0.95);
      }
    }
  }

  const px = [HAIR_BASE];
  const py = [0];
  let th = Math.PI;
  for (let i = 0; i < 4; i++) {
    th += h.a[i];
    px.push(px[i] + HAIR_SEG * Math.cos(th));
    py.push(py[i] + HAIR_SEG * Math.sin(th));
  }
  const Lp: Pt[] = [];
  const Rp: Pt[] = [];
  const Mp: Pt[] = [];
  for (let i = 0; i < 5; i++) {
    const a0 = Math.max(0, i - 1);
    const a1 = Math.min(4, i + 1);
    const tx = px[a1] - px[a0];
    const ty = py[a1] - py[a0];
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const hw = HAIR_W[i] / 2;
    Lp.push([px[i] + nx * hw, py[i] + ny * hw]);
    Rp.push([px[i] - nx * hw, py[i] - ny * hw]);
    Mp.push([px[i] + nx * hw * 0.35, py[i] + ny * hw * 0.35]);
  }
  const Rr = Rp.slice().reverse();
  h.path.setAttribute('d', `${smooth(Lp, true)} L${f2(Rr[0])}${smooth(Rr, false)} Z`);
  h.hi.setAttribute('d', smooth(Mp.slice(0, 4), true));
}

function pose(w: Walker, phase: number, amp: number, lead: number, dt: number, rootHeading: number) {
  const sp = Math.sin(phase);
  const cp = Math.cos(phase);
  const leadDeg = lead * RAD2DEG;

  // پاها: جلو/عقب روی محور راه رفتن؛ پای در حال حرکت به جلو کمی بالاتر
  w.legs.forEach((L, i) => {
    const sgn = i === 0 ? 1 : -1;
    const fx = STRIDE * amp * sp * sgn;
    const lift = Math.max(0, cp * sgn) * amp;
    const hipY = L.side * 3.2;
    const footY = L.side * 3.7;
    L.thigh.setAttribute('x1', '0.5');
    L.thigh.setAttribute('y1', String(hipY));
    L.thigh.setAttribute('x2', (fx * 0.9).toFixed(2));
    L.thigh.setAttribute('y2', String(footY));
    L.thigh.setAttribute('stroke-width', (4.4 + 1.1 * lift).toFixed(2));
    const sc = (1 + 0.16 * lift).toFixed(3);
    L.shoe.setAttribute('transform', `translate(${(fx + 1.2).toFixed(2)} ${footY}) scale(${sc})`);
  });

  // دست‌ها: خلاف پای هم‌طرف
  w.arms.forEach((a, i) => {
    const sgn = i === 0 ? -1 : 1;
    const hx = ARM * amp * sp * sgn;
    const sx = 0.2;
    const sy = a.side * 6.9;
    const hy = a.side * 9.2;
    const mx = (sx + hx) / 2;
    const my = a.side * 8.2;
    const qx = (sx + mx) / 2;
    const qy = (sy + my) / 2;
    a.sleeve.setAttribute('x1', String(sx));
    a.sleeve.setAttribute('y1', String(sy));
    a.sleeve.setAttribute('x2', qx.toFixed(2));
    a.sleeve.setAttribute('y2', qy.toFixed(2));
    a.fore.setAttribute('x1', qx.toFixed(2));
    a.fore.setAttribute('y1', qy.toFixed(2));
    a.fore.setAttribute('x2', hx.toFixed(2));
    a.fore.setAttribute('y2', String(hy));
    a.hand.setAttribute('cx', hx.toFixed(2));
    a.hand.setAttribute('cy', String(hy));
  });

  // لگن، شانه و سر
  const hipRot = -2.6 * sp * amp;
  const torsoRot = 5.8 * sp * amp + leadDeg * 0.45;
  const headRot = leadDeg * 0.95 - 1.8 * sp * amp;
  w.hips.setAttribute('transform', `rotate(${hipRot.toFixed(2)})`);
  w.torso.setAttribute('transform', `rotate(${torsoRot.toFixed(2)})`);
  w.head.setAttribute('transform', `translate(0.6 0) rotate(${headRot.toFixed(2)})`);

  // بالا و پایین رفتن بدن: بیشترین ارتفاع وقتی پاها از کنار هم رد می‌شوند
  const bob = 0.5 * (1 + Math.cos(2 * phase));
  w.body.setAttribute('transform', `scale(${(1 + 0.032 * amp * bob).toFixed(4)})`);

  updateHair(w, dt, rootHeading + headRot / RAD2DEG, phase, amp);
}

export interface WalkOptions {
  /** نسبت مسافت ایستگاه‌ها روی مسیر، مثلاً [0, .25, .5, .75, 1] (فقط وقتی pauseAtStops روشن است) */
  stops?: number[];
  /** سرعت مرجع به واحد SVG بر ثانیه */
  speed?: number;
  /** مقیاس کاراکتر روی مسیر */
  scale?: number;
  /** توقف کوتاه کنار هر گالری (پیش‌فرض خاموش: سرعت ثابت) */
  pauseAtStops?: boolean;
}

/** راه رفتن روی یک path؛ تابع توقف را برمی‌گرداند. */
export function startWalk(svg: SVGSVGElement, path: SVGPathElement, opts: WalkOptions = {}): () => void {
  const VMAX = opts.speed ?? 46;
  const SCALE = opts.scale ?? 1.4;
  const pauseAtStops = opts.pauseAtStops ?? false;
  const S = pauseAtStops && opts.stops && opts.stops.length >= 2 ? opts.stops : [0, 1];
  const last = S.length - 1;
  const CYCLE = 27; // مسافتی که یک چرخه‌ی کامل راه رفتن (دو قدم) طی می‌کند
  const LOOK = 28; // فاصله‌ی پیش‌دستی برای تعیین جهت

  ensureDefs(svg);
  const layer = el('g', { 'pointer-events': 'none' }, svg);
  const walker = createWalker(layer);
  const L = path.getTotalLength();

  const P = (s: number): Pt => {
    const p = path.getPointAtLength(clamp(s, 0, L));
    return [p.x, p.y];
  };
  const headingAt = (s: number, look: number) => {
    let a = P(s);
    let b = P(s + look);
    if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) < 0.01) {
      a = P(s - look);
      b = P(s);
    }
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };

  const st = { s: 0, v: 0, phase: 0, head: headingAt(0, LOOK), lead: 0, hdt: 0, stop: 0, dwell: 0.6, appear: 0 };

  const step = (dt: number) => {
    if (st.appear < 1) st.appear = Math.min(1, st.appear + dt / 0.4);
    let vt = 0;
    if (st.dwell > 0) {
      st.dwell -= dt;
      if (st.dwell <= 0 && st.stop === last) {
        // شروع دوباره از اول مسیر
        st.s = 0;
        st.stop = 0;
        st.dwell = 0.6;
        st.appear = 0;
        st.v = 0;
        st.head = headingAt(0, LOOK);
      }
    } else {
      const target = S[st.stop + 1] * L;
      const d = target - st.s;
      // ترمز فقط در لحظه‌ی رسیدن به ایستگاه (یا انتهای مسیر)، نه در پیچ‌ها
      const brakeZone = pauseAtStops || st.stop + 1 === last ? 36 : 0;
      const ease = brakeZone ? Math.min(1, d / brakeZone) : 1;
      vt = Math.max(brakeZone ? 22 : 0, VMAX * ease);
      if (d <= 1.2) {
        st.s = target;
        st.stop++;
        st.v = 0;
        st.dwell = st.stop === last ? 1.4 : 0.75;
        vt = 0;
      }
    }

    st.v += (vt - st.v) * (1 - Math.exp(-dt * 5));
    if (st.dwell <= 0) {
      const cap = S[Math.min(st.stop + 1, last)] * L;
      st.s = Math.min(cap, st.s + st.v * dt);
    }
    st.phase = (st.phase + ((st.v * dt) / CYCLE) * TAU) % (TAU * 4);

    // جهت: هدف نگاه جلوتر از موقعیت فعلی، با هموارسازی نمایی
    const tgt = headingAt(st.s, LOOK);
    st.head += wrap(tgt - st.head) * (1 - Math.exp(-dt * 7));
    st.lead = clamp(wrap(tgt - st.head), -0.7, 0.7);
    st.hdt = dt;
  };

  const render = () => {
    const amp = Math.pow(clamp(st.v / 36, 0, 1), 0.8);
    const p = P(st.s);
    let alpha = st.appear;
    if (st.stop === last && st.dwell > 0) alpha = Math.min(alpha, clamp(st.dwell / 0.4, 0, 1));
    walker.root.setAttribute(
      'transform',
      `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) rotate(${(st.head * RAD2DEG).toFixed(2)}) scale(${SCALE})`
    );
    walker.root.setAttribute('opacity', alpha.toFixed(2));
    pose(walker, st.phase, amp, st.lead, st.hdt, st.head);
  };

  let raf = 0;
  let lastT: number | null = null;
  const frame = (t: number) => {
    if (lastT === null) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    step(dt);
    render();
    raf = requestAnimationFrame(frame);
  };

  // کاربرانی که حرکت کم خواسته‌اند: کاراکتر ثابت کمی بعد از ابتدای مسیر می‌ایستد
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    st.appear = 1;
    st.s = Math.min(L, 60);
    st.head = headingAt(st.s, LOOK);
    render();
  } else {
    raf = requestAnimationFrame(frame);
  }

  return () => {
    cancelAnimationFrame(raf);
    layer.remove();
  };
}
