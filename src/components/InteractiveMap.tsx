import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Gallery, RouteOptimizationResult } from '../types/gallery';
import { toPersianDigits, getGalleryDisplayName } from '../utils/persianUtils';
import { Navigation, Layers, Compass, Check } from 'lucide-react';

interface InteractiveMapProps {
  galleries: Gallery[];
  selectedGalleries: Gallery[];
  routeResult: RouteOptimizationResult | null;
  onToggleGallery: (gallery: Gallery) => void;
  onSelectForDetails?: (gallery: Gallery) => void;
  activeGalleryId?: number | null;
  isDarkMode?: boolean;
}

// Snapp & Tap30 navigation-style crisp raster tiles with detailed Persian street & alley names
const TILE_LAYERS: Record<string, { name: string; url: string; className: string; attribution: string; maxZoom: number }> = {
  snapp: {
    name: 'طرح اسنپ و تپسی (مسیریابی ملایم و خوانا)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    className: 'snapp-map-tile',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  osm: {
    name: 'نقشه استاندارد شهری (رنگ‌های اصلی)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    className: '',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  esriLight: {
    name: 'نقشه مینیمال تک‌رنگ',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    className: '',
    attribution: '&copy; Esri',
    maxZoom: 16
  }
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  galleries,
  selectedGalleries,
  routeResult,
  onToggleGallery,
  onSelectForDetails,
  activeGalleryId,
  isDarkMode = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeBorderLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerInstanceRef = useRef<L.TileLayer | null>(null);

  // Default to Snapp / Tap30 navigation aesthetic (muted, elegant, clear Persian street names)
  const [currentTileKey, setCurrentTileKey] = useState<keyof typeof TILE_LAYERS>('snapp');
  const [showTilePicker, setShowTilePicker] = useState(false);

  // Initialize Map with sharp high-zoom Leaflet configuration
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [35.73, 51.42],
      zoom: 13,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const config = TILE_LAYERS[currentTileKey];
    const tiles = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: 19,
      className: config.className || ''
    }).addTo(map);

    tileLayerInstanceRef.current = tiles;
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerInstanceRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerInstanceRef.current);
    }
    const config = TILE_LAYERS[currentTileKey];
    tileLayerInstanceRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxZoom === 16 ? 16 : 19,
      className: config.className || ''
    }).addTo(mapInstanceRef.current);
  }, [currentTileKey]);

  // Update Markers & Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (routeBorderLayerRef.current) {
      map.removeLayer(routeBorderLayerRef.current);
      routeBorderLayerRef.current = null;
    }

    const selectedIds = new Set(selectedGalleries.map((g) => g.id));
    const orderedIds = routeResult ? routeResult.orderedGalleries.map((g) => g.id) : [];
    const orderIndexMap = new Map<number, number>();
    orderedIds.forEach((id, idx) => orderIndexMap.set(id, idx + 1));

    const bounds = L.latLngBounds([]);

    // 1. Draw Route Polyline
    if (routeResult && routeResult.geometryCoords.length > 0) {
      const latLngs = routeResult.geometryCoords.map((c) => L.latLng(c[0], c[1]));

      const casing = L.polyline(latLngs, {
        color: '#1e335a',
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      routeBorderLayerRef.current = casing;

      const line = L.polyline(latLngs, {
        color: '#F76B1C',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: routeResult.mode === 'walking' ? '8, 8' : undefined
      }).addTo(map);
      routeLayerRef.current = line;

      latLngs.forEach((ll) => bounds.extend(ll));
    }

    // 2. Render Markers
    galleries.forEach((gallery) => {
      const isSelected = selectedIds.has(gallery.id);
      const orderNum = orderIndexMap.get(gallery.id);
      const isFocused = activeGalleryId === gallery.id;

      let iconHtml = '';
      let iconSize: [number, number] = [28, 28];
      let iconAnchor: [number, number] = [14, 14];

      if (orderNum !== undefined) {
        const isFirst = orderNum === 1;
        const isLast = orderNum === orderedIds.length && !routeResult?.isRoundTrip;
        const bgClass = isFirst
          ? 'bg-[#3D5B99] text-white border-2 border-white'
          : isLast
          ? 'bg-[#F76B1C] text-white border-2 border-white'
          : 'bg-[#1e335a] text-white border-2 border-[#A3C2E4]';

        iconSize = [34, 34];
        iconAnchor = [17, 17];
        iconHtml = `
          <div class="custom-tour-pin ${bgClass} w-[34px] h-[34px] text-xs font-bold shadow-lg">
            ${toPersianDigits(orderNum)}
          </div>
        `;
      } else if (isSelected) {
        iconSize = [30, 30];
        iconAnchor = [15, 15];
        iconHtml = `
          <div class="custom-tour-pin bg-[#3D5B99] text-white border-2 border-white w-[30px] h-[30px] flex items-center justify-center shadow-md">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        `;
      } else {
        const hasExhibition = gallery.activeExhibition || (gallery.exhibitions && gallery.exhibitions.length > 0);
        iconSize = isFocused ? [26, 26] : [20, 20];
        iconAnchor = isFocused ? [13, 13] : [10, 10];
        iconHtml = `
          <div class="custom-tour-pin ${
            isFocused
              ? 'bg-[#F76B1C] border-2 border-white w-[26px] h-[26px]'
              : hasExhibition
              ? 'bg-[#3D5B99] text-white border border-white w-[20px] h-[20px]'
              : 'bg-[#A3C2E4] text-[#1e335a] border border-white w-[18px] h-[18px]'
          } flex items-center justify-center opacity-90">
            <div class="w-2 h-2 rounded-full ${hasExhibition ? 'bg-[#F76B1C]' : 'bg-white'}"></div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize,
        iconAnchor
      });

      const marker = L.marker([gallery.lat, gallery.lng], { icon: customIcon });

      // Rich Popup in Farsi with NO English and NO galleryinfo mentions
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-3 text-stone-800 dark:text-stone-100 max-w-[270px] bg-white dark:bg-[#1a202c] rounded-2xl shadow-xl font-sans';

      const activeEx = gallery.activeExhibition;
      const exhibitionHtml =
        activeEx
          ? `<div class="mt-2 pt-2 border-t border-[#E1E1E1] dark:border-stone-700/60">
               <div class="text-[10px] font-bold text-[#F76B1C]">نمایشگاه جاری ${activeEx.artist ? `· آثار ${activeEx.artist}` : ''}</div>
               <div class="text-xs font-bold text-[#10335e] dark:text-[#dbeafe] mt-0.5 line-clamp-1">${activeEx.title}</div>
               ${activeEx.openingDate ? `<div class="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">افتتاحیه: ${toPersianDigits(activeEx.openingDate)}</div>` : ''}
             </div>`
          : '';

      const trafficWarningHtml = gallery.isInTrafficZone
        ? `<div class="mt-1 text-[10px] font-bold text-[#F76B1C] flex items-center gap-1">
             <span>⚠️ واقع در محدوده طرح ترافیک تهران</span>
           </div>`
        : '';

      const posterOrImg = gallery.posterImage || activeEx?.poster || gallery.image;
      const galleryDisplayName = getGalleryDisplayName(gallery);
      const imageHtml = posterOrImg
        ? `<div class="w-full h-28 mb-2 overflow-hidden rounded-xl bg-white dark:bg-stone-800 border border-[#E1E1E1] dark:border-stone-700">
             <img src="${posterOrImg}" alt="${galleryDisplayName}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
           </div>`
        : '';

      popupDiv.innerHTML = `
        ${imageHtml}
        <div class="text-xs font-bold text-[#1d2d4c] dark:text-white leading-snug">${galleryDisplayName}</div>
        <div class="text-[11px] text-[#3D5B99] dark:text-[#A3C2E4] mt-0.5 font-medium truncate">${gallery.neighborhoodFa || 'تهران'} · ${gallery.addressFa || gallery.address}</div>
        ${trafficWarningHtml}
        ${exhibitionHtml}
        <div class="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-[#E1E1E1] dark:border-stone-800">
          <button id="popup-btn-details-${gallery.id}" class="text-[11px] text-[#3D5B99] dark:text-[#A3C2E4] hover:text-[#F76B1C] underline font-bold cursor-pointer">
            مشاهده جزئیات کامل
          </button>
          <button id="popup-btn-${gallery.id}" class="px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
        isSelected ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-[#3D5B99] text-white hover:bg-[#F76B1C]'
      }">
            ${isSelected ? 'حذف از تور' : '+ افزودن'}
          </button>
        </div>
      `;

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${gallery.id}`);
        if (btn) {
          btn.onclick = () => {
            onToggleGallery(gallery);
            marker.closePopup();
          };
        }
        const btnDetails = document.getElementById(`popup-btn-details-${gallery.id}`);
        if (btnDetails && onSelectForDetails) {
          btnDetails.onclick = () => {
            onSelectForDetails(gallery);
            marker.closePopup();
          };
        }
      });

      marker.bindPopup(popupDiv, { maxWidth: 290, minWidth: 240 });
      marker.addTo(markersLayer);

      if (isSelected || (routeResult && orderNum !== undefined)) {
        bounds.extend([gallery.lat, gallery.lng]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [galleries, selectedGalleries, routeResult, activeGalleryId, isDarkMode]);

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('موقعیت‌یاب در مرورگر شما پشتیبانی نمی‌شود.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 15, { duration: 1.2 });
          L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#3D5B99',
            fillColor: '#F76B1C',
            fillOpacity: 0.95,
            weight: 2
          })
            .bindPopup('موقعیت فعلی شما')
            .addTo(mapInstanceRef.current)
            .openPopup();
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      }
    );
  };

  const handleRecenterCluster = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([35.73, 51.42], 13, { duration: 1.0 });
  };

  return (
    <div className="clay-card relative w-full h-full min-h-[360px] sm:min-h-[420px] overflow-hidden border border-[#E1E1E1] dark:border-stone-800 shadow-md">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Action Controls */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
        {/* Layer Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowTilePicker(!showTilePicker)}
            title="تغییر کیفیت و پوسته نقشه"
            className="clay-button clay-base w-10 h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all"
          >
            <Layers className="w-4 h-4" />
          </button>

          {showTilePicker && (
            <div className="clay-card absolute left-0 mt-2 w-64 bg-white dark:bg-[#1a202c] p-2.5 z-[500] text-xs space-y-1 border border-[#E1E1E1] dark:border-stone-800 shadow-xl">
              <div className="font-bold text-[#3D5B99] dark:text-[#A3C2E4] mb-1.5 px-2 text-[11px]">
                پوسته نقشه (با تفکیک کوچه‌ها)
              </div>
              {(Object.keys(TILE_LAYERS) as (keyof typeof TILE_LAYERS)[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentTileKey(key);
                    setShowTilePicker(false);
                  }}
                  className={`w-full text-right px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    currentTileKey === key
                      ? 'clay-darkblue font-bold text-white'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-[#E1E1E1]/40 dark:hover:bg-stone-800'
                  }`}
                >
                  <span className="leading-snug">{TILE_LAYERS[key].name}</span>
                  {currentTileKey === key && <Check className="w-3.5 h-3.5 mr-2 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Locate Me */}
        <button
          onClick={handleLocateUser}
          title="موقعیت من"
          className="clay-button clay-base w-10 h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all"
        >
          <Navigation className="w-4 h-4" />
        </button>

        {/* Recenter on Tehran */}
        <button
          onClick={handleRecenterCluster}
          title="مرکز گالری‌های تهران"
          className="clay-button clay-base w-10 h-10 flex items-center justify-center text-[#3D5B99] dark:text-[#A3C2E4] hover:scale-105 active:scale-95 transition-all"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[400] clay-card bg-white/95 dark:bg-[#161a22]/95 px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300 hidden sm:flex items-center gap-3 border border-[#E1E1E1] dark:border-stone-800">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3D5B99] inline-block"></span>
          <span>در برنامه تور</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F76B1C] inline-block"></span>
          <span>نمایشگاه فعال</span>
        </div>
        {routeResult && (
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#F76B1C] inline-block"></span>
            <span>مسیر بهینه</span>
          </div>
        )}
      </div>
    </div>
  );
};
