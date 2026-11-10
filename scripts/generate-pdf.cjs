const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT_DIR, 'report_temp.html');
const OUTPUT_PDF = path.join(ROOT_DIR, 'Anti-Gallery-Production-Resilience-Report.pdf');
const PUBLIC_DOCS_DIR = path.join(ROOT_DIR, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DOCS_DIR, 'Anti-Gallery-Production-Resilience-Report.pdf');

if (!fs.existsSync(PUBLIC_DOCS_DIR)) {
  fs.mkdirSync(PUBLIC_DOCS_DIR, { recursive: true });
}

const shabnamRegularPath = path.join(ROOT_DIR, 'public', 'fonts', 'shabnam', 'Shabnam-FD.woff2').replace(/\\/g, '/');
const shabnamBoldPath = path.join(ROOT_DIR, 'public', 'fonts', 'shabnam', 'Shabnam-Bold-FD.woff2').replace(/\\/g, '/');
const ubuntuRegularPath = path.join(ROOT_DIR, 'public', 'fonts', 'ubuntu', 'Ubuntu-Regular.woff2').replace(/\\/g, '/');
const ubuntuBoldPath = path.join(ROOT_DIR, 'public', 'fonts', 'ubuntu', 'Ubuntu-Bold.woff2').replace(/\\/g, '/');

