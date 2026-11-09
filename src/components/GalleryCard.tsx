import React, { useState } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName, getExhibitionMedium, formatGalleryAddress, formatArtistName } from '../utils/persianUtils';
import {
  Plus,
  Check,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  Clock,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  Palette
} from 'lucide-react';

interface GalleryCardProps {
  gallery: Gallery;
  isSelected: boolean;
  orderNumber?: number;
  colorTheme?: 'darkblue' | 'orange' | 'softblue' | 'gray';
  isOpeningThisWeek?: boolean;
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
  isOpeningThisWeek = false,
  onToggle,
  onSelectDetails
}) => {
  const activeExhibition = gallery.activeExhibition || (gallery.exhibitions && gallery.exhibitions[0]) || null;
  const themeClass = THEME_CLASSES[colorTheme];

  const activeSiblingCount = (gallery.siblingSpaces || []).filter(
    (s) => Boolean(s.activeExhibition || s.posterImage)
  ).length;
  const totalActiveAtVenue =
    (Boolean(gallery.activeExhibition || gallery.posterImage) ? 1 : 0) + activeSiblingCount;

  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Reset errors whenever gallery or active exhibition changes
  React.useEffect(() => {
    setPosterError(false);
    setUseLocalFallback(false);
    setLogoError(false);
  }, [gallery.id, activeExhibition?.eventId, gallery.posterImage]);

  // Determine effective poster URL with robust multi-tier fallback
  let posterUrl: string | null = null;
  if (!posterError) {
    if (useLocalFallback && activeExhibition?.eventId === 21551) {
      posterUrl = `${import.meta.env.BASE_URL}assets/events/Event_21551.jpg`;
    } else {
      posterUrl = activeExhibition?.poster || gallery.posterImage || activeExhibition?.posterSmall || gallery.posterSmall || null;
    }
  }

  const galleryLogoUrl = gallery.logoImage || gallery.image;
  const hasActivePoster = Boolean(posterUrl);

  const handlePosterError = () => {
    // If museum of contemporary art fails remote load, try bundled high-res poster
    if (activeExhibition?.eventId === 21551 && !useLocalFallback) {
      setUseLocalFallback(true);
    } else {
      setPosterError(true);
    }
  };

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
              onError={handlePosterError}
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

        {/* 2. Gallery Row: 56x56px Rounded Logo + Gallery Name + Single Clean Location Line */}
        <div className="flex items-center gap-3 mb-3">
          {/* Gallery Logo: 56x56 px (larger, object-cover, seamless edge-to-edge styling) */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm border border-[#E1E1E1] dark:border-stone-700 shrink-0 flex items-center justify-center">
            {!logoError && galleryLogoUrl ? (
              <img
                src={galleryLogoUrl}
                alt={getGalleryDisplayName(gallery)}
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-stone-400" />
            )}
          </div>

          {/* Name & Single Clean Location Line */}
          <div className="truncate flex-1">
            <h3
              onClick={() => onSelectDetails(gallery)}
              className="text-base sm:text-lg font-bold text-[#1d2d4c] dark:text-white leading-snug hover:text-[#F76B1C] cursor-pointer transition-colors truncate"
            >
              {getGalleryDisplayName(gallery)}
            </h3>
            {/* Single location line: neighborhood · street address */}
            <div className="text-sm sm:text-base text-[#3D5B99] dark:text-[#A3C2E4] font-medium truncate mt-0.5">
              <span>{gallery.neighborhoodFa || 'تهران'}</span>
              <span className="mx-1 text-stone-300 dark:text-stone-600">·</span>
              <span className="text-stone-500 dark:text-stone-400">{formatGalleryAddress(gallery.addressFa || gallery.address)}</span>
            </div>
            {totalActiveAtVenue > 1 && (
              <div className="mt-1 flex items-center gap-1 text-xs sm:text-sm font-bold text-[#F76B1C] bg-[#F76B1C]/10 border border-[#F76B1C]/25 px-2.5 py-0.5 rounded-md w-fit">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{toPersianDigits(totalActiveAtVenue)} نمایشگاه همزمان</span>
              </div>
            )}
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
          <div className="p-3.5 rounded-2xl bg-[#f0f4fa] dark:bg-[#1b2230] shadow-sm space-y-2.5 border border-[#A3C2E4]/40 dark:border-stone-700/60">
            {/* Opening & Visiting Days: Friday Opening + Weekdays */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 bg-white/95 dark:bg-stone-900/95 text-[#F76B1C] px-3 py-2 rounded-xl text-sm sm:text-base font-bold shadow-xs border border-[#F76B1C]/20">
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {activeExhibition.openingDate
                      ? `افتتاحیه: ${toPersianDigits(activeExhibition.openingDate)}`
                      : 'افتتاحیه: جمعه‌ها ۱۶:۰۰ الی ۲۰:۰۰'}
                  </span>
                </div>
                {isOpeningThisWeek && (
                  <span className="shrink-0 text-xs sm:text-sm bg-[#F76B1C] text-white px-2.5 py-1 rounded-lg font-extrabold shadow-xs flex items-center gap-1 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>این هفته</span>
                  </span>
                )}
              </div>
              <div className="text-sm sm:text-base text-stone-600 dark:text-stone-300 px-1 font-medium flex items-center justify-between">
                <span>بازدید عادی: یکشنبه تا پنجشنبه {toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')}</span>
                <span className="text-stone-400 font-normal">شنبه تعطیل</span>
              </div>
            </div>

            {/* Exhibition Title (Clean, without redundant type subtitle) */}
            <div>
              <div className="text-base sm:text-lg font-black text-[#10335e] dark:text-[#dbeafe] leading-snug">
                {activeExhibition.title}
              </div>
            </div>

            {/* Artist Name & Art Subject Tag */}
            <div className="space-y-2 pt-2 border-t border-[#E1E1E1]/60 dark:border-stone-700/60">
              {activeExhibition.artist && (
                <div className="flex items-start gap-2 text-sm sm:text-base text-[#1d2d4c] dark:text-stone-200 font-bold">
                  <User className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-stone-500 dark:text-stone-400 font-medium shrink-0">هنرمند:</span>
                  <span
                    className="line-clamp-2 leading-snug"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                    title={activeExhibition.artist}
                  >
                    {formatArtistName(activeExhibition.artist)}
                  </span>
                </div>
              )}

              {/* Subject / Medium Tag */}
              <div className="flex items-center justify-between gap-2 text-base">
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300 font-bold text-sm sm:text-base">
                  <Palette className="w-4 h-4 text-[#F76B1C] shrink-0" />
                  <span>موضوع:</span>
                </div>
                <span className="px-3.5 py-1 rounded-xl text-sm font-black bg-[#edf3ff] dark:bg-blue-950/50 text-[#1856C7] dark:text-[#93c5fd] border border-blue-200/60 dark:border-blue-800/50 shadow-2xs">
                  {getExhibitionMedium(
                    activeExhibition.title,
                    activeExhibition.artist,
                    activeExhibition.type,
                    activeExhibition.eventId,
                    activeExhibition.medium
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Clean compact status for galleries between exhibition cycles (NO dummy image!) */
          <div className="clay-card clay-gray-subtle p-3 rounded-2xl text-sm sm:text-base space-y-1.5 border border-[#E1E1E1] dark:border-stone-800">
            <div className="font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>ساعات کاری عادی نگارخانه</span>
              <span className="text-xs sm:text-sm bg-white dark:bg-stone-800 px-2.5 py-0.5 rounded-full text-stone-500">بین دو نمایشگاه</span>
            </div>
            <div className="text-sm sm:text-base text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-mono">
              <Clock className="w-4 h-4 text-[#3D5B99]" />
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
          className="text-sm sm:text-base text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] font-bold underline transition-colors"
        >
          {hasActivePoster ? 'مشاهده پوستر و آثار' : 'اطلاعات نگارخانه'}
        </button>

        <button
          type="button"
          onClick={() => onToggle(gallery)}
          className={`clay-button px-4 py-2 text-sm sm:text-base font-bold flex items-center gap-2 transition-all active:scale-95 ${
            isSelected
              ? 'clay-darkblue text-white shadow-md'
              : 'clay-base text-stone-700 dark:text-stone-200 hover:scale-[1.02]'
          }`}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 text-[#A3C2E4] stroke-[2.5]" />
              <span>در برنامه بازدید</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4]" />
              <span>افزودن به گشت</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
