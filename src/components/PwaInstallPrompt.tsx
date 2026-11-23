import React, { useState, useEffect } from 'react';
import { Download, X, Compass, Share2, PlusSquare, CheckCircle2, MoreVertical, Smartphone } from 'lucide-react';
import { ToastNotification } from './ToastNotification';

interface PwaInstallPromptProps {
  onInstallStateChange?: (canInstall: boolean) => void;
  externalTrigger?: number; // Increment to trigger install from Header
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  onInstallStateChange,
  externalTrigger
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [showAndroidModal, setShowAndroidModal] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Check if running in standalone mode (already installed)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);

  // Detect iOS
  const isIos =
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  // 1. Listen for Android Chrome / Desktop beforeinstallprompt
  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      onInstallStateChange?.(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      onInstallStateChange?.(true);

      // Check if user recently dismissed (within 2 days)
      const lastDismissed = localStorage.getItem('gallerygardi_pwa_dismissed');
      const now = Date.now();
      if (!lastDismissed || now - parseInt(lastDismissed, 10) > 2 * 24 * 60 * 60 * 1000) {
        // Show after a gentle 2-second delay so page initial load is calm
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      setIsInstalled(true);
      setShowSuccessToast(true);
      onInstallStateChange?.(false);
      setTimeout(() => setShowSuccessToast(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone, onInstallStateChange]);

  // 2. React to external trigger (e.g. Header "نصب اپ" button click)
  useEffect(() => {
    if (!externalTrigger) return;

    if (deferredPrompt) {
      triggerInstall();
    } else if (isIos && !isStandalone) {
      setShowIosModal(true);
    } else if (!isStandalone) {
      setShowAndroidModal(true);
    }
  }, [externalTrigger]);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setShowBanner(false);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
        if (isIos) {
          setShowIosModal(true);
        } else {
          setShowAndroidModal(true);
        }
        setShowBanner(false);
      }
    } else if (isIos) {
      setShowIosModal(true);
      setShowBanner(false);
    } else {
      // Android / Desktop Chrome fallback when browser suppresses automatic prompt
      setShowAndroidModal(true);
      setShowBanner(false);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('gallerygardi_pwa_dismissed', Date.now().toString());
  };

  if (isInstalled) {
    if (!showSuccessToast) return null;
    return (
      <ToastNotification
        toast={{
          title: 'اپلیکیشن آرت‌گشت با موفقیت نصب شد!',
          subtitle: 'اکنون می‌توانید بدون نیاز به مرورگر و به‌صورت تمام‌صفحه از صفحه اصلی گوشی به آرت‌گشت دسترسی داشته باشید.',
          type: 'success',
          duration: 4500
        }}
        onClose={() => setShowSuccessToast(false)}
      />
    );
  }

  return (
    <>
      {/* A. Bottom Automatic Slide-up Install Banner (Android & Mobile) */}
      {showBanner && (
        <div className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-[420px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="clay-card p-4 sm:p-5 bg-white/95 dark:bg-[#1a2130]/95 backdrop-blur-xl border border-[#3D5B99]/30 dark:border-stone-700 shadow-2xl rounded-2xl flex flex-col gap-3.5">
            {/* Top row: Icon, text & close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[#131722] border border-stone-700/60 flex items-center justify-center shrink-0 rounded-2xl shadow-md p-2">
                  <img
                    src="./icons/brand-logo-icon-dark.svg?v=1.168"
                    alt="آرت‌گشت"
                    width="24"
                    height="24"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-[#1c2944] dark:text-white leading-tight">
                    نصب اپلیکیشن آرت‌گشت
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1 leading-relaxed font-medium">
                    برای دسترسی سریع، تمام‌صفحه و بدون نوار آدرس، اپلیکیشن را روی گوشی خود نصب کنید.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom row: Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={dismissBanner}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 rounded-xl transition-colors cursor-pointer"
              >
                بعداً
              </button>
              <button
                type="button"
                onClick={triggerInstall}
                className="clay-button clay-orange text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.2]" />
                <span>نصب اپلیکیشن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B. iOS Safari Installation Instruction Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm clay-card p-5 bg-white dark:bg-[#1a2130] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#131722] border border-stone-700/60 flex items-center justify-center rounded-xl shadow-xs overflow-hidden p-1.5">
                  <img
                    src="./icons/brand-logo-icon-dark.svg?v=1.168"
                    alt="آرت‌گشت"
                    width="20"
                    height="20"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-sm sm:text-base font-black text-[#1c2944] dark:text-white">
                  نصب روی آیفون (iOS)
                </h2>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <div className="w-6 h-6 rounded-lg bg-[#3D5B99]/15 text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm">
                  ۱
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>در نوار پایین مرورگر سافاری روی آیکون</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 font-bold text-xs">
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </span>
                  <span>بزنید.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <div className="w-6 h-6 rounded-lg bg-[#F76B1C]/15 text-[#F76B1C] flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm">
                  ۲
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>به پایین اسکرول کرده و گزینه</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 font-bold text-xs">
                    <PlusSquare className="w-3.5 h-3.5" />
                    Add to Home Screen
                  </span>
                  <span>را انتخاب کنید.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="clay-button clay-base w-full py-2.5 text-xs sm:text-sm font-bold text-[#3D5B99] dark:text-[#A3C2E4] rounded-xl hover:brightness-105 active:scale-95 transition-all mt-1"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* C. Android Chrome Installation Instruction Modal (Fallback when beforeinstallprompt is suppressed) */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm clay-card p-5 bg-white dark:bg-[#1a2130] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#131722] border border-stone-700/60 flex items-center justify-center rounded-xl shadow-xs overflow-hidden p-1.5">
                  <img
                    src="./icons/brand-logo-icon-dark.svg?v=1.168"
                    alt="آرت‌گشت"
                    width="20"
                    height="20"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-sm sm:text-base font-black text-[#1c2944] dark:text-white">
                  نصب مستقیم در اندروید
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-500 flex items-center justify-center cursor-pointer"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
              به دلیل اینکه اپلیکیشن قبلاً حذف شده، کروم پنجره خودکار را موقتاً محدود کرده است. برای نصب مجدد کافیست:
            </p>

            <div className="space-y-2.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <div className="w-6 h-6 rounded-lg bg-[#3D5B99]/15 text-[#3D5B99] dark:text-[#A3C2E4] flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm">
                  ۱
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>در بالای مرورگر کروم روی</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 font-bold text-xs">
                    <MoreVertical className="w-3.5 h-3.5" />
                    منوی سه‌نقطه
                  </span>
                  <span>(بالا سمت راست) بزنید.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <div className="w-6 h-6 rounded-lg bg-[#F76B1C]/15 text-[#F76B1C] flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm">
                  ۲
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>گزینه</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 font-bold text-xs text-[#F76B1C]">
                    <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                    نصب برنامه (Install app)
                  </span>
                  <span>یا «افزودن به صفحه اصلی» را انتخاب کنید.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm">
                  ۳
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span>روی</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">«نصب» (Install)</span>
                  <span>تأیید نمایید تا نسخه تیره با موفقیت نصب شود.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAndroidModal(false)}
              className="clay-button clay-orange text-white w-full py-2.5 text-xs sm:text-sm font-bold rounded-xl hover:brightness-105 active:scale-95 transition-all mt-1 cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
