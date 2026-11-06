import React, { useMemo } from 'react';
import { getCuratedOpeningTours, PersianCuratedTour } from '../data/curatedTours';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
import { X, Sparkles, Clock, ArrowLeft, Flame } from 'lucide-react';

interface CuratedToursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTour: (tour: PersianCuratedTour) => void;
  allGalleries: Gallery[];
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
  allGalleries
}) => {
  // Dynamically compute curated tours strictly among galleries with openings this week
  const curatedTours = useMemo(() => {
    return getCuratedOpeningTours(allGalleries);
  }, [allGalleries]);

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
        <div className="p-4 sm:p-5 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 truncate">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl clay-card clay-orange flex items-center justify-center text-white shrink-0 shadow-md">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
            </div>
            <div className="truncate">
              <h2 className="text-base sm:text-lg font-bold text-[#1d2d4c] dark:text-white truncate">
                گشت‌های هنری و تورهای افتتاحیه این هفته
              </h2>
              <p className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] font-medium truncate mt-0.5">
                مسیرهای گلچین‌شده منحصراً بین نگارخانه‌هایی که این هفته یا امروز افتتاحیه دارند
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
                    {/* Opening This Week Badge */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#F76B1C] bg-[#F76B1C]/10 border border-[#F76B1C]/25 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                        <Flame className="w-3 h-3 text-[#F76B1C]" />
                        <span>افتتاحیه این هفته (امروز)</span>
                      </span>
                      <span className="text-[11px] text-stone-400">·</span>
                      <span className="text-[11px] font-bold text-[#3D5B99] dark:text-[#A3C2E4]">
                        {tour.neighborhoodFa}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[#1d2d4c] dark:text-white group-hover:text-[#F76B1C] transition-colors leading-snug">
                      {tour.titleFa}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                      {tour.descriptionFa}
                    </p>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] block">
                      {toPersianDigits(tourGalleries.length)} گالری
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-end gap-1 mt-1 font-medium font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{toPersianDigits(tour.estimatedHours)} ساعت</span>
                    </span>
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
