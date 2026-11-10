# راهنمای جامع استقرار دو-سروره و مقاومت در برابر قطعی اینترنت بین‌الملل (DEPLOY.md)
## اپلیکیشن «آرت‌گشت» (Anti-Gallery) — نسخه بتا V 1.091

---

## ۱. معماری کلی استقرار (Production Architecture)

سیستم به صورت دو-سروره و مستقل پیاده‌سازی شده است:

```
[سیستم توسعه‌دهنده (لپ‌تاپ)]
    │
    ├── بیلد فرانت‌اند و کانتینر داکر به صورت کاملاً Self-Contained
    │
    ├── انتقال ایمیج و تنظیمات از طریق خط لوله امن SSH (بدون نیاز سرورها به اینترنت خارجی)
    │
    ├───► سرور اصلی داخل ایران (Primary VPS)
    │     ├── دامنه: artgasht.ir
    │     ├── شبکه: متصل به شبکه ملی اطلاعات (اینترنت داخلی ایران)
    │     ├── کاملاً مقاوم در برابر قطعی کامل اینترنت بین‌الملل
    │     └── پایگاه داده محلی (data/galleries.json) + تصاویر آپلودی (data/uploads/)
    │
    └───► سرور آینه آلمان (Mirror VPS)
          ├── دامنه: artgasht.com
          ├── شبکه: متصل به اینترنت بین‌الملل
          └── مناسب کاربران مقیم خارج یا شرایط دسترسی عادی
```

---

## ۲. تمهیدات مقاومت در برابر قطعی اینترنت بین‌الملل (National Intranet Resilience)

1. **حذف ۱۰۰٪ وابستگی‌های ران‌تایم خارجی:**
   - فونت‌های **Shabnam FD** و **Ubuntu** به طور کامل درون پوشه `public/fonts/` به صورت محلی میزبانی می‌شوند. کلیه لینک‌های Google Fonts (`fonts.googleapis.com` و `fonts.gstatic.com`) از کد حذف گردیدند.
   - فایل‌های استایل Leaflet از CDN خارجی (`unpkg.com`) حذف شده و مستقیماً توسط باندلر Vite و `leaflet/dist/leaflet.css` درون پروژه کامپایل می‌شوند.
   - در صورت قطع ارتباط با سرور خارجی OSRM (`router.project-osrm.org`)، تایم‌اوت آن به **۱.۵ ثانیه** کاهش یافته و سیستم فوراً به **موتور آفلاین حل مسئله TSP با ماتریس فاصله هاورسین (Haversine TSP Solver)** سوئیچ می‌کند تا کاربر هیچ تاخیری احساس نکند.
2. **پشتیبانی کامل از زیرساخت نقشه نشان (Neshan Web Map SDK):**
   - سرورهای نقشه نشان (`api.neshan.org` و `static.neshan.org`) درون ایران مستقر بوده و در زمان قطع اینترنت بین‌الملل در بستر شبکه ملی اطلاعات فعال می‌مانند.
   - کلید API نشان (`NESHAN_WEB_KEY`) به ازای هر دامنه در فایل `.env` سرور قابل تنظیم است (`NESHAN_KEY_IR` برای `artgasht.ir` و `NESHAN_KEY_COM` برای `artgasht.com`).
3. **عدم دانلود هیچ پکیجی در سرور ایران:**
   - سرور ایران هرگز دستورات `npm install`، `docker pull` یا دسترسی به Docker Hub و GitHub را اجرا نمی‌کند.
   - فرآیند بیلد کانتینر داکر روی لپ‌تاپ انجام شده و ایمیج با دستور `docker save | ssh "docker load"` مستقیماً به سرور استریم می‌شود.
4. **مدیریت محتوا بدون نیاز به بیلد مجدد:**
   - پنل مدیریت رمزدار (`https://artgasht.ir/#admin`) تعبیه شده است. افزودن یا ویرایش نمایشگاه‌ها و آپلود پوسترها مستقیماً در دیسک سرور (`data/galleries.json` و `data/uploads/`) ذخیره شده و فرانت‌اند تغییرات را بلافاصله نمایش می‌دهد.

---

## ۳. پیش‌نیازها

### روی لپ‌تاپ:
* Node.js نسخه ۲۰ یا بالاتر
* Docker Desktop نصب و در حال اجرا
* دسترسی SSH به سرورها (کلید عمومی SSH ترجیح داده می‌شود)

