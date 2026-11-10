# راهنمای جامع استقرار دو-سروره و تاب‌آوری در برابر قطعی اینترنت بین‌الملل (DEPLOY.md)
## اپلیکیشن «آرت‌گشت» (Anti-Gallery) — نسخه بتا V 1.094

---

## ۱. نقش‌های تفکیک‌شده سرورها (Server Roles)

برخلاف گزارش‌های قبلی، نقش‌ها دقیقاً به شرح زیر است:

```
[سرور اصلی آلمان (PRIMARY)] ── (artgasht.com) ── منبع اصلی داده‌ها (Source of Truth)
   ├── پنل مدیریت (Admin Panel) به صورت پیش‌فرض فعال است.
   ├── ویرایش‌های روزمره نمایشگاه‌ها، اضافه کردن گالری و آپلود پوسترها در اینجا انجام می‌شود.
   └── پایگاه داده مرجع: data/galleries.json و data/uploads/
          │
          │ (همگام‌سازی خودکار هر ۵ دقیقه با rsync روی SSH از سمت ایران)
          ▼
[سرور آینه ایران (MIRROR)] ── (artgasht.ir) ── نسخه آینه فقط-خواندنی (Read-Only Replica)
   ├── مستقر در دیتاسنتر داخلی / متصل به شبکه ملی اطلاعات
   ├── در حالت عادی فقط-خواندنی است (Read-Only) و اسکریپت sync-pull اطلاعات را از آلمان می‌کشد.
   ├── در زمان قطعی کامل اینترنت بین‌الملل، بدون وابستگی خارجی به کار خود ادامه می‌دهد.
   └── حالت اضطراری STANDALONE: قابلیت تبدیل به حالت مستقل جهت فعال‌سازی ادمین در قطعی‌ها.
```

---

## ۲. متغیرهای محیطی در فایل `.env`

### سرور اصلی آلمان (PRIMARY — `artgasht.com`):
```env
SERVER_ROLE=primary
DOMAIN=artgasht.com
ADMIN_ENABLED=true
ADMIN_PASSWORD=یک_رمز_عبور_طولانی_و_تصادفی_بسیار_امن
ADMIN_SECRET=یک_رشته_تصادفی_۳۲_کاراکتری_برای_توکن
SCRAPER_ENABLED=false
PORT=3000
NODE_ENV=production
DATA_DIR=/app/data
NESHAN_KEY_COM=web.cd0b84e26a35496f87485087bce939da
```

### سرور آینه ایران (MIRROR — `artgasht.ir`):
```env
SERVER_ROLE=mirror
DOMAIN=artgasht.ir
ADMIN_ENABLED=false
ADMIN_PASSWORD=یک_رمز_عبور_طولانی_و_تصادفی_بسیار_امن
ADMIN_SECRET=یک_رشته_تصادفی_۳۲_کاراکتری_برای_توکن
SCRAPER_ENABLED=true
PORT=3000
NODE_ENV=production
DATA_DIR=/app/data
NESHAN_KEY_IR=web.cd0b84e26a35496f87485087bce939da

# اطلاعات اتصال به سرور آلمان جهت همگام‌سازی خودکار
PRIMARY_HOST=artgasht.com
PRIMARY_USER=root
PRIMARY_PORT=22
PRIMARY_KEY=/root/.ssh/id_rsa
PRIMARY_DATA_DIR=/opt/artgasht/data
```

---

## ۳. راه‌اندازی همگام‌سازی خودکار در سرور ایران (systemd)

روی سرور ایران، فایل‌های سرویس و تایمر را در مسیر سیستم‌دی قرار دهید:

```bash
sudo cp scripts/artgasht-sync.service /etc/systemd/system/
sudo cp scripts/artgasht-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now artgasht-sync.timer
```

* این تایمر هر ۵ دقیقه اسکریپت `scripts/sync-pull.sh` را اجرا می‌کند.
* اگر سرور آلمان موقتاً قطع باشد یا اینترنت بین‌الملل قطع شود، اسکریپت بدون خطا خارج شده، داده‌های قبلی را دست‌نخورده نگه می‌دارد و در لاگ `/var/log/artgasht-sync.log` ثبت می‌کند.
* آخرین زمان موفقیت همگام‌سازی در `data/last-sync.txt` ذخیره شده و در خروجی `/health` نمایش می‌یابد.
* در صورتی که فایل پرچم `data/STANDALONE` وجود داشته باشد، همگام‌سازی به صورت خودکار لغو می‌شود تا ویرایش‌های محلی رونویسی نشوند.

---

## ۴. راه‌اندازی پشتیبان‌گیری شبانه با چرخش ۷ روزه

روی هر دو سرور، سرویس بکاپ شبانه را فعال کنید:

```bash
sudo cp scripts/artgasht-backup.service /etc/systemd/system/
sudo cp scripts/artgasht-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now artgasht-backup.timer
```

