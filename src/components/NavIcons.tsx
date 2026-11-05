import React from 'react';

// Google Maps Icon (Official Pin)
export const GoogleMapsIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <img
    src="/assets/google-maps-logo.png"
    alt="Google Maps"
    className={`${className} object-contain`}
  />
);

// Waze Icon (Official Cyan car)
export const WazeIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <img
    src="/assets/waze-logo.png"
    alt="Waze"
    className={`${className} object-contain`}
  />
);

// Neshan Icon (Official Compass logo with green/teal center)
export const NeshanIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <img
    src="/assets/neshan-logo.png"
    alt="نشان"
    className={`${className} object-contain`}
  />
);

// Balad Icon (Official Purple logo with yellow pin)
export const BaladIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <img
    src="/assets/balad-logo.png"
    alt="بلد"
    className={`${className} object-contain rounded-md`}
  />
);


