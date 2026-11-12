import React, { useState, useMemo, useEffect } from 'react';
import { getCuratedToursByMode, PersianCuratedTour, CuratedTourFilterMode } from '../data/curatedTours';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
import { X, Clock, ArrowLeft, Flame, Sparkles, MapPin } from 'lucide-react';

interface CuratedToursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTour: (tour: PersianCuratedTour) => void;
  allGalleries: Gallery[];
  initialMode?: CuratedTourFilterMode;
  onModeChange?: (mode: CuratedTourFilterMode) => void;
}

const THEME_BUTTON_CLASSES = {
  darkblue: 'clay-darkblue text-white',
  orange: 'clay-orange text-white',
  softblue: 'clay-softblue text-[#10335e]',
  gray: 'clay-gray text-stone-900'
};

export const CuratedToursModal: React.FC<CuratedToursModalProps> = ({
  isOpen,
  onClose,
  onSelectTour,
  allGalleries,
  initialMode = 'openings-only',
  onModeChange
}) => {
  const [activeTab, setActiveTab] = useState<CuratedTourFilterMode>(initialMode);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  const handleTabChange = (mode: CuratedTourFilterMode) => {
    setActiveTab(mode);
    onModeChange?.(mode);
  };

  // Dynamically compute curated tours strictly based on the chosen mode
  const curatedTours = useMemo(() => {
    return getCuratedToursByMode(allGalleries, activeTab);
  }, [allGalleries, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-stone-950/75 backdrop-blur-md animate-fade-in font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="clay-card relative w-full max-w-4xl bg-white dark:bg-[#181d27] rounded-3xl overflow-hidden flex flex-col max-h-[92vh] border border-[#E1E1E1] dark:border-stone-800 shadow-2xl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] shrink-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl clay-card flex items-center justify-center text-white shrink-0 shadow-md ${
                  activeTab === 'openings-only' ? 'clay-orange' : 'clay-darkblue'
                }`}
              >
                {activeTab === 'openings-only' ? (
                  <Flame className="w-6 h-6 text-white animate-pulse" />
                ) : (
                  <Sparkles className="w-6 h-6 text-[#A3C2E4]" />
                )}
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-[#1d2d4c] dark:text-white tracking-tight">
                  گشت‌های هنری و تورهای آماده
                </h2>
                <p className="text-xs sm:text-sm text-[#3D5B99] dark:text-[#A3C2E4] font-medium mt-0.5">
                  {activeTab === 'openings-only'
                    ? 'مسیرهای متمرکز و نزدیک منحصراً بین نگارخانه‌های دارای افتتاحیه این هفته'
                    : 'مسیرهای پیوسته و جذاب شامل افتتاحیه‌ها و گالری‌های فعالِ میان‌راه'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full clay-button clay-base text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all shrink-0 cursor-pointer hover:scale-105 active:scale-95"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dual Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 gap-1.5 text-xs sm:text-sm font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('openings-only')}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'openings-only'
                  ? 'bg-white dark:bg-[#1f2636] text-[#F76B1C] shadow-sm font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Flame className={`w-4 h-4 ${activeTab === 'openings-only' ? 'text-[#F76B1C]' : 'opacity-70'}`} />
              <span>فقط افتتاحیه‌های این هفته</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('all-active')}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'all-active'
                  ? 'bg-white dark:bg-[#1f2636] text-[#1856C7] dark:text-[#93c5fd] shadow-sm font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === 'all-active' ? 'text-[#1856C7] dark:text-[#93c5fd]' : 'opacity-70'}`} />
              <span>همه گالری‌های باز و فعال</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {curatedTours.map((tour) => {
            const tourGalleries = allGalleries.filter((g) => tour.galleryIds.includes(g.id));
            const btnClass = THEME_BUTTON_CLASSES[tour.themeColor] || 'clay-orange text-white';

            return (
              <div
                key={tour.id}
                className="clay-card p-4.5 sm:p-6 bg-white dark:bg-[#1b212e] hover:scale-[1.006] transition-all group border border-[#E1E1E1]/90 dark:border-stone-800 shadow-sm rounded-2xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    {/* Badge and Neighborhood */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {tour.isOpeningThisWeek ? (
                        <span className="text-xs sm:text-sm font-bold text-[#F76B1C] bg-[#F76B1C]/10 border border-[#F76B1C]/25 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                          <Flame className="w-4 h-4 text-[#F76B1C]" />
                          <span>فقط افتتاحیه این هفته</span>
                        </span>
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-[#1856C7] dark:text-[#93c5fd] bg-[#edf3ff] dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                          <Sparkles className="w-4 h-4 text-[#1856C7] dark:text-[#93c5fd]" />
                          <span>گالری‌های باز و فعال (پیوسته)</span>
                        </span>
                      )}
                      <span className="text-stone-400">·</span>
                      <span className="text-xs sm:text-sm font-bold text-[#3D5B99] dark:text-[#A3C2E4] px-2.5 py-0.5 rounded-lg bg-stone-100 dark:bg-[#141822]">
                        محله {tour.neighborhoodFa}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-xl font-black text-[#1d2d4c] dark:text-white group-hover:text-[#F76B1C] transition-colors leading-snug">
                      {tour.titleFa}
                    </h3>
                    <p className="text-xs sm:text-base text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                      {tour.descriptionFa}
                    </p>
                  </div>

                  {/* Tour Quick Stats */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-200 dark:border-stone-800">
                    <span className="text-xs sm:text-base font-black text-[#1d2d4c] dark:text-stone-100 px-3 py-1 rounded-xl bg-stone-100 dark:bg-[#141822] border border-stone-200 dark:border-stone-700/60">
                      {toPersianDigits(tourGalleries.length)} گالری منتخب
                    </span>
                    <span className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 flex items-center gap-1.5 font-bold font-mono">
                      <Clock className="w-4 h-4 text-[#F76B1C]" />
                      <span>~{toPersianDigits(tour.estimatedHours)} ساعت بازدید</span>
                    </span>
                    {tour.maxHopKm && (
                      <span className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                        <MapPin className="w-4 h-4" />
                        <span>فاصله ایستگاه‌ها: زیر {toPersianDigits(tour.maxHopKm)} کیلومتر</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Galleries Preview list with Step-by-Step Chips */}
                <div className="mt-4 pt-3.5 border-t border-[#E1E1E1] dark:border-stone-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1d2d4c] dark:text-stone-200 mb-2">
                      <MapPin className="w-4 h-4 text-[#F76B1C] shrink-0" />
                      <span>ایستگاه‌های این مسیر به ترتیب بازدید:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                      {tourGalleries.map((g, idx) => {
                        const name = getGalleryDisplayName(g);
                        const exTitle = g.activeExhibition?.title;
                        return (
                          <React.Fragment key={g.id}>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#f4f6fa] dark:bg-[#131722] text-[#1d2d4c] dark:text-stone-200 font-medium border border-stone-200/80 dark:border-stone-700/60 shadow-2xs">
                              <span className="w-4.5 h-4.5 rounded-full bg-[#3D5B99] text-white text-[10px] flex items-center justify-center font-ubuntu font-bold shrink-0">
                                {toPersianDigits(idx + 1)}
                              </span>
                              <span className="font-bold">{name}</span>
                              {exTitle && (
                                <span className="text-stone-500 dark:text-stone-400 text-[11px] font-normal truncate max-w-[140px] sm:max-w-[200px]">
                                  ({exTitle})
                                </span>
                              )}
                            </span>
                            {idx < tourGalleries.length - 1 && (
                              <span className="text-stone-400 text-xs font-bold px-0.5">←</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectTour(tour);
                      onClose();
                    }}
                    className={`clay-button ${btnClass} px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md hover:brightness-105 shrink-0 rounded-xl cursor-pointer w-full md:w-auto mt-2 md:mt-0`}
                  >
                    <span>بارگذاری و مشاهده مسیر</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
