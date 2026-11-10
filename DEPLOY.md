# راهنمای جامع استقرار سرور فرانکفورت (PRIMARY) و معماری دو-سروره
## اپلیکیشن «آرت‌گشت» (Anti-Gallery) — نسخه بتا V 1.095

---

## ۱. مشخصات سرور اصلی (Primary Server Specifications)

* **موقعیت:** فرانکفورت، آلمان (Frankfurt VPS)
* **آدرس IP سرور:** `86.54.42.206`
* **دامنه فعال:** `artgasht.com` و `www.artgasht.com` (DNS تایید شده و متصل به این آی‌پی)
* **کاربر استقرار:** `deploy` (دارای دسترسی sudo، احراز هویت فقط با کلید SSH، ورود کاربر root غیرفعال است)
* **فایروال (UFW):** پورت‌های ۲۲ (SSH)، ۸۰ (HTTP) و ۴۴۳ (HTTPS) باز هستند.
* **مسیر پروژه در سرور:** `/opt/artgasht`
* **نقش در معماری:** **PRIMARY** (منبع اصلی داده‌ها / پنل مدیریت فعال / دیتابیس مرجع).

---

## ۲. راه‌اندازی اولیه سرور با یک اسکریپت (One-Time Bootstrap)

روی سرور فرانکفورت هنوز داکر و پوشه `/opt/artgasht` وجود ندارد. با کاربر `deploy` وارد سرور شده و دستور زیر را اجرا کنید:

```bash
# ایجاد پوشه و دریافت اسکریپت راه‌اندازی اولیه
mkdir -p ~/setup && cd ~/setup
curl -fsSL https://raw.githubusercontent.com/ped-84/anti-gallery/main/scripts/setup-server.sh -o setup-server.sh
sudo bash setup-server.sh
```

### اقداماتی که `setup-server.sh` به صورت خودکار انجام می‌دهد:
1. نصب بسته‌های سیستمی: `curl`, `gnupg`, `rsync`, `tar`, `gzip`, `ca-certificates`.
2. نصب رسمی **Docker CE** و افزونه **Docker Compose** و فعال‌سازی سرویس داکر.
3. افزودن کاربر `deploy` به گروه `docker` (امکان اجرای دستورات داکر بدون sudo).
4. نصب وب‌سرور **Caddy** از مخزن رسمی APT و راه‌اندازی سرویس systemd آن.
5. نصب **Node.js LTS** (جهت اجرای اسکریپت‌های ادغام دیتابیس).
6. ساخت ساختار پوشه‌های `/opt/artgasht/{data,data/uploads,data/backups,scripts}` و واگذاری مالکیت به `deploy:deploy` (UID/GID 1000:1000).
7. فعال‌سازی تایمر خودکار بکاپ شبانه (`artgasht-backup.timer` ساعت ۰۳:۰۰ بامداد با چرخش ۷ روزه).
8. تنظیم خودکار فایروال UFW برای پورت‌های ۲۲، ۸۰ و ۴۴۳.

---

## ۳. تنظیم فایل پیکربندی محلی روی لپ‌تاپ (`deploy.config`)

روی لپ‌تاپ خود در ریشه پروژه، فایل `deploy.config.example` را به `deploy.config` کپی کنید (این فایل در `.gitignore` است و هرگز به گیت کامیت نمی‌شود):

```json
{
  "primary": {
    "name": "Germany VPS (artgasht.com - Primary)",
    "host": "86.54.42.206",
    "user": "deploy",
    "port": 22,
    "key": "~/.ssh/id_rsa",
    "remoteDir": "/opt/artgasht",
    "domain": "artgasht.com",
    "role": "primary"
  },
  "mirror": {
    "name": "Iran VPS (artgasht.ir - Mirror)",
    "host": "YOUR_IRAN_IP",
    "user": "deploy",
    "port": 22,
    "key": "~/.ssh/id_rsa",
    "remoteDir": "/opt/artgasht",
    "domain": "artgasht.ir",
    "role": "mirror"
  }
}
```

---

## ۴. مراحل گام‌به‌گام اولین استقرار از روی لپ‌تاپ (First Deploy Execution Order)

فرآیند استقرار در ویندوز پاورشل به صورت فایل‌محور (`docker save -o` + `scp` + `docker load -i`) پیاده‌سازی شده تا باگ شناخته‌شده تخریب بایت‌های باینری در خط لوله SSH پاورشل ۵.۱ رخ ندهد.

### گام اول: اجرای اسکریپت استقرار روی لپ‌تاپ
در ترمینال PowerShell لپ‌تاپ در پوشه پروژه اجرا کنید:

```powershell
.\scripts\deploy.ps1 -Target primary
```

مراحل خودکاری که اسکریپت طی می‌کند:
1. اجرای اعتبارسنجی تایپ‌اسکریپت (`npm.cmd exec tsc -- --noEmit`).
2. بیلد بهینه فایل‌های فرانت‌اند توسط Vite در پوشه `dist/`.
3. ساخت ایمیج داکر `artgasht:latest` روی داکر محلی لپ‌تاپ.
4. خروجی ایمیج در فایل محلی `artgasht_temp.tar`.
5. آپلود `artgasht_temp.tar` از طریق SCP با کاربر `deploy` به سرور فرانکفورت.
6. اجرای `docker load -i /opt/artgasht/artgasht_temp.tar` در سرور و حذف خودکار فایل tar.
7. کپی فایل‌های `docker-compose.yml`, `Caddyfile` و کلیه اسکریپت‌ها به `/opt/artgasht`.
8. ایجاد فایل `.env` اولیه روی سرور در صورت نبود آن.
9. کپی `Caddyfile` به `/etc/caddy/Caddyfile` و ریلود وب‌سرور Caddy.
10. راه‌اندازی کانتینر اپلیکیشن با دستور `docker compose up -d --force-recreate` تحت کاربر غیرریشه `1000:1000`.
11. استعلام و چاپ خروجی اندپوینت سلامت `/health`.
12. پاکسازی خودکار فایل موقت `artgasht_temp.tar` از روی لپ‌تاپ.

