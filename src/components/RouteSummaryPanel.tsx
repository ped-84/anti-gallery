import React, { useState } from 'react';
import { RouteOptimizationResult, Gallery } from '../types/gallery';
import {
  toPersianDigits,
  TRAFFIC_MODELS,
  TrafficCondition,
  getGalleryDisplayName
} from '../utils/persianUtils';
import {
  buildGoogleMapsUrl,
  buildNeshanUrl,
  buildBaladUrl,
  buildWazeUrl,
  exportToGpx
} from '../utils/routeOptimizer';
import { GoogleMapsIcon, WazeIcon, NeshanIcon, BaladIcon } from './NavIcons';
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
  Info
} from 'lucide-react';

interface RouteSummaryPanelProps {
  routeResult: RouteOptimizationResult | null;
  selectedGalleries: Gallery[];
  isOptimizing: boolean;
  onRemoveGallery: (galleryId: number) => void;
  onClearAll: () => void;
  onRecalculate: (
    mode: 'driving' | 'walking',
    isRoundTrip: boolean,
    trafficCondition: TrafficCondition
  ) => void;
  onSelectGallery: (gallery: Gallery) => void;
}

export const RouteSummaryPanel: React.FC<RouteSummaryPanelProps> = ({
  routeResult,
  selectedGalleries,
  isOptimizing,
  onRemoveGallery,
  onClearAll,
  onRecalculate,
  onSelectGallery
}) => {
  const [mode, setMode] = useState<'driving' | 'walking'>(routeResult?.mode || 'driving');
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(routeResult?.isRoundTrip ?? false);
  const [trafficCondition, setTrafficCondition] = useState<TrafficCondition>(
    routeResult?.trafficCondition || 'peak'
  );
  const [copied, setCopied] = useState(false);

  const handleModeChange = (newMode: 'driving' | 'walking') => {
    setMode(newMode);
    onRecalculate(newMode, isRoundTrip, trafficCondition);
  };

  const handleRoundTripToggle = () => {
    const nextVal = !isRoundTrip;
    setIsRoundTrip(nextVal);
    onRecalculate(mode, nextVal, trafficCondition);
  };

  const handleTrafficChange = (cond: TrafficCondition) => {
    setTrafficCondition(cond);
    onRecalculate(mode, isRoundTrip, cond);
  };

  const handleDownloadGpx = () => {
    if (!routeResult) return;
    const gpxContent = exportToGpx(
      'تور بهینه گالری‌های هنری',
      routeResult.orderedGalleries,
      routeResult.geometryCoords
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
  };

  const handleCopySummary = () => {
    if (!routeResult) return;
    const summary = routeResult.orderedGalleries
      .map(
        (g, i) =>
          `${toPersianDigits(i + 1)}. ${getGalleryDisplayName(g)} - ${g.addressFa || g.address} (${g.neighborhoodFa || g.cityFa || g.city})`
      )
      .join('\n\n');

    const textToCopy = `برنامه بازدید و تور بهینه گالری‌های هنری (${toPersianDigits(routeResult.orderedGalleries.length)} گالری)\nمسافت کل: ${toPersianDigits(routeResult.totalDistanceKm)} کیلومتر | زمان میانگین جابجایی: ~${toPersianDigits(routeResult.totalDurationMin)} دقیقه\n\n${summary}\n\nلینک مستقیم گوگل مپس: ${buildGoogleMapsUrl(routeResult.orderedGalleries)}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const googleMapsUrl = routeResult
    ? buildGoogleMapsUrl(routeResult.orderedGalleries)
    : '';

  // Calculate Average Times as the main large metrics
  const dwellTimeMin = (routeResult?.orderedGalleries.length || 0) * 45;
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

        {/* Travel Mode & Round-trip segmented controls (Spacious & Clean Layout) */}
        {selectedGalleries.length >= 2 && (
          <div className="mt-3.5 space-y-2.5">
            {/* Row 1: Travel Mode & Tour Pattern */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Mode: Car vs Walking */}
              <div className="flex items-center justify-between p-1 bg-[#E1E1E1]/60 dark:bg-stone-800/80 rounded-2xl">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 pr-2.5">تردد:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleModeChange('driving')}
                    className={`px-3 py-1.5 font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      mode === 'driving'
                        ? 'clay-base text-[#1d2d4c] dark:text-white shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5 text-[#3D5B99]" />
                    <span>خودرو</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('walking')}
                    className={`px-3 py-1.5 font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      mode === 'walking'
                        ? 'clay-base text-[#1d2d4c] dark:text-white shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5 text-[#F76B1C]" />
                    <span>پیاده</span>
                  </button>
                </div>
              </div>

              {/* Tour Pattern: End at last gallery vs Round-trip loop */}
              <div className="flex items-center justify-between p-1 bg-[#E1E1E1]/60 dark:bg-stone-800/80 rounded-2xl">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 pr-2.5">مسیر:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isRoundTrip) {
                        setIsRoundTrip(false);
                        onRecalculate(mode, false, trafficCondition);
                      }
                    }}
                    className={`px-2.5 py-1.5 font-bold rounded-xl transition-all ${
                      !isRoundTrip
                        ? 'clay-base text-[#1d2d4c] dark:text-white shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                    title="پایان در گالری آخر"
                  >
                    تک‌مسیره
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isRoundTrip) {
                        setIsRoundTrip(true);
                        onRecalculate(mode, true, trafficCondition);
                      }
                    }}
                    className={`px-2.5 py-1.5 font-bold rounded-xl transition-all flex items-center gap-1 ${
                      isRoundTrip
                        ? 'clay-darkblue text-white shadow-md'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                    title="بازگشت به گالری مبدا"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>رفت‌وبرگشت</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Traffic Scenario Selector (Clear full labels, no cut-offs) */}
            {mode === 'driving' && (
              <div className="pt-2 border-t border-[#E1E1E1]/70 dark:border-stone-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#F76B1C]" />
                    <span>ساعت حرکت در تهران:</span>
                  </span>
                  <span className="text-[10px] text-stone-400">تخمین ترافیک هوشمند</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {(Object.keys(TRAFFIC_MODELS) as TrafficCondition[]).map((cond) => {
                    const conf = TRAFFIC_MODELS[cond];
                    const isActive = trafficCondition === cond;
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => handleTrafficChange(cond)}
                        className={`py-2 px-1 rounded-xl text-center font-bold transition-all truncate ${
                          isActive
                            ? 'clay-orange text-white shadow-sm'
                            : 'clay-base text-stone-600 dark:text-stone-400 hover:bg-[#E1E1E1]/40 dark:hover:bg-stone-800'
                        }`}
                      >
                        {conf.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* METRICS & STATUS SUMMARY: Clean Unified Card Without Crowded Double Banners */}
      {routeResult && (
        <div className="p-3.5 bg-[#f4f7fb] dark:bg-[#12161f] border-b border-[#E1E1E1] dark:border-stone-800 space-y-2.5">
          {/* 3 Metric Columns with large readable numbers */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-stone-200 dark:divide-stone-800 text-center">
            {/* Metric 1: Distance */}
            <div className="px-1 text-center">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-0.5">
                مسافت کل
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#1d2d4c] dark:text-white">
                {toPersianDigits(routeResult.totalDistanceKm)}{' '}
                <span className="text-[11px] font-normal text-stone-500">کیلومتر</span>
              </span>
            </div>

            {/* Metric 2: Average Transit Time */}
            <div className="px-1 text-center">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-0.5">
                زمان جابجایی
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#1d2d4c] dark:text-white">
                ~{toPersianDigits(routeResult.totalDurationMin)}{' '}
                <span className="text-[11px] font-normal text-stone-500">دقیقه</span>
              </span>
            </div>

            {/* Metric 3: Total Tour Day Average */}
            <div className="px-1 text-center">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-0.5">
                کل برنامه (میانگین)
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#F76B1C]">
                {avgHours > 0 ? `${toPersianDigits(avgHours)} ساعت و ` : ''}{toPersianDigits(avgMins)} دقیقه
              </span>
            </div>
          </div>

          {/* Combined Status Chips: Traffic zone & Peak condition (Gentle & informative) */}
          {(routeResult.trafficZoneWarningsCount > 0 || (trafficCondition === 'peak' && trafficDelayMin > 0)) && (
            <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-2 flex-wrap text-xs">
              {routeResult.trafficZoneWarningsCount > 0 && (
                <div className="inline-flex items-center gap-1.5 text-[#F76B1C] font-bold bg-[#feede4] dark:bg-[#381c0c]/70 px-2.5 py-1 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{toPersianDigits(routeResult.trafficZoneWarningsCount)} گالری در محدوده طرح ترافیک</span>
                </div>
              )}
              {trafficCondition === 'peak' && trafficDelayMin > 0 && (
                <div className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-300 font-medium bg-white dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                  <Clock className="w-3.5 h-3.5 text-[#F76B1C] shrink-0" />
                  <span>اوج عصر: تا +{toPersianDigits(trafficDelayMin)} دقیقه تاخیر</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Stops List (Spacious with comfortable measure) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[160px]">
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
                      <div className="font-bold text-[#1d2d4c] dark:text-white truncate">
                        {getGalleryDisplayName(g)}
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 truncate text-[11px]">
                        {g.neighborhoodFa} · {g.addressFa || g.address}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveGallery(g.id)}
                    className="text-stone-400 hover:text-rose-600 p-1"
                    title="حذف از تور"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between pb-1">
              <span>توالی بهینه توقف‌ها (کوتاه‌ترین مسافت و زمان)</span>
              <span className="text-[#F76B1C] font-bold">
                ترتیب بهینه بازدید
              </span>
            </div>

            <div className="relative pr-7 space-y-3.5 before:absolute before:right-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-700">
              {routeResult.orderedGalleries.map((gallery, idx) => {
                const leg = routeResult.legs[idx];
                const isFirst = idx === 0;
                const isLast = idx === routeResult.orderedGalleries.length - 1;

                return (
                  <div key={gallery.id} className="relative group">
                    {/* Order Pin on Timeline */}
                    <div
                      className={`absolute -right-7 top-2 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm z-10 font-mono ${
                        isFirst
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
                            className="font-bold text-[#1d2d4c] dark:text-white hover:text-[#F76B1C] cursor-pointer block leading-snug text-sm truncate"
                          >
                            {getGalleryDisplayName(gallery)}
                          </span>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                            {gallery.neighborhoodFa} · {gallery.addressFa || gallery.address}
                          </div>
                        </div>

                        <button
                          onClick={() => onRemoveGallery(gallery.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                          title="حذف این توقف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {gallery.activeExhibition && (
                        <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-1.5 flex-wrap text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-[#F76B1C]/10 text-[#F76B1C] font-bold">
                            نمایشگاه: {gallery.activeExhibition.title}
                          </span>
                          {gallery.activeExhibition.artist && (
                            <span className="text-stone-600 dark:text-stone-400 font-medium">
                              آثار: {gallery.activeExhibition.artist}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Transit Leg Info: Clean Centered Travel Pill */}
                    {leg && (
                      <div className="my-2.5 flex items-center justify-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#151a24] text-[11px] text-stone-600 dark:text-stone-300 border border-stone-200/70 dark:border-stone-800 shadow-2xs font-mono">
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
                            ~{toPersianDigits(leg.durationMin)} دقیقه جابجایی
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION & EXPORT ACTIONS: 2x2 GRID AS REQUESTED */}
      {routeResult && (
        <div className="p-4 sm:p-5 pb-7 border-t border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] space-y-3 shrink-0">
          <div className="text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between">
            <span>مسیریابی در اپلیکیشن‌ها</span>
            <span className="text-[10px] text-stone-400 font-normal">ترافیک زنده و ناوبری سخنگو</span>
          </div>

          {/* 2x2 Grid: Row 1 = Google Maps + Waze, Row 2 = نشان + بلد */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {/* 1. Google Maps */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3.5 px-3 text-center font-bold flex items-center justify-center gap-2.5 text-stone-800 dark:text-stone-100 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <GoogleMapsIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="font-sans font-bold text-sm tracking-wide">Google Maps</span>
            </a>

            {/* 2. Waze */}
            <a
              href={buildWazeUrl(routeResult.orderedGalleries[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3.5 px-3 text-center font-bold flex items-center justify-center gap-2.5 text-stone-800 dark:text-stone-100 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <WazeIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="font-sans font-bold text-sm tracking-wide">Waze</span>
            </a>

            {/* 3. نشان */}
            <a
              href={buildNeshanUrl(routeResult.orderedGalleries[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3.5 px-3 text-center font-bold flex items-center justify-center gap-2.5 text-stone-800 dark:text-stone-100 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <NeshanIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">نشان</span>
            </a>

            {/* 4. بلد */}
            <a
              href={buildBaladUrl(routeResult.orderedGalleries[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3.5 px-3 text-center font-bold flex items-center justify-center gap-2.5 text-stone-800 dark:text-stone-100 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <BaladIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">بلد</span>
            </a>
          </div>

          {/* Utility Action: Copy Tour Itinerary */}
          <div className="pt-1">
            <button
              onClick={handleCopySummary}
              className="clay-button clay-base w-full py-3 px-4 text-stone-700 dark:text-stone-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-[#E1E1E1] shadow-sm hover:scale-[1.01] active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">متن برنامه و آدرس‌ها کپی شد!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-[#3D5B99]" />
                  <span>کپی متن و مشخصات برنامه بازدید</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
