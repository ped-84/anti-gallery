import {
  Gallery,
  RouteLeg,
  RouteOptimizationResult,
  TimeWindow,
  ScheduledStop,
  DroppedStop,
  TspTwSolution
} from '../types/gallery';
import {
  isInTehranTrafficZone,
  TRAFFIC_MODELS,
  TrafficCondition,
  getGalleryDisplayName
} from './persianUtils';

export interface GalleryNode {
  id: string | number;
  name?: string;
  lat: number;
  lng: number;
  /**
   * رشته ساعت کاری (پشتیبانی از فارسی و انگلیسی و چند بازه زمانی)
   * مثال: "16:00 الی 20:00" یا "10:00-13:30, 15:00-19:00"
   */
  openingHoursText?: string;
  /** در صورت پارس شدن قبلی، می‌توان مستقیماً آرایه پنجره‌ها را پاس داد */
  timeWindows?: TimeWindow[];
  /** زمان توقف استاندارد در گالری (پیش‌فرض: 40 دقیقه) */
  dwellMinutes?: number;
  /** حداقل زمان بازدید مفید در حالت فشرده (پیش‌فرض: 20 دقیقه) */
  minDwellMinutes?: number;
  /** ضریب اهمیت گالری (پیش‌فرض: 1.0) */
  priority?: number;
  /** آیا نیاز به رزرو قبلی دارد؟ */
  requiresAppointment?: boolean;
}

export interface TspTwOptions {
  /** ساعت شروع گشت کاربر ("16:30" یا دقیقه از نیمه‌شب مثلاً 990) */
  startTime: string | number;
  /** حالت حرکت برای تخمین زمان در حالت آفلاین */
  travelMode?: 'walking' | 'driving' | 'transit';
  /** ماتریس زمان سفر پایه (به دقیقه) در صورت دریافت از OSRM Table API */
  osrmDurationMatrixMin?: number[][];
  /** آیا گره اول (ایندکس 0) موقعیت فعلی کاربر یا نقطه شروع ثابت است؟ */
  fixStart?: boolean;
  /** ایندکس گره پایان ثابت (پیش‌فرض: -1 یعنی آزاد) */
  fixEndNode?: number;
  /** آیا مسیر باید به نقطه اول بازگردد؟ */
  isRoundTrip?: boolean;
  /** فعال‌سازی مدل ترافیک ساعتی شهر */
  applyTrafficModel?: boolean;
  /** سقف زمان محاسبه در مرورگر بر حسب میلی‌ثانیه (پیش‌فرض: 35ms) */
  maxComputeTimeMs?: number;
}

// ============================================================================
// ۱. توابع کمکی تبدیل زمان، پارسر ساعت کاری و فاصله هاروسین
// ============================================================================

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

