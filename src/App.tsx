import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Header, APP_VERSION } from './components/Header';
import { GalleryCard } from './components/GalleryCard';
import { InteractiveMap } from './components/InteractiveMap';
import { RouteSummaryPanel } from './components/RouteSummaryPanel';
import { GalleryDetailModal } from './components/GalleryDetailModal';
import { CuratedRouteRoadModal } from './components/CuratedRouteRoadModal';
import { AdminModal } from './components/AdminModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { getTourColorTheme } from './utils/roadLayout';
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
  Building2,
  Navigation
} from 'lucide-react';

const STICKDAZZLE_THEMES = ['darkblue', 'orange', 'softblue', 'gray'] as const;

const STORAGE_KEYS = {
  SELECTED_IDS: 'gallerygardi_selected_ids',
  START_ID: 'gallerygardi_start_id',
  END_ID: 'gallerygardi_end_id',
  ORDERED_IDS: 'gallerygardi_ordered_ids',
  DARK_MODE: 'gallerygardi_dark_mode',
  ORIGIN_LOCATION: 'gallerygardi_origin_location',
  ACTIVE_MODAL_ID: 'artgasht_active_modal_id',
  MOBILE_TAB: 'artgasht_mobile_active_tab'
};

const LEGACY_DEFAULT_IDS = [1023, 485, 25, 182];

function isLegacyDefaultList(ids: any): boolean {
  if (!Array.isArray(ids) || ids.length !== 4) return false;
  return ids.every((id) => LEGACY_DEFAULT_IDS.includes(id));
}

