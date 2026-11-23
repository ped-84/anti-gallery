import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastData {
  id?: string;
  title: string;
  subtitle?: string;
  type?: ToastType;
  duration?: number; // milliseconds, default 4500
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastNotificationProps {
  toast: ToastData;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  onClose
}) => {
  const {
    title,
    subtitle,
    type = 'success',
    duration = 4500,
    action
  } = toast;

  const [progress, setProgress] = useState<number>(100);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    if (duration <= 0) return;

    startTimeRef.current = Date.now();
    remainingTimeRef.current = duration;
    setProgress(100);

    const stepMs = 50;
    const interval = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now();
        return;
      }

      const elapsedSinceResume = Date.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, remainingTimeRef.current - elapsedSinceResume);
      const pct = (currentRemaining / duration) * 100;

      setProgress(pct);

      if (currentRemaining <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, stepMs);

    return () => clearInterval(interval);
  }, [duration, onClose, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    remainingTimeRef.current = Math.max(0, (progress / 100) * duration);
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  // Configure icon & theme colors based on toast type
  let iconComponent = <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />;
  let iconBadgeBg = 'bg-gradient-to-br from-[#FF7A29] to-[#E55909] text-white shadow-md shadow-[#F76B1C]/35 ring-2 ring-white/30 dark:ring-white/15';
  let progressBarColor = 'bg-[#F76B1C]';
  let sideAccentBorder = 'border-r-4 border-r-[#F76B1C]';

  if (type === 'info') {
    iconComponent = <Info className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />;
    iconBadgeBg = 'bg-gradient-to-br from-[#4A6EB5] to-[#3D5B99] text-white shadow-md shadow-[#3D5B99]/35 ring-2 ring-white/30 dark:ring-white/15';
    progressBarColor = 'bg-[#3D5B99]';
    sideAccentBorder = 'border-r-4 border-r-[#3D5B99]';
  } else if (type === 'warning') {
    iconComponent = <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />;
    iconBadgeBg = 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/35 ring-2 ring-white/30 dark:ring-white/15';
    progressBarColor = 'bg-amber-500';
    sideAccentBorder = 'border-r-4 border-r-amber-500';
  } else if (type === 'error') {
    iconComponent = <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />;
    iconBadgeBg = 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/35 ring-2 ring-white/30 dark:ring-white/15';
    progressBarColor = 'bg-rose-500';
    sideAccentBorder = 'border-r-4 border-r-rose-500';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-[5.75rem] sm:bottom-auto sm:top-6 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-24px)] sm:w-auto sm:min-w-[460px] sm:max-w-[580px] pointer-events-auto select-none transition-all"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl sm:rounded-[22px]
          bg-white/98 dark:bg-[#20293d]/98 backdrop-blur-2xl
          border border-[#3D5B99]/30 dark:border-stone-500/60
          shadow-[0_20px_45px_-8px_rgba(24,86,199,0.24),0_6px_16px_rgba(0,0,0,0.06)]
          dark:shadow-[0_24px_55px_-8px_rgba(0,0,0,0.88),0_8px_24px_rgba(0,0,0,0.65)]
          ring-1 ring-black/5 dark:ring-white/15
          p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4
          animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-4 duration-300
          ${sideAccentBorder}
        `}
      >
        {/* Type Icon Badge (Claymorphic) */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${iconBadgeBg} flex items-center justify-center shrink-0`}
        >
          {iconComponent}
        </div>

        {/* Text Content: Title & Subtitle with wide, comfortable layout */}
        <div className="flex-1 min-w-0 pt-0.5 text-right">
          <h4 className="font-black text-[#102a4e] dark:text-white text-sm sm:text-md leading-snug">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs sm:text-xs text-stone-600 dark:text-stone-300 font-medium mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 text-xs font-bold text-[#F76B1C] hover:underline cursor-pointer"
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/90 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
          title="بستن اعلان"
          aria-label="بستن اعلان"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Countdown Progress Bar */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-stone-100 dark:bg-stone-800/80 overflow-hidden">
            <div
              className={`h-full ${progressBarColor} transition-all ease-linear`}
              style={{
                width: `${progress}%`,
                transitionDuration: '50ms'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
