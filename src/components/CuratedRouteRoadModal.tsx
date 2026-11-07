import React, { useState, useEffect, useMemo } from 'react';
import { Gallery } from '../types/gallery';
import { toPersianDigits } from '../utils/persianUtils';
import {
  CURATED_ROAD_ROUTES,
  RoadRoute,
  computeRoadLayout,
  accentFor,
  mix,
  safeFillForWhiteText
} from '../utils/roadLayout';
import { X, Navigation, Compass } from 'lucide-react';
import './route-map.css';

interface CuratedRouteRoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoute: (galleryIds: number[]) => void;
  onSelectGalleryDetails: (gallery: Gallery) => void;
  allGalleries: Gallery[];
}

export const CuratedRouteRoadModal: React.FC<CuratedRouteRoadModalProps> = ({
  isOpen,
  onClose,
  onSelectRoute,
  onSelectGalleryDetails,
  allGalleries
}) => {
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);

  // Close with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentRoute: RoadRoute = CURATED_ROAD_ROUTES[selectedRouteIdx] || CURATED_ROAD_ROUTES[0];

  // Compute dynamic road layout (road height, Bezier curves, pins, and distance bubbles)
  const layout = useMemo(() => {
    return computeRoadLayout(currentRoute, allGalleries);
  }, [currentRoute, allGalleries]);

  if (!isOpen) return null;

  // Colors derived for the active road & car
  const road = currentRoute.color;
  const pin = accentFor(currentRoute);
  const roadCurb = mix(road, '#ffffff', 0.72);
  const carHi = mix(pin, '#ffffff', 0.32);
  const carLo = mix(pin, '#000000', 0.14);
  const roofHi = mix(pin, '#ffffff', 0.45);
  const roofLo = mix(pin, '#ffffff', 0.18);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-2.5 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ag-overlay-root relative w-full max-w-[560px] max-h-[96vh] flex flex-col overflow-y-auto no-scrollbar rounded-3xl mx-auto"
      >
        <div className="flex flex-col gap-3.5 w-full items-center">
          {/* Header Card: Title, Stats, Route Tabs & Close */}
          <div className="ag-head relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors shadow-2xs z-20 cursor-pointer"
              title="بستن پنجره (ESC)"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="ag-eyebrow">مسیرهای پیشنهادی آرت‌گشت</span>
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

            {/* 6 Curated Route Tabs */}
            <div className="ag-tabs">
              {CURATED_ROAD_ROUTES.map((r, idx) => {
                const isSelected = idx === selectedRouteIdx;
                const fill = r.tab || safeFillForWhiteText(r.color);
                const tabBg = mix(r.color, '#ffffff', 0.88);
                const tabInk = mix(r.color, '#000000', 0.42);
                const tabGlow = mix(r.color, '#ffffff', 0.4) + '66';
                const tabBorder = mix(fill, '#000000', 0.15);

                const style: React.CSSProperties = {
                  '--tab-bg': tabBg,
                  '--tab-ink': tabInk,
                  '--tab-dot': r.color,
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

          {/* Map Card: Dynamic Height Winding Road, Pins, Cards & Moving Car */}
          <div
            className="ag-map"
            style={
              {
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

            {/* 3. Distance Bubbles */}
            {layout.legs.map((lg, idx) => (
              <div
                key={idx}
                className={`ag-leg ag-leg--${lg.rightSide ? 'right' : 'left'}`}
                style={{ top: `${lg.y}px`, left: `${lg.x}px` }}
              >
                <svg
                  aria-hidden="true"
                  width={19.4}
                  height={26}
                  viewBox="0 0 19.4 26"
                  className="ag-leg__tip"
                >
                  <path d="M19.4 0 L18.38 0 A13 13 0 0 0 9.19 3.81 L2.83 10.17 A4 4 0 0 0 2.83 15.83 L9.19 22.19 A13 13 0 0 0 18.38 26 L19.4 26 Z" />
                </svg>
                <svg
                  aria-hidden="true"
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  className="ag-leg__icon"
                >
                  <path d="M5 16V11l2-5h10l2 5v5" />
                  <path d="M3 16h18" />
                  <circle cx={7.5} cy={16.5} r={1.5} />
                  <circle cx={16.5} cy={16.5} r={1.5} />
                </svg>
                <span className="ag-leg__text">{lg.text}</span>
              </div>
            ))}

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
                        width={11}
                        height={11}
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
                  <span className="ag-card__show">نمایشگاه: {s.show}</span>
                  {s.showArtist && (
                    <div className="ag-card__artist">آثار: {s.artist}</div>
                  )}
                </button>
              </React.Fragment>
            ))}

            {/* 5. Animated Car (CSS Motion Path along road) */}
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
          </div>

          {/* Bottom Docked CTA Bar: Start This Tour */}
          <div className="ag-foot">
            <div className="flex items-center gap-2 text-xs truncate">
              <Compass className="w-4 h-4 text-[#3D5B99] shrink-0" />
              <span className="font-bold text-[#1f2a44] truncate">
                {currentRoute.label}
              </span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-500 font-medium shrink-0">
                {toPersianDigits(layout.n)} توقف
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectRoute(currentRoute.galleryIds);
                onClose();
              }}
              className="clay-button clay-orange px-5 py-2.5 text-xs font-bold text-white flex items-center gap-2 rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Navigation className="w-4 h-4 stroke-[2.2]" />
              <span>شروع این گشت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
