export interface Exhibition {
  eventId?: number;
  galleryId?: number;
  galleryName?: string;
  title: string;
  artist?: string;
  type?: string;
  openingDate?: string;
  closingDate?: string;
  fullDateRange?: string;
  openingHours?: string;
  poster?: string;
  posterSmall?: string;
  info?: string;
  url?: string;
  isNews?: boolean;
}

export interface Gallery {
  id: number;
  name: string;
  nameFa?: string;
  city: string;
  cityFa?: string;
  lat: number;
  lng: number;
  address: string;
  addressFa?: string;
  phone?: string;
  hours?: string;
  hoursFa?: string;
  website?: string;
  instagram?: string;
  image?: string;
  logoImage?: string;
  posterImage?: string;
  posterSmall?: string;
  sourceUrl: string;
  neighborhood?: string;
  neighborhoodFa?: string;
  exhibitions?: Exhibition[];
  activeExhibition?: Exhibition | null;
  isInTrafficZone?: boolean;
}

export interface RouteLeg {
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMin: number;
  durationWithTrafficMin: number;
  summary?: string;
  steps?: {
    instruction: string;
    distanceM: number;
    durationS: number;
  }[];
}

export interface CustomOrigin {
  type: 'gps' | 'hub' | 'none';
  name: string;
  lat: number;
  lng: number;
}

export interface RouteOptimizationResult {
  orderedGalleries: Gallery[];
  totalDistanceKm: number;
  totalDurationMin: number;
  totalDurationWithTrafficMin: number;
  trafficMultiplier: number;
  trafficCondition: 'normal' | 'peak' | 'weekend';
  trafficZoneWarningsCount: number;
  legs: RouteLeg[];
  geometryCoords: [number, number][]; // [lat, lng] array
  isRoundTrip: boolean;
  mode: 'driving' | 'walking';
  originPoint?: { name: string; lat: number; lng: number };
  algorithmUsed: 'osrm-trip' | 'tsp-matrix' | 'osrm-route' | 'fixed-matrix';
}

export interface CuratedTour {
  id: string;
  title: string;
  subtitle: string;
  city: string;
  neighborhood: string;
  galleryIds: number[];
  description: string;
  estimatedHours: number;
}
