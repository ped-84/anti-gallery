import React from 'react';
import { Compass, Sparkles, Navigation, Sun, Moon } from 'lucide-react';
import { toPersianDigits } from '../utils/persianUtils';

interface HeaderProps {
  selectedCount: number;
  onOpenCuratedTours: () => void;
  onOptimizeRoute: () => void;
  isOptimizing: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const APP_VERSION = 'بتا V 1.053';

export const Header: React.FC<HeaderProps> = ({
  selectedCount,
  onOpenCuratedTours,
  onOptimizeRoute,
  isOptimizing,
  isDarkMode,
  onToggleDarkMode
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#f4f6fa]/95 dark:bg-[#131722]/95 backdrop-blur-md border-b border-[#E1E1E1] dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Wordmark (Compact on mobile, full on desktop) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <a href="/" className="flex items-center gap-2.5 sm:gap-3.5 text-inherit no-underline group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 clay-card clay-darkblue flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
              <Compass className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-lg sm:text-2xl font-black tracking-tight text-[#1c2944] dark:text-white block leading-tight">
                گالری‌گردی
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 leading-snug shrink-0 font-mono">
                  {APP_VERSION}
                </span>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#3D5B99] dark:text-[#A3C2E4] hidden xs:block">
                  مسیریاب هوشمند گالری‌های هنری
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Zone 2: Navigation Links (Desktop only, zero galleryinfo links) */}
        <nav className="hidden lg:flex items-center gap-3 text-xs font-medium">
          <button
            onClick={onOpenCuratedTours}
            className="clay-button clay-softblue px-4 py-2.5 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform"
          >
            <Sparkles className="w-4 h-4 text-[#10335e] dark:text-[#cde0f3]" />
            <span>گشت‌های هنری آماده (تهران)</span>
          </button>
        </nav>

        {/* Zone 3: Dark Mode Switcher & Primary Action (Fully Responsive on Mobile) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Dark Mode Switch */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
            className="clay-button clay-base w-9 h-9 sm:w-11 sm:h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#3D5B99]" />
            )}
          </button>

          {/* Primary Action Button (Compact on Mobile to prevent any overflow) */}
          <button
            onClick={onOptimizeRoute}
            disabled={selectedCount < 2 || isOptimizing}
            className={`clay-button px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 shrink-0 ${
              selectedCount >= 2
                ? 'clay-orange text-white shadow-md hover:brightness-105'
                : 'clay-base text-stone-400 dark:text-stone-600 cursor-not-allowed opacity-75'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            {/* Desktop label */}
            <span className="hidden sm:inline">
              {isOptimizing
                ? 'در حال محاسبه...'
                : selectedCount >= 2
                ? `مسیریابی بهینه (${toPersianDigits(selectedCount)} گالری)`
                : `انتخاب گالری (${toPersianDigits(selectedCount)}/۲+)`}
            </span>
            {/* Mobile label */}
            <span className="inline sm:hidden">
              {isOptimizing
                ? 'محاسبه...'
                : selectedCount >= 2
                ? `مسیریابی (${toPersianDigits(selectedCount)})`
                : `${toPersianDigits(selectedCount)}/۲+`}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
