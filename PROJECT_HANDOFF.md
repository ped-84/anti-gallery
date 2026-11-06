# گالری‌گردی (Anti-Gallery) — Project Handoff & Continuity Brief

> **Purpose of this document:** Complete context handoff for starting a clean, high-speed new session. Paste or refer to this document in the new chat.

---

## 1. Quick Project Identity
* **App Name:** گالری‌گردی (Gallery Gardi)
* **Live Deployment:** [https://ped-84.github.io/anti-gallery/](https://ped-84.github.io/anti-gallery/)
* **Repository:** `https://github.com/ped-84/anti-gallery.git`
  * Main branch: `main`
  * Production deployment branch: `gh-pages` (serves the `dist/` directory)
* **Current Version:** `بتا V 1.056`
* **Next Version:** `بتا V 1.057` (Rule: increment version by `0.001` on every release in `src/components/Header.tsx`).

---

## 2. Core Operational Rules & User Preferences
1. **Speed & Direct Execution:**
   * Do NOT run long, repetitive speculative micro-audits or 30+ sequential tool calls.
   * Make targeted, batched file edits directly (1–2 tool calls max) and verify immediately with `npm.cmd run build`.
2. **Version Bump Rule:**
   * Every single user request that modifies code or data MUST increment `APP_VERSION` in `src/components/Header.tsx` (e.g. `بتا V 1.056` -> `بتا V 1.057`).
3. **Tehran-First Scope:**
   * Currently, the UI shows **Tehran galleries and exhibitions only**.
   * Non-Tehran galleries (Shiraz, Isfahan, Karaj, Mashhad, Kashan, Bojnurd, Istanbul) are **preserved in `src/data/galleries.json`** for future expansion, but **filtered out** in `src/App.tsx`. Never delete them from the database.
4. **Design System (Claymorphic / Stickdazzle):**
   * Use custom UI components (`clay-card`, `clay-button`, `clay-base`).
   * Never use raw browser native `<select>` dropdowns; use `src/components/ClayDropdown.tsx` which supports `size="sm"`, `align="left"`, badges, and custom popovers.
5. **Localization:**
   * Persian font: **Shabnam** (`fonts/shabnam/`).
   * All numbers in UI rendered via `toPersianDigits()`.
   * Address strings cleaned via `formatGalleryAddress()` to strip `&nbsp;` and redundant city prefixes.

---

## 3. Tech Stack & Key Files
* **Core:** Vite + React 18 + TypeScript + Tailwind CSS + Lucide React.
* **Map Engine:** Leaflet + React-Leaflet (custom clay markers and routing polylines).
* **Navigation Helpers:** Export to GPX, Neshan, Balad, Waze, and Google Maps.

### Key File Map:
* [`src/App.tsx`](file:///src/App.tsx): Main app orchestrator, state management, search, filters, catalog grid, and layout.
* [`src/components/Header.tsx`](file:///src/components/Header.tsx): Top navigation bar, `APP_VERSION`, curated tours trigger, dark mode toggle.
* [`src/components/GalleryCard.tsx`](file:///src/components/GalleryCard.tsx): Individual gallery card in catalog, poster display, exhibition title, artist line (`گروهی از هنرمندان`), subject badge (`Palette` icon + `getExhibitionMedium`), opening badges, and "افزودن به گشت" action.
* [`src/components/GalleryDetailModal.tsx`](file:///src/components/GalleryDetailModal.tsx): Deep modal with gallery specs, current/past exhibitions, contact info, working hours, and navigation buttons.
* [`src/components/RouteSummaryPanel.tsx`](file:///src/components/RouteSummaryPanel.tsx): Route itinerary builder, travel mode (driving/walking), pattern (one-way/loop), traffic condition (روان، اوج عصر شلوغ، جمعه), gallery visit duration (`ClayDropdown` 5–60 min), transit stats, and stop reordering.
* [`src/components/ClayDropdown.tsx`](file:///src/components/ClayDropdown.tsx): Custom reusable Claymorphic dropdown popover component.
* [`src/utils/persianUtils.ts`](file:///src/utils/persianUtils.ts): Persian digit converter, medium detector (`getExhibitionMedium`), address cleaner (`formatGalleryAddress`), and date scorers.
* [`src/utils/routeOptimizer.ts`](file:///src/utils/routeOptimizer.ts): TSP route solver, distance matrices, navigation URL builders.
* [`src/data/galleries.json`](file:///src/data/galleries.json): Complete catalog of 122 galleries (83 active Tehran galleries, 39 other cities).
* [`src/data/exhibitions.json`](file:///src/data/exhibitions.json): Current exhibitions dataset.
* [`scripts/sync-galleryinfo.cjs`](file:///scripts/sync-galleryinfo.cjs): Standalone scraper script for fetching live events from `galleryinfo.ir` with intelligent city and zone detection.

---

## 4. Tehran Neighborhood Districts (The 7 Official Zones)
1. **نیاوران و شمال تهران:** نیاوران، فرمانیه، کامرانیه، اقدسیه، بلوار ارتش، نخل، دارآباد، تجریش، دزاشیب، اندرزگو، قیطریه، دروس، دیباجی، پاسداران، تهرانپارس.
   *(Note: گالری با [id 497] in بلوار ارتش غرب belongs here).*
2. **الهیه و فرشته:** خیابان فرشته (فیاضی)، الهیه، سام سنتر، خیابان بیدار، چناران، آقابزرگی، زعفرانیه، محمودیه، ولنجک، پسیان، پارک‌وی.
3. **ونک، میرداماد و ظفر:** ونک، ملاصدرا، شیخ بهایی، خیابان سئول، میرداماد، ظفر (دستگردی)، جردن (آفریقا)، گاندی، بزرگراه کردستان.
4. **بهشتی و مطهری:** خیابان مطهری، خیابان بهشتی (عباس‌آباد)، میرعماد، سهروردی، لارستان، قائم‌مقام فراهانی، میرزای شیرازی شمالی، وزرا، پاکستان.
5. **کریم‌خان و مرکز:** خیابان کریمخان زند، سنایی، خردمند شمالی/جنوبی، نجات‌اللهی (ویلا)، سپند، عضدی (آبان)، سمیه، حافظ، پورموسی، سپهبد قرنی، طالقانی (باغ هنر).
6. **مرکز، انقلاب و امیرآباد:** خیابان انقلاب، کارگر شمالی، امیرآباد، پارک لاله، بلوار کشاورز، وصال، فلسطین، میدان ولیعصر، زرتشت، فاطمی، موزه هنرهای معاصر، حوزه هنری، کوچه لولاگر.
7. **غرب تهران:** سعادت‌آباد، شهرک غرب، پونک، مرزداران، صادقیه، جلال آل احمد، ستارخان، اکباتان.

---

## 5. Standard Deployment Workflow
When finishing an update:
```bash
# 1. Build bundle
npm.cmd run build

# 2. Commit and deploy
git add .
git commit -m "feat: description of changes (v1.05X)"
git push origin main

# 3. Push dist to gh-pages branch
node -e "
const { execSync } = require('child_process');
const path = require('path');
const distDir = path.join(process.cwd(), 'dist');
execSync('git init', { cwd: distDir, stdio: 'inherit' });
execSync('git add -A', { cwd: distDir, stdio: 'inherit' });
execSync('git commit -m \"deploy: v1.05X\"', { cwd: distDir, stdio: 'inherit' });
execSync('git push -f https://github.com/ped-84/anti-gallery.git master:gh-pages', { cwd: distDir, stdio: 'inherit' });
"
```

---

## 6. Recent Fixes Summary (Pre-Handoff State)
* **v1.054:** Cleaned redundant "انفرادی / گروهی" subheaders; added intelligent Art Medium/Subject badge (`Palette` icon); renamed solo `هنرمند: نمایشگاه گروهی` to `گروهی از هنرمندان`.
* **v1.055:** Replaced native `<select>` with custom `ClayDropdown` (size sm, smooth animation, clay styling); cleaned `&nbsp;` HTML entities from all addresses and scraper.
* **v1.056:** Filtered catalog to Tehran-only in `App.tsx`; relocated "گالری با" to "نیاوران و شمال تهران"; categorized non-Tehran cities (Karaj, Mashhad, Shiraz, Isfahan, etc.) in database without deleting them; updated `sync-galleryinfo.cjs` zone classifier.