### روی هر دو سرور (ایران و آلمان):
* سیستم‌عامل لینوکس (Ubuntu 22.04 LTS / 24.04 LTS توصیه می‌شود)
* داکر و پلاگین Docker Compose:
  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-plugin
  sudo systemctl enable --now docker
  ```
* وب‌سرور و ریورس‌پروکسی Caddy:
  ```bash
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
  ```

---

## ۴. آماده‌سازی فایل تنظیمات `.env` روی سرورها

روی هر سرور، مسیر `/opt/artgasht` را ایجاد کرده و فایل `.env` را پیکربندی کنید:

```bash
mkdir -p /opt/artgasht/data/uploads
nano /opt/artgasht/.env
```

نمونه محتوای `.env` برای سرور ایران (`artgasht.ir`):
```env
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=رمز_عبور_بسیار_قوی_پنل_مدیریت
ADMIN_SECRET=یک_رشته_تصادفی_۳۲_کاراکتری_برای_امنیت_توکن
NESHAN_WEB_KEY=web.cd0b84e26a35496f87485087bce939da
NESHAN_KEY_IR=web.cd0b84e26a35496f87485087bce939da
DATA_DIR=/app/data
```

نمونه محتوای `.env` برای سرور آلمان (`artgasht.com`):
```env
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=رمز_عبور_بسیار_قوی_پنل_مدیریت
ADMIN_SECRET=یک_رشته_تصادفی_۳۲_کاراکتری_برای_امنیت_توکن
NESHAN_WEB_KEY=web.cd0b84e26a35496f87485087bce939da
NESHAN_KEY_COM=web.cd0b84e26a35496f87485087bce939da
DATA_DIR=/app/data
```

---

## ۵. تنظیم وب‌سرور Caddy روی سرورها

فایل `Caddyfile` موجود در پروژه را در مسیر `/etc/caddy/Caddyfile` سرور قرار دهید:

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

> [!TIP]
> وب‌سرور Caddy به صورت خودکار گواهینامه‌های SSL معتبر (Let's Encrypt / ZeroSSL) را دریافت و تمدید می‌کند و در زمان قطع اینترنت از کش داخلی خود استفاده می‌نماید.

---

## ۶. فرآیند استقرار خودکار از روی لپ‌تاپ (Deployment Workflow)

### روش اول: استقرار با اسکریپت پاورشل (محیط ویندوز لپ‌تاپ)

برای استقرار روی سرور ایران:
```powershell
.\scripts\deploy-server.ps1 -ServerHost <IP_یا_دامنه_سرور_ایران> -ServerUser root -RemoteDir /opt/artgasht
```

برای استقرار روی سرور آلمان:
```powershell
.\scripts\deploy-server.ps1 -ServerHost <IP_یا_دامنه_سرور_آلمان> -ServerUser root -RemoteDir /opt/artgasht
```

اسکریپت مراحل زیر را خودکار طی می‌کند:
1. اجرای تایپ‌چک کامل تایپ‌اسکریپت (`npm.cmd exec tsc -- --noEmit`).
2. بیلد بهینه دارایی‌های استاتیک توسط Vite.
3. ساخت ایمیج مستقل `artgasht:latest` روی داکر محلی لپ‌تاپ.
4. انتقال فشرده لایه‌های کانتینر مستقیماً روی تونل SSH به دستور `docker load` سرور مقصد.
5. راه‌اندازی بدون قطعی با `docker compose up -d --force-recreate`.
6. فراخوانی و اعتبارسنجی اندپوینت `/health`.

### روش دوم: خروجی دستی آفلاین (Air-Gapped / USB Transfer)

اگر در زمان قطعی کامل اینترنت، دسترسی مستقیم SSH به سرور ممکن نباشد:
1. روی لپ‌تاپ ایمیج را به فایل tar خروجی بگیرید:
   ```bash
   docker build -t artgasht:latest .
   docker save artgasht:latest | gzip > artgasht.tar.gz
   ```
2. فایل `artgasht.tar.gz` را با فلش‌مموری، SCP یا شبکه داخلی به سرور منتقل کنید.
3. در سرور اجرا کنید:
   ```bash
   docker load < artgasht.tar.gz
   cd /opt/artgasht
   docker compose up -d --force-recreate
   ```

---

## ۷. پنل مدیریت بدون نیاز به بیلد (Admin Panel)

* **آدرس دسترسی:** از طریق کلیک روی آیکون قفل هدر در برنامه یا درج هش `#admin` در انتهای آدرس (مانند `https://artgasht.ir/#admin`).
* **احراز هویت:** با رمز عبور مشخص‌شده در متغیر `ADMIN_PASSWORD`.
* **امکانات:**
  * افزودن نمایشگاه و نگارخانه جدید به پایگاه داده.
  * ویرایش کامل جزئیات نمایشگاه‌های جاری، نام هنرمند، تاریخ افتتاحیه، متریال/مدیوم، ساعات بازدید و محله.
  * آپلود تصویر پوستر با پیش‌نمایش آنی که مستقیماً در مسیر `/uploads/` سرور با نام امن ذخیره می‌شود.
  * حذف یا غیرفعال‌سازی نگارخانه‌ها.
  * کلیه تغییرات بدون نیاز به کامپایل، کامیت یا دیپلوی مجدد، در لحظه برای تمام بازدیدکنندگان اعمال می‌شود.

---

## ۸. همگام‌سازی اطلاعات و تصاویر بین سرور ایران و آلمان

برای انتقال داده‌ها و تصاویر آپلودشده بین دو سرور:

```powershell
# ۱. دانلود آخرین اطلاعات از سرور آلمان روی لپ‌تاپ
.\scripts\sync-data.ps1 -Action Pull -RemoteHost <IP_آلمان> -RemoteUser root

# ۲. ارسال اطلاعات دریافت شده به سرور ایران
.\scripts\sync-data.ps1 -Action Push -RemoteHost <IP_ایران> -RemoteUser root
```

یا در لینوکس/مک:
```bash
./scripts/sync-data.sh pull root@<IP_آلمان> /opt/artgasht
./scripts/sync-data.sh push root@<IP_ایران> /opt/artgasht
```

---

## ۹. مانیتورینگ سلامت سرویس (Health Check)

* **اندپوینت سلامت:** `GET /health`
* **نمونه خروجی:**
  ```json
  {
    "status": "ok",
    "appName": "آرت‌گشت",
    "version": "بتا V 1.091",
    "uptimeSeconds": 1420,
    "timestamp": "2026-11-10T13:45:00.000Z",
    "environment": "production",
    "totalGalleries": 128,
    "activeExhibitionsCount": 33
  }
  ```
* **مشاهده لاگ‌های کانتینر:**
  ```bash
  cd /opt/artgasht
  docker compose logs -f --tail=100
  ```
