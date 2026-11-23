import React, { useState, useEffect } from 'react';
import { RouteOptimizationResult, Gallery, CustomOrigin } from '../types/gallery';
import {
  toPersianDigits,
  TRAFFIC_MODELS,
  TrafficCondition,
  getGalleryDisplayName,
  formatGalleryAddress,
  TEHRAN_START_HUBS,
  formatDistanceFa,
  formatDurationFa
} from '../utils/persianUtils';
import { ClayDropdown, DropdownOption } from './ClayDropdown';
import {
  buildGoogleMapsUrl,
  buildNeshanUrl,
  buildWazeUrl,
  exportToGpx
} from '../utils/routeOptimizer';
import { GoogleMapsIcon, WazeIcon, NeshanIcon } from './NavIcons';
import {
  Navigation,
  Car,
  Footprints,
  RotateCw,
  ExternalLink,
  Download,
  Share2,
  Trash2,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
  Zap,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  Flag,
  Timer,
  ChevronDown,
  Home,
  Compass
} from 'lucide-react';

const VISIT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

interface RouteSummaryPanelProps {
  routeResult: RouteOptimizationResult | null;
  selectedGalleries: Gallery[];
  isOptimizing: boolean;
  onRemoveGallery: (galleryId: number) => void;
  onClearAll: () => void;
  onRecalculate: (
    mode: 'driving' | 'walking',
    isRoundTrip: boolean,
    trafficCondition: TrafficCondition,
    origin?: CustomOrigin | null
  ) => void;
  onSelectGallery: (gallery: Gallery) => void;
  onSetStartGallery?: (galleryId: number) => void;
  onSetEndGallery?: (galleryId: number) => void;
  onMoveStop?: (fromIdx: number, toIdx: number) => void;
  onReverseRoute?: () => void;
  onResetAutoOrder?: () => void;
  startGalleryId?: number | null;
  endGalleryId?: number | null;
  originLocation: CustomOrigin | null;
  onChangeOrigin: (origin: CustomOrigin | null) => void;
  onRequestGps: () => void;
  isLocatingGps?: boolean;
  currentMode?: 'driving' | 'walking';
  onModeChange?: (mode: 'driving' | 'walking') => void;
  onShowToast?: (title: string, subtitle?: string, type?: 'success' | 'info' | 'warning' | 'error', duration?: number) => void;
}