---

## ۵. تنظیم رمز عبور پنل مدیریت روی سرور

پس از اولین استقرار، یک‌بار وارد سرور شده و رمز عبور تصادفی و قوی برای ادمین تنظیم کنید:

```bash
ssh deploy@86.54.42.206
nano /opt/artgasht/.env
```

> [!IMPORTANT]
> **قانون حیاتی رمزهای عبور:** مقادیر `ADMIN_PASSWORD` و `ADMIN_SECRET` باید **صرفاً الفبانمایی (Alphanumeric)** شامل حروف انگلیسی و ارقام (`[a-zA-Z0-9]`) باشند (بدون کاراکترهای خاص مانند `$`, `!`, `&`, `"`)، زیرا اسکریپت‌های شل لینوکس این فایل را با دستور `source` فراخوانی می‌کنند.

نمونه محتوای `/opt/artgasht/.env` در سرور فرانکفورت:
```env
SERVER_ROLE=primary
DOMAIN=artgasht.com
ADMIN_ENABLED=true
ADMIN_PASSWORD=K8mP2x9Lq4vW7zR1tY5nB3cD6eF0jH9a
ADMIN_SECRET=X7vB2mK9qL4zR1tY5nP8wD3cE6fJ0hA1
SCRAPER_ENABLED=true
PORT=3000
NODE_ENV=production
DATA_DIR=/app/data
NESHAN_KEY_COM=web.cd0b84e26a35496f87485087bce939da
```

پس از ویرایش `.env`، کانتینر را بازنشانی کنید:
```bash
cd /opt/artgasht && docker compose up -d
```

---

## ۶. تحلیل دسترسی اسکرپر و جریان داده‌ها (Data Flow Architecture)

### بررسی دسترس‌پذیری زیرساخت‌ها از سرور فرانکفورت:
* وب‌سایت مرجع کاتالوگ رویدادها (`https://galleryinfo.ir/Event/fa`): دارای وب‌سرور عمومی روی اینترنت جهانی است و از سرورهای اروپایی قابل واکشی است.
* وب‌سرویس و نقشه نشان (`https://api.neshan.org` و `https://static.neshan.org`): نودهای CDN بین‌المللی ستون (Sotoon CDN) پاسخگو هستند.

### جریان داده‌های پایگاه داده (Data Flow):
برای جلوگیری از رونویسی تصادفی اطلاعات:
1. **اسکرپر به صورت پیش‌فرض روی سرور اصلی آلمان (PRIMARY) فعال است (`SCRAPER_ENABLED=true`).**
2. نمایشگاه‌های جدید استخراج‌شده مستقیماً در دیتابیس مرجع سرور آلمان ذخیره شده و با فیلد `updatedAt` نشانه‌گذاری می‌شوند.
3. تغییرات ایجادشده توسط مدیر در پنل ادمین (`artgasht.com/#admin`) نیز در همین دیتابیس مرجع ذخیره می‌شوند.
4. سرور ایران (MIRROR) هر ۵ دقیقه با اسکریپت `sync-pull.sh` اطلاعات را دانلود کرده و با اسکریپت هوشمند `merge-galleries.cjs` ادغام می‌کند. بدین ترتیب هیچ رویدادی هرگز گم یا رونویسی نمی‌شود.

---

## ۷. چک‌لیست نهایی اعتبارسنجی (Verification Checklist)

پس از استقرار، مراحل زیر را به ترتیب بررسی فرمایید:

- [ ] **۱. تست اندپوینت سلامت سرور:**
  ```bash
  curl -s https://artgasht.com/health | jq
  ```
  *خروجی باید دارای وضعیت `"status": "ok"`, `"serverRole": "primary"`, `"adminEnabled": true` باشد.*

- [ ] **۲. بارگذاری صفحه اصلی در مرورگر:**
  به آدرس [https://artgasht.com](https://artgasht.com) مراجعه کنید. نقشه وکتور نشان، لیست گالری‌ها با فونت شبنم و فونت انگلیسی اوبونتو، بج‌های نارنجی افتتاحیه و گشت‌های پیشنهادی باید بدون هیچ خطایی در کنسول لود شوند.

- [ ] **۳. تست ورود به پنل مدیریت:**
  روی آیکون قفل هدر کلیک کرده یا به [https://artgasht.com/#admin](https://artgasht.com/#admin) بروید. با رمز عبور `ADMIN_PASSWORD` وارد شوید.

- [ ] **۴. افزودن گالری تستی و آپلود پوستر:**
  یک نمایشگاه تستی جدید اضافه کنید، یک عکس به عنوان پوستر آپلود نمایید و تغییرات را ذخیره کنید. پوستر باید در مسیر `/opt/artgasht/data/uploads/` با مالکیت `deploy:deploy` (نه root) ذخیره شود و در سایت نمایش یابد.

- [ ] **۵. تست تایمر پشتیبان‌گیری:**
  در ترمینال سرور دستور زیر را اجرا کرده و فایل آرشیو تولیدشده را تایید نمایید:
  ```bash
  sudo systemctl start artgasht-backup.service
  ls -lh /opt/artgasht/data/backups/
  ```
