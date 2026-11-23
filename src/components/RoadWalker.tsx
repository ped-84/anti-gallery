import React, { useEffect, useRef } from 'react';
import { startWalk } from '../utils/walkerRig';

interface RoadWalkerProps {
  /** همان layout.pathD جاده */
  pathD: string;
  /** ابعاد بوم جاده (همان viewBox جاده) */
  width: number;
  height: number;
  speed?: number;
  scale?: number;
}

/**
 * کاراکتر پیاده‌روی روی جاده‌ی گشت‌ها.
 * یک svg شفاف روی جاده می‌نشیند و در هر فریم فقط transformها عوض می‌شوند؛
 * هیچ filter یا انیمیشن CSS روی المان متحرک نیست.
 */
export const RoadWalker: React.FC<RoadWalkerProps> = ({ pathD, width, height, speed, scale }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!svg || !path) return;
    let stop: (() => void) | undefined;
    try {
      stop = startWalk(svg, path, { speed, scale });
    } catch (err) {
      // انیمیشن تزئینی است؛ خطایش نباید نقشه را از کار بیندازد
      console.warn('RoadWalker failed to start:', err);
    }
    return () => stop?.();
  }, [pathD, speed, scale]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="ag-svg ag-walker-layer"
      style={{ overflow: 'visible' }}
    >
      <path ref={pathRef} d={pathD} fill="none" stroke="none" />
    </svg>
  );
};

export default RoadWalker;
