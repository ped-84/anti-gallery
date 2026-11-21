import React, { useState, useEffect, useMemo } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits } from '../utils/persianUtils';
import {
  CURATED_ROAD_ROUTES,
  RoadRoute,
  computeRoadLayout,
  accentFor,
  mix,
  safeFillForWhiteText,
  getCuratedRoadRoutes
} from '../utils/roadLayout';
import { X, Navigation, Compass, Car, Footprints } from 'lucide-react';
import './route-map.css';

interface CuratedRouteRoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoute: (galleryIds: number[], mode: 'driving' | 'walking') => void;
  onSelectGalleryDetails: (gallery: Gallery) => void;
  allGalleries: Gallery[];
  initialRouteId?: string | null;
  travelMode?: 'driving' | 'walking';
}

export const CuratedRouteRoadModal: React.FC<CuratedRouteRoadModalProps> = ({
  isOpen,
  onClose,
  onSelectRoute,
  onSelectGalleryDetails,
  allGalleries,
  initialRouteId,
  travelMode = 'driving'
}) => {
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);
  const [curatedMode, setCuratedMode] = useState<'driving' | 'walking'>(travelMode);

  // Sync internal mode with travelMode when opened or updated
  useEffect(() => {
    if (travelMode) {
      setCuratedMode(travelMode);
    }
  }, [travelMode, isOpen]);

  // Dynamically resolve curated routes strictly based on active opening exhibitions and mode
  const validRoutes = useMemo(() => {
    return getCuratedRoadRoutes(allGalleries, curatedMode);
  }, [allGalleries, curatedMode]);

  const activeRouteIdx = Math.max(0, Math.min(selectedRouteIdx, Math.max(0, validRoutes.length - 1)));
  const currentRoute: RoadRoute = validRoutes[activeRouteIdx] || CURATED_ROAD_ROUTES[0];

  // Sync with initialRouteId whenever modal opens or route id changes
  useEffect(() => {
    if (isOpen && initialRouteId) {
      const idx = validRoutes.findIndex((r) => r.id === initialRouteId);
      if (idx !== -1) {
        setSelectedRouteIdx(idx);
      }
    }
  }, [isOpen, initialRouteId, validRoutes]);

  const [mapScale, setMapScale] = useState<number>(1);

  // Close with ESC key only if child modal (detail modal) isn't on top
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (document.querySelector('.ag-gallery-detail-modal') || document.querySelector('.z-\\[1200\\]')) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute responsive scale for the map road canvas so it fits any screen without cutting off
  useEffect(() => {
    if (!isOpen) return;

    const updateScale = () => {
      const vw = window.innerWidth;
      const pad = vw < 640 ? 20 : 32;
      const available = Math.min(vw - pad, 560);
      const s = Math.min(1, Math.max(0.50, available / 560));
      setMapScale(s);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isOpen]);

  // Compute dynamic road layout (road height, Bezier curves, pins, and distance bubbles)
  const layout = useMemo(() => {
    return computeRoadLayout(currentRoute, allGalleries, curatedMode);
  }, [currentRoute, allGalleries, curatedMode]);

  if (!isOpen) return null;

  // Colors derived for the active road & car
  const road = currentRoute.color;
  const pin = accentFor(currentRoute);
  const roadCurb = mix(road, '#ffffff', 0.72);
  const carHi = mix(pin, '#ffffff', 0.32);
  const carLo = mix(pin, '#000000', 0.14);
  const roofHi = mix(pin, '#ffffff', 0.45);
  const roofLo = mix(pin, '#ffffff', 0.18);

  const scaledMapH = Math.round(layout.mapH * mapScale);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in font-sans overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ag-overlay-root relative w-full max-w-[560px] flex flex-col gap-3.5 my-auto items-center"
      >
        {/* Header Card: 100% Native Scale (Large, crystal-clear typography) */}
        <div className="ag-head relative w-full">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors shadow-2xs z-20 cursor-pointer"
            title="بستن پنجره (ESC)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 pl-12">
              <span className="ag-eyebrow">مسیرهای پیشنهادی آرت‌گشت</span>
              {/* Segmented Mode Switcher: با خودرو / پیاده‌روی */}
              <div className="inline-flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setCuratedMode('driving');
                    setSelectedRouteIdx(0);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    curatedMode === 'driving'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-blue-600" />
                  <span>با خودرو</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCuratedMode('walking');
                    setSelectedRouteIdx(0);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    curatedMode === 'walking'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5 text-amber-600" />
                  <span>پیاده‌روی</span>
                </button>
              </div>
            </div>

            <div className="ag-title-row">
              <span
                className="ag-title-dot"
                style={{ background: road }}
              />
              <h2 className="ag-title">{currentRoute.label}</h2>
            </div>
          </div>

          {/* Stats Pills */}
          <div className="ag-stats">
            <span className="ag-pill">{layout.stats.stops}</span>
            <span className="ag-pill">{layout.stats.km}</span>
            <span className="ag-pill ag-pill--time">{layout.stats.time}</span>
          </div>

          <div className="ag-divider" />

          {/* Curated Route Tabs (Only hubs with >= 2 galleries) */}
          <div className="ag-tabs">
            {validRoutes.map((r, idx) => {
              const isSelected = idx === activeRouteIdx;
              const fill = r.tab || safeFillForWhiteText(r.color);
              const tabBg = isSelected ? fill : mix(r.color, '#ffffff', 0.88);
              const tabInk = isSelected ? (r.tabInk || '#ffffff') : mix(r.color, '#000000', 0.45);
              const tabGlow = mix(r.color, '#ffffff', 0.4) + '66';
              const tabBorder = isSelected ? mix(fill, '#000000', 0.15) : mix(r.color, '#ffffff', 0.65);

              const style: React.CSSProperties = {
                '--tab-bg': tabBg,
                '--tab-ink': tabInk,
                '--tab-dot': isSelected ? (r.tabInk || '#ffffff') : r.color,
                '--tab-fill': fill,
                '--tab-sel-ink': r.tabInk || '#ffffff',
                '--tab-border': tabBorder,
                '--tab-glow': tabGlow
              } as React.CSSProperties;

              return (
                <button
                  key={r.id}
                  type="button"
                  style={style}
                  className="ag-tab"
                  aria-pressed={isSelected ? 'true' : 'false'}
                  onClick={() => setSelectedRouteIdx(idx)}
                >
                  <span className="ag-tab__dot" />
                  <span>
                    {r.label} ({toPersianDigits(r.galleryIds.length)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Card: Responsive Winding Road, Pins, Cards & Moving Car */}
        <div
          className="relative w-full max-w-[560px] overflow-hidden flex justify-center rounded-3xl"
          style={{ height: `${scaledMapH}px` }}
        >
          <div
            className="ag-map"
            style={
              {
                position: 'absolute',
                top: 0,
                left: '50%',
                width: '560px',
                transform: `translateX(-50%) scale(${mapScale})`,
                transformOrigin: 'top center',
                height: `${layout.mapH}px`,
                '--road': road,
                '--road-curb': roadCurb,
                '--pin': pin,
                '--car-hi': carHi,
                '--car-lo': carLo,
                '--roof-hi': roofHi,
                '--roof-lo': roofLo
              } as React.CSSProperties
            }
          >
            {/* 1. Road Shadow */}
            <svg
              aria-hidden="true"
              width={560}
              height={layout.mapH}
              viewBox={`0 0 560 ${layout.mapH}`}
              className="ag-svg ag-road-shadow"
            >
              <path
                d={layout.pathD}
                fill="none"
                stroke={mix(road, '#000000', 0.3)}
                strokeWidth={44}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* 2. The 5-layer Winding Road */}
            <svg
              role="img"
              width={560}
              height={layout.mapH}
              viewBox={`0 0 560 ${layout.mapH}`}
              className="ag-svg"
              aria-label={`مسیر ${currentRoute.label}`}
            >
              <path d={layout.pathD} className="ag-road ag-road--rim" />
              <path d={layout.pathD} className="ag-road ag-road--curb" />
              <path d={layout.pathD} className="ag-road ag-road--asphalt" />
              <path d={layout.pathD} className="ag-road ag-road--sheen" />
              <path d={layout.pathD} className="ag-road ag-road--dash" />
            </svg>

            {/* 3. Distance Bubbles: Unified Single-Piece Vector Pointer */}
            {layout.legs.map((lg, idx) => {
              const kmVal = lg.km !== null && lg.km !== undefined ? lg.km : 0.25;
              const distLabel = `${toPersianDigits(kmVal)} کیلومتر`;
              const badgeW = 124;
              const badgeH = 34;

              return (
                <div
                  key={idx}
                  className="ag-leg-container"
                  style={{
                    top: `${lg.y}px`,
                    left: `${lg.x}px`,
                    transform: lg.rightSide ? 'translate(0, -50%)' : 'translate(-100%, -50%)',
                    width: `${badgeW}px`,
                    height: `${badgeH}px`
                  }}
                >
                  {/* Single Seamless Vector Shape matching exact green checkmark mockup */}
                  <svg
                    width={badgeW}
                    height={badgeH}
                    viewBox={`0 0 ${badgeW} ${badgeH}`}
                    className="ag-leg-shape"
                    style={{
                      transform: lg.rightSide ? 'scaleX(-1)' : 'none',
                      overflow: 'visible'
                    }}
                    aria-hidden="true"
                  >
                    <path
                      d={`M 17 0.5 L ${badgeW - 20} 0.5 Q ${badgeW - 12} 1.5 ${badgeW - 8} 5.5 L ${badgeW - 3} 13.5 Q ${badgeW} 17 ${badgeW - 3} 20.5 L ${badgeW - 8} 28.5 Q ${badgeW - 12} 32.5 ${badgeW - 20} 33.5 L 17 33.5 A 16.5 16.5 0 0 1 17 0.5 Z`}
                      fill="#ffffff"
                      stroke="rgba(29, 45, 76, 0.18)"
                      strokeWidth="1.2"
                    />
                  </svg>

                  {/* Content layer (Distance text + Car / Walking Icon) */}
                  <div
                    className="ag-leg-content"
                    style={{
                      paddingLeft: lg.rightSide ? '18px' : '14px',
                      paddingRight: lg.rightSide ? '14px' : '18px',
                      flexDirection: lg.rightSide ? 'row-reverse' : 'row'
                    }}
                  >
                    <span className="font-sans tabular-nums text-xs font-black select-none">
                      {distLabel}
                    </span>
                    {curatedMode === 'walking' ? (
                      <Footprints className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Car className="w-4 h-4 text-[#10335e] shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* 4. Pins & Gallery Cards */}
            {layout.stops.map((s) => (
              <React.Fragment key={s.gallery.id}>
                {/* Pin Shadow */}
                <div
                  className="ag-pin-shadow"
                  style={{
                    left: `${s.pin.shadow.x}px`,
                    top: `${s.pin.shadow.y}px`,
                    width: `${s.pin.shadow.w}px`
                  }}
                />

                {/* Pin (non-clickable as requested) */}
                <div
                  className="ag-pin"
                  style={{
                    left: `${s.pin.x}px`,
                    top: `${s.pin.y}px`,
                    width: `${s.pin.size}px`,
                    height: `${s.pin.size}px`
                  }}
                >
                  <div
                    className="ag-pin__body"
                    style={{ transform: `rotate(${s.pin.rot}deg)` }}
                  >
                    <div
                      className="ag-pin__num"
                      style={{
                        width: `${s.pin.numSize}px`,
                        height: `${s.pin.numSize}px`,
                        fontSize: `${s.pin.numFont}px`,
                        transform: `rotate(${s.pin.unrot}deg)`
                      }}
                    >
                      {s.num}
                    </div>
                  </div>
                </div>

                {/* Real Accessible Button Gallery Card */}
                <button
                  type="button"
                  onClick={() => onSelectGalleryDetails(s.gallery)}
                  aria-label={`مشاهده مشخصات ${s.name} - نمایشگاه ${s.show}`}
                  className="ag-card"
                  style={{
                    left: `${s.card.x}px`,
                    top: `${s.card.y}px`,
                    width: `${s.card.w}px`,
                    height: `${s.card.h}px`
                  }}
                >
                  {s.isStart && (
                    <span className="ag-tag ag-tag--start">
                      <span className="ag-tag__dot" />
                      <span>مبدأ گشت</span>
                    </span>
                  )}
                  {s.isEnd && (
                    <span className="ag-tag ag-tag--end">
                      <svg
                        aria-hidden="true"
                        width={12}
                        height={12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8a5a00"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 21V4" />
                        <path d="M5 4h11l-2 4 2 4H5" />
                      </svg>
                      <span>مقصد نهایی</span>
                    </span>
                  )}
                  <div className="ag-card__name" title={s.name}>
                    {s.name}
                  </div>
                  <span className="ag-card__show">{s.show}</span>
                  {s.showArtist && (
                    <div className="ag-card__artist">آثار: {s.artist}</div>
                  )}
                </button>
              </React.Fragment>
            ))}

            {/* 5. Animated Car / Walker (CSS Motion Path along road) */}
            <div
              className="ag-car"
              aria-hidden="true"
              style={{
                offsetPath: `path('${layout.pathD}')`,
                animationDuration: `${layout.carSeconds}s`
              }}
            >
              {curatedMode === 'walking' ? (
                <div
                  className="w-8 h-8 rounded-full bg-white shadow-md border-2 border-amber-600 text-amber-600 flex items-center justify-center animate-bounce -mt-1 -ml-1"
                >
                  <Footprints className="w-4 h-4" />
                </div>
              ) : (
                <div className="ag-car__rig">
                  <i className="wheel" style={{ left: '7px', top: '-1px' }} />
                  <i className="wheel" style={{ left: '28px', top: '-1px' }} />
                  <i className="wheel" style={{ left: '7px', top: '22px' }} />
                  <i className="wheel" style={{ left: '28px', top: '22px' }} />
                  <i className="body" />
                  <i className="rear-glass" />
                  <i className="roof" />
                  <i className="front-glass" />
                  <i className="head" style={{ top: '5px' }} />
                  <i className="head" style={{ top: '17px' }} />
                  <i className="tail" style={{ top: '5px' }} />
                  <i className="tail" style={{ top: '17px' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Docked CTA Bar: 100% Native Scale */}
        <div className="ag-foot w-full">
          <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-[#3D5B99] shrink-0" />
            <span className="font-extrabold text-[#1f2a44] truncate">
              {currentRoute.label}
            </span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-500 font-bold shrink-0">
              {toPersianDigits(layout.n)} توقف
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectRoute(currentRoute.galleryIds, curatedMode);
              onClose();
            }}
            style={{
              backgroundColor: road,
              color: '#ffffff'
            }}
            className="clay-button px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white flex items-center gap-2 rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Navigation className="w-4 h-4 stroke-[2.2]" />
            <span>شروع این گشت</span>
          </button>
        </div>
      </div>
    </div>
  );
};
