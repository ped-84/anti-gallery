import React from 'react';
import { PERSIAN_CURATED_TOURS, PersianCuratedTour } from '../data/curatedTours';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
import { X, Sparkles, Clock, ArrowLeft } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="clay-card relative w-full max-w-2xl bg-white dark:bg-[#181d27] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-[#E1E1E1] dark:border-stone-800">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f7f9fc] dark:bg-[#141822] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-card clay-darkblue flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5 text-[#A3C2E4]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1d2d4c] dark:text-white">
                گشت‌های هنری و تورهای آماده
              </h2>
              <p className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] font-medium">
                مسیرهای گلچین‌شده گالری‌گردی در محله‌های فرهنگی تهران
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full clay-button clay-base text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {PERSIAN_CURATED_TOURS.map((tour) => {
            const tourGalleries = allGalleries.filter((g) => tour.galleryIds.includes(g.id));
            const btnClass = THEME_BUTTON_CLASSES[tour.themeColor] || 'clay-orange text-white';

            return (
              <div
                key={tour.id}
                className="clay-card p-4.5 bg-white dark:bg-[#1b212e] hover:scale-[1.01] transition-all group border border-[#E1E1E1]/80 dark:border-stone-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#F76B1C] block mb-1">
                      {tour.neighborhoodFa} · {tour.city === 'Tehran' ? 'تهران' : tour.city}
                    </span>
                    <h3 className="text-base font-bold text-[#1d2d4c] dark:text-white group-hover:text-[#F76B1C] transition-colors">
                      {tour.titleFa}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                      {tour.descriptionFa}
                    </p>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] block">
                      {toPersianDigits(tourGalleries.length)} گالری
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-end gap-1 mt-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{toPersianDigits(tour.estimatedHours)} ساعت</span>
                    </span>
                  </div>
                </div>

                {/* Galleries Preview list */}
                <div className="mt-4 pt-3 border-t border-[#E1E1E1] dark:border-stone-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 overflow-hidden">
                    <span className="font-bold text-[#1d2d4c] dark:text-stone-200 shrink-0">
                      شامل:
                    </span>
                    <span className="truncate">
                      {tourGalleries.map((g) => getGalleryDisplayName(g)).join(' · ')}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectTour(tour);
                      onClose();
                    }}
                    className={`clay-button ${btnClass} px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm hover:brightness-105`}
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
