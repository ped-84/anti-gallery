import React, { useState, useEffect } from 'react';
import { RouteOptimizationResult, Gallery, CustomOrigin } from '../types/gallery';
import {
  toPersianDigits,
  TRAFFIC_MODELS,
  TrafficCondition,
  getGalleryDisplayName,
  formatGalleryAddress,
  TEHRAN_START_HUBS
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

    const textToCopy = `برنامه بازدید و تور بهینه گالری‌های هنری (${toPersianDigits(routeResult.orderedGalleries.length)} گالری)\n${originText}مسافت کل: ${toPersianDigits(routeResult.totalDistanceKm)} کیلومتر | زمان میانگین جابجایی: ~${toPersianDigits(routeResult.totalDurationMin)} دقیقه\n\n${summary}\n\nلینک مستقیم گوگل مپس: ${buildGoogleMapsUrl(routeResult.orderedGalleries, routeResult.originPoint, mode)}`;

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
    { value: 'gps', label: '📍 موقعیت من (GPS) - پیش‌فرض' },
    { value: 'none', label: '🏛️ شروع از اولین نگارخانه (بدون موقعیت من)' },
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
  const avgTotalTourTimeMin = (routeResult?.totalDurationMin || 0) + dwellTimeMin;
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
                <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>مبدأ حرکت (شروع مسیریابی):</span>
                </span>
                {originLocation?.type === 'gps' && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>موقعیت زنده GPS</span>
                  </span>
                )}
                {originLocation?.type === 'hub' && (
                  <span className="text-xs font-bold text-[#1856C7] dark:text-[#93c5fd]">
                    محله انتخابی
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {/* 1-Click GPS Button */}
                <button
                  type="button"
                  onClick={onRequestGps}
                  className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                    originLocation?.type === 'gps'
                      ? 'clay-button bg-emerald-600 text-white shadow-xs'
                      : 'clay-button clay-base text-stone-700 dark:text-stone-300 hover:text-emerald-600'
                  }`}
                  title="مسیریابی از موقعیت مکانی فعلی شما"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                  <span>{isLocatingGps ? 'دریافت موقعیت...' : 'موقعیت من (GPS)'}</span>
                </button>

                {/* Dropdown for Hubs or Gallery-Start */}
                <div className="flex-1">
                  <ClayDropdown
                    value={currentOriginValue}
                    onChange={handleOriginChange}
                    options={originDropdownOptions}
                    prefix={<MapPin className="w-3.5 h-3.5 text-[#3D5B99]" />}
                    className="w-full text-xs"
                    size="sm"
                  />
                </div>
              </div>

              {originLocation && (
                <div className="px-1 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between border-t border-stone-200/60 dark:border-stone-800 pt-1.5">
                  <span>مبدأ فعال: <strong>{originLocation.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => onChangeOrigin(null)}
                    className="text-rose-500 hover:text-rose-600 font-bold"
                  >
                    حذف مبدأ (شروع از گالری اول)
                  </button>
                </div>
              )}
            </div>
            {/* Row 1: Mode Switch & Route Pattern (Two spacious, balanced Segmented Controls) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Mode: Driving vs Walking */}
              <div className="clay-card p-1.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl flex items-center border border-[#E1E1E1]/80 dark:border-stone-800 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleModeChange('driving')}
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
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
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
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
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
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
                  className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
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
                  <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#F76B1C]" />
                    <span>ساعت حرکت در ترافیک تهران:</span>
                  </span>
                  <span className="text-[11px] font-medium text-stone-400 hidden xs:inline">تخمین هوشمند</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('normal')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs sm:text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'normal'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>عادی</span>
                    <span className="text-[10px] font-normal opacity-70">(روان)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('peak')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs sm:text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'peak'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>عصر</span>
                    <span className="text-[10px] font-normal opacity-70">(شلوغ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrafficChange('weekend')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs sm:text-sm transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      trafficCondition === 'weekend'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>جمعه</span>
                    <span className="text-[10px] font-normal opacity-70">(تعطیلات)</span>
                  </button>
                </div>
              </div>
            )}
            {/* Row 3: Gallery Visit Duration Dropdown: 5 to 60 min (Default: 15 min) */}
            <div className="clay-card p-2 sm:p-2.5 bg-[#f0f3f8] dark:bg-stone-900/90 rounded-2xl border border-[#E1E1E1]/80 dark:border-stone-800 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-bold text-xs sm:text-sm pr-1">
                <Timer className="w-4 h-4 text-[#3D5B99] shrink-0" />
                <span>زمان بازدید هر گالری:</span>
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
        <div className="p-3 sm:p-3.5 bg-gradient-to-b from-[#f7f9fc] to-[#edf2f8] dark:from-[#131722] dark:to-[#0f121a] border-b border-[#E1E1E1] dark:border-stone-800 space-y-2.5">
          {/* Main Hero Summary Card */}
          <div className="clay-card p-3 sm:p-3.5 bg-white dark:bg-[#181d28] border border-[#E1E1E1]/80 dark:border-stone-800 flex items-center justify-between gap-2.5 shadow-xs rounded-xl">
            {/* Primary ETA: Tour Duration */}
            <div>
              <span className="text-[11px] sm:text-xs font-medium text-stone-500 dark:text-stone-400 block mb-0.5">
                زمان کل برنامه ({toPersianDigits(visitDurationMin)} دقیقه بازدید در هر گالری)
              </span>
              <span className="text-base sm:text-lg font-bold text-[#F76B1C] font-mono">
                {avgHours > 0 ? `${toPersianDigits(avgHours)} ساعت و ` : ''}{toPersianDigits(avgMins)} دقیقه
              </span>
            </div>

            {/* Secondary Transit Metrics */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#f0f4fa] dark:bg-stone-800 text-[#1d2d4c] dark:text-stone-200 border border-[#E1E1E1]/80 dark:border-stone-700/80 font-mono">
                {toPersianDigits(routeResult.totalDistanceKm)} کیلومتر مسافت
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#f0f4fa] dark:bg-stone-800 text-[#1d2d4c] dark:text-stone-200 border border-[#E1E1E1]/80 dark:border-stone-700/80 font-mono">
                ~{toPersianDigits(routeResult.totalDurationMin)} دقیقه {mode === 'walking' ? 'پیاده' : 'رانندگی'}
              </span>
            </div>
          </div>

          {/* Context Alert Chips: Traffic Zone & Peak Delay */}
          {(routeResult.trafficZoneWarningsCount > 0 || (trafficCondition === 'peak' && trafficDelayMin > 0)) && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {routeResult.trafficZoneWarningsCount > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 px-2.5 py-1 rounded-lg shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{toPersianDigits(routeResult.trafficZoneWarningsCount)} نگارخانه در محدوده طرح ترافیک</span>
                </div>
              )}
              {trafficCondition === 'peak' && trafficDelayMin > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F76B1C] bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/60 px-2.5 py-1 rounded-lg shadow-2xs">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>ترافیک عصر: +{toPersianDigits(trafficDelayMin)} دقیقه تاخیر احتمالی</span>
                </div>
              )}
            </div>
          )}

          {/* TSP-TW Time Window Insights */}
          {routeResult.tspTwSolution && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#1856C7] dark:text-[#93c5fd]">
                  <Clock className="w-4 h-4 shrink-0 text-[#1856C7] dark:text-[#93c5fd]" />
                  <span>بازه زمانی بهینه بازدید:</span>
                  <span className="font-mono text-sm">{toPersianDigits(routeResult.tspTwSolution.routeStartFormatted)} الی {toPersianDigits(routeResult.tspTwSolution.routeEndFormatted)}</span>
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                  (هماهنگ با ساعات کاری)
                </span>
              </div>

              {routeResult.tspTwSolution.suggestedEarlierStartMinutes && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">
                    <strong>پیشنهاد هوشمند:</strong> با {toPersianDigits(routeResult.tspTwSolution.suggestedEarlierStartMinutes)} دقیقه شروع زودتر، زمان کافی برای بازدید از تمامی گالری‌ها پیش از تعطیلی فراهم می‌شود.
                  </p>
                </div>
              )}

              {routeResult.tspTwSolution.droppedStops.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>هشدار تداخل ساعت کاری ({toPersianDigits(routeResult.tspTwSolution.droppedStops.length)} گالری):</span>
                  </div>
                  <div className="text-[11px] text-rose-800 dark:text-rose-300 space-y-0.5 pr-5">
                    {routeResult.tspTwSolution.droppedStops.map((d, i) => (
                      <div key={i}>
                        • <strong>{d.name || `ایستگاه ${toPersianDigits(d.nodeIndex + 1)}`}</strong>: ساعت {toPersianDigits(d.closingTimeFormatted)} بسته می‌شود (رسیدن تقریبی: ~{toPersianDigits(d.earliestPossibleArrivalFormatted)}).
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Stops List (Spacious with comfortable measure) */}
      <div className="flex-1 overflow-y-auto px-2 py-3.5 sm:p-4 space-y-3.5 min-h-[160px]">
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
                      <div className="text-stone-500 dark:text-stone-400 truncate text-[13px] sm:text-sm">
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
            <div className="text-xs sm:text-sm font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between pb-1 flex-wrap gap-2">
              <span>توالی توقف‌ها ({toPersianDigits(routeResult.orderedGalleries.length)} گالری)</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onReverseRoute}
                  className="clay-button clay-base text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 text-stone-700 dark:text-stone-300 hover:text-[#F76B1C] hover:scale-105 active:scale-95 transition-all shadow-xs"
                  title="معکوس کردن کامل مسیر (از آخر به اول)"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#F76B1C]" />
                  <span>مسیر معکوس</span>
                </button>
                <button
                  type="button"
                  onClick={onResetAutoOrder}
                  className="clay-button clay-base text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] hover:scale-105 active:scale-95 transition-all shadow-xs"
                  title="محاسبه مجدد کوتاه‌ترین مسیر کلی به صورت خودکار"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>چینش خودکار</span>
                </button>
              </div>
            </div>

            <div className="relative pr-6 sm:pr-8 space-y-3.5 before:absolute before:right-3 sm:before:right-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-700">
              {/* Origin Point Stop (If user location/hub is active) */}
              {routeResult.originPoint && (
                <div className="relative group">
                  {/* Origin Pin on Timeline */}
                  <div className="absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 bg-emerald-600 text-white">
                    <Navigation className="w-3.5 h-3.5" />
                  </div>

                  {/* Origin Item Card */}
                  <div className="clay-card p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 truncate">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 text-sm sm:text-base truncate">
                          <span>{routeResult.originPoint.name}</span>
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            مبدأ حرکت
                          </span>
                        </div>
                        <div className="text-[13px] text-stone-500 dark:text-stone-400 mt-0.5">
                          شروع حرکت از این نقطه به سمت نزدیک‌ترین نگارخانه منتخب شما
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transit Leg 0: Origin to First Gallery */}
                  {routeResult.legs[0] && (
                    <div className="my-2.5 flex items-center justify-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#151a24] text-xs text-stone-600 dark:text-stone-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-2xs font-mono">
                        {mode === 'walking' ? (
                          <Footprints className="w-3.5 h-3.5 text-[#F76B1C]" />
                        ) : (
                          <Car className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {toPersianDigits(routeResult.legs[0].distanceKm)} کیلومتر
                        </span>
                        <span className="text-stone-300 dark:text-stone-600">·</span>
                        <span className="font-bold text-[#1d2d4c] dark:text-white">
                          ~{toPersianDigits(routeResult.legs[0].durationWithTrafficMin || routeResult.legs[0].durationMin)} دقیقه تا اولین نگارخانه
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
                      className={`absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 font-mono ${
                        isFirst && !hasOrigin
                          ? 'bg-[#1856C7] text-white'
                          : isLast && !routeResult.isRoundTrip
                          ? 'bg-[#F76B1C] text-white'
                          : 'bg-stone-800 text-white dark:bg-stone-700'
                      }`}
                    >
                      {toPersianDigits(idx + 1)}
                    </div>

                    {/* Gallery Item Card */}
                    <div className="clay-card p-3.5 bg-white dark:bg-[#1a202c] text-xs border border-stone-200 dark:border-stone-800 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 truncate">
                          <span
                            onClick={() => onSelectGallery(gallery)}
                            className="font-black text-[#1d2d4c] dark:text-white hover:text-[#F76B1C] cursor-pointer block leading-snug text-base sm:text-[17px] truncate"
                          >
                            {getGalleryDisplayName(gallery)}
                          </span>
                          <div className="text-[13px] sm:text-sm text-stone-500 dark:text-stone-300 mt-0.5 truncate">
                            {gallery.neighborhoodFa} · {formatGalleryAddress(gallery.addressFa || gallery.address)}
                          </div>
                        </div>

                        {/* Stop Order & Actions: Up, Down, Trash */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onMoveStop?.(idx, idx - 1)}
                            className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-[#1856C7] disabled:opacity-20 disabled:pointer-events-none hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="جابجایی به یک توقف قبل‌تر (بالاتر)"
                          >
                            <ArrowUp className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => onMoveStop?.(idx, idx + 1)}
                            className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-[#1856C7] disabled:opacity-20 disabled:pointer-events-none hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="جابجایی به یک توقف بعدتر (پایین‌تر)"
                          >
                            <ArrowDown className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveGallery(gallery.id)}
                            className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف این توقف"
                          >
                            <Trash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </button>
                        </div>
                      </div>

                      {gallery.activeExhibition && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-[#F76B1C]/10 dark:bg-[#F76B1C]/20 text-[#F76B1C] dark:text-[#ff8a3d] font-black text-[14.5px] sm:text-[15px] border border-[#F76B1C]/20">
                              {gallery.activeExhibition.title}
                            </span>
                          </div>
                          {gallery.activeExhibition.artist && (
                            <p
                              className="text-stone-600 dark:text-stone-300 font-normal leading-relaxed line-clamp-2 text-[14.5px] sm:text-[15.5px]"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                              title={gallery.activeExhibition.artist}
                            >
                              آثار: {gallery.activeExhibition.artist}
                            </p>
                          )}
                        </div>
                      )}

                      {/* TSP-TW Schedule Info for this stop */}
                      {(() => {
                        const scheduledStop = routeResult.tspTwSolution?.scheduledStops.find(
                          (s) => s.id === gallery.id
                        );
                        if (!scheduledStop) return null;
                        return (
                          <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 font-bold font-mono">
                              <Clock className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                              <span>ورود: {toPersianDigits(scheduledStop.arrivalTimeFormatted)}</span>
                              <span className="text-stone-300 dark:text-stone-600">·</span>
                              <span>خروج: {toPersianDigits(scheduledStop.departureTimeFormatted)}</span>
                              <span className="text-stone-400 font-normal text-[11px]">
                                ({toPersianDigits(scheduledStop.effectiveDwellMinutes)} دقیقه)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {scheduledStop.isCompressedVisit && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold text-[11px] flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-amber-600" />
                                  <span>بازدید فشرده</span>
                                </span>
                              )}
                              {scheduledStop.waitMinutes > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[#1856C7] dark:text-[#93c5fd] font-bold text-[11px]">
                                  ⏳ {toPersianDigits(scheduledStop.waitMinutes)} دقیقه انتظار
                                </span>
                              )}
                              {scheduledStop.slackMinutesBeforeClose >= 0 && scheduledStop.slackMinutesBeforeClose <= 60 && (
                                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                                  (تعطیلی: {toPersianDigits(scheduledStop.closingTimeFormatted)})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Distinct Start / End Point Controls & Badges */}
                      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2 flex-wrap text-xs sm:text-[13px]">
                        {isFirst ? (
                          hasOrigin ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-[#1856C7] dark:text-[#93c5fd] bg-[#edf3ff] dark:bg-blue-950/40 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-[#1856C7]"></span>
                              <span>اولین توقف گالری</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-700/60 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>مبدأ گشت</span>
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetStartGallery?.(gallery.id)}
                            className="inline-flex items-center gap-1.5 font-bold text-[#1856C7] dark:text-[#93c5fd] hover:text-white hover:bg-[#1856C7] bg-[#edf3ff] dark:bg-blue-950/40 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-800/50 hover:scale-105 active:scale-95 transition-all shadow-2xs"
                            title={hasOrigin ? "این گالری به عنوان اولین مقصد بعد از خروج از خانه/مبدأ تعیین می‌شود" : "این گالری به عنوان نقطه شروع تعیین شده و باقی مسیر از اینجا بهینه می‌شود"}
                          >
                            <span>📍</span>
                            <span>{hasOrigin ? "اولین گالری بعد از مبدأ" : "شروع از این گالری"}</span>
                          </button>
                        )}

                        {!routeResult.isRoundTrip && (
                          isLast ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs">
                              <span>🏁</span>
                              <span>مقصد نهایی</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSetEndGallery?.(gallery.id)}
                              className="inline-flex items-center gap-1.5 font-medium text-stone-600 dark:text-stone-300 hover:text-white hover:bg-[#F76B1C] bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-xl border border-stone-200 dark:border-stone-700 hover:scale-105 active:scale-95 transition-all shadow-2xs"
                              title="تعیین این گالری به عنوان مقصد پایانی"
                            >
                              <span>🏁</span>
                              <span>پایان در اینجا</span>
                            </button>
                          )
                        )}
                      </div>

                      {/* Direct Navigation Quick Buttons for this stop */}
                      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11.5px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-[#F76B1C]" />
                          <span>ناوبری مستقیم به این توقف:</span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={buildNeshanUrl(gallery, undefined, mode)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="clay-button clay-base px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200 hover:scale-105 active:scale-95 transition-all shadow-2xs border border-stone-200/80 dark:border-stone-700"
                            title={`مسیریابی با نشان به سمت ${getGalleryDisplayName(gallery)}`}
                          >
                            <NeshanIcon className="w-[18px] h-[18px] shrink-0" />
                            <span>نشان</span>
                          </a>
                          <a
                            href={buildWazeUrl(gallery)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="clay-button clay-base px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200 hover:scale-105 active:scale-95 transition-all shadow-2xs border border-stone-200/80 dark:border-stone-700"
                            title={`مسیریابی با ویز به سمت ${getGalleryDisplayName(gallery)}`}
                          >
                            <WazeIcon className="w-[18px] h-[18px] shrink-0" />
                            <span className="font-ubuntu">Waze</span>
                          </a>
                          <a
                            href={buildGoogleMapsUrl([gallery], undefined, mode)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="clay-button clay-base px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200 hover:scale-105 active:scale-95 transition-all shadow-2xs border border-stone-200/80 dark:border-stone-700"
                            title={`مسیریابی با گوگل مپس به سمت ${getGalleryDisplayName(gallery)}`}
                          >
                            <GoogleMapsIcon className="w-[18px] h-[18px] shrink-0" />
                            <span className="font-ubuntu">Google</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Transit Leg Info: Clean Centered Travel Pill */}
                    {leg && (
                      <div className="my-2.5 flex items-center justify-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#151a24] text-xs text-stone-600 dark:text-stone-300 border border-stone-200/70 dark:border-stone-800 shadow-2xs font-mono">
                          {mode === 'walking' ? (
                            <Footprints className="w-3.5 h-3.5 text-[#F76B1C]" />
                          ) : (
                            <Car className="w-3.5 h-3.5 text-[#3D5B99]" />
                          )}
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {toPersianDigits(leg.distanceKm)} کیلومتر
                          </span>
                          <span className="text-stone-300 dark:text-stone-600">·</span>
                          <span className="font-bold text-[#1d2d4c] dark:text-white">
                            ~{toPersianDigits(leg.durationWithTrafficMin || leg.durationMin)} دقیقه {isLast && routeResult.isRoundTrip ? 'بازگشت به مبدأ' : 'جابجایی'}
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
                  <div className="absolute -right-6 sm:-right-7.5 top-2 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 bg-amber-600 text-white font-mono">
                    🏁
                  </div>
                  <div className="clay-card p-3 bg-amber-50/70 dark:bg-amber-950/30 text-xs border border-amber-200 dark:border-amber-800/60 shadow-xs flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      بازگشت به {routeResult.originPoint ? routeResult.originPoint.name : 'نقطه آغاز (گالری اول)'}
                    </span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
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
          <div className="p-4 sm:p-5 pb-7 border-t border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] space-y-3 shrink-0">
            <div className="text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between">
              <span className="text-sm font-bold">مسیریابی کل برنامه بازدید</span>
              <span className="text-xs text-stone-400 font-normal">کل مسیر یکپارچه</span>
            </div>

            {/* Primary Action: Google Maps Full Itinerary (Classic Clay Button Style) */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-3 text-stone-800 dark:text-stone-100 shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
              title={`باز کردن مسیر کامل شامل ${toPersianDigits(totalStops)} گالری در گوگل مپس`}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center">
                <GoogleMapsIcon className="w-full h-full drop-shadow-xs group-hover:scale-110 transition-transform" />
              </div>
              <span className="font-bold text-sm sm:text-base text-stone-800 dark:text-stone-100 tracking-tight">
                مسیریابی یکپارچه کل گشت
              </span>
              <span className="text-[11px] font-ubuntu font-bold bg-[#3D5B99]/10 dark:bg-[#A3C2E4]/20 text-[#3D5B99] dark:text-[#A3C2E4] px-2.5 py-0.5 rounded-full">
                Google Maps
              </span>
            </a>

            {/* Subtitle / Details (Placed Outside, Above the Bulb Line) */}
            <p className="text-xs text-stone-600 dark:text-stone-300 text-center font-medium leading-relaxed">
              مسیر پیوسته با ترتیب بهینه شامل تمام {toPersianDigits(totalStops)} گالری و تخمین ترافیک تهران
            </p>

            {/* Subtle contextual hint */}
            <p className="text-[11px] text-stone-500 dark:text-stone-400 text-center leading-relaxed">
              💡 برای مسیریابی مرحله‌به‌مرحله به یک گالری خاص با <strong>نشان</strong> یا <strong>Waze</strong>، از دکمه‌های مستقیم داخل کارت همان گالری استفاده کنید.
            </p>

            {/* Utility Action: Copy Tour Itinerary */}
            <div className="pt-0.5">
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
