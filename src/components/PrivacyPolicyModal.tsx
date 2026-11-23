import React from 'react';
import { X, ShieldCheck, MapPin, EyeOff, Lock, Server, Mail, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] clay-card bg-white dark:bg-[#181d27] border border-[#E1E1E1] dark:border-stone-800 shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E1E1E1] dark:border-stone-800 bg-[#f8fafc] dark:bg-[#131722]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#10335e] text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1d2d4c] dark:text-white leading-tight">
                سیاست حفظ حریم خصوصی آرت‌گشت
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
                تعهدنامه رسمی امنیت و حفظ حریم خصوصی کاربران (Google Play & Apple App Store Guidelines Compliance)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-sans">
          {/* Key Guarantee Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm">
                اصل بنیادین آرت‌گشت: حفظ ۱۰۰٪ ناشناسی و حریم خصوصی کاربر
              </p>
              <p className="text-2xs sm:text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                آرت‌گشت هیچ‌گونه ثبت‌نام، شماره موبایل، ایمیل، یا ردپای مکانی از شما دریافت یا در هیچ پایگاه‌داده‌ای ذخیره نمی‌کند.
              </p>
            </div>
          </div>

          {/* Section 1: Geolocation */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#10335e] dark:text-[#93c5fd] flex items-center gap-2 text-sm sm:text-base">
              <MapPin className="w-4 h-4 text-[#F76B1C]" />
              <span>۱. نحوه استفاده از دسترسی موقعیت مکانی (GPS)</span>
            </h3>
            <p className="text-justify text-stone-600 dark:text-stone-300">
              هنگامی که دکمه «مسیریابی از موقعیت من» را لمس می‌کنید، سیستم‌عامل دستگاه (اندروید/iOS) از شما اجازه دریافت مختصات فعلی‌تان را می‌خواهد.
              این مختصات <strong>صرفاً و منحصراً در حافظه موقت پردازنده مرورگر دستگاه شما (Client-Side)</strong> برای محاسبه فاصله ریاضی تا نگارخانه‌ها و پیشنهاد نزدیک‌ترین نقطه شروع تور استفاده می‌شود.
              <strong> هیچ نقطه‌ای از موقعیت یا مسیر حرکتی شما هرگز به سرورهای آرت‌گشت یا هیچ شخص ثالثی ارسال یا ثبت نمی‌شود.</strong>
            </p>
          </section>

          {/* Section 2: No Personal Data Collection */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#10335e] dark:text-[#93c5fd] flex items-center gap-2 text-sm sm:text-base">
              <EyeOff className="w-4 h-4 text-[#F76B1C]" />
              <span>۲. عدم جمع‌آوری اطلاعات هویتی و شخصی</span>
            </h3>
            <p className="text-justify text-stone-600 dark:text-stone-300">
              استفاده از تمام امکانات آرت‌گشت رایگان و بدون نیاز به ایجاد حساب کاربری است. ما به هیچ عنوان به مخاطبین، گالری تصاویر، پیامک‌ها، یا شناسه تبلیغاتی دستگاه (Advertising ID) دسترسی نداریم و تقاضای چنین دسترسی‌هایی نمی‌کنیم.
            </p>
          </section>

          {/* Section 3: Third-Party SDKs & Trackers */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#10335e] dark:text-[#93c5fd] flex items-center gap-2 text-sm sm:text-base">
              <Server className="w-4 h-4 text-[#F76B1C]" />
              <span>۳. سرویس‌های نقشه و عدم وجود ردیاب‌های تجاری</span>
            </h3>
            <p className="text-justify text-stone-600 dark:text-stone-300">
              برای نمایش تایل‌های نقشه شهری، از زیرساخت نقشه تعاملی نشان و در صورت درخواست مسیریابی رانندگی، پیوند به اپلیکیشن‌های بومی نقشه (نشان، بلد، گوگل مپ، ویز) استفاده می‌شود. هیچ ردیاب تبلیغاتی (مانند Google AdMob یا سرویس‌های بازاریابی شخص ثالث) در برنامه تعبیه نشده است.
            </p>
          </section>

          {/* Section 4: Security & Encryption */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#10335e] dark:text-[#93c5fd] flex items-center gap-2 text-sm sm:text-base">
              <Lock className="w-4 h-4 text-[#F76B1C]" />
              <span>۴. امنیت انتقال داده‌ها (Encryption in Transit)</span>
            </h3>
            <p className="text-justify text-stone-600 dark:text-stone-300">
              تمامی ترافیک شبکه برنامه با بالاترین استاندارد رمزنگاری امن SSL/TLS (نسخه TLS 1.3 با گواهی معتبر و سیاست‌های امنیتی HSTS) محافظت می‌شود تا از هرگونه استراق سمع یا تغییر داده در مسیر شبکه جلوگیری گردد.
            </p>
          </section>

          {/* Section 5: Contact */}
          <section className="p-3.5 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#10335e] dark:text-[#60a5fa] shrink-0" />
              <div>
                <p className="font-bold text-stone-800 dark:text-stone-200 text-xs">
                  پشتیبانی و ارتباط با توسعه‌دهنده
                </p>
                <p className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                  info@artgasht.com · ped.maleki@gmail.com
                </p>
              </div>
            </div>
            <span className="text-2xs font-bold text-stone-400 shrink-0">
              آخرین بازبینی: نوامبر ۲۰۲۶
            </span>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E1E1E1] dark:border-stone-800 bg-[#f8fafc] dark:bg-[#131722] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="clay-button clay-base px-6 py-2 rounded-full text-xs sm:text-sm font-bold text-[#10335e] dark:text-[#93c5fd] hover:text-[#F76B1C] transition-colors cursor-pointer"
          >
            متوجه شدم و موافقم
          </button>
        </div>
      </div>
    </div>
  );
};