export const RouteSummaryPanel: React.FC<RouteSummaryPanelProps> = ({
  routeResult,
  selectedGalleries,
  isOptimizing,
  onRemoveGallery,
  onClearAll,
  onRecalculate,
  onSelectGallery,
  onSetStartGallery,
  onSetEndGallery,
  onMoveStop,
  onReverseRoute,
  onResetAutoOrder,
  startGalleryId,
  endGalleryId,
  originLocation,
  onChangeOrigin,
  onRequestGps,
  isLocatingGps = false,
  currentMode,
  onModeChange,
  onShowToast
}) => {
  const [internalMode, setInternalMode] = useState<'driving' | 'walking'>(
    currentMode || routeResult?.mode || 'driving'
  );
  const activeMode = currentMode || internalMode;
  const mode = activeMode;

  useEffect(() => {
    if (currentMode && currentMode !== internalMode) {
      setInternalMode(currentMode);
    }
  }, [currentMode]);

  useEffect(() => {
    if (routeResult?.mode && routeResult.mode !== internalMode) {
      setInternalMode(routeResult.mode);
    }
  }, [routeResult?.mode]);

  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(routeResult?.isRoundTrip ?? false);
  const [trafficCondition, setTrafficCondition] = useState<TrafficCondition>(
    routeResult?.trafficCondition || 'peak'
  );
  const [copied, setCopied] = useState(false);
  const [visitDurationMin, setVisitDurationMin] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gallery_visit_duration_min');
      return saved ? parseInt(saved, 10) : 15;
    } catch {
      return 15;
    }
  });

  const handleVisitDurationChange = (val: number) => {
    setVisitDurationMin(val);
    try {
      localStorage.setItem('gallery_visit_duration_min', val.toString());
    } catch {}
    onRecalculate(activeMode, isRoundTrip, trafficCondition);
  };

  const handleModeChange = (newMode: 'driving' | 'walking') => {
    setInternalMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      onRecalculate(newMode, isRoundTrip, trafficCondition);
    }
  };

  const handleRoundTripToggle = () => {
    const nextVal = !isRoundTrip;
    setIsRoundTrip(nextVal);
    onRecalculate(activeMode, nextVal, trafficCondition);
  };

  const handleTrafficChange = (cond: TrafficCondition) => {
    setTrafficCondition(cond);
    onRecalculate(activeMode, isRoundTrip, cond);
  };

  const handleDownloadGpx = () => {
    if (!routeResult) return;
    const gpxContent = exportToGpx(
      'تور بهینه گالری‌های هنری',
      routeResult.orderedGalleries,
      routeResult.geometryCoords,
      routeResult.originPoint
    );
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `art_tour_tehran_${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast?.(
      'فایل مسیر (GPX) دانلود شد',
      'فایل مسیر گشت ذخیره شد و آماده استفاده در برنامه‌های ناوبری و GPS است.',
      'info',
      3500
    );
  };

  const handleCopySummary = () => {
    if (!routeResult) return;
    const originText = routeResult.originPoint
      ? `مبدأ حرکت: ${routeResult.originPoint.name}\n\n`
      : '';
    const summary = routeResult.orderedGalleries
      .map(
        (g, i) =>
          `توقف ${toPersianDigits(i + 1)}: ${getGalleryDisplayName(g)} - ${formatGalleryAddress(g.addressFa || g.address)} (${g.neighborhoodFa || g.cityFa || g.city})`
      )
      .join('\n\n');

    const textToCopy = `برنامه بازدید و تور بهینه گالری‌های هنری (${toPersianDigits(routeResult.orderedGalleries.length)} گالری)\n${originText}مسافت کل: ${formatDistanceFa(routeResult.totalDistanceKm)}، زمان جابه‌جایی حدود ${toPersianDigits(routeResult.totalDurationMin)} دقیقه\n\n${summary}\n\nلینک مستقیم گوگل مپس: ${buildGoogleMapsUrl(routeResult.orderedGalleries, routeResult.originPoint, mode)}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    onShowToast?.(
      'متن برنامه بازدید کپی شد',
      'اطلاعات کامل گشت و لینک مستقیم در حافظه کپی شد و آماده اشتراک‌گذاری است.',
      'info',
      3500
    );
  };

  const googleMapsUrl = routeResult
    ? buildGoogleMapsUrl(routeResult.orderedGalleries, routeResult.originPoint, mode)
    : '';

  const originDropdownOptions: DropdownOption[] = [
    { value: 'gps', label: 'موقعیت فعلی من (GPS)' },
    { value: 'none', label: 'از اولین گالری مسیر' },
    ...TEHRAN_START_HUBS.map((hub) => ({
      value: hub.id,
      label: `محله: ${hub.label}`
    }))
  ];

  let currentOriginValue = 'gps';
  if (originLocation) {
    if (originLocation.type === 'gps') {
      currentOriginValue = 'gps';
    } else if (originLocation.type === 'hub') {
      const matched = TEHRAN_START_HUBS.find(
        (h) => h.label === originLocation.name || (Math.abs(h.lat - originLocation.lat) < 0.002 && Math.abs(h.lng - originLocation.lng) < 0.002)
      );
      currentOriginValue = matched ? matched.id : 'saadat_abad';
    }
  } else {
    try {
      if (localStorage.getItem('artgasht_origin_disabled') === 'true') {
        currentOriginValue = 'none';
      }
    } catch {}
  }

  const handleOriginChange = (val: string) => {
    if (val === 'gps') {
      onRequestGps();
    } else if (val === 'none') {
      onChangeOrigin(null);
    } else {
      const hub = TEHRAN_START_HUBS.find((h) => h.id === val);
      if (hub) {
        onChangeOrigin({
          type: 'hub',
          name: hub.label,
          lat: hub.lat,
          lng: hub.lng
        });
      }
    }
  };

  // Calculate Average Times as the main large metrics (Based on user-selected visit duration per gallery)
  const dwellTimeMin = (routeResult?.orderedGalleries.length || 0) * visitDurationMin;
  // اگر برنامه‌ی زمانی هست، «کل گشت» همان فاصله‌ی حرکت تا پایان است تا با کاشی‌های حرکت/پایان یکی باشد
  const hhmm = (t?: string) => {
    const m = t && /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const schedStart = hhmm(routeResult?.tspTwSolution?.routeStartFormatted);
  const schedEnd = hhmm(routeResult?.tspTwSolution?.routeEndFormatted);
  const avgTotalTourTimeMin =
    schedStart !== null && schedEnd !== null && schedEnd > schedStart
      ? schedEnd - schedStart
      : (routeResult?.totalDurationMin || 0) + dwellTimeMin;
  const avgHours = Math.floor(avgTotalTourTimeMin / 60);
  const avgMins = avgTotalTourTimeMin % 60;

  // Extreme condition calculation (traffic surge during rush hours)
  const trafficDelayMin = Math.max(
    0,
    (routeResult?.totalDurationWithTrafficMin || 0) - (routeResult?.totalDurationMin || 0)
  );

  return (
    <div className="clay-card flex flex-col h-full bg-white/95 dark:bg-[#181d27] overflow-hidden border border-[#E1E1E1] dark:border-stone-800 shadow-sm font-sans">
      {/* Header Bar */}
      <div className="p-4 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1d2d4c] dark:text-white">
              برنامه سفر و مسیر بهینه
            </h2>
            <p className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] mt-0.5 font-medium">
              {toPersianDigits(selectedGalleries.length)} گالری در برنامه بازدید شما
            </p>
          </div>

          {selectedGalleries.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors flex items-center gap-1 font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاک کردن همه</span>
            </button>
          )}
        </div>

        {/* Travel Mode, Route Type & Smart Traffic Controls (Spacious, Mobile-First Architecture) */}
        {selectedGalleries.length >= 1 && (
          <div className="mt-4 space-y-3">
            {/* Origin / Starting Location Selector Card */}
            <div className="clay-card p-3 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl border border-[#E1E1E1]/80 dark:border-stone-800 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>مبدأ حرکت</span>
                </span>
                {isLocatingGps ? (
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400">در حال گرفتن موقعیت…</span>
                ) : originLocation?.type === 'gps' && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>موقعیت زنده GPS</span>
                  </span>
                )}
                {originLocation?.type === 'hub' && (
                  <span className="text-xs font-bold text-[#1856C7] dark:text-[#93c5fd]">
                    محله انتخابی
                  </span>
                )}
              </div>

              {/* یک کنترل برای مبدأ: GPS، شروع از اولین گالری یا یکی از محله‌ها (قبلاً دکمه‌ی GPS + منو + ردیف «حذف مبدأ» تکراری بودند) */}
              <ClayDropdown
                value={currentOriginValue}
                onChange={handleOriginChange}
                options={originDropdownOptions}
                prefix={
                  currentOriginValue === 'gps'
                    ? <Navigation className={`w-3.5 h-3.5 text-emerald-600 ${isLocatingGps ? 'animate-spin' : ''}`} />
                    : <MapPin className="w-3.5 h-3.5 text-[#3D5B99]" />
                }
                className="w-full text-xs"
                buttonClassName="w-full"
                size="sm"
              />
            </div>
            {/* Row 1: Mode Switch & Route Pattern (Two spacious, balanced Segmented Controls) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Mode: Driving vs Walking */}
              <div className="clay-card p-1.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl flex items-center border border-[#E1E1E1]/80 dark:border-stone-800 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleModeChange('driving')}
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    activeMode === 'driving'
                      ? 'clay-button clay-base text-[#1d2d4c] dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
                  }`}
                >
                  <Car className="w-4 h-4 text-[#3D5B99] shrink-0" />
                  <span>با خودرو</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('walking')}
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    activeMode === 'walking'
                      ? 'clay-button clay-base text-[#1d2d4c] dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
                  }`}
                >
                  <Footprints className="w-4 h-4 text-[#F76B1C] shrink-0" />
                  <span>پیاده‌روی</span>
                </button>
              </div>

              {/* Pattern: One-Way vs Loop */}
              <div className="clay-card p-1.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl flex items-center border border-[#E1E1E1]/80 dark:border-stone-800 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (isRoundTrip) {
                      setIsRoundTrip(false);
                      onRecalculate(mode, false, trafficCondition);
                    }
                  }}
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                    !isRoundTrip
                      ? 'clay-button clay-base text-[#1d2d4c] dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
                  }`}
                >
                  <span>تک‌مسیره</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isRoundTrip) {
                      setIsRoundTrip(true);
                      onRecalculate(mode, true, trafficCondition);
                    }
                  }}
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                    isRoundTrip
                      ? 'clay-button clay-darkblue text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5 shrink-0" />
                  <span>رفت‌وبرگشت</span>
                </button>
              </div>
            </div>

            {/* Row 2: Traffic Scenario Selector (Generous Full-Width Card with Breathing Room) */}
            {mode === 'driving' && (
              <div className="clay-card p-3 sm:p-3.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl border border-[#E1E1E1]/80 dark:border-stone-800 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between px-1 mb-0.5">
                  <span className="text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#F76B1C]" />
                    <span>ساعت حرکت در ترافیک تهران:</span>
                  </span>
                  <span className="text-xs font-medium text-stone-400 hidden xs:inline">تخمین هوشمند</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('normal')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'normal'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>عادی</span>
                    <span className="text-xs font-normal opacity-70">(روان)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('peak')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'peak'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>عصر</span>
                    <span className="text-xs font-normal opacity-70">(شلوغ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('weekend')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'weekend'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>جمعه</span>
                    <span className="text-xs font-normal opacity-70">(تعطیلات)</span>
                  </button>
                </div>
              </div>
            )}
            {/* Row 3: Gallery Visit Duration Dropdown: 5 to 60 min (Default: 15 min) */}
            <div className="clay-card p-2 sm:p-2.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl border border-[#E1E1E1]/80 dark:border-stone-800 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-bold text-sm pr-1">
                <Timer className="w-4 h-4 text-[#3D5B99] shrink-0" />
                <span>بازدید هر گالری</span>
              </div>
              <ClayDropdown
                value={String(visitDurationMin)}
                onChange={(val) => handleVisitDurationChange(Number(val))}
                options={VISIT_OPTIONS.map((m) => ({
                  value: String(m),
                  label: `${toPersianDigits(m)} دقیقه`,
                  badge: m === 15 ? 'پیش‌فرض' : m === 60 ? '۱ ساعت' : undefined,
                }))}
                size="sm"
                align="left"
              />
            </div>
          </div>
        )}
      </div>

      {/* TRIP STATS & INSIGHTS CARD: Harmonious, balanced, and clean */}
      {routeResult && (
        <div className="p-3 sm:p-3.5 bg-[#f7f9fc] dark:bg-[#131722] border-b border-[#E1E1E1] dark:border-stone-800 space-y-2.5">
          {/* خلاصه‌ی گشت: یک کارت با چهار کاشی هم‌شکل (همان زبان کارت‌های گالری) + یادداشت‌ها با آیکون، بدون جعبه‌های رنگی جدا */}
          {(() => {
            const sol = routeResult.tspTwSolution;
            const note = 'flex items-start gap-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300';
            const notes: React.ReactNode[] = [];
            if (sol && (sol.departureDelayMinutes ?? 0) > 0) {
              notes.push(
                <div key="delay" className={note}>
                  <Clock className="w-4 h-4 mt-0.5 shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]" aria-hidden="true" />
                  <span>گالری‌ها هنوز باز نیستند؛ ساعت حرکت طوری تنظیم شده که سر ساعت باز شدن برسی.</span>
                </div>
              );
            }
            if (routeResult.trafficZoneWarningsCount > 0) {
              notes.push(
                <div key="zone" className={note}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#F76B1C]" aria-hidden="true" />
                  <span>{toPersianDigits(routeResult.trafficZoneWarningsCount)} گالری در محدوده‌ی طرح ترافیک است.</span>
                </div>
              );
            }
            if (trafficCondition === 'peak' && trafficDelayMin > 0) {
              notes.push(
                <div key="peak" className={note}>
                  <Car className="w-4 h-4 mt-0.5 shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]" aria-hidden="true" />
                  <span>ترافیک عصر حدود {toPersianDigits(trafficDelayMin)} دقیقه به رانندگی اضافه می‌کند.</span>
                </div>
              );
            }
            if (sol?.suggestedEarlierStartMinutes) {
              notes.push(
                <div key="earlier" className={note}>
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-[#F76B1C]" aria-hidden="true" />
                  <span>اگر {toPersianDigits(sol.suggestedEarlierStartMinutes)} دقیقه زودتر راه بیفتی، به همه‌ی گالری‌ها پیش از تعطیلی می‌رسی.</span>
                </div>
              );
            }
            if (sol && sol.droppedStops.length > 0) {
              notes.push(
                <div key="dropped" className={note}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-700 dark:text-rose-300">
                      به {toPersianDigits(sol.droppedStops.length)} گالری پیش از تعطیلی نمی‌رسی:
                    </span>
                    {sol.droppedStops.map((d, i) => (
                      <div key={i}>
                        {d.name || `ایستگاه ${toPersianDigits(d.nodeIndex + 1)}`}: تعطیلی {toPersianDigits(d.closingTimeFormatted)}، رسیدن حدود {toPersianDigits(d.earliestPossibleArrivalFormatted)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            // همان الگوی ردیف «بازدید هر گالری»: کارت رسی خاکستری، برچسب با آیکون راست، مقدار در قرص سفید چپ
            const row = 'flex items-center justify-between gap-2 py-2.5';
            const rowLabel = 'flex items-center gap-2 text-stone-700 dark:text-stone-300 font-bold text-sm pr-1';
            // مقدارها متن ساده‌اند، نه قرص: قرص سفید در این اپ یعنی «قابل کلیک»
            const pill = 'pl-2 text-sm font-bold text-[#1d2d4c] dark:text-white tabular-nums text-left';
            return (
              <div className="space-y-2.5">
                <div className="clay-card p-2 sm:p-2.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl border border-[#E1E1E1]/80 dark:border-stone-800 shadow-xs divide-y divide-[#E1E1E1]/70 dark:divide-stone-800">
                  <div className={row}>
                    <span className={rowLabel}><Timer className="w-4 h-4 text-[#3D5B99] shrink-0" aria-hidden="true" />کل گشت</span>
                    <span className={`${pill} !text-[#E05A10] dark:!text-[#ff8a3d]`}>
                      {avgHours > 0 ? `${toPersianDigits(avgHours)} ساعت و ` : ''}{toPersianDigits(avgMins)} دقیقه
                    </span>
                  </div>
                  {sol && (
                    <div className={row}>
                      <span className={rowLabel}><Clock className="w-4 h-4 text-[#3D5B99] shrink-0" aria-hidden="true" />حرکت تا پایان</span>
                      <span className={pill}>{toPersianDigits(sol.routeStartFormatted)} تا {toPersianDigits(sol.routeEndFormatted)}</span>
                    </div>
                  )}
                  <div className={row}>
                    <span className={rowLabel}>
                      {mode === 'walking'
                        ? <Footprints className="w-4 h-4 text-[#F76B1C] shrink-0" aria-hidden="true" />
                        : <Car className="w-4 h-4 text-[#3D5B99] shrink-0" aria-hidden="true" />}
                      {mode === 'walking' ? 'پیاده‌روی' : 'رانندگی'}
                    </span>
                    <span className={pill}>{formatDurationFa(routeResult.totalDurationMin)}، {formatDistanceFa(routeResult.totalDistanceKm)}</span>
                  </div>
                </div>
                {notes.length > 0 && <div className="space-y-2 px-1">{notes}</div>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Main Stops List (Spacious with comfortable measure) */}
      <div className="flex-1 overflow-y-auto px-2 py-3 sm:p-4 space-y-3 min-h-[160px]">
        {selectedGalleries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-stone-500">
            <MapPin className="w-10 h-10 stroke-1 mb-2 opacity-50 text-[#3D5B99]" />
            <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
              هنوز گالری‌ای انتخاب نکرده‌اید
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mt-1 leading-relaxed">
              ۴، ۵ یا ۶ گالری را از لیست یا بخش «گشت‌های هنری آماده» اضافه کنید تا بهترین توالی مسیر برایتان محاسبه شود.
            </p>
          </div>
        ) : !routeResult ? (
          <div className="space-y-3">
            <div className="text-xs text-stone-600 dark:text-stone-300 bg-[#ebf3fb] dark:bg-stone-900 p-3 rounded-2xl border border-[#A3C2E4]/40 dark:border-stone-800 flex items-start gap-2 leading-relaxed">
              <Info className="w-4 h-4 text-[#3D5B99] shrink-0 mt-0.5" />
              <span>
                شما {toPersianDigits(selectedGalleries.length)} گالری انتخاب کرده‌اید. برای محاسبه کوتاه‌ترین مسیر روی دکمه <strong>مسیریابی بهینه</strong> در بالای صفحه کلیک کنید.
              </span>
            </div>

            <div className="space-y-2">
              {selectedGalleries.map((g, idx) => (
                <div
                  key={g.id}
                  className="clay-card p-3 bg-white dark:bg-[#1a202c] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-6 h-6 rounded-full bg-[#E1E1E1] dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold flex items-center justify-center shrink-0">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-[#1d2d4c] dark:text-white truncate text-sm sm:text-base">
                        {getGalleryDisplayName(g)}
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 truncate text-sm">
                        {g.neighborhoodFa} · {formatGalleryAddress(g.addressFa || g.address)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveGallery(g.id)}
                    className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg"
                    title="حذف از گشت"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between pb-1 flex-wrap gap-2.5">
              <span>توالی توقف‌ها ({toPersianDigits(routeResult.orderedGalleries.length)} گالری)</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onReverseRoute}
                  className="clay-button clay-base text-sm font-bold px-3.5 py-2 min-h-10 rounded-xl flex items-center gap-1.5 text-stone-700 dark:text-stone-300 hover:text-[#F76B1C] hover:scale-105 active:scale-95 transition-all shadow-xs"
                  title="ترتیب گشت برعکس شود (آخرین گالری اول)"
                >
                  <ArrowUpDown className="w-4 h-4 text-[#F76B1C]" />
                  <span>مسیر معکوس</span>
                </button>
                <button
                  type="button"
                  onClick={onResetAutoOrder}
                  className="clay-button clay-base text-sm font-bold px-3.5 py-2 min-h-10 rounded-xl flex items-center gap-1.5 text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] hover:scale-105 active:scale-95 transition-all shadow-xs"
                  title="ترتیب دستی کنار گذاشته شود و بهترین ترتیب دوباره حساب شود"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>چینش خودکار</span>
                </button>
              </div>
            </div>

            <div className="relative pr-6 sm:pr-8 space-y-3 before:absolute before:right-3 sm:before:right-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-700">
              {/* Origin Point Stop (If user location/hub is active) */}
              {routeResult.originPoint && (
                <div className="relative group">
                  {/* Origin Pin on Timeline */}
                  <div className="absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 bg-emerald-600 text-white">
                    <Navigation className="w-3.5 h-3.5" />
                  </div>

                  {/* Origin Item Card */}
                  <div className="clay-card p-3 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 truncate">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 text-sm sm:text-base truncate">
                          <span>{routeResult.originPoint.name}</span>
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            مبدأ حرکت
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transit Leg 0: Origin to First Gallery */}
                  {routeResult.legs[0] && (
                    <div className="my-2.5 flex items-center justify-center">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f1f4fa] dark:bg-[#151a24] text-sm text-stone-600 dark:text-stone-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-2xs tabular-nums">
                        {mode === 'walking' ? (
                          <Footprints className="w-4 h-4 text-[#F76B1C]" />
                        ) : (
                          <Car className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="font-bold text-[#1d2d4c] dark:text-white">
                          حدود {toPersianDigits(routeResult.legs[0].durationWithTrafficMin || routeResult.legs[0].durationMin)} دقیقه تا اولین نگارخانه
                        </span>
                        <span className="font-medium text-stone-500 dark:text-stone-400">
                          ({formatDistanceFa(routeResult.legs[0].distanceKm)})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {routeResult.orderedGalleries.map((gallery, idx) => {
                const hasOrigin = Boolean(routeResult.originPoint);
                const isFirst = idx === 0;
                const isLast = idx === routeResult.orderedGalleries.length - 1;
                const leg = hasOrigin ? routeResult.legs[idx + 1] : routeResult.legs[idx];

                return (
                  <div key={gallery.id} className="relative group">
                    {/* Order Pin on Timeline */}
                    <div
                      className={`absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-sm font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 tabular-nums ${
                        isFirst && !hasOrigin
                          ? 'bg-[#1856C7] text-white'
                          : isLast && !routeResult.isRoundTrip
                          ? 'bg-[#F76B1C] text-white'
                          : 'bg-stone-800 text-white dark:bg-stone-700'
                      }`}
                    >
                      {toPersianDigits(idx + 1)}
                    </div>

                    {/* کارت توقف (فشرده): نام + اقدام‌ها ← نمایشگاه ← یک ردیف زمان ← یک ردیف کنترل/ناوبری */}
                    {(() => {
                      const scheduledStop = routeResult.tspTwSolution?.scheduledStops.find((s) => s.id === gallery.id);
                      const navBtn = 'clay-button clay-base w-11 h-11 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-stone-200/80 dark:border-stone-700';
                      const iconBtn = 'w-10 h-10 rounded-xl flex items-center justify-center text-stone-400 disabled:opacity-20 disabled:pointer-events-none hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors';
                      return (
                        <div className="clay-card p-3.5 bg-white dark:bg-[#1a202c] text-sm border border-stone-200 dark:border-stone-800 shadow-xs space-y-2.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => onSelectGallery(gallery)}
                                className="font-bold text-[#1d2d4c] dark:text-white hover:text-[#F76B1C] block leading-snug text-base truncate max-w-full text-right"
                              >
                                {getGalleryDisplayName(gallery)}
                              </button>
                              <div className="text-sm text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                {gallery.neighborhoodFa} · {formatGalleryAddress(gallery.addressFa || gallery.address)}
                              </div>
                            </div>
                            <div className="flex items-center shrink-0 -ml-1">
                              <button type="button" disabled={idx === 0} onClick={() => onMoveStop?.(idx, idx - 1)} className={`${iconBtn} hover:text-[#3D5B99]`} title="یک توقف جلوتر" aria-label="یک توقف جلوتر">
                                <ArrowUp className="w-5 h-5" />
                              </button>
                              <button type="button" disabled={isLast} onClick={() => onMoveStop?.(idx, idx + 1)} className={`${iconBtn} hover:text-[#3D5B99]`} title="یک توقف عقب‌تر" aria-label="یک توقف عقب‌تر">
                                <ArrowDown className="w-5 h-5" />
                              </button>
                              <button type="button" onClick={() => onRemoveGallery(gallery.id)} className={`${iconBtn} hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40`} title="حذف این توقف" aria-label="حذف این توقف">
                                <Trash2 className="w-[18px] h-[18px]" />
                              </button>
                            </div>
                          </div>

                          {gallery.activeExhibition && (
                            <div className="min-w-0">
                              <div className="font-exhibit text-xl text-[#E05A10] dark:text-[#ff8a3d] truncate">
                                {gallery.activeExhibition.title}
                              </div>
                              {gallery.activeExhibition.artist && (
                                <div className="text-sm text-stone-600 dark:text-stone-300 truncate" title={gallery.activeExhibition.artist}>
                                  {gallery.activeExhibition.artist}
                                </div>
                              )}
                            </div>
                          )}

                          {scheduledStop && (
                            <div className="flex items-center gap-x-2.5 gap-y-1.5 flex-wrap text-sm tabular-nums">
                              <span className="inline-flex items-center gap-1 font-bold text-stone-700 dark:text-stone-200">
                                <Clock className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" aria-hidden="true" />
                                <span>{toPersianDigits(scheduledStop.visitStartFormatted)} تا {toPersianDigits(scheduledStop.departureTimeFormatted)}</span>
                              </span>
                              {scheduledStop.waitMinutes >= 5 && (
                                <span
                                  className="px-2.5 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/40 text-[#1856C7] dark:text-[#93c5fd] font-bold"
                                  title={`ساعت ${scheduledStop.arrivalTimeFormatted} می‌رسی ولی گالری ${scheduledStop.visitStartFormatted} باز می‌شود`}
                                >
                                  {formatDurationFa(scheduledStop.waitMinutes)} صبر تا باز شدن
                                </span>
                              )}
                              {scheduledStop.isCompressedVisit && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold inline-flex items-center gap-1">
                                  <Zap className="w-3 h-3" aria-hidden="true" />
                                  <span>بازدید کوتاه</span>
                                </span>
                              )}
                              {scheduledStop.slackMinutesBeforeClose >= 0 && scheduledStop.slackMinutesBeforeClose <= 60 && (
                                <span className="text-stone-500 dark:text-stone-400">
                                  تعطیلی {toPersianDigits(scheduledStop.closingTimeFormatted)}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-2.5 pt-3 border-t border-stone-100 dark:border-stone-800/80">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* شروع/پایان: همان کنترل دوتایی «با خودرو / پیاده‌روی»؛ گزینه‌ی فعال قرص سفید برجسته */}
                              <div className="p-1 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-xl flex items-center gap-1 border border-[#E1E1E1]/80 dark:border-stone-800">
                                {(() => {
                                  const seg = 'min-h-9 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-1.5';
                                  const on = 'clay-button clay-base text-[#1d2d4c] dark:text-white shadow-xs';
                                  const off = 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200';
                                  const startLabel = hasOrigin ? 'اولین مقصد' : 'شروع';
                                  return (
                                    <>
                                      <button
                                        type="button"
                                        aria-pressed={isFirst}
                                        disabled={isFirst}
                                        onClick={() => onSetStartGallery?.(gallery.id)}
                                        className={`${seg} ${isFirst ? `${on} cursor-default` : off}`}
                                        title={isFirst
                                          ? (hasOrigin ? 'بعد از مبدأ، اول به این گالری می‌روی' : 'گشت از این گالری شروع می‌شود')
                                          : (hasOrigin ? 'اول به این گالری برو؛ ترتیب بقیه دوباره بهینه می‌شود' : 'گشت از این گالری شروع شود؛ ترتیب بقیه دوباره بهینه می‌شود')}
                                      >
                                        <Navigation className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" aria-hidden="true" />
                                        <span>{startLabel}</span>
                                      </button>
                                      {!routeResult.isRoundTrip && (
                                        <button
                                          type="button"
                                          aria-pressed={isLast}
                                          disabled={isLast}
                                          onClick={() => onSetEndGallery?.(gallery.id)}
                                          className={`${seg} ${isLast ? `${on} cursor-default` : off}`}
                                          title={isLast ? 'گشت در این گالری تمام می‌شود' : 'گشت در این گالری تمام شود؛ ترتیب بقیه دوباره بهینه می‌شود'}
                                        >
                                          <Flag className="w-4 h-4 text-[#F76B1C] shrink-0" aria-hidden="true" />
                                          <span>پایان</span>
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0" role="group" aria-label={`مسیریابی تا ${getGalleryDisplayName(gallery)}`}>
                              <a href={buildNeshanUrl(gallery, undefined, mode)} target="_blank" rel="noopener noreferrer" className={navBtn} title="باز کردن مسیر تا این گالری در نشان" aria-label="باز کردن مسیر تا این گالری در نشان">
                                <NeshanIcon className="w-[22px] h-[22px]" />
                              </a>
                              <a href={buildWazeUrl(gallery)} target="_blank" rel="noopener noreferrer" className={navBtn} title="باز کردن مسیر تا این گالری در Waze" aria-label="باز کردن مسیر تا این گالری در Waze">
                                <WazeIcon className="w-[22px] h-[22px]" />
                              </a>
                              <a href={buildGoogleMapsUrl([gallery], undefined, mode)} target="_blank" rel="noopener noreferrer" className={navBtn} title="باز کردن مسیر تا این گالری در Google Maps" aria-label="باز کردن مسیر تا این گالری در Google Maps">
                                <GoogleMapsIcon className="w-[22px] h-[22px]" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Transit Leg Info: Clean Centered Travel Pill */}
                    {leg && (
                      <div className="my-2.5 flex items-center justify-center">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f1f4fa] dark:bg-[#151a24] text-sm text-stone-600 dark:text-stone-300 border border-stone-200/70 dark:border-stone-800 shadow-2xs tabular-nums">
                          {mode === 'walking' ? (
                            <Footprints className="w-4 h-4 text-[#F76B1C]" />
                          ) : (
                            <Car className="w-4 h-4 text-[#3D5B99]" />
                          )}
                          <span className="font-bold text-[#1d2d4c] dark:text-white">
                            حدود {toPersianDigits(leg.durationWithTrafficMin || leg.durationMin)} دقیقه {isLast && routeResult.isRoundTrip ? 'بازگشت به مبدأ' : mode === 'walking' ? 'پیاده' : 'رانندگی'}
                          </span>
                          <span className="font-medium text-stone-500 dark:text-stone-400">
                            ({formatDistanceFa(leg.distanceKm)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Final Return Card for Round-Trip */}
              {routeResult.isRoundTrip && (
                <div className="relative group">
                  <div className="absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 bg-amber-600 text-white tabular-nums">
                    🏁
                  </div>
                  <div className="clay-card p-3 bg-amber-50/70 dark:bg-amber-950/30 text-xs border border-amber-200 dark:border-amber-800/60 shadow-xs flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      بازگشت به {routeResult.originPoint ? routeResult.originPoint.name : 'نقطه آغاز (گالری اول)'}
                    </span>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                      پایان مسیر رفت‌وبرگشت
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION & EXPORT ACTIONS: 2x2 GRID AS REQUESTED */}
      {routeResult && (() => {
        const totalStops = routeResult.orderedGalleries.length;

        return (
          <div className="p-3 sm:p-4 pb-5 border-t border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] space-y-2.5 shrink-0">
            {/* کل گشت در گوگل‌مپ: یک خط، بدون برچسب اضافه */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-stone-800 dark:text-stone-100 shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group whitespace-nowrap"
              title={`باز کردن مسیر کامل شامل ${toPersianDigits(totalStops)} گالری در گوگل مپس`}
            >
              <GoogleMapsIcon className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm sm:text-base">
                کل گشت در <span className="font-ubuntu">Google Maps</span>
              </span>
            </a>

            <p className="text-xs text-stone-500 dark:text-stone-400 text-center leading-relaxed">
              همه‌ی {toPersianDigits(totalStops)} گالری به همین ترتیب. برای نشان یا Waze از دکمه‌های هر کارت استفاده کن.
            </p>

            {/* Utility Action: Copy Tour Itinerary */}
            <div>
              <button
                onClick={handleCopySummary}
                className="clay-button clay-base w-full py-3 px-4 text-stone-700 dark:text-stone-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-[#E1E1E1] dark:border-stone-700 shadow-sm hover:scale-[1.01] active:scale-95 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">متن برنامه بازدید کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4]" />
                    <span>کپی متن برنامه بازدید</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
