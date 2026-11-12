import React from 'react';
import { Download } from 'lucide-react';
import { ClayThemeToggle } from './ClayThemeToggle';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onTriggerInstall?: () => void;
  isStandalone?: boolean;
}

export const APP_VERSION = 'بتا V 1.102';

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onTriggerInstall,
  isStandalone = false
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#f4f6fa]/95 dark:bg-[#131722]/95 backdrop-blur-md border-b border-[#E1E1E1] dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 md:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Logo & Wordmark (Compact on mobile, right-aligned subtitle) */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <a href="/" className="flex items-center gap-2 sm:gap-3.5 text-inherit no-underline group">
            {/* Corporate Brand Icon (Compact on mobile, larger on tablet/desktop) */}
            <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 clay-card flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 p-1 sm:p-1.5 bg-white dark:bg-[#181d27] border border-stone-200 dark:border-stone-800 shadow-sm rounded-xl sm:rounded-2xl">
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
            <div className="flex flex-col justify-center text-right">
              {/* English Brand Wordmark (Proportional on mobile) */}
              <div className="flex items-center">
                <img
                  src="./icons/brand-wordmark-light.png"
                  alt="art gasht"
                  className="h-5 sm:h-7 md:h-9 w-auto object-contain block dark:hidden"
                />
                <img
                  src="./icons/brand-wordmark-dark.png"
                  alt="art gasht"
                  className="h-5 sm:h-7 md:h-9 w-auto object-contain hidden dark:block"
                />
              </div>
              {/* Slogan right-aligned with the logo, visible on all screens */}
              <p className="text-[9.5px] sm:text-xs font-medium text-[#3D5B99] dark:text-[#A3C2E4] text-right mt-0.5 sm:mt-1 leading-tight tracking-tight">
                مسیریاب هوشمند گالری‌های هنری
              </p>
            </div>
          </a>
        </div>

        {/* Zone 2: Actions Group (PWA Install + Day/Night Toggle) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* PWA Install Button (Hidden if already in standalone app mode) */}
          {!isStandalone && onTriggerInstall && (
            <button
              onClick={onTriggerInstall}
              title="نصب اپلیکیشن روی گوشی یا رایانه (PWA)"
              className="clay-button clay-base w-9 h-9 sm:w-auto sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer rounded-xl"
            >
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5 stroke-[2.2]" />
              <span className="hidden sm:inline">نصب اپ</span>
            </button>
          )}

          {/* Animated Claymorphic Day/Night Theme Switch */}
          <ClayThemeToggle isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
        </div>
      </div>
    </header>
  );
};
