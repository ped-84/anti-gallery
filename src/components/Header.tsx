import React from 'react';
import { Compass, Sparkles, Navigation, Sun, Moon, Download } from 'lucide-react';
import { toPersianDigits } from '../utils/persianUtils';

interface HeaderProps {
  selectedCount: number;
  onOpenCuratedTours: () => void;
  onOptimizeRoute: () => void;
  isOptimizing: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  hasCustomOrigin?: boolean;
  onTriggerInstall?: () => void;
  isStandalone?: boolean;
}

export const APP_VERSION = 'بتا V 1.079';

export const Header: React.FC<HeaderProps> = ({
  selectedCount,
  onOpenCuratedTours,
  onOptimizeRoute,
  isOptimizing,
  isDarkMode,
  onToggleDarkMode,
  hasCustomOrigin = false,
  onTriggerInstall,
  isStandalone = false
}) => {
  const canOptimize = hasCustomOrigin ? selectedCount >= 1 : selectedCount >= 2;
  const minRequired = hasCustomOrigin ? 1 : 2;
  return (
    <header className="sticky top-0 z-40 bg-[#f4f6fa]/95 dark:bg-[#131722]/95 backdrop-blur-md border-b border-[#E1E1E1] dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Wordmark (Compact on mobile, full on desktop) */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <a href="/" className="flex items-center gap-2 sm:gap-3.5 text-inherit no-underline group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 clay-card clay-darkblue flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-base sm:text-xl font-black tracking-tight text-[#1c2944] dark:text-white block leading-tight">
                آرت‌گشت
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 leading-snug shrink-0 font-mono">
                  {APP_VERSION}
                </span>
                <p className="text-[11px] sm:text-xs font-medium text-[#3D5B99] dark:text-[#A3C2E4] hidden md:block">
                  مسیریاب هوشمند گالری‌های هنری
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Zone 2: Curated Tours Button (Desktop / Tablet Only - centered) */}
        <div className="hidden md:flex items-center">
          <button
            onClick={onOpenCuratedTours}
            title="گشت‌های هنری آماده (تهران)"
            className="clay-button clay-orange text-white px-4 py-2.5 flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all shadow-md shrink-0 text-xs font-bold cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white stroke-[2.2] shrink-0" />
            <span>گشت‌های هنری آماده (تهران)</span>
          </button>
        </div>

        {/* Zone 3: Actions Group (Curated trigger on mobile + Dark mode + Optimize) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Curated Tours Trigger (Visible only on screens < md, perfectly spaced with actions) */}
          <button
            onClick={onOpenCuratedTours}
            title="گشت‌های هنری آماده (تهران)"
            className="md:hidden clay-button clay-orange text-white px-2.5 py-2 flex items-center gap-1.5 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 text-xs font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white stroke-[2.2] shrink-0" />
            <span>گشت‌ها</span>
          </button>

          {/* PWA Install Button (Hidden if already in standalone app mode) */}
          {!isStandalone && onTriggerInstall && (
            <button
              onClick={onTriggerInstall}
              title="نصب اپلیکیشن روی گوشی یا رایانه (PWA)"
              className="clay-button clay-base w-9 h-9 sm:w-auto sm:px-3 sm:py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer rounded-xl"
            >
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5 stroke-[2.2]" />
              <span className="hidden sm:inline">نصب اپ</span>
            </button>
          )}

          {/* Dark Mode Switch */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
            className="clay-button clay-base w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer rounded-xl"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#3D5B99]" />
            )}
          </button>

          {/* Primary Action Button: آبی کمرنگ (Light Blue) */}
          <button
            onClick={onOptimizeRoute}
            disabled={!canOptimize || isOptimizing}
            className={`clay-button px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 shrink-0 rounded-xl cursor-pointer ${
              canOptimize
                ? 'clay-softblue text-[#10335e] dark:text-[#cde0f3] shadow-sm hover:brightness-105'
                : 'clay-base text-stone-400 dark:text-stone-600 cursor-not-allowed opacity-75'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#10335e] dark:text-[#cde0f3] stroke-[2.2] ${isOptimizing ? 'animate-spin' : ''}`} />
            {/* Desktop label */}
            <span className="hidden sm:inline">
              {isOptimizing
                ? 'در حال محاسبه...'
                : canOptimize
                ? `مسیریابی بهینه (${toPersianDigits(selectedCount)} گالری)`
                : `انتخاب گالری (${toPersianDigits(selectedCount)}/${toPersianDigits(minRequired)}+)`}
            </span>
            {/* Mobile label */}
            <span className="inline sm:hidden">
              {isOptimizing
                ? 'محاسبه...'
                : canOptimize
                ? `مسیریابی (${toPersianDigits(selectedCount)})`
                : `${toPersianDigits(selectedCount)}/${toPersianDigits(minRequired)}+`}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
