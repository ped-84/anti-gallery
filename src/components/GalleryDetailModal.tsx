import React, { useState, useEffect } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName, getExhibitionMedium, formatGalleryAddress, formatArtistName } from '../utils/persianUtils';
import {
  X,
  MapPin,
  Clock,
  Phone,
  Globe,
  Instagram,
  Plus,
  Check,
  Calendar,
  User,
  Palette,
  AlertTriangle,
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { buildGoogleMapsUrl, buildNeshanUrl, buildBaladUrl, buildWazeUrl } from '../utils/routeOptimizer';
import { GoogleMapsIcon, WazeIcon, NeshanIcon, BaladIcon } from './NavIcons';

interface GalleryDetailModalProps {
  gallery: Gallery | null;
  isSelected: boolean;
  selectedGalleryIds?: number[];
  isStartGallery?: boolean;
  onClose: () => void;
  onToggle: (gallery: Gallery) => void;
  onSetStart?: (galleryId: number) => void;
}

export const GalleryDetailModal: React.FC<GalleryDetailModalProps> = ({
  gallery,
  isSelected,
  selectedGalleryIds,
  isStartGallery,
  onClose,
  onToggle,
  onSetStart
}) => {
  // 1. All hooks declared at top level (MUST be before any conditional returns!)
  const [useLocalFallback, setUseLocalFallback] = useState<boolean>(false);
  const [isPosterEnlarged, setIsPosterEnlarged] = useState<boolean>(false);
  const [posterLoadError, setPosterLoadError] = useState<boolean>(false);
  const [selectedSpaceIndex, setSelectedSpaceIndex] = useState<number>(0);

  // Group all co-located sibling spaces at this venue (active exhibitions first)
  const allSpaces = React.useMemo(() => {
    if (!gallery) return [];
    const list = [gallery, ...(gallery.siblingSpaces || [])];
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values());
    return unique.sort((a, b) => {
      const aActive = Boolean(a.activeExhibition || a.posterImage) ? 1 : 0;
      const bActive = Boolean(b.activeExhibition || b.posterImage) ? 1 : 0;
      return bActive - aActive;
    });
  }, [gallery]);

  useEffect(() => {
    setSelectedSpaceIndex(0);
  }, [gallery?.id]);

  const currentSpace = allSpaces[selectedSpaceIndex] || gallery;
  const activeExhibition =
    currentSpace?.activeExhibition || (currentSpace?.exhibitions && currentSpace.exhibitions[0]) || null;

  useEffect(() => {
    setUseLocalFallback(false);
    setIsPosterEnlarged(false);
    setPosterLoadError(false);
  }, [currentSpace?.id, activeExhibition?.eventId]);

  // Handle ESC key to close modal or lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPosterEnlarged) {
          setIsPosterEnlarged(false);
        } else if (gallery) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPosterEnlarged, gallery, onClose]);

  // Early return if no gallery selected
  if (!gallery) return null;

  // Determine effective poster URL with robust fallback for currentSpace
  let posterUrl: string | null = null;
  if (!posterLoadError && currentSpace) {
    if (useLocalFallback && activeExhibition?.eventId === 21551) {
      posterUrl = `${import.meta.env.BASE_URL}assets/events/Event_21551.jpg`;
    } else {
      posterUrl =
        activeExhibition?.poster ||
        currentSpace.posterImage ||
        activeExhibition?.posterSmall ||
        currentSpace.posterSmall ||
        null;
    }
  }

  const galleryLogoUrl = currentSpace.logoImage || currentSpace.image || gallery.logoImage || gallery.image;
  const galleryDisplayName = getGalleryDisplayName(gallery);
  const currentSpaceDisplayName = getGalleryDisplayName(currentSpace);

  // Check if this venue is part of current tour
  const isVenueSelected = selectedGalleryIds
    ? allSpaces.some((s) => selectedGalleryIds.includes(s.id))
    : isSelected;

  const isVenueStart = selectedGalleryIds && gallery
    ? Boolean(isStartGallery || allSpaces.some((s) => s.id === gallery.id && isStartGallery))
    : Boolean(isStartGallery);

  const handlePosterError = () => {
    if (activeExhibition?.eventId === 21551 && !useLocalFallback) {
      setUseLocalFallback(true);
    } else {
      setPosterLoadError(true);
    }
  };

  return (
    <>
      {/* Main Detail Modal */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in font-sans"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="clay-card relative w-full max-w-lg bg-white dark:bg-[#181d27] rounded-3xl overflow-hidden flex flex-col max-h-[92vh] border border-[#E1E1E1] dark:border-stone-800 shadow-2xl"
        >
          {/* 1. Modal Top Bar: Header info + Close Button */}
          <div className="p-4 sm:p-4.5 bg-[#f6f9fc] dark:bg-[#131722] border-b border-[#E1E1E1] dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 truncate">
              {/* Gallery Logo */}
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-xs border border-[#E1E1E1] dark:border-stone-700 shrink-0 flex items-center justify-center">
                {galleryLogoUrl ? (
                  <img
                    src={galleryLogoUrl}
                    alt={galleryDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Palette className="w-5 h-5 text-stone-400" />
                )}
              </div>

              <div className="truncate">
                <h2 className="font-bold text-base sm:text-lg text-[#1d2d4c] dark:text-white truncate leading-tight">
                  {galleryDisplayName}
                </h2>
                <div className="text-xs text-[#3D5B99] dark:text-[#A3C2E4] truncate mt-0.5 font-medium flex items-center gap-1.5">
                  <span>{currentSpace.neighborhoodFa || gallery.neighborhoodFa || 'تهران'}</span>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span className="truncate text-stone-500 dark:text-stone-400">
                    {formatGalleryAddress(currentSpace.addressFa || currentSpace.address || gallery.addressFa || gallery.address)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(currentSpace.isInTrafficZone || gallery.isInTrafficZone) && (
                <span className="bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>طرح ترافیک</span>
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center transition-colors shadow-xs"
                title="بستن پنجره"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Space / Hall Switcher Tabs for venues with multiple spaces/floors */}
          {allSpaces.length > 1 && (
            <div className="px-4 py-2.5 bg-[#edf3fb] dark:bg-[#10141e] border-b border-[#E1E1E1] dark:border-stone-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-sm sm:text-base font-bold text-stone-600 dark:text-stone-300 shrink-0">
                سالن‌ها و فضاها ({toPersianDigits(allSpaces.length)}):
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {allSpaces.map((space, idx) => {
                  const isSpaceActive = Boolean(space.activeExhibition || space.posterImage);
                  const isSelectedTab = idx === selectedSpaceIndex;
                  const rawName = space.nameFa || space.name;
                  let tabLabel = '';
                  if (rawName.includes('(')) {
                    const match = rawName.match(/\(([^)]+)\)/);
                    tabLabel = match ? match[1] : rawName;
                  } else if (space.activeExhibition?.title) {
                    tabLabel = `سالن ${toPersianDigits(idx + 1)}: ${space.activeExhibition.title}`;
                  } else {
                    tabLabel = `سالن ${toPersianDigits(idx + 1)}`;
                  }

                  return (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => {
                        setSelectedSpaceIndex(idx);
                        setPosterLoadError(false);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        isSelectedTab
                          ? 'bg-[#3D5B99] text-white shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-[#E1E1E1] dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isSpaceActive ? 'bg-[#F76B1C]' : 'bg-stone-300 dark:bg-stone-600'
                        }`}
                      />
                      <span className="truncate max-w-[150px]">{tabLabel}</span>
                      {isSpaceActive ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md ${
                            isSelectedTab
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          فعال
                        </span>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md ${
                            isSelectedTab
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-400'
                          }`}
                        >
                          بین دو نمایشگاه
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Scrollable Body: Content is FRONT AND CENTER! */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 flex-1">
            {/* Traffic Zone notice for mobile */}
            {gallery.isInTrafficZone && (
              <div className="sm:hidden bg-[#F76B1C]/10 text-[#F76B1C] border border-[#F76B1C]/25 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>این نگارخانه در محدوده طرح ترافیک تهران واقع شده است</span>
              </div>
            )}

            {/* Exhibition Details Box (Prominent & Clear) */}
            {activeExhibition ? (
              <div className="clay-card clay-orange-subtle p-3.5 sm:p-4 rounded-2xl shadow-xs border border-[#F76B1C]/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* افتتاحیه: ۱۴ پیکسل */}
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#F76B1C]">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      {activeExhibition.openingDate
                        ? `افتتاحیه: ${toPersianDigits(activeExhibition.openingDate)}`
                        : 'افتتاحیه: جمعه‌ها ۱۶:۰۰ الی ۲۰:۰۰'}
                    </span>
                  </div>
                  {/* بج ساعت: ۱۲ پیکسل */}
                  <span className="text-xs font-bold bg-[#F76B1C] text-white px-2.5 py-0.5 rounded-lg shadow-xs">
                    ساعت ۱۶ تا ۲۰
                  </span>
                </div>

                {/* عنوان نمایشگاه: ۱۸ پیکسل */}
                <div>
                  <h3 className="text-lg sm:text-[18px] font-black text-[#10335e] dark:text-[#dbeafe] leading-snug">
                    {activeExhibition.title}
                  </h3>
                </div>

                {/* نام هنرمند: ۱۴ پیکسل */}
                {activeExhibition.artist && (
                  <div className="flex items-center gap-2 text-sm text-[#1d2d4c] dark:text-stone-200 font-bold pt-2 border-t border-[#F76B1C]/20">
                    <User className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                    <span className="text-stone-500 dark:text-stone-400 font-medium text-sm">هنرمند:</span>
                    <span className="text-sm font-bold">{formatArtistName(activeExhibition.artist)}</span>
                  </div>
                )}

                {/* موضوع و مدیوم آثار: عنوان ۱۴ پیکسل، نشان/بج ۱۴ پیکسل */}
                <div className="flex items-center justify-between gap-2 text-sm pt-2 border-t border-[#F76B1C]/15">
                  <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 font-bold text-sm">
                    <Palette className="w-4 h-4 text-[#F76B1C] shrink-0" />
                    <span>موضوع و مدیوم آثار:</span>
                  </div>
                  <span className="px-3 py-1 rounded-xl text-sm font-bold bg-[#edf3ff] dark:bg-blue-950/60 text-[#1856C7] dark:text-[#93c5fd] border border-blue-200/80 dark:border-blue-800 shadow-2xs">
                    {getExhibitionMedium(activeExhibition.title, activeExhibition.artist, activeExhibition.type)}
                  </span>
                </div>

                {/* دوره برگزاری: ۱۲ پیکسل */}
                {activeExhibition.fullDateRange && (
                  <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 pt-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#F76B1C]" />
                    <span>دوره برگزاری: {toPersianDigits(activeExhibition.fullDateRange)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="clay-card clay-gray-subtle p-3.5 rounded-2xl border border-[#E1E1E1] dark:border-stone-800 text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
                <span className="font-bold text-stone-800 dark:text-stone-200">وضعیت نگارخانه:</span> در حال حاضر بین دو دوره نمایشگاه قرار دارد. برای اطلاع از تاریخ رویداد بعدی با تلفن گالری تماس حاصل فرمایید.
              </div>
            )}

            {/* Poster Showcase (Interactive Click to Enlarge Lightbox) */}
            {posterUrl && (
              <div className="relative group rounded-2xl overflow-hidden bg-[#f4f7fb] dark:bg-[#121620] border border-[#E1E1E1] dark:border-stone-800 flex items-center justify-center p-2 shadow-inner">
                <img
                  src={posterUrl}
                  alt={activeExhibition?.title || galleryDisplayName}
                  referrerPolicy="no-referrer"
                  onClick={() => setIsPosterEnlarged(true)}
                  className="max-h-60 sm:max-h-72 w-auto h-auto max-w-full object-contain rounded-xl shadow-xs cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-200"
                  onError={handlePosterError}
                />
                <button
                  type="button"
                  onClick={() => setIsPosterEnlarged(true)}
                  className="absolute bottom-4 left-4 bg-black/60 hover:bg-black/80 text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 backdrop-blur-md shadow-md transition-all active:scale-95"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>نمایش بزرگ پوستر</span>
                </button>
              </div>
            )}

            {/* Visiting Schedule & Contact Details */}
            <div className="clay-card p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#151922] border border-[#E1E1E1] dark:border-stone-800 space-y-3">
              {/* Visiting Days & Hours: عنوان ۱۴ پیکسل، متن ۱۲ پیکسل */}
              <div className="flex items-start gap-2.5">
                <Clock className="w-4.5 h-4.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800 dark:text-stone-200 block text-sm">برنامه و ساعات بازدید:</span>
                  <div className="text-stone-600 dark:text-stone-300 text-xs leading-relaxed mt-1 space-y-0.5 font-medium">
                    <div>• افتتاحیه: جمعه‌ها ساعت ۱۶:۰۰ الی ۲۰:۰۰</div>
                    <div>• روزهای عادی: یکشنبه تا پنجشنبه {toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')} (شنبه تعطیل)</div>
                  </div>
                </div>
              </div>

              {/* Address: عنوان ۱۴ پیکسل، متن نشانی ۱۲ پیکسل */}
              <div className="flex items-start gap-2.5 pt-2.5 border-t border-stone-200/70 dark:border-stone-800">
                <MapPin className="w-4.5 h-4.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800 dark:text-stone-200 block text-sm">نشانی:</span>
                  <span className="text-stone-600 dark:text-stone-300 text-xs leading-relaxed block mt-1 font-medium">
                    {formatGalleryAddress(gallery.addressFa || gallery.address)}
                  </span>
                </div>
              </div>

              {/* Phone: عنوان ۱۴ پیکسل، متن شماره ۱۲ پیکسل */}
              {gallery.phone && (
                <div className="flex items-center gap-2.5 pt-2.5 border-t border-stone-200/70 dark:border-stone-800 text-sm">
                  <Phone className="w-4.5 h-4.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                  <span className="font-bold text-stone-800 dark:text-stone-200 text-sm">تلفن:</span>
                  <a
                    href={`tel:${gallery.phone}`}
                    className="text-[#F76B1C] font-bold hover:underline font-mono text-xs sm:text-sm"
                  >
                    {toPersianDigits(gallery.phone)}
                  </a>
                </div>
              )}
            </div>

            {/* Social Links & Web: ۱۴ پیکسل */}
            {(gallery.website || gallery.instagram) && (
              <div className="flex items-center gap-2.5 flex-wrap">
                {gallery.website && (
                  <a
                    href={gallery.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clay-button clay-base px-4 py-2 font-bold flex items-center gap-2 text-[#3D5B99] dark:text-[#A3C2E4] text-sm hover:scale-105 transition-all shadow-xs rounded-xl"
                  >
                    <Globe className="w-4 h-4" />
                    <span>وبسایت نگارخانه</span>
                  </a>
                )}

                {gallery.instagram && (
                  <a
                    href={gallery.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clay-button clay-orange-subtle px-4 py-2 font-bold flex items-center gap-2 text-[#F76B1C] text-sm hover:scale-105 transition-all shadow-xs rounded-xl"
                  >
                    <Instagram className="w-4 h-4" />
                    <span>صفحه اینستاگرام</span>
                  </a>
                )}
              </div>
            )}

            {/* 3. Direct Navigation Apps Row: دکمه‌های مسیریابی ۱۴ پیکسل */}
            <div className="pt-2.5 border-t border-stone-200/70 dark:border-stone-800">
              <span className="text-sm font-bold text-stone-700 dark:text-stone-200 block mb-2">
                مسیریابی مستقیم با اپلیکیشن‌ها:
              </span>
              <div className="grid grid-cols-4 gap-2">
                <a
                  href={buildNeshanUrl(currentSpace)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base py-2.5 px-1 flex flex-col items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
                >
                  <NeshanIcon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-bold text-stone-800 dark:text-white">نشان</span>
                </a>

                <a
                  href={buildBaladUrl(currentSpace)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base py-2.5 px-1 flex flex-col items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
                >
                  <BaladIcon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-bold text-stone-800 dark:text-white">بلد</span>
                </a>

                <a
                  href={buildGoogleMapsUrl([currentSpace])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base py-2.5 px-1 flex flex-col items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
                >
                  <GoogleMapsIcon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-bold text-stone-800 dark:text-white">Google</span>
                </a>

                <a
                  href={buildWazeUrl(currentSpace)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base py-2.5 px-1 flex flex-col items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
                >
                  <WazeIcon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-bold text-stone-800 dark:text-white">Waze</span>
                </a>
              </div>
            </div>
          </div>

          {/* 4. Docked Action Footer: دکمه افزودن به گشت ۱۴ پیکسل */}
          <div className="p-3 sm:p-3.5 bg-[#f6f9fc] dark:bg-[#131722] border-t border-[#E1E1E1] dark:border-stone-800 space-y-2 shrink-0">
            {/* Start Point Button / Indicator (if in tour) */}
            {isVenueSelected && (
              <div>
                {isVenueStart ? (
                  <div className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 py-2 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center gap-2 shadow-xs">
                    <span>🟢</span>
                    <span>مبدأ گشت (نقطه شروع مسیر)</span>
                  </div>
                ) : onSetStart ? (
                  <button
                    type="button"
                    onClick={() => onSetStart(currentSpace.id)}
                    className="w-full clay-button clay-base text-xs sm:text-sm font-bold py-2.5 px-3 text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] flex items-center justify-center gap-2 transition-all shadow-xs rounded-xl"
                  >
                    <MapPin className="w-4 h-4 text-[#F76B1C]" />
                    <span>شروع گشت از این گالری (تغییر مبدأ)</span>
                  </button>
                ) : null}
              </div>
            )}

            {/* Primary Action Button: دکمه افزودن به گشت ۱۴ پیکسل */}
            <button
              type="button"
              onClick={() => onToggle(currentSpace)}
              className={`w-full clay-button py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 rounded-xl ${
                isVenueSelected
                  ? 'clay-base text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-xs'
                  : 'clay-orange text-white shadow-md hover:brightness-105'
              }`}
            >
              {isVenueSelected ? (
                <>
                  <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
                  <span>در برنامه گشت شما قرار دارد (کلیک برای حذف)</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ افزودن این گالری به برنامه گشت</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Fullscreen Poster Lightbox */}
      {isPosterEnlarged && posterUrl && (
        <div
          onClick={() => setIsPosterEnlarged(false)}
          className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-lg animate-fade-in font-sans cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[92vh] flex flex-col items-center cursor-default"
          >
            {/* Top Lightbox Bar */}
            <div className="w-full flex items-center justify-between pb-3 text-white gap-3">
              <div className="truncate">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {activeExhibition?.title || galleryDisplayName}
                </h3>
                {activeExhibition?.artist && (
                  <p className="text-xs text-stone-300 truncate">
                    {activeExhibition.artist}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={posterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-full transition-colors flex items-center gap-1.5 text-xs font-medium"
                  title="مشاهده فایل اصلی در برگه جدید"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">اندازه اصلی</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsPosterEnlarged(false)}
                  className="bg-white/20 hover:bg-white/35 text-white p-2 rounded-full transition-colors"
                  title="بستن (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Poster Image */}
            <div className="relative rounded-2xl overflow-hidden bg-stone-900 shadow-2xl border border-white/10 flex items-center justify-center max-h-[82vh]">
              <img
                src={posterUrl}
                alt={activeExhibition?.title || galleryDisplayName}
                referrerPolicy="no-referrer"
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