export function parseTimeToMinutes(timeStr: string | number): number {
  if (typeof timeStr === 'number') return Math.round(timeStr);
  const clean = normalizeDigits(timeStr).trim();
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 960; // پیش‌فرض 16:00
  const hours = parseInt(match[1], 10);
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + mins;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * پارسر هوشمند رشته‌های ساعات کاری فارسی و انگلیسی (تک‌بازه و چندبازه مثل تعطیلی ناهار میلان)
 * مثال: "16:00 الی 20:00" | "10:00 - 13:30, 15:00 - 19:00" | "11 تا 19"
 */
export function parseOpeningHours(raw?: string): TimeWindow[] {
  if (!raw || !raw.trim()) {
    return [{ openMin: 9 * 60, closeMin: 21 * 60 }]; // پیش‌فرض 09:00 تا 21:00
  }
  const normalized = normalizeDigits(raw);
  const regex = /(\d{1,2}(?::\d{2})?)\s*(?:الی|تا|-|–|—|to)\s*(\d{1,2}(?::\d{2})?)/gi;
  const windows: TimeWindow[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const openMin = parseTimeToMinutes(match[1]);
    let closeMin = parseTimeToMinutes(match[2]);
    if (closeMin <= openMin) closeMin += 24 * 60; // مدیریت عبور از نیمه‌شب
    windows.push({ openMin, closeMin });
  }

  if (windows.length === 0) {
    return [{ openMin: 9 * 60, closeMin: 21 * 60 }];
  }
  return windows.sort((a, b) => a.openMin - b.openMin);
}

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
 * ضریب ترافیک وابسته به ساعت حرکت (Time-Dependent Traffic Multiplier)
 */
export function getTrafficMultiplier(
  timeOfDayMin: number,
  mode: 'walking' | 'driving' | 'transit' = 'driving',
  enabled: boolean = true
): number {
  if (!enabled || mode === 'walking') return 1.0;
  const factor = mode === 'transit' ? 0.45 : 1.0;

  // اوج صبحگاهی (07:30 تا 09:30)
  if (timeOfDayMin >= 450 && timeOfDayMin <= 570) return 1 + 0.35 * factor;
  // اوج عصرگاهی و ساعت افتتاحیه گالری‌ها (16:30 تا 19:30)
  if (timeOfDayMin >= 990 && timeOfDayMin <= 1170) return 1 + 0.45 * factor;
  // ترافیک نیمه‌سنگین میانه روز و شب (12:00 تا 16:30 و 19:30 تا 21:00)
  if (timeOfDayMin >= 720 && timeOfDayMin <= 1260) return 1 + 0.20 * factor;
  // ساعات خلوت (Off-Peak)
  return 1.0;
}

/**
 * ساخت ماتریس زمان سفر پایه (به دقیقه) با لحاظ ضریب پیچ‌وخم معابر شهری (Tortuosity = 1.3)
 */
export function buildBaseTravelMinutesMatrix(
  nodes: { lat: number; lng: number }[],
  mode: 'walking' | 'driving' | 'transit' = 'walking',
  osrmDurationMatrixMin?: number[][]
): number[][] {
  const n = nodes.length;
  if (osrmDurationMatrixMin && osrmDurationMatrixMin.length === n) {
    return osrmDurationMatrixMin;
  }

  const TORTUOSITY = 1.3; // نسبت مسیر واقعی خیابانی به خط مستقیم هوایی
  const speedKmh = mode === 'walking' ? 4.5 : mode === 'transit' ? 16.0 : 22.0;
  const parkingOrStationBufferMin = mode === 'driving' ? 4 : mode === 'transit' ? 3 : 0;

  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const directKm = haversineDistance(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);
        const effectiveKm = directKm * TORTUOSITY;
        const rawMins = (effectiveKm / speedKmh) * 60;
        matrix[i][j] = Math.max(2, Math.round(rawMins + (directKm > 0.4 ? parkingOrStationBufferMin : 0)));
      }
    }
  }
  return matrix;
}

// ============================================================================
// ۲. هسته اصلی حل‌کننده TSP-TW / OPTW (مقید به پنجره‌های زمانی چندگانه)
// ============================================================================

interface InternalNode {
  index: number;
  id: string | number;
  name?: string;
  windows: TimeWindow[];
  latestCloseMin: number;
  dwell: number;
  minDwell: number;
  priority: number;
}

interface StepEval {
  feasible: boolean;
  arrivalMin: number;
  visitStartMin: number;
  departureMin: number;
  waitMin: number;
  effectiveDwell: number;
  shortageMin: number;
  closingMin: number;
  travelMin: number;
  stepCost: number;
}