این اسکریپت هر شب ساعت ۰۳:۰۰ بامداد یک نسخه فشرده `tar.gz` از داده‌ها و تصاویر در `data/backups/` ایجاد کرده و فایل‌های قدیمی‌تر از ۷ روز را پاک می‌کند.

---

## ۵. دستورالعمل سناریوهای عملیاتی (Operational Scenarios)

### سناریوی ۱: استقرار خودکار عادی از روی لپ‌تاپ (Normal Deploy)
فایل `deploy.config.example` را به `deploy.config` کپی کرده و آی‌پی سرورها را وارد نمایید. سپس ایمیج یک‌بار روی لپ‌تاپ بیلد شده و به سرورها منتقل می‌شود:

```powershell
# استقرار روی هر دو سرور آلمان و ایران:
.\scripts\deploy.ps1 -Target all

# یا صرفاً سرور اصلی آلمان:
.\scripts\deploy.ps1 -Target primary

# یا صرفاً سرور آینه ایران:
.\scripts\deploy.ps1 -Target mirror
```

در لینوکس/مک:
```bash
./scripts/deploy.sh all
```

---

### سناریوی ۲: ورود به حالت مستقل اضطراری در زمان قطعی اینترنت بین‌الملل (Enter Standalone)
هنگامی که اینترنت بین‌الملل قطع است و دسترسی به سرور آلمان وجود ندارد، برای مدیریت نمایشگاه‌ها مستقیماً روی سرور ایران:

```bash
sudo /opt/artgasht/scripts/mirror-mode.sh standalone
```
* پرچم `data/STANDALONE` فعال می‌شود.
* پنل مدیریت در `https://artgasht.ir/#admin` فوراً فعال می‌گردد.
* تایمر همگام‌سازی متوقف می‌شود تا اطلاعات محلی دستکاری نشوند.

---

### سناریوی ۳: بازگشت اینترنت و ادغام دوطرفه اطلاعات (Merge-Back)
پس از برقراری مجدد ارتباط بین‌الملل، برای انتقال نمایشگاه‌ها و پوسترهای جدیدی که در زمان قطعی روی سرور ایران ثبت کرده‌اید به سرور اصلی آلمان:

```bash
sudo /opt/artgasht/scripts/mirror-mode.sh merge-back
```
مراحل خودکار:
1. تهیه بکاپ زمان‌دار از هر دو سرور ایران و آلمان.
2. دانلود دیتابیس آلمان به ایران.
3. ادغام بر اساس شناسه گالری (`id`) با قانون برتری جدیدترین تاریخ ویرایش (`updatedAt`).
4. کپی دوطرفه پوسترهای جدید با `rsync`.
5. انتشار نسخه ادغام شده روی هر دو سرور.
6. حذف پرچم `STANDALONE` و فعال‌سازی مجدد تایمر همگام‌سازی.

---

### سناریوی ۴: بازگشت دستی به حالت آینه (Mirror Mode)
اگر قصد دارید بدون ادغام به حالت فقط-خواندنی برگردید:

```bash
sudo /opt/artgasht/scripts/mirror-mode.sh mirror
```

---

### سناریوی ۵: تست دسترس‌پذیری زیرساخت‌های ایرانی (Reachability Test)
برای بررسی ارتباط سرور با وب‌سرویس نقشه نشان و کاتالوگ رویدادها:

```bash
./scripts/test-reachability.sh
```

---

## ۶. گواهی‌نامه دستی SSL روی سرور ایران (Manual TLS in Caddy)

اگر در زمان قطعی اینترنت، Caddy نتواند از Let's Encrypt گواهی‌نامه دریافت کند، می‌توانید گواهی‌نامه صادرشده داخلی یا دستی را در فایل `/etc/caddy/Caddyfile` سرور ایران قرار دهید (مشابه `Caddyfile.iran.example`):

```caddyfile
artgasht.ir, www.artgasht.ir {
    tls /etc/caddy/certs/artgasht.ir.crt /etc/caddy/certs/artgasht.ir.key
    reverse_proxy 127.0.0.1:3000
}
```

---

## ۷. اسرار مورد نیاز در گیت‌هاب اکشنز (GitHub Secrets)

در مسیر `Settings -> Secrets and variables -> Actions` مخزن گیت‌هاب، متغیرهای زیر را برای خط لوله CI/CD تنظیم کنید:

| نام Secret | مقدار |
| :--- | :--- |
| `PRIMARY_HOST` | آی‌پی یا نام دامنه سرور آلمان (`artgasht.com`) |
| `PRIMARY_USER` | نام کاربر SSH سرور آلمان (معمولاً `root`) |
| `PRIMARY_SSH_KEY` | کلید خصوصی SSH جهت اتصال به سرور آلمان |
| `PRIMARY_PORT` | پورت SSH سرور آلمان (پیش‌فرض ۲۲) |
| `MIRROR_HOST` | آی‌پی سرور ایران (`artgasht.ir`) |
| `MIRROR_USER` | نام کاربر SSH سرور ایران (معمولاً `root`) |
| `MIRROR_PORT` | پورت SSH سرور ایران (پیش‌فرض ۲۲) |
