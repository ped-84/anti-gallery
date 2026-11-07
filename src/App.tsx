import React, { useState, useMemo, useEffect } from 'react';
import { Gallery, RouteOptimizationResult, CustomOrigin } from './types/gallery';
import rawGalleriesData from './data/galleries.json';
import {
  PERSIAN_CURATED_TOURS,
  PersianCuratedTour,
  CuratedTourFilterMode,
  getCuratedToursByMode
} from './data/curatedTours';
import { optimizeGalleryRoute, calculateFixedRoute } from './utils/routeOptimizer';
import {
  toPersianDigits,
  TrafficCondition,
  getPersianNeighborhood,
  getGalleryDisplayName,
  parsePersianDateToScore,
  isThisWeekOpening
} from './utils/persianUtils';
import { Header } from './components/Header';
import { GalleryCard } from './components/GalleryCard';
import { InteractiveMap } from './components/InteractiveMap';
import { RouteSummaryPanel } from './components/RouteSummaryPanel';
import { GalleryDetailModal } from './components/GalleryDetailModal';
import { CuratedRouteRoadModal } from './components/CuratedRouteRoadModal';
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
  Compass,
  Flame,
  Building2
} from 'lucide-react';

const STICKDAZZLE_THEMES = ['darkblue', 'orange', 'softblue', 'gray'] as const;

const STORAGE_KEYS = {
  SELECTED_IDS: 'gallerygardi_selected_ids',
  START_ID: 'gallerygardi_start_id',
  END_ID: 'gallerygardi_end_id',
  ORDERED_IDS: 'gallerygardi_ordered_ids',
  DARK_MODE: 'gallerygardi_dark_mode',
  ORIGIN_LOCATION: 'gallerygardi_origin_location'
};

const LEGACY_DEFAULT_IDS = [1023, 485, 25, 182];

function isLegacyDefaultList(ids: any): boolean {
  if (!Array.isArray(ids) || ids.length !== 4) return false;
  return ids.every((id) => LEGACY_DEFAULT_IDS.includes(id));
}