const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مستند آماده‌سازی پروداکشن و تاب‌آوری آرت‌گشت</title>
  <style>
    @font-face {
      font-family: 'Shabnam';
      src: url('file:///${shabnamRegularPath}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'Shabnam';
      src: url('file:///${shabnamBoldPath}') format('woff2');
      font-weight: bold;
      font-style: normal;
    }
    @font-face {
      font-family: 'Ubuntu';
      src: url('file:///${ubuntuRegularPath}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'Ubuntu';
      src: url('file:///${ubuntuBoldPath}') format('woff2');
      font-weight: bold;
      font-style: normal;
    }

    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
      @bottom-center {
        content: "صفحه " counter(page) " از " counter(pages);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Shabnam', 'Vazirmatn', Tahoma, 'Segoe UI', sans-serif;
      direction: rtl;
      text-align: right;
      color: #1f2937;
      background-color: #ffffff;
      line-height: 1.6;
      font-size: 10.5pt;
      margin: 0;
      padding: 0;
    }

    .font-en, code, pre {
      font-family: 'Ubuntu', Consolas, 'Courier New', monospace !important;
      direction: ltr;
      display: inline-block;
    }

    .header-banner {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 22px;
      border: 1px solid #334155;
    }

    .header-banner h1 {
      margin: 0 0 8px 0;
      font-size: 17pt;
      font-weight: bold;
      color: #f8fafc;
    }

    .header-banner .subtitle {
      font-size: 11pt;
      color: #cbd5e1;
      margin: 0 0 12px 0;
    }

    .header-meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 8px;
      font-size: 8.5pt;
      font-weight: bold;
    }

    .badge-primary { background: #38bdf8; color: #082f49; }
    .badge-success { background: #34d399; color: #064e3b; }
    .badge-warning { background: #fbbf24; color: #78350f; }
    .badge-danger { background: #f87171; color: #7f1d1d; }
    .badge-neutral { background: #e2e8f0; color: #334155; }

    h2 {
      font-size: 13pt;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11.5pt;
      color: #1e293b;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    p, li {
      color: #374151;
      text-align: justify;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: right;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
    }

    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    code {
      background-color: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 2px 5px;
      border-radius: 5px;
      font-size: 8.5pt;
      color: #0f172a;
    }

    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 12px;
      border-radius: 10px;
      font-size: 8pt;
      line-height: 1.45;
      overflow-x: hidden;
      white-space: pre-wrap;
      page-break-inside: avoid;
      margin: 10px 0;
      direction: ltr;
      text-align: left;
    }

    .alert {
      border-right: 4px solid #3b82f6;
      background: #eff6ff;
      padding: 10px 14px;
      border-radius: 0 10px 10px 0;
      margin: 14px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }

    .alert-success {
      border-right-color: #10b981;
      background: #ecfdf5;
      color: #065f46;
    }

    .alert-warning {
      border-right-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }

    .footer {
      margin-top: 30px;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  </style>
</head>
<body>

  <div class="header-banner">
    <h1>آرت‌گشت (Anti-Gallery) — مستند معماری و استقرار دو-سروره</h1>
    <div class="subtitle">راهنمای جامع آماده‌سازی پروداکشن، مقاوم‌سازی در برابر قطعی کامل اینترنت بین‌الملل و پنل مدیریت داده‌ها</div>
    <div class="header-meta">
      <span class="badge badge-primary">نسخه: بتا V 1.093</span>
      <span class="badge badge-success">دامنه اصلی: artgasht.ir (ایران)</span>
      <span class="badge badge-warning">دامنه آینه: artgasht.com (آلمان)</span>
      <span class="badge badge-neutral">تاریخ انتشار: ۲۰ آبان ۱۴۰۵</span>
    </div>
  </div>

  <h2>۱. معماری کلان سیستم (Architecture Overview)</h2>
  <p>
    پلتفرم <strong>«آرت‌گشت»</strong> برای راه‌اندازی بر روی دو سرور مجازی مجزا و پایدار پیکربندی شده است. هدف بنیادین این معماری، تداوم ۱۰۰٪ سرویس‌دهی به کاربران داخل کشور در سناریوی قطعی سراسری ارتباطات اینترنت بین‌الملل (شبکه ملی اطلاعات) و همچنین حفظ دسترس‌پذیری جهانی برای مخاطبان خارج از کشور است.
  </p>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0; color:#0369a1;">سرور اصلی ایران (Primary VPS)</h3>
      <ul>
        <li><strong>دامنه:</strong> <span class="font-en">artgasht.ir</span></li>
        <li><strong>بستر شبکه:</strong> دیتاسنتر داخلی / متصل به شبکه ملی اطلاعات</li>
        <li><strong>سطح تاب‌آوری:</strong> عدم وابستگی به هیچ وب‌سایت، رجیستری یا سرور خارجی در زمان اجرا</li>
        <li><strong>ذخیره‌سازی داده:</strong> پایگاه داده محلی (<span class="font-en">data/galleries.json</span>) و تصاویر (<span class="font-en">data/uploads/</span>)</li>
      </ul>
    </div>
    <div class="card">
      <h3 style="margin-top:0; color:#b45309;">سرور آینه آلمان (Mirror VPS)</h3>
      <ul>
        <li><strong>دامنه:</strong> <span class="font-en">artgasht.com</span></li>
        <li><strong>بستر شبکه:</strong> شبکه بین‌الملل</li>
        <li><strong>وظیفه:</strong> میزبانی آینه برای دسترسی کاربران بین‌المللی و توریست‌های خارجی</li>
        <li><strong>همگام‌سازی:</strong> انتقال داده‌ها با اسکریپت‌های اختصاصی <span class="font-en">sync-data</span></li>
      </ul>
    </div>
  </div>

  <h2>۲. حسابرسی کامل درخواست‌های خارجی (External Requests Audit)</h2>
  <p>
    تمام درخواست‌های شبکه صادر شده از فرانت‌اند مرورگر و بک‌اند سرور به صورت کامل ممیزی شدند:
  </p>

  <table>
    <thead>
      <tr>
        <th>ردیف</th>
        <th>دسته‌بندی</th>
        <th>مقصد و URL</th>
        <th>محل در کد</th>
        <th>ماهیت</th>
        <th>رفتار در زمان قطعی اینترنت بین‌الملل</th>
        <th>اقدام انجام‌شده در نسخه جدید</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>۱</td>
        <td>فونت لاتین</td>
        <td><span class="font-en">fonts.googleapis.com</span></td>
        <td><span class="font-en">index.html</span></td>
        <td><span class="badge badge-danger">خارجی (گوگل)</span></td>
        <td>باعث کندی و مسدود شدن رندر فونت می‌شود</td>
        <td><strong>حذف کامل شد؛</strong> کلیه فونت‌های Ubuntu و Shabnam FD محلی شدند.</td>
      </tr>
      <tr>
        <td>۲</td>
        <td>استایل نقشه</td>
        <td><span class="font-en">unpkg.com/leaflet</span></td>
        <td><span class="font-en">index.html</span></td>
        <td><span class="badge badge-danger">خارجی (کلادفلر)</span></td>
        <td>شکستن ظاهر کنترل‌های نقشه Leaflet</td>
        <td><strong>حذف شد؛</strong> استایل <span class="font-en">leaflet/dist/leaflet.css</span> مستقیماً باندل گردید.</td>
      </tr>
      <tr>
        <td>۳</td>
        <td>مسیریابی رانندگی/پیاده</td>
        <td><span class="font-en">router.project-osrm.org</span></td>
        <td><span class="font-en">routeOptimizer.ts</span></td>
        <td><span class="badge badge-danger">خارجی (آلمان)</span></td>
        <td>۶ ثانیه معطلی تایم‌اوت و توقف مسیریابی</td>
        <td>تایم‌اوت به ۱.۵ ثانیه کاهش یافت و فوراً به موتور حل TSP آفلاین هاورسین سوئیچ می‌کند.</td>
      </tr>
      <tr>
        <td>۴</td>
        <td>کتابخانه نقشه نشان</td>
        <td><span class="font-en">static.neshan.org</span></td>
        <td><span class="font-en">index.html</span></td>
        <td><span class="badge badge-success">ایرانی (نشان)</span></td>
        <td>کاملاً فعال در شبکه ملی اطلاعات</td>
        <td>حفظ شد و توسط Service Worker در مرورگر کاربر به صورت آفلاین کش می‌شود.</td>
      </tr>
      <tr>
        <td>۵</td>
        <td>تایل‌های نقشه وکتور</td>
        <td><span class="font-en">api.neshan.org</span></td>
        <td><span class="font-en">InteractiveMap.tsx</span></td>
        <td><span class="badge badge-success">ایرانی (نشان)</span></td>
        <td>کاملاً فعال در شبکه ملی اطلاعات</td>
        <td>حفظ شد؛ کلید API به صورت داینامیک از متغیر محیطی دامنه تنظیم می‌شود.</td>
      </tr>
      <tr>
        <td>۶</td>
        <td>ناوبری Waze / Google</td>
        <td><span class="font-en">waze.com</span> و گوگل</td>
        <td><span class="font-en">routeOptimizer.ts</span></td>
        <td><span class="badge badge-danger">خارجی</span></td>
        <td>وابسته به ارتباط کاربر با سرورهای خارجی</td>
        <td>به عنوان فال‌بک حفظ شدند؛ گزینه‌های اصلی «نشان» و «بلد» هستند.</td>
      </tr>
      <tr>
        <td>۷</td>
        <td>ناوبری نشان و بلد</td>
        <td>دیپ‌لینک اپ‌های نشان/بلد</td>
        <td><span class="font-en">GalleryDetailModal.tsx</span></td>
        <td><span class="badge badge-success">ایرانی</span></td>
        <td>۱۰۰٪ فعال روی گوشی کاربران ایرانی</td>
        <td>لینک‌های استاندارد مستقیم به اپلیکیشن و وب‌اپ‌های داخلی فعال است.</td>
      </tr>
      <tr>
        <td>۸</td>
        <td>پوسترهای نمایشگاه‌ها</td>
        <td><span class="font-en">galleryinfo.ir/Images/...</span></td>
        <td><span class="font-en">galleries.json</span></td>
        <td><span class="badge badge-success">ایرانی</span></td>
        <td>سرور در ایران بوده و لود می‌شود</td>
        <td>تصاویر جدید از طریق پنل ادمین مستقیماً در <span class="font-en">/uploads/</span> لوکال سرور ذخیره می‌شوند.</td>
      </tr>
      <tr>
        <td>۹</td>
        <td>اسکرپر خودکار رویدادها</td>
        <td><span class="font-en">galleryinfo.ir/Event/fa</span></td>
        <td><span class="font-en">server.ts</span></td>
        <td><span class="badge badge-success">ایرانی</span></td>
        <td>فعال در داخل کشور</td>
        <td>با مکانیسم کش بازگشتی در صورت قطعی اتصال تقویت شد.</td>
      </tr>
      <tr>
        <td>۱۰</td>
        <td>آنالیتیکس و ردیاب‌ها</td>
        <td>هیچ مقصدی ندارد</td>
        <td>کل پروژه</td>
        <td><span class="badge badge-neutral">ندارد</span></td>
        <td>بدون تاثیر</td>
        <td>بررسی کامل: هیچ ترکر گوگل، فیسبوک یا کلاریتی در سورس برنامه وجود ندارد.</td>
      </tr>
      <tr>
        <td>۱۱</td>
        <td>نصب بسته‌های پکیج</td>
        <td><span class="font-en">registry.npmjs.org</span></td>
        <td>ران‌تایم سرور</td>
        <td><span class="badge badge-danger">خارجی</span></td>
        <td>دستور <span class="font-en">npm install</span> در زمان قطعی کامل خطا می‌دهد</td>
        <td><strong>حذف شد؛</strong> کل کانتینر داکر روی لپ‌تاپ کامپایل و ایمپورت می‌شود.</td>
      </tr>
    </tbody>
  </table>

  <h2>۳. حذف کامل وابستگی‌های ران‌تایم خارجی</h2>
  <div class="card">
    <ul>
      <li><strong>خودمیزبانی تایپوگرافی (Self-Hosted Typography):</strong> تمام فایلهای woff2 فونت‌های Shabnam FD و Ubuntu در پوشه <span class="font-en">public/fonts/</span> تعبیه شده‌اند. اتصال‌های DNS به سرورهای گوگل قطع گردید.</li>
      <li><strong>حذف CDN‌های شخص‌ثالث:</strong> تمام کتابخانه‌های جاوااسکریپت و استایل‌ها به صورت لوکال در زمان بیلد با Vite یکپارچه شدند.</li>
      <li><strong>مسیریابی آفلاین بی‌درنگ:</strong> در صورت قطع دسترسی به OSRM، با تایم‌اوت بسیار کوتاه (۱.۵ ثانیه)، الگوریتم فروشنده دوره‌گرد هاورسین در جاوااسکریپت مرورگر اجرا می‌شود.</li>
      <li><strong>کلید API نشان داینامیک:</strong> به منظور تفکیک دامنه و مدیریت مجوزهای نقشه نشان، فرانت‌اند کلید را از اندپوینت <span class="font-en">/api/config</span> سرور یا متغیرهای <span class="font-en">NESHAN_KEY_IR</span> و <span class="font-en">NESHAN_KEY_COM</span> دریافت می‌کند.</li>
    </ul>
  </div>

  <h2>۴. پنل مدیریت بدون نیاز به تغییر کد (Admin Panel & Local Storage)</h2>
  <p>
    برای ویرایش گالری‌ها و نمایشگاه‌ها بدون نیاز به بیلد یا کدنویسی مجدد، سامانه مدیریت درون‌برنامه‌ای به شرح زیر تعبیه شد:
  </p>
  <div class="card">
    <ul>
      <li><strong>روش دسترسی:</strong> کلیک بر روی آیکون قفل در هدر برنامه یا مراجعه به نشانی <span class="font-en">https://artgasht.ir/#admin</span></li>
      <li><strong>امنیت:</strong> احراز هویت با رمز عبور سرور (<span class="font-en">ADMIN_PASSWORD</span>) از طریق متد <span class="font-en">POST /api/admin/login</span> و صدور توکن امنیتی.</li>
      <li><strong>فرم کلیمورفیک اختصاصی:</strong> استفاده از دراپ‌داون ارگانیک <span class="font-en">ClayDropdown</span> برای انتخاب متریال/تکنیک (نقاشی، عکاسی، مجسمه و...) و محلات ۷‌گانه تهران بدون استفاده از تگ‌های فرم معمولی.</li>
      <li><strong>آپلود پوستر در سرور:</strong> امکان انتخاب تصویر پوستر و ذخیره‌سازی خودکار در مسیر ماندگار <span class="font-en">data/uploads/</span> با آدرس‌دهی محلی.</li>
      <li><strong>به‌روزرسانی در لحظه:</strong> تغییرات ایجادشده مستقیماً در فایل دیتابیس ماندگار <span class="font-en">data/galleries.json</span> سرور ذخیره شده و فوراً در مرورگر تمام کاربران نمایش داده می‌شود.</li>
    </ul>
  </div>

  <h2>۵. بیلد کاملاً مستقل روی لپ‌تاپ و استقرار در سرور ایران</h2>
  <div class="alert alert-warning">
    <strong>قانون کلیدی استقرار در سرور ایران:</strong> سرور داخل ایران در شرایط قطع اینترنت بین‌الملل هرگز نباید نیازمند اجرای دستوراتی مانند <span class="font-en">docker pull</span>، <span class="font-en">git clone</span> یا <span class="font-en">npm install</span> باشد.
  </div>

  <p>چرخه استقرار به صورت Self-Contained پیاده‌سازی شده است:</p>
  <pre>
# ۱. اعتبارسنجی تایپ‌اسکریپت روی لپ‌تاپ:
npm.cmd exec tsc -- --noEmit

# ۲. بیلد فرانت‌اند استاتیک:
npm.cmd run build

# ۳. ساخت ایمیج داکر روی لپ‌تاپ:
docker build -t artgasht:latest .

# ۴. انتقال مستقیم ایمیج به سرور با استریم SSH بدون ذخیره در داکر هاب:
docker save artgasht:latest | gzip | ssh user@iran_vps "gzip -d | docker load"

# ۵. راه‌اندازی در سرور با یک دستور:
ssh user@iran_vps "cd /opt/artgasht && docker compose up -d --force-recreate"
  </pre>

  <h2>۶. فایل‌های تحویل داده شده در مخزن پروژه</h2>
  <table>
    <thead>
      <tr>
        <th>نام فایل</th>
        <th>محل قرارگیری</th>
        <th>کاربرد و توضیحات</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="font-en">Dockerfile</span></td>
        <td>ریشه پروژه</td>
        <td>ایمیج چندمرحله‌ای بر پایه Node 20 Alpine با ولوم ذخیره‌سازی و پایش خودکار سلامت</td>
      </tr>
      <tr>
        <td><span class="font-en">docker-compose.yml</span></td>
        <td>ریشه پروژه</td>
        <td>تعریف سرویس پروداکشن، ولوم پایگاه داده <span class="font-en">./data:/app/data</span> و پورت ۳۰۰۰ لوکال</td>
      </tr>
      <tr>
        <td><span class="font-en">Caddyfile</span></td>
        <td>ریشه پروژه</td>
        <td>تنظیمات ریورس‌پروکسی Caddy با فشرده‌سازی zstd/gzip، کشینگ هدرها و SSL خودکار</td>
      </tr>
      <tr>
        <td><span class="font-en">.env.example</span></td>
        <td>ریشه پروژه</td>
        <td>قالب استاندارد متغیرهای محیطی برای رمز مدیریت، پورت و کلیدهای نقشه نشان</td>
      </tr>
      <tr>
        <td><span class="font-en">/health</span></td>
        <td>درون <span class="font-en">server.ts</span></td>
        <td>اندپوینت سلامت با خروجی JSON وضعیت سیستم، زمان آپ‌تایم و تعداد گالری‌ها</td>
      </tr>
      <tr>
        <td><span class="font-en">scripts/deploy-server.ps1</span></td>
        <td>پوشه اسکریپت‌ها</td>
        <td>اسکریپت ویندوز پاورشل برای تایپ‌چک، بیلد، خروجی داکر، انتقال SSH و اجرای سلامت‌سنجی</td>
      </tr>
      <tr>
        <td><span class="font-en">scripts/deploy-server.sh</span></td>
        <td>پوشه اسکریپت‌ها</td>
        <td>نسخه معادل Bash لینوکس/مک/WSL برای استقرار خودکار کانتینر در سرور</td>
      </tr>
      <tr>
        <td><span class="font-en">scripts/sync-data.ps1</span></td>
        <td>پوشه اسکریپت‌ها</td>
        <td>اسکریپت انتقال داده‌ها و تصاویر آپلودشده بین سرور آلمان، لپ‌تاپ و سرور ایران</td>
      </tr>
      <tr>
        <td><span class="font-en">scripts/sync-data.sh</span></td>
        <td>پوشه اسکریپت‌ها</td>
        <td>اسکریپت معادل با rsync/scp برای همگام‌سازی اطلاعات در محیط لینوکس</td>
      </tr>
      <tr>
        <td><span class="font-en">DEPLOY.md</span></td>
        <td>ریشه پروژه</td>
        <td>مستند گام‌به‌گام دستورالعمل‌های نصب پکیج‌ها، کانفیگ Caddy، تست و بازیابی بحران</td>
      </tr>
    </tbody>
  </table>

  <h2>۷. خلاصه مشخصات پروداکشن (Production Summary)</h2>
  <div class="card">
    <p><strong>پشته فنی (Tech Stack):</strong> React 19 + TypeScript + Vite 8 (فرانت‌اند کلیمورفیک PWA) + Express / Node.js 20 (بک‌اند سبک درون کانتینر) + Caddy v2 (ریورس‌پروکسی و TLS خودکار).</p>
    <p><strong>پورت داخلی سرور (Internal Port):</strong> پورت <span class="font-en">3000</span> (محدود به <span class="font-en">127.0.0.1:3000</span> به صورت محافظت‌شده و بدون دسترسی مستقیم از اینترنت عمومی).</p>
    <p><strong>محل ماندگاری داده‌ها (Data Persistence):</strong> پوشه <span class="font-en">./data/galleries.json</span> برای لیست نگارخانه‌ها و پوشه <span class="font-en">./data/uploads/</span> برای پوسترهای آپلودشده (متصل به ولوم <span class="font-en">/app/data</span> در کانتینر).</p>
    <p><strong>اندپوینت سلامت (Health Check):</strong> آدرس <span class="font-en">http://127.0.0.1:3000/health</span> با کد بازگشتی ۲۰۰ و آمار فعال نمایشگاه‌ها.</p>
  </div>

  <div class="footer">
    <span>تهیه شده برای تیم فنی پروژه آرت‌گشت (Anti-Gallery)</span>
    <span>نسخه بتا V 1.093 — آبان ۱۴۰۵</span>
  </div>

</body>
</html>`;

fs.writeFileSync(HTML_FILE, htmlContent, 'utf-8');
console.log('Generated temporary HTML file at:', HTML_FILE);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempUserDataDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'edge_pdf_export_' + Date.now());

const printCmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="${tempUserDataDir}" --no-sandbox --print-to-pdf="${OUTPUT_PDF}" --no-pdf-header-footer "file:///${HTML_FILE.replace(/\\/g, '/')}"`;

console.log('Running Edge print-to-pdf command...');
try {
  execSync(printCmd, { stdio: 'inherit' });
  console.log('PDF successfully created at:', OUTPUT_PDF);

  // Copy to public/docs for web serving
  fs.copyFileSync(OUTPUT_PDF, PUBLIC_PDF);
  console.log('PDF copied to public folder:', PUBLIC_PDF);

  // Clean up temp HTML
  if (fs.existsSync(HTML_FILE)) {
    fs.unlinkSync(HTML_FILE);
  }
} catch (err) {
  console.error('Error generating PDF:', err.message);
  process.exit(1);
}
