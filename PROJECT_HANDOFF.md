# گالری‌گردی (Anti-Gallery) — Master Project Handoff & Architecture Brief

> **MANDATORY INSTRUCTION FOR AGENTS READING THIS FILE:**
> 1. **QUALITY IS PARAMOUNT:** Never ever sacrifice quality, correctness, visual smoothness, or robust error-free code for speed or quick answering. The user values a production-grade, bug-free, beautifully crafted app above everything else. Speed should come from eliminating redundant speculative roundtrips, NOT by cutting corners, skipping checks, or rushing incomplete work.
> 2. **VERSION INCREMENT RULE:** Every single change request MUST increment `APP_VERSION` in `src/components/Header.tsx` by `0.001` (Current: `بتا V 1.076`, Next: `بتا V 1.077`).
> 3. **TEHRAN-FIRST SCOPE:** Only display Tehran galleries to the user for now. Non-Tehran galleries (Shiraz, Isfahan, Karaj, Mashhad, etc.) are preserved in `src/data/galleries.json` but filtered out in `src/App.tsx`. Never delete them.

---

## 1. Project Identity & Production URLs
* **Brand Name:** گالری‌گردی (Anti-Gallery / Gallery Gardi)
* **Target Audience:** Art enthusiasts, gallery-goers, curators, and tourists exploring art exhibitions in Tehran.
* **Live GitHub Pages URL:** [https://ped-84.github.io/anti-gallery/](https://ped-84.github.io/anti-gallery/)
* **Git Repository:** `https://github.com/ped-84/anti-gallery.git`
  * Branch `main`: Source code repository.
  * Branch `gh-pages`: Production static site build (serves `dist/`).
* **Current Version:** `بتا V 1.076`
* **Next Version:** `بتا V 1.077`

---

## 2. Core Philosophy & Design Guidelines

### A. Non-Negotiable Quality Standards
* **Zero Visual Glitches:** All cards, modals, dropdowns, and buttons must align perfectly with smooth padding, balanced spacing, and fluid transitions.
* **Flawless RTL & Typography:** The entire UI is RTL (Right-to-Left) with Persian typography powered by the **Shabnam** font family (`fonts/shabnam/`). All numbers displayed in the interface MUST pass through `toPersianDigits()`.
* **Clean Persian Text:** Addresses must never contain HTML entities (e.g. `&nbsp;`, `&amp;`, `&quot;`). Always sanitize addresses via `formatGalleryAddress()`.
* **Graceful Fallbacks:** If an exhibition lacks a poster, a clean, styled placeholder with gallery logo is shown. If artist is `"نمایشگاه گروهی"`, display `"گروهی از هنرمندان"`. Redundant `"نمایشگاه انفرادی"` subtitles under exhibition titles must remain eliminated.

### B. The Claymorphic / Stickdazzle Design System
* **Surfaces:** Use `clay-card` (`bg-white/95 dark:bg-[#181d28]/95 backdrop-blur-md rounded-2xl border border-[#E1E1E1] dark:border-stone-800 shadow-xs`).
* **Buttons:** Use `clay-button clay-base` or `clay-darkblue` with active states and subtle hover elevation.
* **Dropdowns:** **NEVER USE RAW HTML `<select>`!** Use the custom component `ClayDropdown.tsx` (`size="sm" | "md"`, `align="left" | "right"`, animated chevrons, rounded popovers, and checkmark indicators).

---

## 3. Architecture & File Structure

```
├── index.html                     # Entry HTML, Shabnam font declarations, title, favicon
├── vite.config.ts                 # Vite config (base: '/anti-gallery/')
├── tailwind.config.js             # Tailwind theme, custom colors, animations
├── src/
│   ├── main.tsx                   # React root mount
│   ├── App.tsx                    # Core app logic, state, search & filter pipelines, catalog grid
│   ├── types/
│   │   └── gallery.ts             # TypeScript definitions (Gallery, Exhibition, Route, Tour)
│   ├── components/
│   │   ├── Header.tsx             # Navbar, APP_VERSION, dark mode toggle, curated tours trigger
│   │   ├── GalleryCard.tsx        # Exhibition card, medium badge, opening status, action buttons
│   │   ├── GalleryDetailModal.tsx # Full-screen deep modal with contact, hours, history, nav buttons
│   │   ├── RouteSummaryPanel.tsx  # Tour itinerary planner, mode, pattern, traffic, visit duration, metrics
│   │   ├── ClayDropdown.tsx       # Reusable Claymorphic dropdown menu component
│   │   ├── CuratedToursModal.tsx  # Modal displaying pre-crafted art walks
│   │   ├── Map.tsx                # Leaflet interactive Tehran map with markers and route polylines
│   │   └── NavIcons.tsx           # SVGs for Waze, Neshan, Balad, Google Maps
│   ├── utils/
│   │   ├── persianUtils.ts        # toPersianDigits, getExhibitionMedium, formatGalleryAddress, date scorers
│   │   └── routeOptimizer.ts      # TSP solver, distance matrices, navigation URL builders, GPX exporter
│   └── data/
│       ├── galleries.json         # Master dataset of 122 galleries (83 Tehran, 39 other cities)
│       ├── exhibitions.json       # Live exhibition events dataset
│       └── curatedTours.ts        # Hand-crafted Tehran walking tours
└── scripts/
    └── sync-galleryinfo.cjs       # Scraper engine connecting to galleryinfo.ir API
```

---

## 4. Complete Feature Specifications

### 1. Catalog & Exhibition Feed (`src/App.tsx`, `GalleryCard.tsx`)
* **3-Stage Filter Tabs:**
  1. `افتتاحیه این هفته` (Default): Shows only exhibitions opening this current week/Friday based on `isThisWeekOpening()`.
  2. `نمایشگاه‌های فعال با پوستر`: Exhibitions with verified active posters.
  3. `همه نگارخانه‌ها`: All registered Tehran galleries.
* **Search Engine:** Real-time multi-attribute search matching gallery name (Persian & English), artist names, exhibition titles, neighborhoods, and street addresses.
* **Sorting (`ClayDropdown`):**
  * `جدیدترین رویدادها (پیش‌فرض)`: Sorted by latest exhibition event ID / opening date score descending.
  * `بر اساس نام نگارخانه`: Alphabetical in Persian.
* **Neighborhood Filter (`ClayDropdown`):** Displays all 7 Tehran zones.
* **Card Details:**
  * Gallery logo + name + single location line (`محله · نشانی خیابان`).
  * Poster preview with lazy loading and tap-to-view.
  * Exhibition Title.
  * Artist row with `User` icon (group exhibitions show `گروهی از هنرمندان`).
  * **Medium / Subject Badge:** Powered by `getExhibitionMedium()` with `Palette` icon:
    * `نقاشی` (Painting)
    * `عکاسی` (Photography)
    * `مجسمه‌سازی و حجم` (Sculpture & Volume)
    * `خوشنویسی و خط` (Calligraphy)
    * `طراحی` (Drawing/Sketch)
    * `چاپ دستی` (Printmaking)
    * `چیدمان (اینستالیشن)` (Installation Art)
    * `چندرسانه‌ای` (New Media)
    * `هنر الیاف و بافت` (Textile / Fiber Art)
    * `گنجینه موزه` (Museum Collection)
    * `هنرهای تجسمی` (Fine Arts fallback)
  * Opening status badge (`افتتاحیه: جمعه ۱۵ آبان ۱۴۰۵` + `این هفته`).
  * Action buttons: `اطلاعات نگارخانه` (modal) and `+ افزودن به گشت` (route selection).

### 2. Route Planner & Optimizer (`RouteSummaryPanel.tsx`, `routeOptimizer.ts`)
* **Mode Control:** Car (`با خودرو`) vs Walking (`پیاده‌روی`).
* **Route Pattern:** One-way (`تک‌مسیره`) vs Loop (`رفت‌وبرگشت`).
* **Tehran Traffic Scenarios (Driving mode):**
  * `عادی (روان)`
  * `اوج عصر (شلوغ)`: Adds realistic rush-hour delay.
  * `جمعه و تعطیلات`: Optimized for opening day traffic.
  * Traffic zone alert: Highlights if galleries fall inside Tehran's Restricted Traffic Zone (`طرح ترافیک`).
* **Gallery Visit Duration Dropdown (`ClayDropdown`):**
  * Allows user to select estimated time spent inside each gallery (5 min to 60 min in 5-min intervals, default: **15 min**).
  * Automatically updates the overall tour ETA:
    $$\text{Total Time} = \text{Transit Time} + (\text{Number of Galleries} \times \text{Visit Duration})$$
* **Itinerary Controls:**
  * Reorder stops up/down.
  * Set stop as starting point or ending point.
  * Remove stop from route or clear entire route.
* **1-Click External Navigation:**
  * Google Maps multi-waypoint URL.
  * Neshan app direct routing.
  * Balad app direct routing.
  * Waze direct routing.
  * Download `.gpx` file for GPS devices.
  * Copy complete text summary with formatted Persian digits.

### 3. Curated Tours (`CuratedToursModal.tsx`, `curatedTours.ts`)
* Pre-designed, highly engaging walking tours in Tehran art clusters:
  1. **گذر هنر معاصر کریم‌خان** (Karimkhan Contemporary Corridor)
  2. **گشت هنری الهیه و فرشته** (Elahiyeh & Fereshteh High-Art Walk)
  3. **مسیر هنر و میراث مرکز و انقلاب** (Downtown & Enghelab Art Trail)
* Clicking any tour immediately loads its gallery set into the Route Planner.

---

## 5. Tehran Neighborhood Taxonomy (The 7 Official Zones)
Any Tehran gallery must be classified strictly into one of these 7 zones:

1. **نیاوران و شمال تهران:** نیاوران، فرمانیه، کامرانیه، اقدسیه، بلوار ارتش، نخل، دارآباد، تجریش، دزاشیب، اندرزگو، قیطریه، دروس، دیباجی، پاسداران، تهرانپارس. *(Includes گالری با [id 497] in بلوار ارتش غرب).*
2. **الهیه و فرشته:** خیابان فرشته (فیاضی)، الهیه، سام سنتر، خیابان بیدار، چناران، آقابزرگی، زعفرانیه، محمودیه، ولنجک، پسیان، پارک‌وی.
3. **ونک، میرداماد و ظفر:** ونک، ملاصدرا، شیخ بهایی، خیابان سئول، میرداماد، ظفر (دستگردی)، جردن (آفریقا / نلسون ماندلا)، گاندی، بزرگراه کردستان.
4. **بهشتی و مطهری:** خیابان مطهری، خیابان بهشتی (عباس‌آباد)، میرعماد، سهروردی، لارستان، قائم‌مقام فراهانی، میرزای شیرازی شمالی، وزرا، پاکستان.
5. **کریم‌خان و مرکز:** خیابان کریمخان زند، سنایی، خردمند شمالی/جنوبی، نجات‌اللهی (ویلا)، سپند، عضدی (آبان)، سمیه، حافظ، پورموسی، سپهبد قرنی، طالقانی (باغ هنر).
6. **مرکز، انقلاب و امیرآباد:** خیابان انقلاب، کارگر شمالی، امیرآباد، پارک لاله، بلوار کشاورز، وصال، فلسطین، میدان ولیعصر، زرتشت، فاطمی، موزه هنرهای معاصر، حوزه هنری، کوچه لولاگر.
7. **غرب تهران:** سعادت‌آباد، شهرک غرب، پونک، مرزداران، صادقیه، جلال آل احمد، ستارخان، اکباتان.

---

## 6. Critical Bugs & Gotchas (NEVER Reintroduce)
1. **Never use raw `<select>` elements:** Always use `<ClayDropdown>`. Native selects break the Claymorphic aesthetic and produce jarring OS-level dropdowns.
2. **Never expose `&nbsp;` in addresses:** The upstream scraper occasionally captures `&nbsp;`. All addresses in components must use `formatGalleryAddress()`.
3. **Never hardcode non-Tehran default to Karimkhan:** If `sync-galleryinfo.cjs` discovers a gallery outside Tehran, record its actual city (`Karaj`, `Mashhad`, `Shiraz`, etc.).
4. **Never delete non-Tehran data:** Non-Tehran galleries are kept in `galleries.json` and `exhibitions.json` and filtered only at the view layer (`App.tsx`).
5. **Never commit `.github/workflows/`:** The GitHub Personal Access Token lacks the `workflow` scope. Syncing is done locally via `node scripts/sync-galleryinfo.cjs`.

---

## 7. Verification & Deployment Commands

Always verify the build before deploying:
```powershell
# 1. Build test
npm.cmd run build

# 2. Deploy script (Main + GitHub Pages)
node -e "
const { execSync } = require('child_process');
const path = require('path');
function run(cmd, cwd) { execSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit' }); }

run('git add .');
run('git commit -m \"feat: <DESCRIPTION> (v1.05X)\"');
run('git push origin main');

const distDir = path.join(process.cwd(), 'dist');
run('git init', distDir);
run('git add -A', distDir);
run('git commit -m \"deploy: v1.05X\"', distDir);
run('git push -f https://github.com/ped-84/anti-gallery.git master:gh-pages', distDir);
"
```