export default function App() {
  // Filter for Tehran-only display per user instructions (non-Tehran preserved in DB for future expansion)
  const galleries = useMemo<Gallery[]>(() => {
    const tehranList = (rawGalleriesData as Gallery[]).filter((g) => {
      const city = (g.city || '').toLowerCase();
      const cityFa = g.cityFa || '';
      return city === 'tehran' || cityFa === 'تهران';
    });

    // Link sibling spaces / halls sharing the exact same physical building
    const mapKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const locGroups = new Map<string, Gallery[]>();
    tehranList.forEach((g) => {
      const key = mapKey(g.lat, g.lng);
      if (!locGroups.has(key)) locGroups.set(key, []);
      locGroups.get(key)!.push(g);
    });

    return tehranList.map((g): Gallery => {
      const key = mapKey(g.lat, g.lng);
      const coLocated = locGroups.get(key) || [];
      const siblings = coLocated.filter((s) => s.id !== g.id);
      return {
        ...g,
        siblingSpaces: siblings.length > 0 ? siblings : undefined
      };
    });
  }, []);

  // Restore user selected galleries or default to an empty itinerary
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_IDS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // If the stored selection is the legacy placeholder sample, purge it
          if (isLegacyDefaultList(parsed)) {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_IDS);
            localStorage.removeItem(STORAGE_KEYS.ORDERED_IDS);
            localStorage.removeItem(STORAGE_KEYS.START_ID);
            localStorage.removeItem(STORAGE_KEYS.END_ID);
            return [];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    // Clean slate: user starts with empty tour until they pick galleries
    return [];
  });

  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return false;
  });

  // Responsive mobile view tab ('catalog' vs 'map')
  const [mobileActiveTab, setMobileActiveTab] = useState<'catalog' | 'map'>('catalog');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');
  const [galleryFilterTab, setGalleryFilterTab] = useState<'this-week' | 'all-active' | 'all'>('this-week');
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
      try {
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(next));
      } catch {}
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

  const maxOpeningScore = useMemo(() => {
    const scores = galleries
      .map((g) => parsePersianDateToScore(g.activeExhibition?.openingDate))
      .filter((s) => s > 0);
    return scores.length > 0 ? Math.max(...scores) : 0;
  }, [galleries]);

  const totalThisWeek = useMemo(() => {
    return galleries.filter((g) => isThisWeekOpening(g.activeExhibition?.openingDate, maxOpeningScore)).length;
  }, [galleries, maxOpeningScore]);

  const [curatedTourMode, setCuratedTourMode] = useState<CuratedTourFilterMode>('openings-only');

  const currentCuratedTours = useMemo(() => {
    return getCuratedToursByMode(galleries, curatedTourMode);
  }, [galleries, curatedTourMode]);

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

      if (galleryFilterTab === 'this-week') {
        if (!isThisWeekOpening(gallery.activeExhibition?.openingDate, maxOpeningScore)) {
          return false;
        }
      } else if (galleryFilterTab === 'all-active') {
        if (!hasPoster) {
          return false;
        }
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
  }, [galleries, searchQuery, selectedNeighborhood, galleryFilterTab, maxOpeningScore, sortBy]);

  const [startGalleryId, setStartGalleryId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.START_ID);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [endGalleryId, setEndGalleryId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.END_ID);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [originLocation, setOriginLocation] = useState<CustomOrigin | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORIGIN_LOCATION);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);

  // Gentle geolocation attempt on mount if user hasn't chosen an origin yet
  useEffect(() => {
    if (!originLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newOrigin: CustomOrigin = {
            type: 'gps',
            name: 'موقعیت فعلی شما (GPS)',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setOriginLocation(newOrigin);
          try {
            localStorage.setItem(STORAGE_KEYS.ORIGIN_LOCATION, JSON.stringify(newOrigin));
          } catch {}
        },
        () => {
          // Silent fallback if user ignores or denies permission prompt
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 300000 }
      );
    }
  }, []);

  const handleRequestGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('مرورگر شما از دریافت موقعیت مکانی پشتیبانی نمی‌کند.');
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const newOrigin: CustomOrigin = {
          type: 'gps',
          name: 'موقعیت فعلی شما (GPS)',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setOriginLocation(newOrigin);
        try {
          localStorage.setItem(STORAGE_KEYS.ORIGIN_LOCATION, JSON.stringify(newOrigin));
        } catch {}
        runRouteOptimization(
          routeResult?.mode || 'driving',
          routeResult?.isRoundTrip ?? false,
          routeResult?.trafficCondition || 'peak',
          startGalleryId,
          endGalleryId,
          newOrigin
        );
      },
      (err) => {
        setIsLocatingGps(false);
        console.warn('Geolocation error:', err.message);
        alert('امکان دریافت خودکار موقعیت مکانی وجود نداشت. لطفاً دسترسی GPS را در تنظیمات مرورگر تأیید کنید یا محله خود را از منو انتخاب کنید.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleChangeOrigin = (origin: CustomOrigin | null) => {
    setOriginLocation(origin);
    try {
      if (origin) {
        localStorage.setItem(STORAGE_KEYS.ORIGIN_LOCATION, JSON.stringify(origin));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ORIGIN_LOCATION);
      }
    } catch {}
    runRouteOptimization(
      routeResult?.mode || 'driving',
      routeResult?.isRoundTrip ?? false,
      routeResult?.trafficCondition || 'peak',
      startGalleryId,
      endGalleryId,
      origin
    );
  };

  const runRouteOptimization = async (
    mode: 'driving' | 'walking' = routeResult?.mode || 'driving',
    isRoundTrip: boolean = routeResult?.isRoundTrip ?? false,
    trafficCondition: TrafficCondition = routeResult?.trafficCondition || 'peak',
    startId: number | null = startGalleryId,
    endId: number | null = endGalleryId,
    origin: CustomOrigin | null = originLocation
  ) => {
    const hasCustomStart = Boolean(origin && origin.lat !== 0);
    const minRequired = hasCustomStart ? 1 : 2;
    if (selectedGalleries.length < minRequired) {
      setRouteResult(null);
      return;
    }

    setIsOptimizing(true);
    try {
      const customStart = hasCustomStart && origin
        ? { name: origin.name, lat: origin.lat, lng: origin.lng }
        : undefined;

      const result = await optimizeGalleryRoute(selectedGalleries, {
        mode,
        isRoundTrip,
        trafficCondition,
        customStart,
        startGalleryId: customStart ? null : startId,
        endGalleryId: endId
      });
      setRouteResult(result);
    } catch (err: any) {
      console.error('Route optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_IDS, JSON.stringify(selectedGalleryIds));
    } catch {}
  }, [selectedGalleryIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.START_ID, JSON.stringify(startGalleryId));
    } catch {}
  }, [startGalleryId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.END_ID, JSON.stringify(endGalleryId));
    } catch {}
  }, [endGalleryId]);

  useEffect(() => {
    if (routeResult?.orderedGalleries && routeResult.orderedGalleries.length > 0) {
      try {
        const order = routeResult.orderedGalleries.map((g) => g.id);
        localStorage.setItem(STORAGE_KEYS.ORDERED_IDS, JSON.stringify(order));
      } catch {}
    } else if (selectedGalleryIds.length === 0) {
      try {
        localStorage.removeItem(STORAGE_KEYS.ORDERED_IDS);
      } catch {}
    }
  }, [routeResult, selectedGalleryIds]);

  // Restore saved itinerary order or calculate on mount
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }

    try {
      const savedOrdered = localStorage.getItem(STORAGE_KEYS.ORDERED_IDS);
      if (savedOrdered) {
        const orderedIds: number[] = JSON.parse(savedOrdered);
        const isValid =
          orderedIds.length === selectedGalleryIds.length &&
          orderedIds.every((id) => selectedGalleryIds.includes(id));

        if (isValid && orderedIds.length >= 1) {
          const matchingGalleries = orderedIds
            .map((id) => galleries.find((g) => g.id === id))
            .filter((g): g is Gallery => !!g);

          if (matchingGalleries.length === orderedIds.length) {
            calculateFixedRoute(matchingGalleries, {
              customStart: originLocation && originLocation.lat !== 0 ? { name: originLocation.name, lat: originLocation.lat, lng: originLocation.lng } : undefined
            }).then((res) => {
              setRouteResult(res);
            }).catch(() => {
              runRouteOptimization('driving', false, 'peak', startGalleryId, endGalleryId, originLocation);
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Restore order note:', e);
    }

    const hasCustomStart = Boolean(originLocation && originLocation.lat !== 0);
    const minRequired = hasCustomStart ? 1 : 2;
    if (selectedGalleries.length >= minRequired) {
      runRouteOptimization('driving', false, 'peak', startGalleryId, endGalleryId, originLocation);
    }
  }, []);

  const handleToggleGallery = (gallery: Gallery) => {
    const siblingIds = gallery.siblingSpaces?.map((s) => s.id) || [];
    const allVenueIds = [gallery.id, ...siblingIds];

    setSelectedGalleryIds((prev) => {
      const isAnySelected = prev.some((id) => allVenueIds.includes(id));
      if (isAnySelected) {
        if (startGalleryId && allVenueIds.includes(startGalleryId)) setStartGalleryId(null);
        if (endGalleryId && allVenueIds.includes(endGalleryId)) setEndGalleryId(null);
        return prev.filter((id) => !allVenueIds.includes(id));
      } else {
        return [...prev, gallery.id];
      }
    });
  };

  useEffect(() => {
    const hasCustomStart = Boolean(originLocation && originLocation.lat !== 0);
    const minRequired = hasCustomStart ? 1 : 2;
    if (selectedGalleries.length >= minRequired) {
      runRouteOptimization(
        routeResult?.mode || 'driving',
        routeResult?.isRoundTrip ?? false,
        routeResult?.trafficCondition || 'peak',
        startGalleryId,
        endGalleryId,
        originLocation
      );
    } else {
      setRouteResult(null);
    }
  }, [selectedGalleryIds, originLocation]);

  const handleSetStartGallery = (id: number) => {
    const venueGallery = galleries.find((g) => g.id === id);
    const siblingIds = venueGallery?.siblingSpaces?.map((s) => s.id) || [];
    const allVenueIds = [id, ...siblingIds];
    const matchingSelectedId = selectedGalleryIds.find((sid) => allVenueIds.includes(sid)) || id;

    setStartGalleryId(matchingSelectedId);
    if (endGalleryId === matchingSelectedId) setEndGalleryId(null);
    runRouteOptimization(
      routeResult?.mode || 'driving',
      routeResult?.isRoundTrip ?? false,
      routeResult?.trafficCondition || 'peak',
      matchingSelectedId,
      endGalleryId === matchingSelectedId ? null : endGalleryId,
      originLocation
    );
  };

  const handleSetEndGallery = (id: number) => {
    setEndGalleryId(id);
    if (startGalleryId === id) setStartGalleryId(null);
    runRouteOptimization(
      routeResult?.mode || 'driving',
      routeResult?.isRoundTrip ?? false,
      routeResult?.trafficCondition || 'peak',
      startGalleryId === id ? null : startGalleryId,
      id,
      originLocation
    );
  };

  const handleReverseRoute = async () => {
    if (!routeResult || routeResult.orderedGalleries.length < 2) return;
    const reversed = [...routeResult.orderedGalleries].reverse();
    setIsOptimizing(true);
    try {
      const newResult = await calculateFixedRoute(reversed, {
        mode: routeResult.mode,
        isRoundTrip: routeResult.isRoundTrip,
        trafficCondition: routeResult.trafficCondition,
        customStart: routeResult.originPoint
      });
      setRouteResult(newResult);
      setStartGalleryId(reversed[0].id);
      setEndGalleryId(reversed[reversed.length - 1].id);
    } catch (e) {
      console.warn('Reverse route note:', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleMoveStop = async (fromIdx: number, toIdx: number) => {
    if (!routeResult) return;
    const list = [...routeResult.orderedGalleries];
    if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);

    setIsOptimizing(true);
    try {
      const newResult = await calculateFixedRoute(list, {
        mode: routeResult.mode,
        isRoundTrip: routeResult.isRoundTrip,
        trafficCondition: routeResult.trafficCondition,
        customStart: routeResult.originPoint
      });
      setRouteResult(newResult);
      setStartGalleryId(list[0].id);
      setEndGalleryId(list[list.length - 1].id);
    } catch (e) {
      console.warn('Move stop note:', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleResetAutoOrder = () => {
    setStartGalleryId(null);
    setEndGalleryId(null);
    runRouteOptimization(
      routeResult?.mode || 'driving',
      routeResult?.isRoundTrip ?? false,
      routeResult?.trafficCondition || 'peak',
      null,
      null,
      originLocation
    );
  };

  const handleClearAll = () => {
    setSelectedGalleryIds([]);
    setStartGalleryId(null);
    setEndGalleryId(null);
    setRouteResult(null);
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_IDS, JSON.stringify([]));
      localStorage.removeItem(STORAGE_KEYS.ORDERED_IDS);
      localStorage.removeItem(STORAGE_KEYS.START_ID);
      localStorage.removeItem(STORAGE_KEYS.END_ID);
    } catch {}
  };

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
        hasCustomOrigin={Boolean(originLocation && originLocation.lat !== 0)}
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
      <div className="bg-[#e4ebf5] dark:bg-[#161a24] text-stone-700 dark:text-stone-300 text-xs py-2.5 border-b border-[#E1E1E1] dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 font-medium">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F76B1C] inline-block shadow-sm shrink-0"></span>
            <span className="text-xs">
              <strong>{toPersianDigits(totalWithPosters)} نمایشگاه جاری</strong> از میان {toPersianDigits(galleries.length)} نگارخانه
            </span>
          </div>

          <div className="flex items-center shrink-0">
            <button
              onClick={() => setIsCuratedModalOpen(true)}
              className="clay-button clay-orange-subtle px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all text-[#F76B1C] shrink-0 shadow-xs"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
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
            {/* Mode Switcher Pill */}
            <div className="flex items-center p-0.5 rounded-xl bg-stone-200/80 dark:bg-stone-800/80 text-[11px] font-bold shrink-0 ml-1">
              <button
                type="button"
                onClick={() => setCuratedTourMode('openings-only')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  curatedTourMode === 'openings-only'
                    ? 'bg-white dark:bg-[#1f2636] text-[#F76B1C] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="فقط تورهای گالری‌هایی که این هفته افتتاحیه دارند"
              >
                <Flame className="w-3 h-3 text-[#F76B1C]" />
                <span>فقط افتتاحیه</span>
              </button>
              <button
                type="button"
                onClick={() => setCuratedTourMode('all-active')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  curatedTourMode === 'all-active'
                    ? 'bg-white dark:bg-[#1f2636] text-[#1856C7] dark:text-[#93c5fd] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="همه گالری‌های باز و فعالِ پیوسته در مسیر"
              >
                <Sparkles className="w-3 h-3 text-[#1856C7] dark:text-[#93c5fd]" />
                <span>همه فعال و باز</span>
              </button>
            </div>

            <span className="text-stone-300 dark:text-stone-700 hidden sm:inline">|</span>

            {/* Tour buttons for current mode */}
            {currentCuratedTours.map((tour, idx) => {
              const theme = STICKDAZZLE_THEMES[idx % STICKDAZZLE_THEMES.length];
              return (
                <button
                  key={tour.id}
                  onClick={() => handleSelectCuratedTour(tour)}
                  className={`clay-button clay-${theme}-subtle text-xs px-2.5 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1 border border-[#E1E1E1] dark:border-stone-700`}
                  title={`${tour.titleFa} (${toPersianDigits(tour.galleryIds.length)} گالری - فاصله ایستگاه‌ها زیر ${toPersianDigits(tour.maxHopKm || 1.5)} کم)`}
                >
                  <span>{tour.titleFa.replace('گذر افتتاحیه‌های ', '').replace('مدار افتتاحیه‌های ', '').replace('مسیر هنری ', '').replace('گشت افتتاحیه‌های ', '').replace('محور افتتاحیه‌های ', '').replace('گذر هنر ', '').replace('محور هنر ', '').replace('محور ', '').replace('گشت طلایی ', '').replace('مدار هنری ', '').replace('مسیر تاریخی ', '').replace('مثلث ', '')}</span>
                  <span className="opacity-70 text-[10px] font-mono">({toPersianDigits(tour.galleryIds.length)})</span>
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
              onSetStartGallery={handleSetStartGallery}
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

              {/* View filter tabs & Controls (Authentic Claymorphic Segmented Control) */}
              <div className="space-y-2.5 w-full">
                {/* 1. Sleek Claymorphic Segmented Control: 3 tabs on one line, no scroll, authentic Clay style */}
                <div className="clay-card p-1.5 flex items-center gap-1.5 bg-[#f0f3f8] dark:bg-stone-900 rounded-2xl w-full border border-[#E1E1E1] dark:border-stone-800 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setGalleryFilterTab('this-week')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm text-center ${
                      galleryFilterTab === 'this-week'
                        ? 'clay-button clay-base text-[#F76B1C] shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${galleryFilterTab === 'this-week' ? 'text-[#F76B1C]' : 'text-amber-500'}`} />
                    <span className="hidden sm:inline">افتتاحیه‌های این هفته</span>
                    <span className="sm:hidden">این هفته</span>
                    <span className="text-[11px] font-mono opacity-85">({toPersianDigits(totalThisWeek)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryFilterTab('all-active')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm text-center ${
                      galleryFilterTab === 'all-active'
                        ? 'clay-button clay-base text-[#3D5B99] dark:text-[#A3C2E4] shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden sm:inline">نمایشگاه‌های جاری</span>
                    <span className="sm:hidden">جاری</span>
                    <span className="text-[11px] font-mono opacity-85">({toPersianDigits(totalWithPosters)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryFilterTab('all')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm text-center ${
                      galleryFilterTab === 'all'
                        ? 'clay-button clay-base text-[#3D5B99] dark:text-[#A3C2E4] shadow-sm'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden sm:inline">همه نگارخانه‌ها</span>
                    <span className="sm:hidden">همه</span>
                    <span className="text-[11px] font-mono opacity-85">({toPersianDigits(galleries.length)})</span>
                  </button>
                </div>

                {/* 2. Sort & Neighborhood Dropdowns Underneath (Taller, spacious, full-width grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  {/* Sort selector */}
                  <ClayDropdown
                    value={sortBy}
                    onChange={(val) => setSortBy(val as 'latest' | 'name')}
                    options={[
                      { value: 'latest', label: 'ترتیب: جدیدترین رویدادها (پیش‌فرض)' },
                      { value: 'name', label: 'ترتیب: بر اساس نام نگارخانه' }
                    ]}
                    prefix={<ArrowUpDown className="w-4 h-4" />}
                    className="w-full"
                  />

                  {/* Neighborhood Dropdown */}
                  <ClayDropdown
                    value={selectedNeighborhood}
                    onChange={(val) => setSelectedNeighborhood(val)}
                    options={[
                      { value: 'All', label: 'محدوده: تمام محله‌های تهران' },
                      ...neighborhoods.map((neigh) => ({ value: neigh, label: neigh }))
                    ]}
                    prefix={<MapPin className="w-4 h-4" />}
                    className="w-full"
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
                  isOpeningThisWeek={isThisWeekOpening(gallery.activeExhibition?.openingDate, maxOpeningScore)}
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
                    setGalleryFilterTab('all');
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
                onRemoveGallery={(id) => {
                  if (startGalleryId === id) setStartGalleryId(null);
                  if (endGalleryId === id) setEndGalleryId(null);
                  setSelectedGalleryIds((prev) => prev.filter((gid) => gid !== id));
                }}
                onClearAll={handleClearAll}
                onRecalculate={(m, rt, tc, o) =>
                  runRouteOptimization(
                    m,
                    rt,
                    tc,
                    startGalleryId,
                    endGalleryId,
                    o !== undefined ? o : originLocation
                  )
                }
                onSelectGallery={(g) => {
                  setHighlightedGalleryId(g.id);
                  setActiveModalGallery(g);
                }}
                onSetStartGallery={handleSetStartGallery}
                onSetEndGallery={handleSetEndGallery}
                onMoveStop={handleMoveStop}
                onReverseRoute={handleReverseRoute}
                onResetAutoOrder={handleResetAutoOrder}
                startGalleryId={startGalleryId}
                endGalleryId={endGalleryId}
                originLocation={originLocation}
                onChangeOrigin={handleChangeOrigin}
                onRequestGps={handleRequestGps}
                isLocatingGps={isLocatingGps}
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
              سامانه گالری‌گردی
            </span>
            <span className="text-stone-400">·</span>
            <span>مسیریاب هوشمند نگارخانه‌ها و رویدادهای هنرهای تجسمی تهران</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <GalleryDetailModal
        gallery={activeModalGallery}
        isSelected={
          activeModalGallery
            ? selectedGalleryIds.some(
                (id) =>
                  id === activeModalGallery.id ||
                  (activeModalGallery.siblingSpaces?.some((s) => s.id === id) ?? false)
              )
            : false
        }
        selectedGalleryIds={selectedGalleryIds}
        isStartGallery={
          activeModalGallery
            ? startGalleryId === activeModalGallery.id ||
              (activeModalGallery.siblingSpaces?.some((s) => s.id === startGalleryId) ?? false)
            : false
        }
        onClose={() => setActiveModalGallery(null)}
        onToggle={handleToggleGallery}
        onSetStart={handleSetStartGallery}
      />

      <CuratedRouteRoadModal
        isOpen={isCuratedModalOpen}
        onClose={() => setIsCuratedModalOpen(false)}
        onSelectRoute={(ids) => {
          setSelectedGalleryIds(ids);
          setStartGalleryId(ids[0] || null);
          setEndGalleryId(ids[ids.length - 1] || null);
          setMobileActiveTab('map');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectGalleryDetails={(g) => setActiveModalGallery(g)}
        allGalleries={galleries}
      />
    </div>
  );
}