export function solveTspWithTimeWindows(
  galleries: GalleryNode[],
  options: TspTwOptions
): TspTwSolution {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const n = galleries.length;
  const startMin = parseTimeToMinutes(options.startTime);
  const mode = options.travelMode ?? 'walking';
  const fixStart = options.fixStart ?? false;
  const fixEndNode = options.fixEndNode ?? -1;
  const isRoundTrip = options.isRoundTrip ?? false;
  const applyTraffic = options.applyTrafficModel ?? true;
  const maxComputeTimeMs = options.maxComputeTimeMs ?? 35;

  if (n === 0) {
    return {
      isFullyFeasible: true,
      orderedIndices: [],
      scheduledStops: [],
      droppedStops: [],
      totalTravelMinutes: 0,
      totalWaitMinutes: 0,
      totalVisitMinutes: 0,
      routeStartFormatted: formatMinutesToTime(startMin),
      routeEndFormatted: formatMinutesToTime(startMin),
      suggestedEarlierStartMinutes: null,
      computeTimeMs: 0
    };
  }

  // نرمال‌سازی گره‌ها و پنجره‌های زمانی
  const nodes: InternalNode[] = galleries.map((g, idx) => {
    const windows =
      g.timeWindows && g.timeWindows.length > 0
        ? [...g.timeWindows].sort((a, b) => a.openMin - b.openMin)
        : parseOpeningHours(g.openingHoursText);
    const dwell = g.dwellMinutes ?? 40;
    const minDwell = Math.min(dwell, g.minDwellMinutes ?? Math.max(15, Math.floor(dwell * 0.5)));
    return {
      index: idx,
      id: g.id,
      name: g.name,
      windows,
      latestCloseMin: windows[windows.length - 1].closeMin,
      dwell,
      minDwell,
      priority: g.priority ?? 1.0
    };
  });

  const baseTravel = buildBaseTravelMinutesMatrix(galleries, mode, options.osrmDurationMatrixMin);

  // تابع محاسبه زمان سفر وابسته به زمان حرکت
  const getTravelMin = (fromIdx: number, toIdx: number, departTimeMin: number): number => {
    if (fromIdx === -1 || fromIdx === toIdx) return 0;
    const mult = getTrafficMultiplier(departTimeMin, mode, applyTraffic);
    return Math.round(baseTravel[fromIdx][toIdx] * mult);
  };

  // تابع ارزیابی انتقال حالت از گره u به گره v در زمان currTime
  const evaluateTransition = (currTime: number, u: number, v: number): StepEval => {
    const tr = u === -1 ? 0 : getTravelMin(u, v, currTime);
    const arr = currTime + tr;
    const node = nodes[v];

    for (let k = 0; k < node.windows.length; k++) {
      const win = node.windows[k];
      const vStart = Math.max(arr, win.openMin);
      const availableTime = win.closeMin - vStart;

      if (availableTime >= node.minDwell) {
        const effDwell = Math.min(node.dwell, availableTime);
        const shortage = node.dwell - effDwell;
        const wait = vStart - arr;
        const dep = vStart + effDwell;
        const slack = win.closeMin - dep;

        // تابع هزینه گام: زمان سفر + جریمه انتظار + جریمه فشرده‌سازی بازدید - پاداش حاشیه امنیت
        const waitPenalty = wait <= 45 ? 0.55 * wait : 0.55 * 45 + 1.8 * (wait - 45);
        const stepCost = tr * 1.0 + waitPenalty + shortage * 3.0 - Math.min(60, slack) * 0.02;

        return {
          feasible: true,
          arrivalMin: arr,
          visitStartMin: vStart,
          departureMin: dep,
          waitMin: wait,
          effectiveDwell: effDwell,
          shortageMin: shortage,
          closingMin: win.closeMin,
          travelMin: tr,
          stepCost
        };
      }
    }

    return {
      feasible: false,
      arrivalMin: arr,
      visitStartMin: arr,
      departureMin: arr,
      waitMin: 0,
      effectiveDwell: 0,
      shortageMin: node.dwell,
      closingMin: node.latestCloseMin,
      travelMin: tr,
      stepCost: Infinity
    };
  };

  // ارزیابی کامل یک دنباله از گره‌ها
  const evaluateSequence = (seq: number[]): {
    feasible: boolean;
    steps: StepEval[];
    totalPriority: number;
    totalCost: number;
    endTime: number;
  } => {
    let curr = startMin;
    let totalCost = 0;
    let totalPriority = 0;
    const steps: StepEval[] = [];

    for (let i = 0; i < seq.length; i++) {
      const u = i === 0 ? -1 : seq[i - 1];
      const v = seq[i];
      const ev = evaluateTransition(curr, u, v);
      if (!ev.feasible) {
        return { feasible: false, steps, totalPriority, totalCost: Infinity, endTime: curr };
      }
      steps.push(ev);
      curr = ev.departureMin;
      totalCost += ev.stepCost;
      totalPriority += nodes[v].priority;
    }

    if (isRoundTrip && seq.length > 1) {
      totalCost += getTravelMin(seq[seq.length - 1], seq[0], curr);
    }

    return { feasible: true, steps, totalPriority, totalCost, endTime: curr };
  };

  // ==========================================================================
  // فاز ۱: جستجوی دقیق Branch-and-Bound با Bitmask Memoization و EDF Ordering
  // ==========================================================================
  let bestSeq: number[] = [];
  let bestSteps: StepEval[] = [];
  let bestPriority = -1;
  let bestCost = Infinity;

  // مرتب‌سازی کاندیداها بر اساس زودترین ساعت بسته شدن (Earliest Deadline First)
  const edfOrder = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => nodes[a].latestCloseMin - nodes[b].latestCloseMin
  );

  const memoTime = new Map<number, number>();
  const memoCost = new Map<number, number>();
  let iterations = 0;
  let timedOut = false;

  const dfs = (
    mask: number,
    lastNode: number,
    currTime: number,
    currCost: number,
    currPriority: number,
    path: number[],
    stepsSoFar: StepEval[]
  ) => {
    iterations++;
    if ((iterations & 127) === 0) {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      if (elapsed > maxComputeTimeMs) {
        timedOut = true;
        return;
      }
    }

    const endNodeValid = fixEndNode === -1 || path.length < n || lastNode === fixEndNode;
    if (path.length > 0 && endNodeValid) {
      const roundTripExtra =
        isRoundTrip && path.length > 1 ? getTravelMin(lastNode, path[0], currTime) : 0;
      const totalC = currCost + roundTripExtra;

      if (
        currPriority > bestPriority + 1e-6 ||
        (Math.abs(currPriority - bestPriority) <= 1e-6 && totalC < bestCost - 1e-4)
      ) {
        bestPriority = currPriority;
        bestCost = totalC;
        bestSeq = path.slice();
        bestSteps = stepsSoFar.slice();
      }
    }

    if (path.length === n) return;

    // هرس تسلط حالت (State Dominance Pruning) برای N <= 20
    if (lastNode !== -1 && n <= 20) {
      const stateKey = mask * 32 + lastNode;
      const prevTime = memoTime.get(stateKey);
      const prevCost = memoCost.get(stateKey);
      if (
        prevTime !== undefined &&
        prevCost !== undefined &&
        currTime >= prevTime &&
        currCost >= prevCost - 1e-3
      ) {
        return;
      }
      if (prevTime === undefined || currTime < prevTime) {
        memoTime.set(stateKey, currTime);
        memoCost.set(stateKey, currCost);
      }
    }

    const candidates: { v: number; ev: StepEval }[] = [];
    for (let i = 0; i < n; i++) {
      const v = edfOrder[i];
      if ((mask & (1 << v)) !== 0) continue;
      if (fixStart && path.length === 0 && v !== 0) continue;

      const ev = evaluateTransition(currTime, lastNode, v);
      if (ev.feasible) {
        candidates.push({ v, ev });
      }
    }

    candidates.sort((a, b) => {
      const urgencyDiff = nodes[a.v].latestCloseMin - nodes[b.v].latestCloseMin;
      if (Math.abs(urgencyDiff) > 45) return urgencyDiff;
      return a.ev.stepCost - b.ev.stepCost;
    });

    for (const cand of candidates) {
      path.push(cand.v);
      stepsSoFar.push(cand.ev);
      dfs(
        mask | (1 << cand.v),
        cand.v,
        cand.ev.departureMin,
        currCost + cand.ev.stepCost,
        currPriority + nodes[cand.v].priority,
        path,
        stepsSoFar
      );
      path.pop();
      stepsSoFar.pop();
      if (timedOut) return;
    }
  };

  if (n <= 12) {
    dfs(0, -1, startMin, 0, 0, [], []);
  }

  // ==========================================================================
  // فاز ۲: هیوریستیک درج زمانی سولومون (Solomon I1) + بهبود محلی Or-Opt
  // ==========================================================================
  if (n > 12 || timedOut) {
    const unvisited = new Set<number>(Array.from({ length: n }, (_, i) => i));
    const route: number[] = [];

    if (fixStart && unvisited.has(0)) {
      const ev0 = evaluateTransition(startMin, -1, 0);
      if (ev0.feasible) {
        route.push(0);
        unvisited.delete(0);
      }
    }

    let inserted = true;
    while (inserted && unvisited.size > 0) {
      inserted = false;
      let bestCandidate = -1;
      let bestInsertPos = -1;
      let bestInsertEval: ReturnType<typeof evaluateSequence> | null = null;
      let bestInsertionScore = Infinity;

      for (const cand of unvisited) {
        const minPos = fixStart && route.length > 0 && route[0] === 0 ? 1 : 0;
        for (let pos = minPos; pos <= route.length; pos++) {
          const trial = [...route.slice(0, pos), cand, ...route.slice(pos)];
          const ev = evaluateSequence(trial);
          if (ev.feasible) {
            const urgencyBonus = (1440 - nodes[cand].latestCloseMin) * 0.15;
            const score = ev.totalCost - urgencyBonus - nodes[cand].priority * 50;
            if (score < bestInsertionScore) {
              bestInsertionScore = score;
              bestCandidate = cand;
              bestInsertPos = pos;
              bestInsertEval = ev;
            }
          }
        }
      }

      if (bestCandidate !== -1 && bestInsertEval) {
        route.splice(bestInsertPos, 0, bestCandidate);
        unvisited.delete(bestCandidate);
        inserted = true;
      }
    }

    // بهبود محلی با Or-Opt
    let improved = true;
    let locIter = 0;
    let currEval = evaluateSequence(route);

    while (improved && locIter < 30 && route.length > 2) {
      improved = false;
      locIter++;
      const startIndex = fixStart && route[0] === 0 ? 1 : 0;

      for (let i = startIndex; i < route.length; i++) {
        for (let j = startIndex; j < route.length; j++) {
          if (i === j) continue;
          const trial = route.slice();
          const [moved] = trial.splice(i, 1);
          trial.splice(j, 0, moved);
          const ev = evaluateSequence(trial);
          if (ev.feasible && ev.totalCost < currEval.totalCost - 0.01) {
            route.splice(0, route.length, ...trial);
            currEval = ev;
            improved = true;
          }
        }
      }
    }

    if (
      currEval.feasible &&
      (currEval.totalPriority > bestPriority ||
        (currEval.totalPriority === bestPriority && currEval.totalCost < bestCost))
    ) {
      bestPriority = currEval.totalPriority;
      bestCost = currEval.totalCost;
      bestSeq = route;
      bestSteps = currEval.steps;
    }
  }

  // ==========================================================================
  // فاز ۳: ساخت خروجی نهایی، تشخیص ایستگاه‌های حذف‌شده و پیشنهاد شروع زودتر
  // ==========================================================================
  const scheduledSet = new Set<number>(bestSeq);
  const scheduledStops: ScheduledStop[] = bestSeq.map((nodeIdx, i) => {
    const st = bestSteps[i];
    const g = nodes[nodeIdx];
    return {
      nodeIndex: nodeIdx,
      id: g.id,
      name: g.name,
      arrivalTimeMin: st.arrivalMin,
      arrivalTimeFormatted: formatMinutesToTime(st.arrivalMin),
      waitMinutes: st.waitMin,
      visitStartMin: st.visitStartMin,
      visitStartFormatted: formatMinutesToTime(st.visitStartMin),
      departureTimeMin: st.departureMin,
      departureTimeFormatted: formatMinutesToTime(st.departureMin),
      effectiveDwellMinutes: st.effectiveDwell,
      isCompressedVisit: st.shortageMin > 0,
      travelMinutesFromPrev: st.travelMin,
      closingTimeMin: st.closingMin,
      closingTimeFormatted: formatMinutesToTime(st.closingMin),
      slackMinutesBeforeClose: st.closingMin - st.departureMin
    };
  });

  const lastDepartureMin =
    scheduledStops.length > 0
      ? scheduledStops[scheduledStops.length - 1].departureTimeMin
      : startMin;
  const lastVisitedIdx = bestSeq.length > 0 ? bestSeq[bestSeq.length - 1] : -1;

  const droppedStops: DroppedStop[] = [];
  let maxShortfall = 0;

  for (let i = 0; i < n; i++) {
    if (!scheduledSet.has(i)) {
      const g = nodes[i];
      const trFromLast = lastVisitedIdx === -1 ? 0 : getTravelMin(lastVisitedIdx, i, lastDepartureMin);
      const earliestArr = lastDepartureMin + trFromLast;
      const shortfall = Math.max(0, earliestArr + g.minDwell - g.latestCloseMin);
      if (shortfall > maxShortfall) maxShortfall = shortfall;

      const reason =
        startMin + g.minDwell > g.latestCloseMin
          ? 'ALREADY_CLOSED_AT_START'
          : earliestArr + g.minDwell > g.latestCloseMin
          ? 'CLOSED_BEFORE_ARRIVAL'
          : 'TIME_BUDGET_EXCEEDED';

      droppedStops.push({
        nodeIndex: i,
        id: g.id,
        name: g.name,
        reason,
        closingTimeFormatted: formatMinutesToTime(g.latestCloseMin),
        earliestPossibleArrivalFormatted: formatMinutesToTime(earliestArr),
        shortfallMinutes: shortfall
      });
    }
  }

  let suggestedEarlierStartMinutes: number | null = null;
  if (droppedStops.length > 0 && maxShortfall > 0 && maxShortfall <= 180) {
    suggestedEarlierStartMinutes = Math.ceil((maxShortfall + 10) / 15) * 15;
  }

  const totalTravelMinutes = scheduledStops.reduce((acc, s) => acc + s.travelMinutesFromPrev, 0);
  const totalWaitMinutes = scheduledStops.reduce((acc, s) => acc + s.waitMinutes, 0);
  const totalVisitMinutes = scheduledStops.reduce((acc, s) => acc + s.effectiveDwellMinutes, 0);
  const computeTimeMs =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

  return {
    isFullyFeasible: droppedStops.length === 0,
    orderedIndices: bestSeq,
    scheduledStops,
    droppedStops,
    totalTravelMinutes,
    totalWaitMinutes,
    totalVisitMinutes,
    routeStartFormatted: formatMinutesToTime(startMin),
    routeEndFormatted: formatMinutesToTime(lastDepartureMin),
    suggestedEarlierStartMinutes,
    computeTimeMs: Number(computeTimeMs.toFixed(2))
  };
}