export default function App() {
  // All galleries in database (seeded from bundled rawGalleriesData, synced dynamically with server)
  const [allGalleries, setAllGalleries] = useState<Gallery[]>(() => rawGalleriesData as Gallery[]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState<{
    serverRole?: string;
    adminEnabled?: boolean;
    isStandalone?: boolean;
    neshanKey?: string;
  }>({
    serverRole: 'primary',
    adminEnabled: true,
    isStandalone: false
  });

  // Sync dynamic galleries and config from backend server
  useEffect(() => {
    // 1. Fetch domain-specific Neshan Web Key & app metadata
    fetch('/api/config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg) {
          setServerConfig(cfg);
          if (typeof window !== 'undefined') {
            (window as any).__ARTGASHT_CONFIG__ = cfg;
          }
        }
      })
      .catch(() => {});

    // 2. Fetch fresh galleries from server database (if server is running)
    fetch('/api/galleries')
      .then((res) => {
        if (!res.ok) throw new Error('Server API unavailable');
        return res.json();
      })
      .then((freshList: Gallery[]) => {
        if (Array.isArray(freshList) && freshList.length > 0) {
          setAllGalleries(freshList);
        }
      })
      .catch(() => {
        // Graceful offline fallback: already seeded with bundled rawGalleriesData
      });
  }, []);

  // Listen for hidden admin route (#/admin, #admin, /admin, ?admin=1)
  useEffect(() => {
    const checkAdminTrigger = () => {
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const search = window.location.search;
      const isAdminRoute =
        hash === '#/admin' ||
        hash === '#admin' ||
        pathname === '/admin' ||
        pathname.endsWith('/admin') ||
        search.includes('admin=1');

      if (isAdminRoute) {
        // Respect ADMIN_ENABLED: when false (e.g. Iran mirror), show nothing special (home page)
        if (serverConfig.adminEnabled === false) {
          setIsAdminOpen(false);
          return;
        }
        setIsAdminOpen(true);
      }
    };
    checkAdminTrigger();
    window.addEventListener('hashchange', checkAdminTrigger);
    window.addEventListener('popstate', checkAdminTrigger);
    return () => {
      window.removeEventListener('hashchange', checkAdminTrigger);
      window.removeEventListener('popstate', checkAdminTrigger);
    };
  }, [serverConfig.adminEnabled]);

  // Protect admin route from search engine indexing
  useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]');
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    const isAdminRoute =
      hash === '#/admin' ||
      hash === '#admin' ||
      pathname === '/admin' ||
      pathname.endsWith('/admin') ||
      isAdminOpen;

    if (isAdminRoute) {
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow, noarchive');
    } else if (metaRobots) {
      metaRobots.setAttribute('content', 'index, follow');
    }
  }, [isAdminOpen]);

  // Filter for Tehran-only display per user instructions (non-Tehran preserved in DB for future expansion)
  const galleries = useMemo<Gallery[]>(() => {
    const tehranList = allGalleries.filter((g) => {
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
  }, [allGalleries]);

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

  // Responsive mobile view tab ('catalog' vs 'map') - Persisted across app switches
  const [mobileActiveTabState, setMobileActiveTabState] = useState<'catalog' | 'map'>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEYS.MOBILE_TAB);
      if (saved === 'catalog' || saved === 'map') return saved;
    } catch {}
    return 'catalog';
  });

  const setMobileActiveTab = useCallback((tab: 'catalog' | 'map') => {
    setMobileActiveTabState(tab);
    try {
      sessionStorage.setItem(STORAGE_KEYS.MOBILE_TAB, tab);
    } catch {}
  }, []);

  const mobileActiveTab = mobileActiveTabState;

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');
  const [galleryFilterTab, setGalleryFilterTab] = useState<'this-week' | 'all-active' | 'all'>('this-week');
  const [sortBy, setSortBy] = useState<'latest' | 'name'>('latest');

  // Modals (Persist active gallery ID so app switching on mobile never loses modal state)
  const [activeModalGalleryState, setActiveModalGalleryState] = useState<Gallery | null>(() => {
    try {
      const savedId = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_MODAL_ID);
      if (savedId) {
        const idNum = parseInt(savedId, 10);
        const found = galleries.find((g) => g.id === idNum);
        if (found) return found;
      }
    } catch {}
    return null;
  });

  const setActiveModalGallery = useCallback((gallery: Gallery | null) => {
    setActiveModalGalleryState(gallery);
    try {
      if (gallery) {
        sessionStorage.setItem(STORAGE_KEYS.ACTIVE_MODAL_ID, String(gallery.id));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_MODAL_ID);
      }
    } catch {}
  }, []);

  const activeModalGallery = activeModalGalleryState;
  const [isCuratedModalOpen, setIsCuratedModalOpen] = useState<boolean>(false);
  const [highlightedGalleryId, setHighlightedGalleryId] = useState<number | null>(null);
  const [activeCuratedRouteId, setActiveCuratedRouteId] = useState<string | null>(null);
  const [pwaInstallTrigger, setPwaInstallTrigger] = useState<number>(0);

  // Check if running in standalone mode (already installed PWA)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);

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
      try {
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sync dark class and mobile browser status/navigation bar theme-color
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDarkMode ? '#131722' : '#f4f6fa');
    }
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
    const theme = getTourColorTheme(tour.id + ' ' + tour.titleFa + ' ' + tour.neighborhoodFa);
    setActiveCuratedRouteId(theme.routeId);
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

  const hasCustomOrigin = Boolean(originLocation && originLocation.lat !== 0);
  const minRequired = hasCustomOrigin ? 1 : 2;
  const canOptimize = selectedGalleries.length >= minRequired;

  return (
    <div className="min-h-screen bg-[#f3f5f8] dark:bg-[#12151e] text-stone-800 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden">
      {/* Top Bar (Claymorphic with Stickdazzle Palette, Fully Responsive) */}
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onTriggerInstall={() => setPwaInstallTrigger((prev) => prev + 1)}
        isStandalone={isStandalone}
      />

      {/* Operational Ribbon */}
      <div className="bg-[#e4ebf5] dark:bg-[#161a24] text-stone-700 dark:text-stone-300 py-2.5 sm:py-3 border-b border-[#E1E1E1] dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 font-medium">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#F76B1C] inline-block shadow-sm shrink-0"></span>
            <span className="text-sm sm:text-base font-medium">
              <strong>{toPersianDigits(totalWithPosters)} نمایشگاه جاری</strong> از میان {toPersianDigits(galleries.length)} نگارخانه فعال در تهران
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Dedicated Curated Tours Claymorphic Spotlight Card */}
        <section className="clay-card p-4 sm:p-5.5 bg-gradient-to-r from-white via-[#fcfdff] to-[#f4f7fb] dark:from-[#181d27] dark:via-[#1c2331] dark:to-[#141924] border border-[#E1E1E1] dark:border-stone-800 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl clay-button clay-orange flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[#1c2944] dark:text-white tracking-tight">
                    گشت‌های آماده آرت‌گشت
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-full bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 leading-snug">
                    مسیرهای پیشنهادی تهران
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                  مسیرهای منتخب و پیوسته برای گالری‌گردی بهینه با کمترین زمان و فاصله در محله‌های هنری تهران همراه با کروکی و راهنمای گام‌به‌گام
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCuratedModalOpen(true)}
              className="clay-button clay-orange text-white px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-bold flex items-center justify-center gap-2 rounded-2xl shadow-md hover:brightness-105 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer w-full sm:w-auto"
              title="مشاهده نقشه و مسیرهای پیشنهادی گشت‌های آماده"
            >
              <Sparkles className="w-4 h-4 text-white stroke-[2.2] shrink-0" />
              <span>گشت‌های آماده</span>
            </button>
          </div>
        </section>

        {/* Editorial Claymorphic Banner */}
        <section className="clay-card p-4 sm:p-6 bg-white dark:bg-[#181d27] border border-[#E1E1E1] dark:border-stone-800">
          <span className="text-sm sm:text-base font-bold text-[#F76B1C] block mb-1">
            برنامه‌ریزی بازدید از گالری‌های هنری و نمایشگاه‌های جاری
          </span>
          <h1 className="text-xl sm:text-3xl font-bold text-[#1d2d4c] dark:text-white tracking-tight leading-snug">
            بهترین مسیر آرت‌گشت در تهران
          </h1>
          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
            گالری‌های مورد نظر خود را انتخاب کنید تا بهترین مسیر با احتساب ترافیک تهران به شما پیشنهاد شود.
          </p>

          {/* Quick Tour Presets */}
          <div className="mt-4 pt-3.5 border-t border-[#E1E1E1] dark:border-stone-800 flex items-center gap-2 flex-wrap">
            {/* Mode Switcher Pill */}
            <div className="flex items-center p-0.5 rounded-xl bg-stone-200/80 dark:bg-stone-800/80 text-xs sm:text-[13px] font-bold shrink-0 ml-1">
              <button
                type="button"
                onClick={() => setCuratedTourMode('openings-only')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  curatedTourMode === 'openings-only'
                    ? 'bg-white dark:bg-[#1f2636] text-[#F76B1C] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="فقط تورهای گالری‌هایی که این هفته افتتاحیه دارند"
              >
                <Flame className="w-3.5 h-3.5 text-[#F76B1C]" />
                <span>فقط افتتاحیه</span>
              </button>
              <button
                type="button"
                onClick={() => setCuratedTourMode('all-active')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
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
            {currentCuratedTours.map((tour) => {
              const theme = getTourColorTheme(tour.id + ' ' + tour.titleFa + ' ' + tour.neighborhoodFa);
              const isSelected =
                tour.galleryIds.length > 0 &&
                tour.galleryIds.length === selectedGalleryIds.length &&
                tour.galleryIds.every((id) => selectedGalleryIds.includes(id));

              return (
                <button
                  key={tour.id}
                  type="button"
                  onClick={() => handleSelectCuratedTour(tour)}
                  style={
                    isSelected
                      ? {
                          backgroundColor: theme.activeBg,
                          color: theme.activeText,
                          borderColor: theme.activeBorder,
                          boxShadow: `0 4px 14px -2px ${theme.activeGlow}`
                        }
                      : isDarkMode
                      ? {
                          backgroundColor: theme.bgDark,
                          color: theme.textDark,
                          borderColor: theme.borderDark
                        }
                      : {
                          backgroundColor: theme.bg,
                          color: theme.text,
                          borderColor: theme.border
                        }
                  }
                  className="clay-button text-xs sm:text-sm px-3.5 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 rounded-full border outline-none focus:outline-none cursor-pointer"
                  title={`${tour.titleFa} (${toPersianDigits(tour.galleryIds.length)} گالری - فاصله ایستگاه‌ها زیر ${toPersianDigits(tour.maxHopKm || 1.5)} کم)`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 transition-transform"
                    style={{
                      backgroundColor: isSelected ? theme.activeDot : theme.dot
                    }}
                  />
                  <span>
                    {tour.titleFa
                      .replace('معاصر کریم‌خان', 'کریم‌خان')
                      .replace('موزه معاصر و پارک لاله', 'پارک لاله و کشاورز')
                      .replace('گذر افتتاحیه‌های ', '')
                      .replace('مدار افتتاحیه‌های ', '')
                      .replace('مسیر هنری ', '')
                      .replace('گشت افتتاحیه‌های ', '')
                      .replace('محور افتتاحیه‌های ', '')
                      .replace('گذر هنر ', '')
                      .replace('محور هنر ', '')
                      .replace('محور ', '')
                      .replace('گشت طلایی ', '')
                      .replace('مدار هنری ', '')
                      .replace('مسیر تاریخی ', '')
                      .replace('مثلث ', '')}
                  </span>
                  <span
                    className="text-xs font-bold font-sans"
                    style={{ opacity: isSelected ? 0.9 : 0.7 }}
                  >
                    <bdi>({toPersianDigits(tour.galleryIds.length)})</bdi>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mobile Web App View Switcher (Visible on screens < lg, sticky) */}
        <div className="lg:hidden sticky top-16 sm:top-18 md:top-20 z-30 bg-[#f3f5f8]/95 dark:bg-[#12151e]/95 backdrop-blur-md px-3 py-2 border-y border-[#E1E1E1] dark:border-stone-800 flex items-center gap-2 rounded-2xl shadow-xs">
          <button
            onClick={() => setMobileActiveTab('catalog')}
            className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              mobileActiveTab === 'catalog'
                ? 'clay-darkblue text-white shadow-sm'
                : 'clay-base text-stone-600 dark:text-stone-300'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>فهرست نمایشگاه‌ها <bdi>({toPersianDigits(filteredGalleries.length)})</bdi></span>
          </button>
          <button
            onClick={() => setMobileActiveTab('map')}
            className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              mobileActiveTab === 'map'
                ? 'clay-orange text-white shadow-sm'
                : 'clay-base text-stone-600 dark:text-stone-300'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>نقشه و مسیر <bdi>({toPersianDigits(selectedGalleries.length)})</bdi></span>
          </button>
        </div>

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
                <Search className="w-5 h-5 text-[#3D5B99] absolute right-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی نام هنرمند (مثلاً داریوش حسینی)، عنوان نمایشگاه، نگارخانه..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="clay-input w-full pr-12 pl-4 py-3 bg-[#f6f8fb] dark:bg-[#141822] text-sm sm:text-base placeholder:text-stone-400 focus:outline-none text-[#1d2d4c] dark:text-white transition-all font-medium border border-[#E1E1E1]/50 rounded-2xl"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#F76B1C] hover:text-[#de5508] font-bold"
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
                    <Flame className={`w-4 h-4 shrink-0 ${galleryFilterTab === 'this-week' ? 'text-[#F76B1C]' : 'text-amber-500'}`} />
                    <span className="hidden sm:inline">افتتاحیه‌های این هفته</span>
                    <span className="sm:hidden">این هفته</span>
                    <span className="text-xs sm:text-sm font-bold font-sans opacity-90"><bdi>({toPersianDigits(totalThisWeek)})</bdi></span>
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
                    <Palette className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">نمایشگاه‌های جاری</span>
                    <span className="sm:hidden">جاری</span>
                    <span className="text-xs sm:text-sm font-bold font-sans opacity-90"><bdi>({toPersianDigits(totalWithPosters)})</bdi></span>
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
                    <Grid className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">همه نگارخانه‌ها</span>
                    <span className="sm:hidden">همه</span>
                    <span className="text-xs sm:text-sm font-bold font-sans opacity-90"><bdi>({toPersianDigits(galleries.length)})</bdi></span>
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
            <div className="flex items-center justify-between text-sm sm:text-base text-[#3D5B99] dark:text-[#A3C2E4] px-1 font-bold">
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

        {/* Floating Route Optimization Bar (Bottom-center, thumb-friendly, replaces header button) */}
        <aside aria-label="نوار مسیریابی سریع" className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)] sm:w-auto transition-all duration-300">
          <div className="clay-card bg-white/95 dark:bg-[#181d27]/95 backdrop-blur-md border border-[#E1E1E1] dark:border-stone-800 p-2 sm:p-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2 px-1 sm:px-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                  canOptimize ? 'bg-[#F76B1C] animate-pulse' : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
              <span className="text-xs sm:text-sm font-bold text-[#1c2944] dark:text-stone-200 truncate">
                {selectedGalleries.length === 0
                  ? `انتخاب حداقل ${toPersianDigits(minRequired)} گالری`
                  : `${toPersianDigits(selectedGalleries.length)} گالری در مسیر`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedGalleries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="پاک کردن انتخاب‌ها"
                  className="clay-button clay-base p-2 text-stone-500 hover:text-rose-500 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  runRouteOptimization();
                  setMobileActiveTab('map');
                }}
                disabled={!canOptimize || isOptimizing}
                className={`clay-button px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 rounded-xl transition-all cursor-pointer ${
                  canOptimize
                    ? 'clay-orange text-white shadow-md hover:brightness-105 active:scale-95'
                    : 'clay-base text-stone-400 dark:text-stone-600 cursor-not-allowed opacity-75'
                }`}
              >
                <Navigation
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] ${
                    isOptimizing ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {isOptimizing
                    ? 'محاسبه مسیر...'
                    : canOptimize
                    ? `مسیریابی بهینه (${toPersianDigits(selectedGalleries.length)})`
                    : `حداقل ${toPersianDigits(minRequired)} گالری`}
                </span>
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer (with version badge migrated from header) */}
      <footer className="bg-[#e4ebf5] dark:bg-[#10141c] text-stone-600 dark:text-stone-400 border-t border-[#E1E1E1] dark:border-stone-800 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 mt-12 pb-24 sm:pb-8 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <Compass className="w-4 h-4 text-[#F76B1C]" />
            <span className="font-bold text-[#1d2d4c] dark:text-white text-sm">
              سامانه آرت‌گشت
            </span>
            <span className="text-stone-400">·</span>
            <span>مسیریاب هوشمند نگارخانه‌ها و رویدادهای هنرهای تجسمی تهران</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#F76B1C]/15 text-[#F76B1C] border border-[#F76B1C]/30 leading-snug font-ubuntu shadow-xs">
              {APP_VERSION}
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
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
        initialRouteId={activeCuratedRouteId}
      />

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

      {/* Admin Panel Modal (Hidden Route, Password Protected, Zero-rebuild DB edits) */}
      <AdminModal
        isOpen={isAdminOpen && serverConfig.adminEnabled !== false}
        onClose={() => {
          setIsAdminOpen(false);
          if (window.location.hash === '#/admin' || window.location.hash === '#admin') {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        galleries={allGalleries}
        onGalleriesUpdated={setAllGalleries}
        isDarkMode={isDarkMode}
        adminEnabled={serverConfig.adminEnabled}
        serverRole={serverConfig.serverRole}
        isStandalone={serverConfig.isStandalone}
      />

      {/* PWA Installation Prompt (Android / iOS / Desktop) */}
      <PwaInstallPrompt externalTrigger={pwaInstallTrigger} />

    </div>
  );
}
