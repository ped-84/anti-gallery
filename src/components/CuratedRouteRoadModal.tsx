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
              const minsVal =
                lg.minutes !== null && lg.minutes !== undefined
                  ? lg.minutes
                  : curatedMode === 'walking'
                  ? Math.max(1, Math.round(kmVal * 13))
                  : 2;
              const distLabel =
                curatedMode === 'walking'
                  ? `${toPersianDigits(kmVal)} کیلومتر - ${toPersianDigits(minsVal)} دقیقه`
                  : `${toPersianDigits(kmVal)} کیلومتر`;
              const badgeW = curatedMode === 'walking' ? 164 : 124;
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
                      paddingLeft: lg.rightSide ? '16px' : '12px',
                      paddingRight: lg.rightSide ? '12px' : '16px',
                      flexDirection: lg.rightSide ? 'row-reverse' : 'row'
                    }}
                  >
                    <span className="font-sans tabular-nums text-[11px] sm:text-xs font-black select-none whitespace-nowrap">
                      {distLabel}
                    </span>
                    {curatedMode === 'walking' ? (
                      <Footprints className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
            {curatedMode === 'walking' ? (
              <div
                className="ag-walker"
                aria-hidden="true"
                style={{
                  offsetPath: `path('${layout.pathD}')`,
                  animationDuration: `${layout.carSeconds}s`
                }}
              >
                <div className="ag-walker__rig">
                  <svg
                    width="48"
                    height="64"
                    viewBox="0 0 48 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="overflow-visible"
                  >
                    <defs>
                      {/* Shirt 3D Claymorphic Gradient matching road & car theme */}
                      <linearGradient id="walker-shirt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={carHi} />
                        <stop offset="48%" stopColor={pin} />
                        <stop offset="100%" stopColor={carLo} />
                      </linearGradient>

                      {/* Back Leg / Shadow Denim */}
                      <linearGradient id="walker-denim-back" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#23426e" />
                        <stop offset="100%" stopColor="#142845" />
                      </linearGradient>

                      {/* Front Leg Denim */}
                      <linearGradient id="walker-denim-front" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#467bb8" />
                        <stop offset="100%" stopColor="#28538c" />
                      </linearGradient>

                      {/* Hair 3D Volume Gradient */}
                      <linearGradient id="walker-hair-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#25334d" />
                        <stop offset="50%" stopColor="#182236" />
                        <stop offset="100%" stopColor="#0c121e" />
                      </linearGradient>
                    </defs>

                    {/* 1. Ground Contact Shadow on Asphalt (pulses with foot strikes) */}
                    <ellipse
                      className="ag-anim-shadow"
                      cx="24"
                      cy="58"
                      rx="14"
                      ry="3.5"
                      fill="#090d16"
                      opacity="0.45"
                    />

                    {/* 2. Animated Character Body (with natural rhythmic step bounce) */}
                    <g className="ag-anim-bob">
                      {/* BACK ARM (swings opposite to back leg) */}
                      <g transform="translate(18, 22)">
                        <g className="ag-anim-arm-l">
                          <path
                            d="M 0 0 L -3 8 L -4 14"
                            stroke="#e09c85"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                          />
                          <circle cx="-4" cy="15" r="1.6" fill="#e09c85" />
                        </g>
                      </g>

                      {/* BACK LEG (shaded darker for depth, full walking stride + knee flex) */}
                      <g transform="translate(20, 33)">
                        <g className="ag-anim-leg-l">
                          {/* Thigh */}
                          <path
                            d="M 0 0 L -2 11"
                            stroke="url(#walker-denim-back)"
                            strokeWidth="4.8"
                            strokeLinecap="round"
                          />
                          {/* Knee joint -> Shin & Foot */}
                          <g transform="translate(-2, 11)">
                            <g className="ag-anim-knee-l">
                              {/* Calf */}
                              <path
                                d="M 0 0 L -1 10"
                                stroke="url(#walker-denim-back)"
                                strokeWidth="4.2"
                                strokeLinecap="round"
                              />
                              {/* Rolled Cuff */}
                              <ellipse cx="-1" cy="8.5" rx="2.5" ry="1.2" fill="#7fa6d8" />
                              {/* Sneaker */}
                              <path
                                d="M -2 9 L 4 11.5 L 3.5 13.5 L -3 13 Z"
                                fill="#e2e8f0"
                                stroke="#090d16"
                                strokeWidth="0.8"
                              />
                              <line
                                x1="-3"
                                y1="13.2"
                                x2="3.5"
                                y2="13.2"
                                stroke="#090d16"
                                strokeWidth="1.1"
                              />
                            </g>
                          </g>
                        </g>
                      </g>

                      {/* TORSO & HIPS (Claymorphic 3D styling) */}
                      {/* Hips / Jeans Waistband */}
                      <path d="M 17 31 L 31 31 L 29 35 L 19 35 Z" fill="#28538c" />
                      <line
                        x1="18"
                        y1="31"
                        x2="30"
                        y2="31"
                        stroke="#162c4c"
                        strokeWidth="1"
                      />

                      {/* T-Shirt Body (Dynamic Tour Colors) */}
                      <path
                        d="M 18 19 L 30 19 L 31 31 L 17 31 Z"
                        fill="url(#walker-shirt-grad)"
                      />
                      {/* 3D Clay highlight on shirt top edge */}
                      <path
                        d="M 18.5 19.5 L 29.5 19.5 L 23 20 Z"
                        fill="rgba(255,255,255,0.45)"
                      />

                      {/* Crossbody Tote Strap */}
                      <line
                        x1="20"
                        y1="19"
                        x2="29"
                        y2="33"
                        stroke="#1e293b"
                        strokeWidth="1.3"
                      />
                      {/* Mini Exhibition Tote Bag */}
                      <rect
                        x="27"
                        y="30"
                        width="5"
                        height="6.5"
                        rx="1.2"
                        fill="#fff7ed"
                        stroke={pin}
                        strokeWidth="0.8"
                      />

                      {/* FRONT LEG (bright denim, clear forward stride + knee flex) */}
                      <g transform="translate(26, 33)">
                        <g className="ag-anim-leg-r">
                          {/* Thigh */}
                          <path
                            d="M 0 0 L 2 11"
                            stroke="url(#walker-denim-front)"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          {/* Knee joint -> Shin & Foot */}
                          <g transform="translate(2, 11)">
                            <g className="ag-anim-knee-r">
                              {/* Calf */}
                              <path
                                d="M 0 0 L 1 10"
                                stroke="url(#walker-denim-front)"
                                strokeWidth="4.4"
                                strokeLinecap="round"
                              />
                              {/* Rolled Jean Cuff */}
                              <ellipse cx="1" cy="8.5" rx="2.7" ry="1.3" fill="#bfdbfe" />
                              {/* Clean White Sneaker */}
                              <path
                                d="M -1 9 L 6 11.5 L 5.5 13.5 L -2 13 Z"
                                fill="#ffffff"
                                stroke="#090d16"
                                strokeWidth="0.8"
                              />
                              <line
                                x1="-2"
                                y1="13.2"
                                x2="5.5"
                                y2="13.2"
                                stroke="#090d16"
                                strokeWidth="1.2"
                              />
                            </g>
                          </g>
                        </g>
                      </g>

                      {/* FRONT ARM & SLEEVE (swings opposite to front leg) */}
                      <g transform="translate(28, 22)">
                        <g className="ag-anim-arm-r">
                          {/* Sleeve */}
                          <path d="M -2 -2 L 3 1 L 2 5 L -2 4 Z" fill="url(#walker-shirt-grad)" />
                          {/* Forearm */}
                          <path
                            d="M 1 4 L 4 11 L 6 15"
                            stroke="#fcd7c7"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Hand */}
                          <circle cx="6" cy="15.5" r="1.7" fill="#fcd7c7" />
                        </g>
                      </g>

                      {/* HEAD & HAIR */}
                      {/* Neck */}
                      <rect x="22" y="16.5" width="4" height="3" fill="#fcd7c7" />

                      {/* Back Hair Volume */}
                      <path
                        d="M 18 12 C 17 6, 29 5, 30 11 C 31 16, 27 20, 23 20 C 18 20, 17 16, 18 12 Z"
                        fill="url(#walker-hair-grad)"
                      />

                      {/* Face */}
                      <circle cx="24.5" cy="13.5" r="4.8" fill="#fcd7c7" />
                      {/* Cheek Blush */}
                      <circle cx="26.5" cy="15" r="1.3" fill="#fca5a5" opacity="0.6" />

                      {/* Front Bob Hair Fringe & Bangs */}
                      <path
                        d="M 19 12 C 20 8, 28 8, 29 11 C 26 12, 23 11, 21 14 Z"
                        fill="#182236"
                      />
                      <path
                        d="M 18 13 C 17 16, 18 18, 20 19 C 19 19, 18 16, 18 13 Z"
                        fill="#0f172a"
                      />
                      {/* 3D Hair Gloss / Clay Highlight */}
                      <path
                        d="M 22 7.5 C 24 7, 27 7.5, 28 8.5"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                </div>
              </div>
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