// ============================================================================
// ۳. حفظ سازگاری با امضای قبلی (Backward-Compatible Wrapper)
// ============================================================================
export function solveTspOrder(
  points: { lat: number; lng: number; openingHoursText?: string; dwellMinutes?: number }[],
  isRoundTrip: boolean = false,
  fixStart: boolean = false,
  fixEndNode: number = -1,
  startTime: string | number = '16:00'
): number[] {
  const galleries: GalleryNode[] = points.map((p, idx) => ({
    id: idx,
    lat: p.lat,
    lng: p.lng,
    openingHoursText: p.openingHoursText,
    dwellMinutes: p.dwellMinutes ?? 40
  }));

  const sol = solveTspWithTimeWindows(galleries, {
    startTime,
    isRoundTrip,
    fixStart,
    fixEndNode,
    travelMode: 'walking'
  });

  if (sol.orderedIndices.length < points.length) {
    const missing = sol.droppedStops.map((d) => d.nodeIndex);
    return [...sol.orderedIndices, ...missing];
  }
  return sol.orderedIndices;
}

export interface RouteOptimizerOptions {
  mode?: 'driving' | 'walking';
  isRoundTrip?: boolean;
  trafficCondition?: TrafficCondition;
  customStart?: { name: string; lat: number; lng: number };
  startGalleryId?: number | null;
  endGalleryId?: number | null;
  startTime?: string | number;
  dwellMinutes?: number;
}

