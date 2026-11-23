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
  getCuratedRoadRoutes,
  ROAD_CONSTANTS
} from '../utils/roadLayout';
import { X, Navigation, Compass, Car, Footprints } from 'lucide-react';
import { RoadWalker } from './RoadWalker';
import './route-map.css';

const MAP_W = ROAD_CONSTANTS.MAP_W;
const TREE_TONES = [
  { base: '#6FAF8C', hi: '#A7D6BA', lo: '#4E8E6D' },
  { base: '#5E9F80', hi: '#97CBAB', lo: '#437E61' },
  { base: '#86BC8F', hi: '#BCE0C1', lo: '#5F9A6B' }
];

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
  // حالت تیره از کلاس روی <html> خوانده می‌شود (هوک نیست؛ مودال با هر باز شدن دوباره رندر می‌شود)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
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
      // نقشه هم‌عرض کارت بالا و پایین (حداکثر ۵۲۰px) می‌شود؛ روی دسکتاپ کمی بزرگ‌تر از ۴۸۰ هم مقیاس می‌گیرد
      const FRAME_W = 520;
      const available = Math.min(vw - pad, FRAME_W);
      const s = Math.min(FRAME_W / MAP_W, Math.max(0.55, available / MAP_W));
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
        className="ag-overlay-root relative w-full max-w-[520px] flex flex-col gap-3.5 my-auto items-center"
      >
        {/* Header Card: 100% Native Scale (Large, crystal-clear typography) */}
        <div className="ag-head relative w-full">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-colors shadow-2xs z-20 cursor-pointer"
            title="بستن پنجره (ESC)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 pl-12">
              <span className="ag-eyebrow">مسیرهای پیشنهادی آرت‌گشت</span>
              {/* Segmented Mode Switcher: با خودرو / پیاده‌روی */}
              <div className="inline-flex items-center p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200/80 dark:border-stone-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setCuratedMode('driving');
                    setSelectedRouteIdx(0);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    curatedMode === 'driving'
                      ? 'bg-white dark:bg-[#232a3a] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
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
                      ? 'bg-white dark:bg-[#232a3a] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
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
              const tabBg = isSelected ? fill : isDark ? mix(r.color, '#141822', 0.78) : mix(r.color, '#ffffff', 0.88);
              const tabInk = isSelected ? (r.tabInk || '#ffffff') : isDark ? mix(r.color, '#ffffff', 0.55) : mix(r.color, '#000000', 0.45);
              const tabGlow = mix(r.color, '#ffffff', 0.4) + '66';
              const tabBorder = isSelected ? mix(fill, '#000000', 0.15) : isDark ? mix(r.color, '#141822', 0.5) : mix(r.color, '#ffffff', 0.65);

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
          className="relative w-full max-w-[520px] overflow-hidden flex justify-center rounded-3xl"
          style={{ height: `${scaledMapH}px` }}
        >
          <div
            className="ag-map"
            style={
              {
                position: 'absolute',
                top: 0,
                left: '50%',
                width: `${MAP_W}px`,
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
              width={MAP_W}
              height={layout.mapH}
              viewBox={`0 0 ${MAP_W} ${layout.mapH}`}
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
              width={MAP_W}
              height={layout.mapH}
              viewBox={`0 0 ${MAP_W} ${layout.mapH}`}
              className="ag-svg"
              aria-label={`مسیر ${currentRoute.label}`}
            >
              <path d={layout.pathD} className="ag-road ag-road--rim" />
              <path d={layout.pathD} className="ag-road ag-road--curb" />
              <path d={layout.pathD} className="ag-road ag-road--asphalt" />
              <path d={layout.pathD} className="ag-road ag-road--sheen" />
              <path d={layout.pathD} className="ag-road ag-road--dash" />
            </svg>

            {/* 2b. Static roadside trees (no animation, shadows drawn inside the SVG) */}
            {layout.trees.length > 0 && (
              <svg
                aria-hidden="true"
                width={MAP_W}
                height={layout.mapH}
                viewBox={`0 0 ${MAP_W} ${layout.mapH}`}
                className="ag-svg"
              >
                {layout.trees.map((t, i) => {
                  const tone = TREE_TONES[t.tone];
                  return (
                    <g key={i}>
                      {/* soft ground shadow */}
                      <ellipse cx={t.x + t.r * 0.32} cy={t.y + t.r * 0.62} rx={t.r * 1.15} ry={t.r * 0.78} fill="#1d2d4c" opacity={0.11} />
                      {/* canopy: three overlapping clay blobs, lit from the top-left */}
                      <circle cx={t.x + t.r * 0.38} cy={t.y + t.r * 0.18} r={t.r * 0.72} fill={tone.lo} />
                      <circle cx={t.x - t.r * 0.36} cy={t.y + t.r * 0.22} r={t.r * 0.68} fill={tone.lo} />
                      <circle cx={t.x} cy={t.y - t.r * 0.12} r={t.r * 0.82} fill={tone.base} />
                      <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.36} r={t.r * 0.32} fill={tone.hi} opacity={0.9} />
                      <circle cx={t.x + t.r * 0.26} cy={t.y - t.r * 0.02} r={t.r * 0.14} fill={tone.hi} opacity={0.55} />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* 3. Distance Bubbles: Unified Single-Piece Vector Pointer */}
            {layout.legs.map((lg, idx) => {
              const badgeW = lg.w;
              const badgeH = lg.h;
              const r = badgeH / 2;

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
                  {/* Single seamless shape: rounded tag with a point toward the road */}
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
                      d={`M ${r} 0.5 L ${badgeW - 20} 0.5 Q ${badgeW - 12} 1.5 ${badgeW - 8} 5.5 L ${badgeW - 3} ${r - 3.5} Q ${badgeW} ${r} ${badgeW - 3} ${r + 3.5} L ${badgeW - 8} ${badgeH - 5.5} Q ${badgeW - 12} ${badgeH - 1.5} ${badgeW - 20} ${badgeH - 0.5} L ${r} ${badgeH - 0.5} A ${r - 0.5} ${r - 0.5} 0 0 1 ${r} 0.5 Z`}
                      fill="var(--bubble)"
                      stroke="var(--bubble-border)"
                      strokeWidth="1.2"
                    />
                  </svg>

                  <div
                    className="ag-leg-content"
                    style={{
                      paddingLeft: lg.rightSide ? '18px' : '12px',
                      paddingRight: lg.rightSide ? '12px' : '18px'
                    }}
                  >
                    {curatedMode === 'walking' ? (
                      <Footprints className="ag-leg-icon text-[#c2410c] dark:text-[#ff8a3d]" aria-hidden="true" />
                    ) : (
                      <Car className="ag-leg-icon text-[#10335e] dark:text-[#A3C2E4]" aria-hidden="true" />
                    )}
                    <span className="ag-leg-text">{lg.text}</span>
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
                  className={`ag-card${s.isStart || s.isEnd ? ' ag-card--tagged' : ''}`}
                  style={{
                    left: `${s.card.x}px`,
                    top: `${s.card.y}px`,
                    width: `${s.card.w}px`,
                    minHeight: `${s.card.h}px`
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
                        stroke="currentColor"
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

            {/* 5. Animated Walker (rAF + SVG transform) / Car (CSS motion path) */}
            {curatedMode === 'walking' ? (
              <RoadWalker pathD={layout.pathD} width={MAP_W} height={layout.mapH} />
            ) : (
              <div
                className="ag-car"
                aria-hidden="true"
                style={{
                  offsetPath: `path('${layout.pathD}')`,
                  animationDuration: `${layout.carSeconds}s`
                }}
              >
                <div className="ag-car__rig">
                  <i className="shadow" />
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
              </div>
            )}
          </div>
        </div>

        {/* Bottom Docked CTA Bar: 100% Native Scale */}
        <div className="ag-foot w-full">
          <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-[#3D5B99] dark:text-[#A3C2E4] shrink-0" />
            <span className="font-extrabold text-[#1f2a44] dark:text-white truncate">
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
