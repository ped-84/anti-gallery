import React from 'react';
import { Download } from 'lucide-react';
import { ClayThemeToggle } from './ClayThemeToggle';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onTriggerInstall?: () => void;
  isStandalone?: boolean;
}

export const APP_VERSION = 'بتا V 1.111';

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onTriggerInstall,
  isStandalone = false
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#f4f6fa]/95 dark:bg-[#131722]/95 backdrop-blur-md border-b border-[#E1E1E1] dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-22 md:h-24 flex items-center justify-between gap-3 sm:gap-4">
        {/* Zone 1: Brand Wordmark Logo (Prominent, Sole Main Logo, Right-Aligned Subtitle) */}
        <div className="flex items-center shrink-0">
          <a href="/" className="flex flex-col justify-center text-right text-inherit no-underline group">
            {/* English Brand Wordmark (Primary Logo, Enlarged) */}
            <div className="flex items-center group-hover:opacity-95 transition-opacity">
              <img
                src="./icons/brand-wordmark-light.png"
                alt="art gasht"
                className="h-8 sm:h-10 md:h-12 w-auto object-contain block dark:hidden"
              />
              <img
                src="./icons/brand-wordmark-dark.png"
                alt="art gasht"
                className="h-8 sm:h-10 md:h-12 w-auto object-contain hidden dark:block"
              />
            </div>
            {/* Slogan with comfortable breathing room below wordmark */}
            <p className="text-xs sm:text-sm font-semibold text-[#3D5B99] dark:text-[#A3C2E4] text-right mt-1.5 sm:mt-2 leading-tight tracking-tight">
              مسیریاب هوشمند گالری‌های هنری
            </p>
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
