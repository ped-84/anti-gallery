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
  AlertTriangle
} from 'lucide-react';
import { buildGoogleMapsUrl, buildNeshanUrl, buildBaladUrl, buildWazeUrl } from '../utils/routeOptimizer';
import { GoogleMapsIcon, WazeIcon, NeshanIcon, BaladIcon } from './NavIcons';

interface GalleryDetailModalProps {
  gallery: Gallery | null;
  isSelected: boolean;
  onClose: () => void;
  onToggle: (gallery: Gallery) => void;
}

export const GalleryDetailModal: React.FC<GalleryDetailModalProps> = ({
  gallery,
  isSelected,
  onClose,
  onToggle
}) => {
  if (!gallery) return null;

  const activeExhibition = gallery.activeExhibition || (gallery.exhibitions && gallery.exhibitions[0]) || null;
  const posterUrl = activeExhibition?.poster || gallery.posterImage;
  const galleryLogoUrl = gallery.logoImage || gallery.image;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in font-sans">
      <div className="clay-card relative w-full max-w-xl bg-white dark:bg-[#1a202c] rounded-3xl overflow-hidden flex flex-col max-h-[94vh] border border-[#E1E1E1] dark:border-stone-800 shadow-2xl">
        {/* Close button (Always accessible at top left) */}
        <button
          onClick={onClose}
          className="absolute top-3.5 left-3.5 w-9 h-9 rounded-full bg-stone-950/70 hover:bg-stone-950 text-white flex items-center justify-center transition-colors shadow-md z-20"
          title="بستن پنجره"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Traffic Zone Indicator */}
        {gallery.isInTrafficZone && (
          <div className="absolute top-3.5 right-3.5 bg-[#F76B1C] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md backdrop-blur-sm z-20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>محدوده طرح ترافیک تهران</span>
          </div>
        )}

        {/* 1. Modal Poster Showcase: 100% UNCHOPPED & UNCONSTRAINED FULL POSTER DISPLAY */}
        <div className="relative w-full bg-[#f4f7fb] dark:bg-[#121620] p-4 pt-12 flex items-center justify-center border-b border-[#E1E1E1] dark:border-stone-800 shrink-0">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={activeExhibition?.title || getGalleryDisplayName(gallery)}
              referrerPolicy="no-referrer"
              className="max-h-[46vh] sm:max-h-[52vh] w-auto h-auto max-w-full object-contain rounded-2xl shadow-md border border-[#E1E1E1] dark:border-stone-700"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-44 w-full flex flex-col items-center justify-center text-[#3D5B99]">
              <Palette className="w-10 h-10 mb-2 opacity-60" />
              <span className="text-sm font-bold">نمایشگاه هنری</span>
            </div>
          )}
        </div>

        {/* 2. Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-stone-700 dark:text-stone-300">
          {/* Gallery Header Row: Logo 48x48 + Name + Location */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f4f7fb] dark:bg-[#141822] border border-[#E1E1E1] dark:border-stone-800">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-sm border border-[#E1E1E1] dark:border-stone-700 shrink-0 flex items-center justify-center p-1">
              {galleryLogoUrl ? (
                <img
                  src={galleryLogoUrl}
                  alt={getGalleryDisplayName(gallery)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Palette className="w-5 h-5 text-stone-400" />
              )}
            </div>
            <div className="truncate flex-1">
              <div className="font-bold text-sm text-[#1d2d4c] dark:text-white truncate">
                {getGalleryDisplayName(gallery)}
              </div>
              <div className="text-[11px] text-[#3D5B99] dark:text-[#A3C2E4] truncate mt-0.5 font-medium">
                {gallery.neighborhoodFa} · {gallery.addressFa || gallery.address}
              </div>
            </div>
          </div>

          {/* Prominent Opening Date & Exhibition Details */}
          {activeExhibition && (
            <div className="clay-card clay-orange-subtle p-4 rounded-2xl shadow-sm border border-[#F76B1C]/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F76B1C]">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    {activeExhibition.openingDate
                      ? `تاریخ افتتاحیه: ${toPersianDigits(activeExhibition.openingDate)}`
                      : 'افتتاحیه: جمعه‌ها ۱۶:۰۰ الی ۲۰:۰۰'}
                  </span>
                </div>
                <span className="text-[11px] font-bold bg-[#F76B1C] text-white px-2.5 py-0.5 rounded-full">
                  ساعت ۱۶:۰۰ تا ۲۰:۰۰
                </span>
              </div>

              <div>
                <div className="text-base font-bold text-[#10335e] dark:text-[#dbeafe] leading-snug">
                  {activeExhibition.title}
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                  {activeExhibition.type || 'نمایشگاه انفرادی'}
                </div>
              </div>

              {activeExhibition.artist && (
                <div className="flex items-center gap-1.5 text-xs text-[#1d2d4c] dark:text-stone-200 font-bold pt-1 border-t border-[#F76B1C]/20">
                  <User className="w-3.5 h-3.5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
                  <span className="text-stone-500 dark:text-stone-400 font-normal">آثار هنرمند:</span>
                  <span>{activeExhibition.artist}</span>
                </div>
              )}

              {activeExhibition.fullDateRange && (
                <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-[#F76B1C]" />
                  <span>دوره برگزاری: {toPersianDigits(activeExhibition.fullDateRange)}</span>
                </div>
              )}
            </div>
          )}

          {/* Metadata Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#ebf3fb] dark:bg-stone-800 flex items-center justify-center shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#1d2d4c] dark:text-white block">نشانی دقیق:</span>
                <span className="text-stone-600 dark:text-stone-300 leading-relaxed mt-0.5 block">
                  {gallery.addressFa || gallery.address}
                </span>
              </div>
            </div>

            {/* Visiting Days & Hours: Clarifying Friday opening and weekday schedule */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#ebf3fb] dark:bg-stone-800 flex items-center justify-center shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]">
                <Clock className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="font-bold text-[#1d2d4c] dark:text-white block">تقویم و ساعات بازدید:</span>
                <div className="text-stone-600 dark:text-stone-300 leading-relaxed space-y-0.5 text-[11px]">
                  <div>• <strong>افتتاحیه:</strong> جمعه‌ها ساعت ۱۶:۰۰ الی ۲۰:۰۰</div>
                  <div>• <strong>روزهای عادی:</strong> یکشنبه تا پنجشنبه (ساعات عادی: {toPersianDigits(gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰')})</div>
                  <div>• <strong>تعطیلات هفتگی:</strong> شنبه‌ها اکثر نگارخانه‌ها تعطیل هستند</div>
                </div>
              </div>
            </div>

            {gallery.phone && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#ebf3fb] dark:bg-stone-800 flex items-center justify-center shrink-0 text-[#3D5B99] dark:text-[#A3C2E4]">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-[#1d2d4c] dark:text-white block">تلفن هماهنگی:</span>
                  <a
                    href={`tel:${gallery.phone}`}
                    className="text-[#F76B1C] font-bold hover:underline font-mono mt-0.5 block"
                  >
                    {toPersianDigits(gallery.phone)}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Social Links & Web (ZERO galleryinfo links) */}
          {(gallery.website || gallery.instagram) && (
            <div className="flex items-center gap-3 pt-3 border-t border-[#E1E1E1] dark:border-stone-800 flex-wrap">
              {gallery.website && (
                <a
                  href={gallery.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-base px-3 py-1.5 font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform text-[#3D5B99]"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>وبسایت رسمی نگارخانه</span>
                </a>
              )}

              {gallery.instagram && (
                <a
                  href={gallery.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button clay-orange-subtle px-3 py-1.5 font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
                >
                  <Instagram className="w-3.5 h-3.5 text-[#F76B1C]" />
                  <span>صفحه اینستاگرام</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* 3. Modal Footer Controls: 2x2 Navigation Grid + Tour Toggle */}
        <div className="p-4 pb-6 bg-[#f8fafc] dark:bg-[#141822] border-t border-[#E1E1E1] dark:border-stone-800 space-y-3 shrink-0">
          <div className="text-[11px] font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-between">
            <span>مسیریابی مستقیم به این نگارخانه</span>
            <span className="text-[10px] text-stone-400 font-normal">ترافیک زنده</span>
          </div>

          {/* 2x2 Navigation Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {/* Row 1: Google Maps & Waze */}
            <a
              href={buildGoogleMapsUrl([gallery])}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3 px-3 text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <GoogleMapsIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="font-sans font-bold text-sm tracking-wide">Google Maps</span>
            </a>

            <a
              href={buildWazeUrl(gallery)}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3 px-3 text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <WazeIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="font-sans font-bold text-sm tracking-wide">Waze</span>
            </a>

            {/* Row 2: نشان & بلد */}
            <a
              href={buildNeshanUrl(gallery)}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3 px-3 text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <NeshanIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">نشان</span>
            </a>

            <a
              href={buildBaladUrl(gallery)}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-button clay-base border border-[#E1E1E1] dark:border-stone-700 py-3 px-3 text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group"
            >
              <BaladIcon className="w-8 h-8 shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">بلد</span>
            </a>
          </div>

          {/* Add / Remove from Tour Button */}
          <button
            onClick={() => onToggle(gallery)}
            className={`w-full clay-button py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
              isSelected
                ? 'clay-base text-rose-600 border border-rose-200 dark:border-rose-900'
                : 'clay-orange text-white shadow-md hover:brightness-105'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>در برنامه گشت شما قرار دارد (حذف از گشت)</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>+ افزودن به گشت</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
