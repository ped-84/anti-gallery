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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-md animate-fade-in font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="clay-card relative w-full max-w-2xl bg-white dark:bg-[#181d27] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-[#E1E1E1] dark:border-stone-800 shadow-2xl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 truncate">
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl clay-card flex items-center justify-center text-white shrink-0 shadow-md ${
                  activeTab === 'openings-only' ? 'clay-orange' : 'clay-darkblue'
                }`}
              >
                {activeTab === 'openings-only' ? (
                  <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
                ) : (
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#A3C2E4]" />
                )}
              </div>
              <div className="truncate">
                <h2 className="text-base sm:text-lg font-bold text-[#1d2d4c] dark:text-white truncate">
                  گشت‌های هنری و تورهای آماده
                </h2>
                <p className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] font-medium truncate mt-0.5">
                  {activeTab === 'openings-only'
                    ? 'مسیرهای متمرکز و نزدیک منحصراً بین نگارخانه‌های دارای افتتاحیه این هفته'
                    : 'مسیرهای پیوسته و جذاب شامل افتتاحیه‌ها و گالری‌های فعالِ میان‌راه'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full clay-button clay-base text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all shrink-0"
              title="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dual Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('openings-only')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                activeTab === 'openings-only'
                  ? 'bg-white dark:bg-[#1f2636] text-[#F76B1C] shadow-sm font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${activeTab === 'openings-only' ? 'text-[#F76B1C]' : 'opacity-70'}`} />
              <span>فقط افتتاحیه‌های این هفته</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('all-active')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                activeTab === 'all-active'
                  ? 'bg-white dark:bg-[#1f2636] text-[#1856C7] dark:text-[#93c5fd] shadow-sm font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'all-active' ? 'text-[#1856C7] dark:text-[#93c5fd]' : 'opacity-70'}`} />
              <span>همه گالری‌های باز و فعال</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {curatedTours.map((tour) => {
            const tourGalleries = allGalleries.filter((g) => tour.galleryIds.includes(g.id));
            const btnClass = THEME_BUTTON_CLASSES[tour.themeColor] || 'clay-orange text-white';

            return (
              <div
                key={tour.id}
                className="clay-card p-4 sm:p-4.5 bg-white dark:bg-[#1b212e] hover:scale-[1.008] transition-all group border border-[#E1E1E1]/90 dark:border-stone-800 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div>
                    {/* Badge and Neighborhood */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {tour.isOpeningThisWeek ? (
                        <span className="text-xs sm:text-[13px] font-bold text-[#F76B1C] bg-[#F76B1C]/10 border border-[#F76B1C]/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <Flame className="w-3.5 h-3.5 text-[#F76B1C]" />
                          <span>فقط افتتاحیه این هفته</span>
                        </span>
                      ) : (
                        <span className="text-xs sm:text-[13px] font-bold text-[#1856C7] dark:text-[#93c5fd] bg-[#edf3ff] dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5 text-[#1856C7] dark:text-[#93c5fd]" />
                          <span>گالری‌های باز و فعال (پیوسته)</span>
                        </span>
                      )}
                      <span className="text-xs text-stone-400">·</span>
                      <span className="text-xs sm:text-[13px] font-bold text-[#3D5B99] dark:text-[#A3C2E4]">
                        {tour.neighborhoodFa}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[#1d2d4c] dark:text-white group-hover:text-[#F76B1C] transition-colors leading-snug">
                      {tour.titleFa}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                      {tour.descriptionFa}
                    </p>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-[#3D5B99] dark:text-[#A3C2E4] block">
                      {toPersianDigits(tourGalleries.length)} گالری
                    </span>
                    <span className="text-xs sm:text-[13px] text-stone-500 dark:text-stone-400 flex items-center justify-end gap-1 mt-1 font-medium font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{toPersianDigits(tour.estimatedHours)} ساعت</span>
                    </span>
                    {tour.maxHopKm && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-1 font-medium">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>فاصله ایستگاه‌ها: زیر {toPersianDigits(tour.maxHopKm)} کم</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Galleries Preview list with Exhibition Titles */}
                <div className="mt-3.5 pt-3 border-t border-[#E1E1E1] dark:border-stone-800/80 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 overflow-hidden flex-1 min-w-[200px]">
                    <span className="font-bold text-[#1d2d4c] dark:text-stone-200 shrink-0">
                      شامل:
                    </span>
                    <span className="truncate">
                      {tourGalleries
                        .map((g) => {
                          const name = getGalleryDisplayName(g);
                          const exTitle = g.activeExhibition?.title;
                          return exTitle ? `${name} (${exTitle})` : name;
                        })
                        .join(' · ')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectTour(tour);
                      onClose();
                    }}
                    className={`clay-button ${btnClass} px-3.5 sm:px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm hover:brightness-105 shrink-0 rounded-xl`}
                  >
                    <span>بارگذاری این مسیر</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
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
