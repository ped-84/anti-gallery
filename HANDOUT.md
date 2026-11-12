# آرت‌گشت (Anti-Gallery) — دستنامه و راهنمای جامع انتقال به چت جدید (Complete Project Handout)

> **تاریخ آخرین به‌روزرسانی:** نوامبر ۲۰۲۶ (۲۱ آبان ۱۴۰۵)  
> **نسخه فعلی مستقر:** `بتا V 1.097` (نسخه بعدی در نوبت: `بتا V 1.098`)  
> **مخزن گیت‌هاب:** `https://github.com/ped-84/anti-gallery.git`  
> **آدرس لایو گیت‌هاب پیجز:** [https://ped-84.github.io/anti-gallery/](https://ped-84.github.io/anti-gallery/)  
> **دامنه سرور اصلی (آلمان):** `https://artgasht.com`  
> **دامنه سرور آینه (ایران):** `https://artgasht.ir`  

---

## ۱. پرامپت آماده برای ارسال به چت جدید (Copy-Paste Prompt for New Chat)

```text
سلام! من در حال توسعه پروژه «آرت‌گشت» (Anti-Gallery) هستم؛ یک پلتفرم جامع PWA و مسیریاب هوشمند بازدید از گالری‌های هنری و نمایشگاه‌های فعال تهران بر پایه React 19، TypeScript، Tailwind CSS v4، استایل کلیمورفیک (Claymorphic) و نقشه تعاملی نشان.

فایل‌های جامع HANDOUT.md، PROJECT_HANDOFF.md و DEPLOY.md در ریشه مخزن وجود دارند. لطفاً قبل از هر اقدامی آن‌ها را به دقت مطالعه کن.

قوانین و ضوابط الزامی و تغییرناپذیر پروژه:
۱. پاسخ‌های فارسی در چت: تمامی پاسخ‌هایت در چت باید کاملاً راست‌چین و درون <div dir="rtl" style="text-align: right; direction: rtl;"> قرار گیرند.
۲. قانون افزایش نسخه (Version Increment): به ازای هر درخواست تغییر، نسخه برنامه APP_VERSION در فایل src/components/Header.tsx باید ۰.۰۰۱ واحد افزایش یابد (نسخه فعلی: بتا V 1.097 و نسخه بعدی: بتا V 1.098). همچنین CACHE_NAME در public/sw.js و مقدار version در server.ts با همان نسخه به‌روز می‌شود.
۳. دامنه نمایش: در حال حاضر فقط گالری‌های تهران در فرانت‌اند نمایش داده می‌شوند (شهرهای دیگر در دیتابیس محفوظ‌اند و نباید حذف شوند).
۴. تایپوگرافی و ارقام: تمام ارقام فارسی باید از toPersianDigits() عبور کنند. فونت متون فارسی شبنم (Shabnam FD) و متون انگلیسی و آدرس‌ها Ubuntu است که به صورت محلی در public/fonts/ میزبانی شده‌اند. هیچ فونت خارجی نباید در ران‌تایم لود شود.
۵. کامپوننت‌های فرم: هرگز از تگ پیش‌فرض <select> استفاده نکن و همواره از کامپوننت اختصاصی ClayDropdown.tsx استفاده کن.
۶. قوانین هوک‌های ریکت (Rules of Hooks): هیچ هوکی (useMemo, useState, useEffect, useCallback) نباید بعد از شرط if (...) return یا داخل شرط‌ها فراخوانی شود؛ همه هوک‌ها باید بدون قید و شرط در بالاترین سطح کامپوننت تعریف شوند.
۷. پایداری در برابر قطعی اینترنت بین‌الملل: هیچ وابستگی ران‌تایم خارجی مجاز نیست. اپ باید در اینترنت ملی (سرور ایران) ۱۰۰٪ پایدار بماند.
۸. معماری سرورها: سرور PRIMARY در آلمان (artgasht.com) منبع اصلی داده و پنل ادمین است؛ سرور MIRROR در ایران (artgasht.ir) نسخه فقط-خواندنی با سینک هر ۵ دقیقه و امکان حالت اضطراری STANDALONE است.
۹. فرآیند نهایی‌سازی و استقرار: پس از هر تغییر، کدهای تایپ‌اسکریپت با npm.cmd exec tsc -- --noEmit چک شده، بیلد با npm.cmd run build گرفته شده و پس از کامیت و پوش به شاخه main، با اسکریپت node scripts/deploy-ghpages.cjs روی gh-pages منتشر گردد.

وضعیت فعلی پروژه را بررسی کن و اعلام آمادگی نما تا تسک بعدی را شروع کنیم.
```

---

## ۲. خلاصه هویت و اهداف محصول (Product Identity & Vision)

«آرت‌گشت» برترین و مدرن‌ترین راهنمای آنلاین گالری‌گردی در تهران است. این وب‌اپلیکیشن به کاربران امکان می‌دهد:
* نمایشگاه‌های جاری و افتتاحیه‌های جمعه‌های تهران را مرور کنند.
* پوسترهای رسمی، نام هنرمند، عنوان، بیانیه (Statement)، ساعت کاری و شماره تماس گالری‌ها را مشاهده نمایند.
* با استفاده از الگوریتم هوشمند حل مسئله فروشنده دوره‌گرد (TSP)، بهینه‌ترین مسیر بازدید از چندین گالری را بر اساس ترافیک واقعی تهران و طرح ترافیک استخراج کنند.
* موقعیت گالری‌ها را به چهار اپلیکیشن ناوبری محبوب (نشان، بلد، ویز و گوگل مپس) ارسال کنند.
* تورهای پیشنهادی موضوعی و جغرافیایی (مانند تور کریمخان، الهیه و ونک) را طی کنند.
* از طریق پنل مدیریت اختصاصی بدون نیاز به بیلد یا دیپلوی، اطلاعات نمایشگاه‌ها و تصاویر پوسترهای جدید را ثبت نمایند.

---

## ۳. پشته فنی پروژه (Tech Stack)

| لایه | تکنولوژی / ابزار | توضیحات |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19.0.1 | معماری مدرن کامپوننت‌محور با React Hooks کامل |
| **Language** | TypeScript 5.8 / 7.0 | تایپ‌سیفتی ۱۰۰٪ بدون هیچ `any` ناایمن در منطق اصلی |
| **Build Tool** | Vite 8.3.5 | بیلد فوق سریع با تنظیم مسیر نسبی (`base: './'`) |
| **Styling** | Tailwind CSS v4 + Claymorphism | سیستم کلیمورفیک با سایه‌های سه‌بعدی نرم (`clay-card`, `clay-button`, `clay-input`) |
| **Persian Typography** | Shabnam FD (Local woff2) | فونت شبنم فارسی با ارقام فارسی محلی شده در `public/fonts/shabnam/` |
| **English Typography** | Ubuntu (Local woff2) | فونت رسمی اوبونتو برای حروف و کلمات انگلیسی با `unicode-range` در `public/fonts/ubuntu/` |
| **Map Engine** | Neshan Vector Map (Mapbox GL) | نقشه وکتور تعاملی نشان بر پایه دیتاسنترهای داخلی ایران، همراه لایه طرح ترافیک تهران |
| **Routing / TSP** | OSRM + Local Haversine Matrix | مسیریاب آنلاین با فال‌بک آنی ۱.۵ ثانیه‌ای به ماتریس آفلاین هاورسین در شرایط قطعی اینترنت |
| **Backend** | Express 4.21 + Node 20 Alpine | سرور فول‌استک فوق‌العاده سبک با مدیریت دیتابیس JSON و فایل‌های آپلود |
| **Reverse Proxy** | Caddy v2 | مدیریت خودکار گواهینامه TLS/HTTPS، کشینگ پیشرفته هدرهای امنیتی و فوروارد به پورت ۳۰۰۰ |
| **Containerization** | Docker + Docker Compose | کانتینر چندمرحله‌ای سبک، اجرا با کاربر غیر روت (`UID:GID 1000:1000`) |
| **PWA & Offline** | Service Worker (`public/sw.js`) | ذخیره و کش دارایی‌های استاتیک، بدون مسدود کردن درخواست‌های داینامیک API |

---

## ۴. معماری دو-سروره و تاب‌آوری ملی (Dual-Server Architecture)

پروژه به گونه‌ای مهندسی شده که در زمان قطعی کامل اینترنت بین‌الملل، بدون هیچ افت عملکردی در داخل کشور فعال بماند:

```text
                  +-----------------------------------------+
                  |  لپ‌تاپ توسعه‌دهنده (Local Dev Machine)  |
                  +-----------------------------------------+
                     | docker save -o                       | docker save -o
                     | scp image + load                     | scp image + load
                     v                                      v
       +----------------------------+         +----------------------------+
       |   PRIMARY (آلمان - VPS)   |         |    MIRROR (ایران - VPS)    |
       |     86.54.42.206           |         |       artgasht.ir          |
       |     artgasht.com           |         |   اینترنت ملی / تاب‌آور     |
       +----------------------------+         +----------------------------+
       | • کانتینر Artgasht (Node)  |  rsync  | • کانتینر Artgasht (Node)  |
       | • وب‌سرور Caddy (HTTPS)    | ------> | • وب‌سرور Caddy (HTTPS)    |
       | • پنل مدیریت: فعال (RW)    | (هر ۵   | • پنل مدیریت: فقط خواندنی   |
       | • پورت داخلی: 3000         |  دقیقه) | • پورت داخلی: 3000         |
       | • کاربر: deploy (UID 1000) |         | • کاربر: deploy (UID 1000) |
       +----------------------------+         +----------------------------+
                                                            |
                                             قطعی اینترنت   | اجرای اسکریپت
                                             بین‌الملل      v
                                              [حالت اضطراری STANDALONE]
                                              • فعال‌سازی پنل مدیریت محلی
                                              • ثبت تغییرات در دیتابیس ایران
                                              • ادغام دوطرفه پس از اتصال
                                                با ./scripts/mirror-mode.sh merge-back
```

### مشخصات و نقش سرورها:
1. **سرور اصلی (PRIMARY - آلمان):**
   - **آی‌پی:** `86.54.42.206`
   - **دامنه:** `artgasht.com`
   - **کاربر:** `deploy` (عضو گروه docker، کلید SSH، بدون لاگین root)
   - **نقش:** منبع اصلی داده‌ها (Source of Truth)، پنل مدیریت فعال، ایجاد و ویرایش گالری‌ها و آپلود تصاویر.
2. **سرور آینه (MIRROR - ایران):**
   - **دامنه:** `artgasht.ir`
   - **کاربر:** `deploy` (UID/GID 1000:1000)
   - **نقش:** آینه زنده برای کاربران داخل ایران با سرعت لود بالا بر بستر شبکه ملی اطلاعات.
   - **سینک خودکار:** هر ۵ دقیقه یکبار از طریق اسکریپت `scripts/sync-pull.sh` و تایمر سیستم‌دی `artgasht-sync.timer`، فایل `data/galleries.json` و پوشه `data/uploads/` را از سرور آلمان دریافت می‌کند.
   - **حالت اضطراری STANDALONE:** در صورت قطعی اینترنت بین‌الملل، با اجرای دستور `sudo /opt/artgasht/scripts/mirror-mode.sh standalone`، پنل مدیریت روی سرور ایران موقتاً فعال می‌شود. پس از اتصال مجدد با دستور `merge-back` اطلاعات بر اساس شناسه گالری و فیلد `updatedAt` ادغام و به سرور آلمان فرستاده می‌شوند.

---

## ۵. نقشه پوشه‌ها و فایل‌های حیاتی مخزن (Codebase Anatomy)

```text
c:\Users\pemal\OneDrive\Desktop\Anti - Gallery\
├── Dockerfile                      # ساخت داکر ایمیج سلف‌کانتین با کاربر deploy (1000:1000)
├── docker-compose.yml              # پیکربندی کانتینر با پورت 3000:3000 و ماونت /data
├── Caddyfile                       # کانفیگ تمیز ریورس‌پروکسی Caddy
├── deploy.config.example           # الگوی کانفیگ آی‌پی و کلید SSH سرورها
├── .env.example                    # متغیرهای محیطی نمونه (ADMIN_PASSWORD, NESHAN_KEY, ...)
├── PROJECT_HANDOFF.md              # مستند فنی تفصیلی پروژه
├── DEPLOY.md                       # راهنمای قدم‌به‌قدم استقرار سرور فرانکفورت و ایران
├── HANDOUT.md                      # همین دستنامه انتقال
├── package.json                    # وابستگی‌ها و اسکریپت‌های npm
├── vite.config.ts                  # تنظیمات Vite
├── server.ts                       # سرور Express با اندپوینت‌های /health, /api/config, /api/admin/*
│
├── data/                           # داده‌های ماندگار سرور (ماونت شده در داکر)
│   ├── galleries.json              # دیتابیس زنده گالری‌ها (JSON)
│   └── uploads/                    # پوسترهای آپلودشده توسط ادمین
│
├── public/
│   ├── sw.js                       # سرویس‌ورکر PWA با کش نسخه ۱.۰۹۶
│   ├── manifest.json               # مانیفست وب PWA
│   ├── favicon.png                 # آیکون بوکمارک
│   ├── icons/                      # آیکون‌های استاندارد ۱۹۲ و ۵۱۲ کلیمورفیک
│   └── fonts/
│       ├── shabnam/                # فونت‌های محلی شبنم فارسی
│       └── ubuntu/                 # فونت‌های محلی اوبونتو انگلیسی
│
├── src/
│   ├── main.tsx                    # مانت اپلیکیشن و ثبت سرویس‌ورکر
│   ├── App.tsx                     # کامپوننت روت، لود داده از سرور، فیلتر تهران، تب‌ها
│   ├── index.css                   # متغیرهای کلیمورفیک، فونت‌فیس‌ها، انیمیشن‌ها
│   ├── types/
│   │   └── gallery.ts              # تایپ‌های Gallery, Exhibition, CuratedTour, RouteLeg
│   ├── components/
│   │   ├── Header.tsx              # هدر اپ، شماره نسخه (APP_VERSION)، دکمه قفل ادمین، تم
│   │   ├── AdminModal.tsx          # پنل ادمین (رفع ریشه‌ای ارور ۳۱۰ و رعایت کامل هوک‌ها)
│   │   ├── GalleryCard.tsx         # کارت معرفی گالری، نشان مدیوم، تاریخ افتتاحیه
│   │   ├── GalleryDetailModal.tsx  # مدال جزئیات، تماس، آدرس و ۴ اپلیکیشن ناوبری
│   │   ├── CuratedRouteRoadModal.tsx # مدال جاده‌ای تورهای پیشنهادی
│   │   ├── CuratedToursModal.tsx   # پنجره انتخاب تورهای منتخب
│   │   ├── RouteSummaryPanel.tsx   # پنل بهینه‌سازی مسیر با TSP
│   │   ├── InteractiveMap.tsx      # نقشه وکتور نشان با فیلترها و لایه ترافیک
│   │   ├── ClayDropdown.tsx        # دراپ‌داون اختصاصی کلیمورفیک (جایگزین تگ select)
│   │   └── PwaInstallPrompt.tsx    # پرامپت هوشمند نصب PWA در اندروید و iOS
│   └── utils/
│       ├── persianUtils.ts         # تبدیل ارقام فارسی و فرمت‌بندی تاریخ و تقویم
│       └── routeOptimizer.ts       # حل‌کننده TSP، فال‌بک هاورسین، محاسبات فاصله و زمان
│
└── scripts/
    ├── setup-server.sh             # اسکریپت راه‌اندازی صفر-تا-صد اوبونتو ۲۴.۰۴ (داکر، کدی، کاربر)
    ├── deploy.ps1                  # اسکریپت دیپلوی پاورشل ویندوز (target: primary|mirror|all)
    ├── deploy.sh                   # اسکریپت دیپلوی بش لینوکس
    ├── sync-pull.sh                # اسکریپت سینک ۵ دقیقه‌ای rsync در سرور ایران
    ├── mirror-mode.sh              # سوییچ حالت‌های standalone, mirror, merge-back
    ├── backup.sh                   # بکاپ‌گیری شبانه با چرخش ۷ روزه
    ├── test-reachability.sh        # تست در دسترس بودن منابع در سرور (Neshan, galleryinfo)
    ├── deploy-ghpages.cjs          # استقرار خودکار روی برنچ gh-pages گیت‌هاب
    ├── merge-galleries.cjs         # الگوریتم ادغام هوشمند دیتابیس گالری‌ها با updatedAt
    └── sync-galleryinfo.cjs        # اسکرپر دوره‌ای اطلاعات رویدادهای هنری
```

---

## ۶. قوانین و استانداردهای توسعه (Core Coding Rules & Conventions)

### قانون ۱: قالب‌بندی چت به زبان فارسی و راست‌چین
هر پاسخی که به کاربر داده می‌شود باید کاملاً راست‌چین و داخل تگ زیر محصور باشد:
```html
<div dir="rtl" style="text-align: right; direction: rtl;">
... متن فارسی با ساختار زیبا و خوانا ...
</div>
```

### قانون ۲: قانون افزایش نسخه (Version Increment)
به ازای هر درخواست تغییر از کاربر، نسخه باید **۰.۰۰۱** واحد افزایش یابد:
* [`src/components/Header.tsx`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/src/components/Header.tsx): `export const APP_VERSION = 'بتا V 1.097';`
* [`public/sw.js`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/public/sw.js): `const CACHE_NAME = 'artgasht-pwa-v1.097';`
* [`server.ts`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/server.ts): فیلد `version` در اندپوینت‌های `/health` و `/api/config`

### قانون ۳: رعایت اکید قوانین هوک‌های ریکت (Rules of Hooks)
* هرگز و تحت هیچ شرایطی نباید هوک‌های ریکت (`useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`) پس از دستور خروج شرطی (`if (...) return ...`) قرار گیرند.
* در کامپوننت [`AdminModal.tsx`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/src/components/AdminModal.tsx)، تمامی هوک‌ها (شامل `filteredGalleries` و `useEffect` کلید Escape) به ابتدای تابع و قبل از هر شرطی منتقل شده‌اند و شرط خروج `if (!isOpen) return null;` دقیقاً در انتهای تابع و پیش از بازگرداندن JSX قرار گرفته است تا از تکرار خطای Minified React #310 جلوگیری شود.

### قانون ۴: ممنوعیت تگ بومی `<select>`
در تمامی فرم‌ها و فیلترها، همواره از کامپوننت اختصاصی [`ClayDropdown.tsx`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/src/components/ClayDropdown.tsx) استفاده شود تا زیبایی کلیمورفیک حفظ شود.

### قانون ۵: دامنه نمایش تهران (Tehran-Only Display)
در فرانت‌اند فقط گالری‌های تهران نمایش داده می‌شوند:
```tsx
const galleries = useMemo<Gallery[]>(() => {
  return allGalleries.filter((g) => {
    const city = (g.city || '').toLowerCase();
    const cityFa = (g.cityFa || '').trim();
    return city === 'tehran' || cityFa === 'تهران';
  });
}, [allGalleries]);
```
گالری‌های سایر شهرها در پایگاه داده محفوظ هستند و نباید پاک شوند.

### قانون ۶: تایپوگرافی بدون اتکا به وب‌سرورهای خارجی
* ارقام فارسی با تابع `toPersianDigits(num)` تبدیل شوند.
* هیچ درخواست اینترنتی به `fonts.googleapis.com` یا CDNهای خارجی نباید در کد وجود داشته باشد.

---

## ۷. گردش کار استقرار و دستورات نهایی‌سازی (Workflow & Verification)

پس از هر بار اتمام تغییرات، سلسله دستورات زیر در ویندوز اجرا می‌شود:

```powershell
# ۱. اعتبارسنجی بدون خطای TypeScript
npm.cmd exec tsc -- --noEmit

# ۲. ساخت بسته پروداکشن با Vite
npm.cmd run build

# ۳. ثبت تغییرات در گیت و پوش به شاخه اصلی
git add -A
git commit -m "feat/fix: <توضیح تغییر> (v1.09X)"
git push origin main

# ۴. انتشار نسخه لایو پیش‌نمایش روی گیت‌هاب پیجز
node scripts/deploy-ghpages.cjs

# ۵. استقرار روی سرورهای واقعی (در صورت درخواست کاربر)
# روی سرور فرانکفورت (آلمان):
.\scripts\deploy.ps1 -Target primary

# روی سرور ایران:
.\scripts\deploy.ps1 -Target mirror

# روی هر دو سرور:
.\scripts\deploy.ps1 -Target all
```

---

## ۸. متغیرهای محیطی سرور پروداکشن (`.env`)

```ini
NODE_ENV=production
PORT=3000
DATA_DIR=/app/data

# نقش سرور: primary (آلمان) یا mirror (ایران)
SERVER_ROLE=primary

# وضعیت پنل ادمین: در سرور آلمان true و در سرور ایران false (مگر فایل data/STANDALONE باشد)
ADMIN_ENABLED=true

# رمز عبور ورود به پنل ادمین
ADMIN_PASSWORD=change_this_to_strong_secret

# کلید وب نقشه نشان به تفکیک دامنه
NESHAN_KEY_IR=web.74834ff0e68d40a08d28148b3b44b6aa
NESHAN_KEY_COM=web.74834ff0e68d40a08d28148b3b44b6aa

# فعال بودن اسکرپر خودکار
SCRAPER_ENABLED=false
```

---

## ۹. وضعیت فعلی و کارهای در اولویت (Current Status & Next Steps)

1. **وضعیت مخزن:** کاملاً تمیز، نسخه `بتا V 1.097`. آیکون قفل هدر برای عموم حذف شده و پنل مدیریت تنها از طریق مسیر مخفی `#/admin` یا `/admin` در دسترس است. ربات‌های جستجوگر مسدود شده و تمام اندپوینت‌های سرور محافظت‌شده باقی مانده‌اند.
2. **خطای حل‌شده اخیر:** رفع قطعی خطای Minified React #310 در باز کردن پنل ادمین از طریق مرتب‌سازی بدون شرط هوک‌ها در [`AdminModal.tsx`](file:///c:/Users/pemal/OneDrive/Desktop/Anti%20-%20Gallery/src/components/AdminModal.tsx).
3. **اقدام بعدی مورد نیاز کاربر:** 
   - اجرای `setup-server.sh` روی سرور ابری فرانکفورت (`86.54.42.206`) با کاربر `deploy`.
   - تنظیم فایل `deploy.config` بر اساس نمونه `deploy.config.example`.
   - اجرای اولین دیپلوی پروداکشن با دستور `.\scripts\deploy.ps1 -Target primary`.
