import React from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
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
  Navigation
} from 'lucide-react';
import { buildGoogleMapsUrl, buildNeshanUrl, buildBaladUrl, buildWazeUrl } from '../utils/routeOptimizer';
import { GoogleMapsIcon, WazeIcon, NeshanIcon, BaladIcon } from './NavIcons';

interface GalleryDetailModalProps {
  gallery: Gallery | null;
  isSelected: boolean;
  isStartGallery?: boolean;
  onClose: () => void;
  onToggle: (gallery: Gallery) => void;
  onSetStart?: (galleryId: number) => void;
}

export const GalleryDetailModal: React.FC<GalleryDetailModalProps> = ({
  gallery,
  isSelected,
  isStartGallery,
  onClose,
  onToggle,
  onSetStart
}) => {
  if (!gallery) return null;

  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const activeExhibition = gallery.activeExhibition || (gallery.exhibitions && gallery.exhibitions[0]) || null;

  React.useEffect(() => {
    setUseLocalFallback(false);
  }, [gallery?.id, activeExhibition?.eventId]);

  const posterUrl = (useLocalFallback && activeExhibition?.eventId === 21551)
    ? `${import.meta.env.BASE_URL}assets/events/Event_21551.jpg`
    : (activeExhibition?.poster || gallery.posterImage || activeExhibition?.posterSmall || gallery.posterSmall);

  const galleryLogoUrl = gallery.logoImage || gallery.image;
  const galleryDisplayName = getGalleryDisplayName(gallery);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in font-sans"
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
              <h2 className="font-bold text-base text-[#1d2d4c] dark:text-white truncate leading-tight">
                {galleryDisplayName}
              </h2>
              <div className="text-[11px] text-[#3D5B99] dark:text-[#A3C2E4] truncate mt-0.5 font-medium flex items-center gap-1.5">
                <span>{gallery.neighborhoodFa || 'تهران'}</span>
                <span className="text-stone-300 dark:text-stone-600">·</span>
                <span className="truncate text-stone-500 dark:text-stone-400">{gallery.addressFa || gallery.address}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {gallery.isInTrafficZone && (
              <span className="bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 text-[10px] font-bold px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>طرح ترافیک</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center transition-colors shadow-xs"
              title="بستن پنجره"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body: Content is FRONT AND CENTER! */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-stone-700 dark:text-stone-300 flex-1">
          {/* Traffic Zone notice for mobile */}
          {gallery.isInTrafficZone && (
            <div className="sm:hidden bg-[#F76B1C]/10 text-[#F76B1C] border border-[#F76B1C]/25 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>این نگارخانه در محدوده طرح ترافیک تهران واقع شده است</span>
            </div>
          )}

          {/* Exhibition Details Box (Prominent & Clear) */}
          {activeExhibition ? (
            <div className="clay-card clay-orange-subtle p-4 rounded-2xl shadow-xs border border-[#F76B1C]/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F76B1C]">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    {activeExhibition.openingDate
                      ? `افتتاحیه: ${toPersianDigits(activeExhibition.openingDate)}`
                      : 'افتتاحیه: جمعه‌ها ۱۶:۰۰ الی ۲۰:۰۰'}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-[#F76B1C] text-white px-2 py-0.5 rounded-md shadow-xs">
                  ساعت ۱۶ تا ۲۰
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#10335e] dark:text-[#dbeafe] leading-snug">
                  {activeExhibition.title}
                </h3>
                <div className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 font-medium">
                  {activeExhibition.type || 'نمایشگاه انفرادی'}
                </div>
              </div>

              {activeExhibition.artist && (
                <div className="flex items-center gap-1.5 text-xs text-[#1d2d4c] dark:text-stone-200 font-bold pt-1.5 border-t border-[#F76B1C]/20">
                  <User className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                  <span className="text-stone-500 dark:text-stone-400 font-normal">آثار هنرمند:</span>
                  <span>{activeExhibition.artist}</span>
                </div>
              )}

              {activeExhibition.fullDateRange && (
                <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 pt-0.5">
                  <Clock className="w-3 h-3 text-[#F76B1C]" />
                  <span>دوره برگزاری: {toPersianDigits(activeExhibition.fullDateRange)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="clay-card clay-gray-subtle p-3.5 rounded-2xl border border-[#E1E1E1] dark:border-stone-800 text-stone-600 dark:text-stone-400 text-xs">
              <span className="font-bold text-stone-800 dark:text-stone-200">وضعیت نگارخانه:</span> در حال حاضر بین دو دوره نمایشگاه قرار دارد. برای اطلاع از تاریخ رویداد بعدی با تلفن گالری تماس حاصل فرمایید.
            </div>
          )}

          {/* Poster Showcase (Well-proportioned, clean preview) */}
          {posterUrl && (
            <div className="rounded-2xl overflow-hidden bg-[#f4f7fb] dark:bg-[#121620] border border-[#E1E1E1] dark:border-stone-800 flex items-center justify-center p-2 shadow-inner">
              <img
                src={posterUrl}
                alt={activeExhibition?.title || galleryDisplayName}
                referrerPolicy="no-referrer"
                className="max-h-60 sm:max-h-72 w-auto h-auto max-w-full object-contain rounded-xl shadow-xs"
                onError={(e) => {
                  if (activeExhibition?.eventId === 21551 && !useLocalFallback) {
                    setUseLocalFallback(true);
                  } else {
                    (e.target as HTMLElement).style.display = 'none';
                  }
                }}
              />
            </div>
          )}

          {/* Visiting Schedule & Contact Details */}
          <div className="clay-card p-3.5 rounded-2xl bg-white dark:bg-[#151922] border border-[#E1E1E1] dark:border-stone-800 space-y-2.5">
            {/* Visiting Days & Hours */}
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-800 dark:text-stone-200 block">برنامه و ساعات بازدید:</span>
                <div className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed mt-0.5 space-y-0.5">
                  <div>• افتتاحیه: جمعه‌ها ساعت ۱۶:۰۰ الی ۲۰:۰۰</div>
                  <div>• روزهای عادی: یکشنبه تا پنجشنبه {toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')} (شنبه تعطیل)</div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
              <MapPin className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-800 dark:text-stone-200 block">نشانی:</span>
                <span className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed block mt-0.5">
                  {gallery.addressFa || gallery.address}
                </span>
              </div>
            </div>

            {/* Phone */}
            {gallery.phone && (
              <div className="flex items-center gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                <Phone className="w-4 h-4 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                <span className="font-bold text-stone-800 dark:text-stone-200">تلفن:</span>
                <a
                  href={`tel:${gallery.phone}`}
                  className="text-[#F76B1C] font-bold hover:underline font-mono"
                >
                  {toPersianDigits(gallery.phone)}
                </a>
              </div>
            )}
          </div>

          {/* Social Links & Web */}
          {(gallery.website || gallery.instagram) && (
            <div className="flex items-center gap-2.5 flex-wrap">
              {gallery.website && (
                <a
                  href={gallery.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base px-3 py-1.5 font-bold flex items-center gap-1.5 text-[#3D5B99] dark:text-[#A3C2E4] text-xs hover:scale-105 transition-all shadow-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>وبسایت نگارخانه</span>
                </a>
              )}

              {gallery.instagram && (
                <a
                  href={gallery.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-orange-subtle px-3 py-1.5 font-bold flex items-center gap-1.5 text-[#F76B1C] text-xs hover:scale-105 transition-all shadow-xs"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>صفحه اینستاگرام</span>
                </a>
              )}
            </div>
          )}

          {/* 3. Compact Navigation: 1 sleek row taking minimal space! */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-2">
              مسیریابی مستقیم با اپلیکیشن‌ها:
            </span>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <a
                href={buildNeshanUrl(gallery)}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-button clay-base py-2 px-1 flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
              >
                <NeshanIcon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-bold">نشان</span>
              </a>

              <a
                href={buildBaladUrl(gallery)}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-button clay-base py-2 px-1 flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
              >
                <BaladIcon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-bold">بلد</span>
              </a>

              <a
                href={buildGoogleMapsUrl([gallery])}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-button clay-base py-2 px-1 flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
              >
                <GoogleMapsIcon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-bold">Google</span>
              </a>

              <a
                href={buildWazeUrl(gallery)}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-button clay-base py-2 px-1 flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs rounded-xl"
              >
                <WazeIcon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-bold">Waze</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4. Docked Action Footer: Clean & Focused on Tour Actions */}
        <div className="p-3.5 sm:p-4 bg-[#f6f9fc] dark:bg-[#131722] border-t border-[#E1E1E1] dark:border-stone-800 space-y-2 shrink-0">
          {/* Start Point Button / Indicator (if in tour) */}
          {isSelected && (
            <div>
              {isStartGallery ? (
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 py-1.5 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center gap-1.5 shadow-xs">
                  <span>🟢</span>
                  <span>مبدأ گشت (نقطه شروع مسیر)</span>
                </div>
              ) : onSetStart ? (
                <button
                  type="button"
                  onClick={() => onSetStart(gallery.id)}
                  className="w-full clay-button clay-base text-xs font-bold py-2 px-3 text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] flex items-center justify-center gap-1.5 transition-all shadow-xs rounded-xl"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#F76B1C]" />
                  <span>شروع گشت از این گالری (تغییر مبدأ)</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Primary Action Button: Add to / Remove from Tour */}
          <button
            onClick={() => onToggle(gallery)}
            className={`w-full clay-button py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 rounded-xl ${
              isSelected
                ? 'clay-base text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-xs'
                : 'clay-orange text-white shadow-md hover:brightness-105'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>در برنامه گشت شما قرار دارد (کلیک برای حذف)</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>+ افزودن این گالری به برنامه گشت</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
