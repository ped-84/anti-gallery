import React, { useState, useMemo, useEffect } from 'react';
import { Gallery, RouteOptimizationResult } from './types/gallery';
import rawGalleriesData from './data/galleries.json';
import { PERSIAN_CURATED_TOURS, PersianCuratedTour } from './data/curatedTours';
import { optimizeGalleryRoute } from './utils/routeOptimizer';
import { toPersianDigits, TrafficCondition, getPersianNeighborhood, getGalleryDisplayName } from './utils/persianUtils';
import { Header } from './components/Header';
import { GalleryCard } from './components/GalleryCard';
import { InteractiveMap } from './components/InteractiveMap';
import { RouteSummaryPanel } from './components/RouteSummaryPanel';
import { GalleryDetailModal } from './components/GalleryDetailModal';
import { CuratedToursModal } from './components/CuratedToursModal';
import { ClayDropdown } from './components/ClayDropdown';
import {
  Search,
  Sparkles,
  MapPin,
  RotateCcw,
  Palette,
  Grid,
  ArrowUpDown,
  ChevronDown,
  Map as MapIcon,
  Compass
} from 'lucide-react';

const STICKDAZZLE_THEMES = ['darkblue', 'orange', 'softblue', 'gray'] as const;

export default function App() {
  const galleries = rawGalleriesData as Gallery[];
  // Default sample (4 galleries with verified active posters & opening dates)
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<number[]>([1023, 485, 25, 182]);
  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Responsive mobile view tab ('catalog' vs 'map')
  const [mobileActiveTab, setMobileActiveTab] = useState<'catalog' | 'map'>('catalog');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');
  const [filterActivePostersOnly, setFilterActivePostersOnly] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'latest' | 'name'>('latest');

  // Modals
  const [activeModalGallery, setActiveModalGallery] = useState<Gallery | null>(null);
  const [isCuratedModalOpen, setIsCuratedModalOpen] = useState<boolean>(false);
  const [highlightedGalleryId, setHighlightedGalleryId] = useState<number | null>(null);

  // Background Auto-Sync State
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime: string;
    nextScheduledSync: string;
    scheduleDescription: string;
    isSyncing: boolean;
  } | null>(null);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync-status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch {
      // static/offline fallback
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsTriggeringSync(true);
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' });
      if (res.ok) {
        await fetchSyncStatus();
      }
    } catch (e) {
      console.warn('Manual sync failed:', e);
    } finally {
      setIsTriggeringSync(false);
    }
  };

  // Dark Mode Toggle
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const selectedGalleries = useMemo(() => {
    return selectedGalleryIds
      .map((id) => galleries.find((g) => g.id === id))
      .filter((g): g is Gallery => !!g);
  }, [galleries, selectedGalleryIds]);

  const totalWithPosters = useMemo(() => {
    return galleries.filter((g) => Boolean(g.posterImage || g.activeExhibition?.poster)).length;
  }, [galleries]);

  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    galleries.forEach((g) => {
      const neigh = g.neighborhoodFa || getPersianNeighborhood(g.neighborhood);
      if (neigh) set.add(neigh);
    });
    return Array.from(set).sort();
  }, [galleries]);

  // Filtered and sorted galleries (Default: Sorted by latest exhibition / latest additions)
  const filteredGalleries = useMemo(() => {
    const filtered = galleries.filter((gallery) => {
      const hasPoster = Boolean(gallery.posterImage || gallery.activeExhibition?.poster);

      if (filterActivePostersOnly && !hasPoster) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const displayName = getGalleryDisplayName(gallery);
        const matchesName =
          (gallery.nameFa || '').toLowerCase().includes(q) ||
          (gallery.name || '').toLowerCase().includes(q) ||
          displayName.toLowerCase().includes(q);
        const matchesAddr = (gallery.addressFa || gallery.address).toLowerCase().includes(q);
        const matchesNeigh = (gallery.neighborhoodFa || getPersianNeighborhood(gallery.neighborhood)).toLowerCase().includes(q);

        const activeEx = gallery.activeExhibition;
        const matchesActiveEx = activeEx && (
          activeEx.title.toLowerCase().includes(q) ||
          (activeEx.artist || '').toLowerCase().includes(q) ||
          (activeEx.type || '').toLowerCase().includes(q) ||
          (activeEx.openingDate || '').toLowerCase().includes(q)
        );

        const matchesOtherExhibitions = gallery.exhibitions?.some(
          (e) => e.title.toLowerCase().includes(q) || (e.artist || '').toLowerCase().includes(q)
        );

        if (!matchesName && !matchesAddr && !matchesNeigh && !matchesActiveEx && !matchesOtherExhibitions) {
          return false;
        }
      }

      if (selectedNeighborhood !== 'All') {
        const currentNeigh = gallery.neighborhoodFa || getPersianNeighborhood(gallery.neighborhood);
        if (currentNeigh !== selectedNeighborhood) return false;
      }

      return true;
    });

    // Default Sorting: Latest exhibition / newest event ID descending
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return getGalleryDisplayName(a).localeCompare(getGalleryDisplayName(b), 'fa');
      }

      const aEventId = a.activeExhibition?.eventId || (a.posterImage ? a.id : 0);
      const bEventId = b.activeExhibition?.eventId || (b.posterImage ? b.id : 0);

      if (bEventId !== aEventId) {
        return bEventId - aEventId;
      }

      return b.id - a.id;
    });
  }, [galleries, searchQuery, selectedNeighborhood, filterActivePostersOnly, sortBy]);

  const runRouteOptimization = async (
    mode: 'driving' | 'walking' = routeResult?.mode || 'driving',
    isRoundTrip: boolean = routeResult?.isRoundTrip ?? false,
    trafficCondition: TrafficCondition = routeResult?.trafficCondition || 'peak'
  ) => {
    if (selectedGalleries.length < 2) return;
    setIsOptimizing(true);
    try {
      const result = await optimizeGalleryRoute(selectedGalleries, {
        mode,
        isRoundTrip,
        trafficCondition
      });
      setRouteResult(result);
    } catch (err: any) {
      console.error('Route optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    runRouteOptimization('driving', false, 'peak');
  }, []);

  const handleToggleGallery = (gallery: Gallery) => {
    setSelectedGalleryIds((prev) => {
      if (prev.includes(gallery.id)) {
        return prev.filter((id) => id !== gallery.id);
      } else {
        return [...prev, gallery.id];
      }
    });
  };

  useEffect(() => {
    if (selectedGalleries.length >= 2) {
      runRouteOptimization(
        routeResult?.mode || 'driving',
        routeResult?.isRoundTrip ?? false,
        routeResult?.trafficCondition || 'peak'
      );
    } else {
      setRouteResult(null);
    }
  }, [selectedGalleryIds]);

  const handleSelectCuratedTour = (tour: PersianCuratedTour) => {
    setSelectedGalleryIds(tour.galleryIds);
  };

  const galleryOrderMap = useMemo(() => {
    const map = new Map<number, number>();
    if (routeResult) {
      routeResult.orderedGalleries.forEach((g, idx) => {
        map.set(g.id, idx + 1);
      });
    }
    return map;
  }, [routeResult]);

  return (
    <div className="min-h-screen bg-[#f3f5f8] dark:bg-[#12151e] text-stone-800 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden">
      {/* Top Bar (Claymorphic with Stickdazzle Palette, Fully Responsive) */}
      <Header
        selectedCount={selectedGalleries.length}
        onOpenCuratedTours={() => setIsCuratedModalOpen(true)}
        onOptimizeRoute={() => {
          runRouteOptimization();
          setMobileActiveTab('map');
        }}
        isOptimizing={isOptimizing}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Operational Ribbon */}
      <div className="bg-[#e4ebf5] dark:bg-[#161a24] text-stone-700 dark:text-stone-300 text-xs px-3 sm:px-6 lg:px-8 py-2.5 border-b border-[#E1E1E1] dark:border-stone-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap font-medium">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F76B1C] inline-block shadow-sm shrink-0"></span>
            <span className="truncate">
              <strong>{toPersianDigits(totalWithPosters)} نمایشگاه جاری</strong> از میان {toPersianDigits(galleries.length)} نگارخانه
            </span>

            {/* Scheduled Auto-Sync Status Badge */}
            <div className="hidden md:flex items-center gap-2 mr-3 pr-3 border-r border-[#A3C2E4]/40 dark:border-stone-700 text-[11px] text-stone-500 dark:text-stone-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>همگام‌سازی خودکار:</span>
              <span className="text-[#3D5B99] dark:text-[#A3C2E4] font-bold">
                چهارشنبه و پنجشنبه (هر ۲ ساعت) · جمعه (هر نیم‌ساعت)
              </span>
              <button
                onClick={handleManualSync}
                disabled={isTriggeringSync}
                title="همگام‌سازی دستی اکنون"
                className="p-1 hover:text-[#F76B1C] transition-colors rounded-md hover:bg-white/60 dark:hover:bg-stone-800"
              >
                <RotateCcw className={`w-3 h-3 ${isTriggeringSync ? 'animate-spin text-[#F76B1C]' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCuratedModalOpen(true)}
              className="clay-button clay-orange-subtle px-3 py-1 text-xs font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition-all text-[#F76B1C] shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>۴ گشت هنری آماده</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Web App View Switcher (Visible on screens < lg) */}
      <div className="lg:hidden sticky top-18 z-30 bg-[#f3f5f8]/95 dark:bg-[#12151e]/95 backdrop-blur-md px-4 py-2 border-b border-[#E1E1E1] dark:border-stone-800 flex items-center gap-2">
        <button
          onClick={() => setMobileActiveTab('catalog')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            mobileActiveTab === 'catalog'
              ? 'clay-darkblue text-white shadow-sm'
              : 'clay-base text-stone-600 dark:text-stone-300'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>فهرست نمایشگاه‌ها ({toPersianDigits(filteredGalleries.length)})</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('map')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            mobileActiveTab === 'map'
              ? 'clay-orange text-white shadow-sm'
              : 'clay-base text-stone-600 dark:text-stone-300'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>نقشه و مسیر ({toPersianDigits(selectedGalleries.length)})</span>
        </button>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Editorial Claymorphic Banner */}
        <section className="clay-card p-4 sm:p-6 bg-white dark:bg-[#181d27] border border-[#E1E1E1] dark:border-stone-800">
          <span className="text-[11px] font-bold text-[#F76B1C] block mb-1">
            برنامه‌ریزی تور گالری‌های هنری و نمایشگاه‌های جاری
          </span>
          <h1 className="text-xl sm:text-3xl font-bold text-[#1d2d4c] dark:text-white tracking-tight leading-snug">
            بهترین مسیر گالری‌گردی در تهران
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
            پوسترهای مربعی نمایشگاه‌ها، تاریخ افتتاحیه و نام هنرمندان را بررسی کرده و مقصدهای بازدید خود را انتخاب کنید تا کوتاه‌ترین مسیر با احتساب ترافیک تهران محاسبه شود.
          </p>

          {/* Quick Tour Presets */}
          <div className="mt-4 pt-3.5 border-t border-[#E1E1E1] dark:border-stone-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#1d2d4c] dark:text-stone-300 ml-1">
              تورهای آماده:
            </span>
            {PERSIAN_CURATED_TOURS.map((tour, idx) => {
              const theme = STICKDAZZLE_THEMES[idx % STICKDAZZLE_THEMES.length];
              return (
                <button
                  key={tour.id}
                  onClick={() => handleSelectCuratedTour(tour)}
                  className={`clay-button clay-${theme}-subtle text-xs px-3 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1 border border-[#E1E1E1] dark:border-stone-700`}
                >
                  <span>{tour.titleFa.split(' ')[0]} {tour.titleFa.split(' ')[1] || ''}</span>
                  <span className="opacity-70 text-[10px]">({toPersianDigits(tour.galleryIds.length)})</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* FULL-WIDTH IMMERSIVE MAP (Desktop, Tablet & Mobile) */}
        <section className={`w-full ${mobileActiveTab === 'catalog' ? 'hidden lg:block' : 'block'}`}>
          <div className="h-[420px] sm:h-[480px] lg:h-[530px] w-full rounded-2xl overflow-hidden border border-[#E1E1E1] dark:border-stone-800 shadow-md">
            <InteractiveMap
              galleries={galleries}
              selectedGalleries={selectedGalleries}
              routeResult={routeResult}
              onToggleGallery={handleToggleGallery}
              onSelectForDetails={(g) => setActiveModalGallery(g)}
              activeGalleryId={highlightedGalleryId}
              isDarkMode={isDarkMode}
            />
          </div>
        </section>

        {/* 2-COLUMN SECTION BELOW MAP: Catalog & Route Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* RIGHT COLUMN: Gallery Directory, Search & Cards (7 cols on lg in RTL) */}
          <section className={`lg:col-span-7 flex flex-col space-y-4 sm:space-y-5 ${mobileActiveTab === 'map' ? 'hidden lg:flex' : 'flex'}`}>
            {/* Filter & Search Toolbar */}
            <div className="clay-card p-3.5 sm:p-4.5 bg-white dark:bg-[#181d27] border border-[#E1E1E1] dark:border-stone-800 space-y-3">
              {/* Search input with clay inset */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#3D5B99] absolute right-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی نام هنرمند (مثلاً داریوش حسینی)، عنوان نمایشگاه، نگارخانه..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="clay-input w-full pr-11 pl-4 py-2.5 bg-[#f6f8fb] dark:bg-[#141822] text-xs placeholder:text-stone-400 focus:outline-none text-[#1d2d4c] dark:text-white transition-all font-medium border border-[#E1E1E1]/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#F76B1C] hover:text-[#de5508] font-bold"
                  >
                    پاک کردن
                  </button>
                )}
              </div>

              {/* View filter tabs: Posters Only vs All Galleries + Sort Option */}
              <div className="flex items-center justify-between gap-2.5 flex-wrap text-xs font-medium">
                {/* Segmented Control for Posters vs All */}
                <div className="flex items-center gap-1 p-1 bg-[#E1E1E1]/60 dark:bg-stone-800/80 rounded-2xl w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setFilterActivePostersOnly(true)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                      filterActivePostersOnly
                        ? 'clay-base text-[#F76B1C] shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>نمایشگاه‌های جاری ({toPersianDigits(totalWithPosters)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterActivePostersOnly(false)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                      !filterActivePostersOnly
                        ? 'clay-base text-[#3D5B99] shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>همه نگارخانه‌ها ({toPersianDigits(galleries.length)})</span>
                  </button>
                </div>

                {/* Sort & Neighborhood Controls with cohesive ClayDropdown */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {/* Sort selector */}
                  <ClayDropdown
                    value={sortBy}
                    onChange={(val) => setSortBy(val as 'latest' | 'name')}
                    options={[
                      { value: 'latest', label: 'جدیدترین رویدادها (پیش‌فرض)' },
                      { value: 'name', label: 'بر اساس نام نگارخانه' }
                    ]}
                    prefix={<ArrowUpDown className="w-3.5 h-3.5" />}
                    className="flex-1 sm:flex-none"
                  />

                  {/* Neighborhood Dropdown */}
                  <ClayDropdown
                    value={selectedNeighborhood}
                    onChange={(val) => setSelectedNeighborhood(val)}
                    options={[
                      { value: 'All', label: 'تمام محله‌ها' },
                      ...neighborhoods.map((neigh) => ({ value: neigh, label: neigh }))
                    ]}
                    prefix={<MapPin className="w-3.5 h-3.5" />}
                    className="flex-1 sm:flex-none"
                  />
                </div>
              </div>
            </div>

            {/* Catalog Header Info */}
            <div className="flex items-center justify-between text-xs text-[#3D5B99] dark:text-[#A3C2E4] px-1 font-bold">
              <span>
                نمایش <strong>{toPersianDigits(filteredGalleries.length)}</strong> نگارخانه
              </span>
              <span>
                <strong>{toPersianDigits(selectedGalleries.length)}</strong> گالری در برنامه بازدید شما
              </span>
            </div>

            {/* Gallery Cards Grid (with Square Posters and Compact Layouts) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredGalleries.map((gallery, idx) => (
                <GalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  isSelected={selectedGalleryIds.includes(gallery.id)}
                  orderNumber={galleryOrderMap.get(gallery.id)}
                  colorTheme={STICKDAZZLE_THEMES[idx % STICKDAZZLE_THEMES.length]}
                  onToggle={handleToggleGallery}
                  onSelectDetails={(g) => setActiveModalGallery(g)}
                />
              ))}
            </div>

            {filteredGalleries.length === 0 && (
              <div className="clay-card p-10 text-center bg-white dark:bg-[#181d27] text-stone-500 space-y-3 border border-[#E1E1E1]">
                <MapPin className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto stroke-1" />
                <p className="text-base font-bold text-stone-800 dark:text-stone-200">
                  هیچ گالری‌ای با این فیلتر یافت نشد
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedNeighborhood('All');
                    setFilterActivePostersOnly(false);
                  }}
                  className="clay-button clay-softblue px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 mt-2 text-[#10335e]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>نمایش همه نگارخانه‌ها</span>
                </button>
              </div>
            )}
          </section>

          {/* LEFT COLUMN: Route Summary Panel (5 cols on lg in RTL, sticky on desktop) */}
          <section className={`lg:col-span-5 flex flex-col space-y-4 sm:space-y-5 lg:sticky lg:top-24 ${mobileActiveTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
            {/* Route Summary Panel */}
            <div className="flex-1 flex flex-col min-h-[500px]">
              <RouteSummaryPanel
                routeResult={routeResult}
                selectedGalleries={selectedGalleries}
                isOptimizing={isOptimizing}
                onRemoveGallery={(id) =>
                  setSelectedGalleryIds((prev) => prev.filter((gid) => gid !== id))
                }
                onClearAll={() => setSelectedGalleryIds([])}
                onRecalculate={(m, rt, tc) => runRouteOptimization(m, rt, tc)}
                onSelectGallery={(g) => {
                  setHighlightedGalleryId(g.id);
                  setActiveModalGallery(g);
                }}
              />
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#e4ebf5] dark:bg-[#10141c] text-stone-600 dark:text-stone-400 border-t border-[#E1E1E1] dark:border-stone-800 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 mt-12 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#F76B1C]" />
            <span className="font-bold text-[#1d2d4c] dark:text-white text-sm">
              سامانه گالری‌گرد
            </span>
            <span className="text-stone-400">·</span>
            <span>مسیریاب هوشمند نگارخانه‌ها و رویدادهای هنرهای تجسمی تهران</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <GalleryDetailModal
        gallery={activeModalGallery}
        isSelected={activeModalGallery ? selectedGalleryIds.includes(activeModalGallery.id) : false}
        onClose={() => setActiveModalGallery(null)}
        onToggle={handleToggleGallery}
      />

      <CuratedToursModal
        isOpen={isCuratedModalOpen}
        onClose={() => setIsCuratedModalOpen(false)}
        onSelectTour={handleSelectCuratedTour}
        allGalleries={galleries}
      />
    </div>
  );
}