/**
 * Optimizes the route among selected art galleries, factoring in Multi-Window TSP-TW and traffic models.
 * Supports choosing a specific start gallery, end gallery, or finding the global optimal time-aware sequence.
 */
export async function optimizeGalleryRoute(
  galleries: Gallery[],
  options: RouteOptimizerOptions = {}
): Promise<RouteOptimizationResult> {
  const mode = options.mode || 'driving';
  const isRoundTrip = options.isRoundTrip ?? false;
  const trafficCondition = options.trafficCondition || 'peak';
  const startTime = options.startTime ?? '16:00';
  const dwellMinutes = options.dwellMinutes ?? 40;

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

  // Re-order input galleries array if a startGalleryId or endGalleryId is explicitly chosen
  let workingGalleries = [...galleries];

  // 1. Position startGallery at the beginning
  if (options.startGalleryId) {
    const sIdx = workingGalleries.findIndex((g) => g.id === options.startGalleryId);
    if (sIdx > 0) {
      const [startG] = workingGalleries.splice(sIdx, 1);
      workingGalleries.unshift(startG);
    }
  }

  // 2. Position endGallery at the end
  if (options.endGalleryId && options.endGalleryId !== options.startGalleryId) {
    const eIdx = workingGalleries.findIndex((g) => g.id === options.endGalleryId);
    if (eIdx !== -1 && eIdx !== workingGalleries.length - 1) {
      const [endG] = workingGalleries.splice(eIdx, 1);
      workingGalleries.push(endG);
    }
  }

  const allPoints: { name: string; lat: number; lng: number; isCustom?: boolean; gallery?: Gallery }[] = [];
  if (options.customStart) {
    allPoints.push({
      name: options.customStart.name,
      lat: options.customStart.lat,
      lng: options.customStart.lng,
      isCustom: true
    });
  }
  workingGalleries.forEach((g) => {
    allPoints.push({
      name: getGalleryDisplayName(g),
      lat: g.lat,
      lng: g.lng,
      gallery: g
    });
  });

  const hasFixedStart = Boolean(options.customStart || options.startGalleryId);
  const hasFixedEnd = Boolean(options.endGalleryId && !isRoundTrip);
  const fixEndNode = hasFixedEnd ? allPoints.length - 1 : -1;

  // Build GalleryNode array for TSP-TW
  const galleryNodes: GalleryNode[] = allPoints.map((p, idx) => {
    const isCustom = Boolean(p.isCustom);
    return {
      id: p.gallery?.id ?? `origin-${idx}`,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      openingHoursText: isCustom
        ? '00:00 الی 23:59'
        : p.gallery?.activeExhibition?.openingHours || p.gallery?.hoursFa || p.gallery?.hours,
      dwellMinutes: isCustom ? 0 : dwellMinutes,
      minDwellMinutes: isCustom ? 0 : Math.max(15, Math.floor(dwellMinutes * 0.5)),
      priority: 1.0
    };
  });

  let osrmDurationMatrixMin: number[][] | undefined = undefined;

  // Try OSRM Table API first (with fast 1.5s timeout for network resilience)
  try {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) {
      const coordsStr = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
      const osrmMode = mode === 'walking' ? 'walking' : 'driving';
      const tableUrl = `https://router.project-osrm.org/table/v1/${osrmMode}/${coordsStr}?annotations=duration`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(tableUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && Array.isArray(data.durations)) {
          osrmDurationMatrixMin = data.durations.map((row: number[]) =>
            row.map((sec: number) => Math.max(1, Math.round(sec / 60)))
          );
        }
      }
    }
  } catch (err) {
    console.warn('OSRM Table API note (falling back to offline matrix):', err);
  }

  // Solve Multi-Window TSP-TW
  const tspTwSolution = solveTspWithTimeWindows(galleryNodes, {
    startTime,
    travelMode: mode,
    osrmDurationMatrixMin,
    fixStart: hasFixedStart,
    fixEndNode,
    isRoundTrip,
    applyTrafficModel: mode === 'driving',
    maxComputeTimeMs: 40
  });

  // Extract ordered galleries from feasible scheduled stops
  const scheduledIndices = tspTwSolution.orderedIndices;
  let orderedGalleries: Gallery[] = [];
  if (scheduledIndices.length > 0) {
    orderedGalleries = scheduledIndices
      .map((idx) => allPoints[idx].gallery)
      .filter((g): g is Gallery => !!g);
  }

  // If any galleries were dropped by TSP-TW, append them at the end so map pins remain complete
  if (tspTwSolution.droppedStops.length > 0) {
    const droppedIndices = tspTwSolution.droppedStops.map((d) => d.nodeIndex);
    const droppedGalleries = droppedIndices
      .map((idx) => allPoints[idx].gallery)
      .filter((g): g is Gallery => !!g);
    orderedGalleries = [...orderedGalleries, ...droppedGalleries];
  }

  if (orderedGalleries.length === 0) {
    orderedGalleries = workingGalleries;
  }

  // Calculate realistic road geometry and turn-by-turn legs
  const fixedRoute = await calculateFixedRoute(orderedGalleries, {
    mode,
    isRoundTrip,
    trafficCondition,
    customStart: options.customStart
  });

  return {
    ...fixedRoute,
    trafficZoneWarningsCount,
    algorithmUsed: osrmDurationMatrixMin ? 'tsp-tw-osrm' : 'tsp-tw-offline',
    tspTwSolution
  };
}

