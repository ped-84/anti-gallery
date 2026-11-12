import React from 'react';
import { Navigation, Download } from 'lucide-react';
import { toPersianDigits } from '../utils/persianUtils';
import { ClayThemeToggle } from './ClayThemeToggle';

interface HeaderProps {
  selectedCount: number;
  onOptimizeRoute: () => void;
  isOptimizing: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  hasCustomOrigin?: boolean;
  onTriggerInstall?: () => void;
  isStandalone?: boolean;
}

export const APP_VERSION = 'بتا V 1.100';

export const Header: React.FC<HeaderProps> = ({
  selectedCount,
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-20 sm:h-[88px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Logo & Wordmark (Corporate identity) */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <a href="/" className="flex items-center gap-2.5 sm:gap-3.5 text-inherit no-underline group">
            {/* Corporate Brand Icon (Claymorphic) */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 clay-card flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 p-1.5 sm:p-2 bg-white dark:bg-[#181d27] border border-stone-200 dark:border-stone-800 shadow-sm rounded-2xl">
              <img
                src="./icons/brand-logo-icon.png"
                alt="لوگوی آرت‌گشت"
                className="w-full h-full object-contain block dark:hidden"
              />
              <img
                src="./icons/brand-logo-icon-dark.png"
                alt="لوگوی آرت‌گشت"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
            <div className="flex flex-col justify-center">
              {/* Prominent English Brand Wordmark */}
              <div className="flex items-center">
                <img
                  src="./icons/brand-wordmark-light.png"
                  alt="art gasht"
                  className="h-6 sm:h-7 md:h-8 w-auto object-contain block dark:hidden"
                />
                <img
                  src="./icons/brand-wordmark-dark.png"
                  alt="art gasht"
                  className="h-6 sm:h-7 md:h-8 w-auto object-contain hidden dark:block"
                />
              </div>
              {/* Version Badge & Slogan with enhanced vertical breathing room */}
              <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5">
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 leading-snug shrink-0 font-ubuntu">
                  {APP_VERSION}
                </span>
                <p className="text-[11px] sm:text-xs font-medium text-[#3D5B99] dark:text-[#A3C2E4] hidden md:block">
                  مسیریاب هوشمند گالری‌های هنری
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Zone 2: Actions Group (PWA Install + Day/Night Toggle + Optimize) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

          {/* Animated Claymorphic Day/Night Theme Switch */}
          <ClayThemeToggle isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />

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
                : selectedCount === 0
                ? `انتخاب حداقل ${toPersianDigits(minRequired)} گالری`
                : `انتخاب گالری (${toPersianDigits(selectedCount)} از ${toPersianDigits(minRequired)})`}
            </span>
            {/* Mobile label */}
            <span className="inline sm:hidden">
              {isOptimizing
                ? 'محاسبه...'
                : canOptimize
                ? `مسیریابی (${toPersianDigits(selectedCount)})`
                : selectedCount === 0
                ? `حداقل ${toPersianDigits(minRequired)} گالری`
                : `${toPersianDigits(selectedCount)} از ${toPersianDigits(minRequired)}`}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
