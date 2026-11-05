import React, { useState } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
import {
  Plus,
  Check,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  Clock,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';

interface GalleryCardProps {
  gallery: Gallery;
  isSelected: boolean;
  orderNumber?: number;
  colorTheme?: 'darkblue' | 'orange' | 'softblue' | 'gray';
  onToggle: (gallery: Gallery) => void;
  onSelectDetails: (gallery: Gallery) => void;
}

const THEME_CLASSES = {
  darkblue: 'clay-darkblue-subtle',
  orange: 'clay-orange-subtle',
  softblue: 'clay-softblue-subtle',
  gray: 'clay-gray-subtle'
};

export const GalleryCard: React.FC<GalleryCardProps> = ({
  gallery,
  isSelected,
  orderNumber,
  colorTheme = 'darkblue',
  onToggle,
  onSelectDetails
}) => {
  const [posterError, setPosterError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const activeExhibition = gallery.activeExhibition || (gallery.exhibitions && gallery.exhibitions[0]) || null;
  const themeClass = THEME_CLASSES[colorTheme];

  const posterUrl = !posterError ? (activeExhibition?.poster || gallery.posterImage) : null;
  const galleryLogoUrl = gallery.logoImage || gallery.image;
  const hasActivePoster = Boolean(posterUrl);

  return (
    <div
      className={`clay-card relative flex flex-col justify-between p-4 ${
        isSelected
          ? 'ring-2 ring-[#3D5B99] dark:ring-[#F76B1C] bg-white dark:bg-[#1b212d]'
          : 'bg-white/95 dark:bg-[#171c26]'
      }`}
    >
      <div>
        {/* 1. Square 1:1 Poster Container (UNCRADLED & UNCHOPPED: object-contain with studio padding) */}
        {hasActivePoster ? (
          <div
            onClick={() => onSelectDetails(gallery)}
            className="relative w-full aspect-square mb-3.5 rounded-2xl overflow-hidden bg-[#f4f7fb] dark:bg-[#121620] border border-[#E1E1E1] dark:border-stone-800 shadow-inner flex items-center justify-center p-2 group cursor-pointer"
          >
            <img
              src={posterUrl!}
              alt={activeExhibition?.title || getGalleryDisplayName(gallery)}
              referrerPolicy="no-referrer"
              onError={() => setPosterError(true)}
              className="max-w-full max-h-full object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300 shadow-xs"
            />

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px] rounded-2xl">
              <Maximize2 className="w-4 h-4" />
              <span>مشاهده پوستر کامل</span>
            </div>

            {/* Order number badge if in tour */}
            {orderNumber !== undefined && (
              <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[#3D5B99] dark:bg-[#F76B1C] text-white font-bold text-xs flex items-center justify-center shadow-lg border-2 border-white dark:border-stone-900 z-10 font-mono">
                {toPersianDigits(orderNumber)}
              </div>
            )}

            {/* Traffic Zone Indicator */}
            {gallery.isInTrafficZone && (
              <div className="absolute top-2.5 left-2.5 bg-[#F76B1C] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm z-10">
                <AlertTriangle className="w-3 h-3" />
                <span>طرح ترافیک</span>
              </div>
            )}
          </div>
        ) : null}

        {/* 2. Gallery Row: 48x48px Rounded Logo + Gallery Name + Single Clean Location Line */}
        <div className="flex items-center gap-3 mb-3">
          {/* Gallery Logo: 48x48 px */}
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-sm border border-[#E1E1E1] dark:border-stone-700 shrink-0 flex items-center justify-center p-1">
            {!logoError && galleryLogoUrl ? (
              <img
                src={galleryLogoUrl}
                alt={getGalleryDisplayName(gallery)}
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-stone-400" />
            )}
          </div>

          {/* Name & Single Clean Location Line */}
          <div className="truncate flex-1">
            <h3
              onClick={() => onSelectDetails(gallery)}
              className="text-sm font-bold text-[#1d2d4c] dark:text-white leading-snug hover:text-[#F76B1C] cursor-pointer transition-colors truncate"
            >
              {getGalleryDisplayName(gallery)}
            </h3>
            {/* Single location line: neighborhood · street address */}
            <div className="text-[11px] text-[#3D5B99] dark:text-[#A3C2E4] font-medium truncate mt-0.5">
              <span>{gallery.neighborhoodFa || 'تهران'}</span>
              <span className="mx-1 text-stone-300 dark:text-stone-600">·</span>
              <span className="text-stone-500 dark:text-stone-400">{gallery.addressFa || gallery.address}</span>
            </div>
          </div>

          {/* Order badge for cards without poster */}
          {!hasActivePoster && orderNumber !== undefined && (
            <div className="w-8 h-8 rounded-full bg-[#3D5B99] dark:bg-[#F76B1C] text-white font-bold text-xs flex items-center justify-center shadow-md shrink-0 font-mono">
              {toPersianDigits(orderNumber)}
            </div>
          )}
        </div>

        {/* 3. PROMINENT OPENING DATE & EXHIBITION DETAILS (Unified clean styling) */}
        {activeExhibition ? (
          <div className="p-3 rounded-2xl bg-[#f0f4fa] dark:bg-[#1b2230] shadow-sm space-y-2 border border-[#A3C2E4]/40 dark:border-stone-700/60">
            {/* Opening & Visiting Days: Friday Opening + Weekdays */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 bg-white/95 dark:bg-stone-900/95 text-[#F76B1C] px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs border border-[#F76B1C]/20">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {activeExhibition.openingDate
                    ? `افتتاحیه: ${toPersianDigits(activeExhibition.openingDate)}`
                    : 'افتتاحیه: جمعه‌ها ۱۶:۰۰ الی ۲۰:۰۰'}
                </span>
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 px-1 font-medium flex items-center justify-between">
                <span>بازدید عادی: یکشنبه تا پنجشنبه {toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')}</span>
                <span className="text-stone-400">شنبه تعطیل</span>
              </div>
            </div>

            {/* Exhibition Title & Type */}
            <div>
              <div className="text-sm font-bold text-[#10335e] dark:text-[#dbeafe] leading-tight">
                {activeExhibition.title}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                {activeExhibition.type || 'نمایشگاه انفرادی'}
              </div>
            </div>

            {/* Artist Name */}
            {activeExhibition.artist && (
              <div className="flex items-center gap-1.5 text-xs text-[#1d2d4c] dark:text-stone-200 font-bold pt-1 border-t border-[#E1E1E1]/50 dark:border-stone-700/50">
                <User className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">هنرمند:</span>
                <span className="truncate">{activeExhibition.artist}</span>
              </div>
            )}
          </div>
        ) : (
          /* Clean compact status for galleries between exhibition cycles (NO dummy image!) */
          <div className="clay-card clay-gray-subtle p-3 rounded-2xl text-xs space-y-1 border border-[#E1E1E1] dark:border-stone-800">
            <div className="font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>ساعات کاری عادی نگارخانه</span>
              <span className="text-[10px] bg-white dark:bg-stone-800 px-2 py-0.5 rounded-full text-stone-500">بین دو نمایشگاه</span>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-mono">
              <Clock className="w-3 h-3 text-[#3D5B99]" />
              <span>{toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-[#E1E1E1]/80 dark:border-stone-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectDetails(gallery)}
          className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] font-bold underline transition-colors"
        >
          {hasActivePoster ? 'مشاهده پوستر و آثار' : 'اطلاعات نگارخانه'}
        </button>

        <button
          type="button"
          onClick={() => onToggle(gallery)}
          className={`clay-button px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
            isSelected
              ? 'clay-darkblue text-white shadow-md'
              : 'clay-base text-stone-700 dark:text-stone-200 hover:scale-[1.02]'
          }`}
        >
          {isSelected ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#A3C2E4] stroke-[2.5]" />
              <span>در برنامه بازدید</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4]" />
              <span>+ افزودن به تور</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