/**
 * Calculates exact route metrics and geometry for a manual sequence of galleries
 * (e.g. after manual up/down swap or reversing the route).
 */
export async function calculateFixedRoute(
  orderedGalleries: Gallery[],
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

  if (orderedGalleries.length === 0) {
    throw new Error('گالری‌ای برای مسیریابی انتخاب نشده است.');
  }

  let trafficZoneWarningsCount = 0;
  orderedGalleries.forEach((g) => {
    if (isInTehranTrafficZone(g.address, g.lat, g.lng)) {
      trafficZoneWarningsCount++;
    }
  });

  const allPoints: { name: string; lat: number; lng: number; gallery?: Gallery }[] = [];
  if (options.customStart) {
    allPoints.push({
      name: options.customStart.name,
      lat: options.customStart.lat,
      lng: options.customStart.lng
    });
  }
  orderedGalleries.forEach((g) => {
    allPoints.push({
      name: getGalleryDisplayName(g),
      lat: g.lat,
      lng: g.lng,
      gallery: g
    });
  });

  // Try OSRM Route API for exact road routing along the user's fixed sequence
  try {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      throw new Error('Offline mode: skipping foreign OSRM routing');
    }

    const coords = allPoints.map((p) => `${p.lng},${p.lat}`);
    if (isRoundTrip && allPoints.length > 1) {
      coords.push(`${allPoints[0].lng},${allPoints[0].lat}`);
    }
    const coordsStr = coords.join(';');
    const osrmMode = mode === 'walking' ? 'walking' : 'driving';
    const routeUrl = `https://router.project-osrm.org/route/v1/${osrmMode}/${coordsStr}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(routeUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geometryCoords: [number, number][] = (route.geometry?.coordinates || []).map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const legs: RouteLeg[] = (route.legs || []).map((leg: any, idx: number) => {
          const from = allPoints[idx]?.name || `توقف ${idx + 1}`;
          const nextIdx = (idx + 1) % allPoints.length;
          const to = isRoundTrip && idx === allPoints.length - 1
            ? allPoints[0]?.name || 'نقطه آغاز'
            : allPoints[nextIdx]?.name || `توقف ${idx + 2}`;

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

        const totalDistKm = parseFloat(((route.distance || 0) / 1000).toFixed(2));
        const totalDurationMin = Math.max(1, Math.round((route.duration || 0) / 60));
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
          algorithmUsed: 'osrm-route'
        };
      }
    }
  } catch (err) {
    console.warn('OSRM route request note:', err);
  }

  // Fallback: Haversine distance matrix calculations
  const avgSpeedKmH = mode === 'walking' ? 4.5 : 24;
  const legs: RouteLeg[] = [];
  let totalDistanceKm = 0;
  const geometryCoords: [number, number][] = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const p1 = allPoints[i];
    const p2 = allPoints[i + 1];
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
      summary: 'خیابان‌های شهری'
    });

    geometryCoords.push([p1.lat, p1.lng]);
    geometryCoords.push([(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2]);
  }

  const lastP = allPoints[allPoints.length - 1];
  geometryCoords.push([lastP.lat, lastP.lng]);

  if (isRoundTrip && allPoints.length > 1) {
    const pFirst = allPoints[0];
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
    algorithmUsed: 'fixed-matrix'
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
  coords: [number, number][],
  origin?: { name: string; lat: number; lng: number }
): string {
  const originXml = origin
    ? `  <wpt lat="${origin.lat}" lon="${origin.lng}">
    <name>مبدأ حرکت: ${escapeXml(origin.name)}</name>
    <desc>نقطه شروع تور گالری‌های هنری</desc>
  </wpt>\n`
    : '';

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
    <desc>مسیر بهینه آرت‌گشت تهران</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${originXml}${waypointsXml}
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
