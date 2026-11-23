import React, { useState } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName, getExhibitionMedium, formatGalleryAddress, formatArtistName, getExhibitionStatus, formatHoursFa } from '../utils/persianUtils';
import { toOptimizedImageUrl } from '../utils/imageUrl';
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
  priority?: boolean;
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
  priority = false,
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
  const [useProxy, setUseProxy] = useState(true);

  // Reset errors whenever gallery or active exhibition changes
  React.useEffect(() => {
    setPosterError(false);
    setUseLocalFallback(false);
    setLogoError(false);
    setUseProxy(true);
  }, [gallery.id, activeExhibition?.eventId, gallery.posterImage]);

  // Determine effective poster URL with robust multi-tier fallback
  let posterUrl: string | null = null;
  if (!posterError) {
    if (useLocalFallback && activeExhibition?.eventId === 21551) {
      posterUrl = `${import.meta.env.BASE_URL}assets/events/Event_21551.jpg`;
    } else {
      // Prioritize full high-resolution original poster (Event_*.jpg) so text and artwork are crisp and legible
      const rawPoster = activeExhibition?.poster || gallery.posterImage || activeExhibition?.posterSmall || gallery.posterSmall || null;
      posterUrl = useProxy ? toOptimizedImageUrl(rawPoster) : rawPoster;
    }
  }

  const galleryLogoUrl = useProxy ? toOptimizedImageUrl(gallery.logoImage || gallery.image) : (gallery.logoImage || gallery.image);
  const hasActivePoster = Boolean(posterUrl);

  const handlePosterError = () => {
    // If museum of contemporary art fails remote load, try bundled high-res poster
    if (activeExhibition?.eventId === 21551 && !useLocalFallback) {
      setUseLocalFallback(true);
    } else if (useProxy) {
      setUseProxy(false);
    } else {
      setPosterError(true);
    }
  };

  const status = activeExhibition ? getExhibitionStatus(activeExhibition) : null;
  const hoursText = activeExhibition
    ? formatHoursFa(activeExhibition.openingHours || gallery.hoursFa || gallery.hours)
    : '';

  let statusColors = 'bg-white dark:bg-stone-900/80 text-[#10335e] dark:text-[#dbeafe] border-[#10335e]/15 dark:border-[#93c5fd]/20';
  if (status?.badgeType === 'opening') {
    statusColors = 'bg-white dark:bg-stone-900/80 text-[#E05A10] dark:text-[#ff8a3d] border-[#F76B1C]/30';
  } else if (status?.badgeType === 'closing-today') {
    statusColors = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800';
  } else if (status?.badgeType === 'closing-soon') {
    statusColors = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800';
  }

  return (
    <div
      className={`clay-card relative flex flex-col justify-between p-3 sm:p-4 ${
        isSelected
          ? 'ring-2 ring-[#3D5B99] dark:ring-[#F76B1C] bg-white dark:bg-[#1b212d]'
          : 'bg-white/95 dark:bg-[#171c26]'
      }`}
    >
      <div>
        {/* 1. پوستر: کامل و بدون برش (object-contain)؛ پس‌زمینه‌ی محوِ همان پوستر جای حاشیه‌ی خالی را می‌گیرد.
              موبایل ۵:۴ (کارت کوتاه‌تر)، دسکتاپ مربع. */}
        {hasActivePoster ? (
          <div
            onClick={() => onSelectDetails(gallery)}
            className="relative w-full aspect-[5/4] sm:aspect-square mb-3 rounded-2xl overflow-hidden bg-[#eef2f8] dark:bg-[#121620] flex items-center justify-center group cursor-pointer"
          >
            <img
              src={posterUrl!}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-xl opacity-45 dark:opacity-30 pointer-events-none"
            />
            <img
              src={posterUrl!}
              alt={activeExhibition?.title || getGalleryDisplayName(gallery)}
              referrerPolicy="no-referrer"
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'low'}
              decoding="async"
              width="400"
              height="400"
              onError={handlePosterError}
              className="relative h-full w-auto max-w-full object-contain shadow-[0_6px_20px_-6px_rgba(16,51,94,0.35)] group-hover:scale-[1.02] transition-transform duration-300"
            />

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 rounded-2xl">
              <Maximize2 className="w-4 h-4" />
              <span>مشاهده پوستر کامل</span>
            </div>

            {/* Order number badge if in tour */}
            {orderNumber !== undefined && (
              <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-[#3D5B99] dark:bg-[#F76B1C] text-white font-bold text-xs flex items-center justify-center shadow-lg border-2 border-white dark:border-stone-900 z-10 tabular-nums">
                {toPersianDigits(orderNumber)}
              </div>
            )}

            {/* Traffic Zone Indicator */}
            {gallery.isInTrafficZone && (
              <div className="absolute top-2.5 left-2.5 bg-[#F76B1C] text-white text-2xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm z-10">
                <AlertTriangle className="w-3 h-3" />
                <span>طرح ترافیک</span>
              </div>
            )}
          </div>
        ) : null}

        {/* 2. ردیف گالری: لوگو + نام + محله/آدرس */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm border border-[#E1E1E1] dark:border-stone-700 shrink-0 flex items-center justify-center">
            {!logoError && galleryLogoUrl ? (
              <img
                src={galleryLogoUrl}
                alt={getGalleryDisplayName(gallery)}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                width="48"
                height="48"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-stone-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2
              onClick={() => onSelectDetails(gallery)}
              className="text-base font-bold text-[#1d2d4c] dark:text-white leading-snug hover:text-[#F76B1C] cursor-pointer transition-colors truncate"
            >
              {getGalleryDisplayName(gallery)}
            </h2>
            <div className="text-sm text-[#3D5B99] dark:text-[#A3C2E4] font-medium truncate">
              <span>{gallery.neighborhoodFa || 'تهران'}</span>
              <span className="mx-1 text-stone-300 dark:text-stone-600">·</span>
              <span className="text-stone-500 dark:text-stone-400">{formatGalleryAddress(gallery.addressFa || gallery.address)}</span>
            </div>
          </div>

          {totalActiveAtVenue > 1 && (
            <div
              className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#E05A10] dark:text-[#ff8a3d] bg-[#F76B1C]/10 border border-[#F76B1C]/25 px-2 py-0.5 rounded-lg"
              title={`${toPersianDigits(totalActiveAtVenue)} نمایشگاه همزمان در این مکان`}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{toPersianDigits(totalActiveAtVenue)} نمایشگاه</span>
            </div>
          )}

          {/* Order badge for cards without poster */}
          {!hasActivePoster && orderNumber !== undefined && (
            <div className="w-8 h-8 rounded-full bg-[#3D5B99] dark:bg-[#F76B1C] text-white font-bold text-xs flex items-center justify-center shadow-md shrink-0 tabular-nums">
              {toPersianDigits(orderNumber)}
            </div>
          )}
        </div>

        {/* 3. نمایشگاه: عنوان (فونت نمایشی) ← هنرمند ← یک ردیف برچسب (وضعیت، ساعت، موضوع) */}
        {activeExhibition && status ? (
          <div className="p-3 rounded-2xl bg-[#f0f4fa] dark:bg-[#1b2230] space-y-2 border border-[#A3C2E4]/40 dark:border-stone-700/60">
            <h3
              onClick={() => onSelectDetails(gallery)}
              title={activeExhibition.title}
              className="font-exhibit text-lg sm:text-xl text-[#10335e] dark:text-[#dbeafe] cursor-pointer truncate"
            >
              {activeExhibition.title}
            </h3>

            {activeExhibition.artist && (
              <div className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300 min-w-0" title={activeExhibition.artist}>
                <User className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" aria-hidden="true" />
                <span className="truncate font-medium">{formatArtistName(activeExhibition.artist)}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold border ${statusColors}`}>
                {status.badgeType === 'closing-today' ? (
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{status.statusBadge}</span>
                {status.badgeType === 'opening' && isOpeningThisWeek && (
                  <span className="bg-[#F76B1C] text-white px-1.5 py-px rounded-md text-2xs font-extrabold">این هفته</span>
                )}
                {status.badgeType === 'closing-today' && (
                  <span className="bg-rose-600 text-white px-1.5 py-px rounded-md text-2xs font-extrabold">امروز</span>
                )}
              </span>

              {hoursText && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-white dark:bg-stone-900/80 text-[#1d2d4c] dark:text-stone-200 border border-[#10335e]/10 dark:border-stone-700">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]" aria-hidden="true" />
                  <bdi>{hoursText}</bdi>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-[#edf3ff] dark:bg-blue-950/50 text-[#1856C7] dark:text-[#93c5fd] border border-blue-200/60 dark:border-blue-800/50">
                <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
        ) : (
          /* گالری بین دو نمایشگاه */
          <div className="p-3 rounded-2xl bg-[#f4f6f9] dark:bg-[#1b2230] text-sm space-y-1 border border-[#E1E1E1] dark:border-stone-800">
            <div className="font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between gap-2">
              <span>ساعت کاری نگارخانه</span>
              <span className="text-xs bg-white dark:bg-stone-800 px-2.5 py-0.5 rounded-full text-stone-500">بین دو نمایشگاه</span>
            </div>
            <div className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5 tabular-nums">
              <Clock className="w-4 h-4 text-[#3D5B99]" aria-hidden="true" />
              <span>{formatHoursFa(gallery.hoursFa || gallery.hours) || 'ساعت کاری ثبت نشده'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#E1E1E1]/80 dark:border-stone-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectDetails(gallery)}
          className="text-sm text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] font-bold underline underline-offset-4 transition-colors"
        >
          {hasActivePoster ? 'مشاهده پوستر و آثار' : 'اطلاعات نگارخانه'}
        </button>

        <button
          type="button"
          onClick={() => onToggle(gallery)}
          className={`clay-button px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${
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
