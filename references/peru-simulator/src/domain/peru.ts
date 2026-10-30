import type { LonLat, LonLatBounds } from './types';

/** Approximate bounding box of Peru. */
export const PERU_BOUNDS: LonLatBounds = { west: -81.4, south: -18.4, east: -68.6, north: 0.0 };

export const PERU_CENTER: LonLat = { lon: -75.0, lat: -9.2 };

/** Highest point in Peru (Huascarán Sur) rounded up, used for bounding volumes. */
export const PERU_MAX_ELEVATION = 6800;

export interface Landmark {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  /** Suggested viewing distance from the target, in meters. */
  readonly viewDistance: number;
}

export const LANDMARKS: readonly Landmark[] = [
  { name: 'Machu Picchu', lon: -72.545, lat: -13.163, viewDistance: 9000 },
  { name: 'Huascarán', lon: -77.6045, lat: -9.1222, viewDistance: 25000 },
  { name: 'Lake Titicaca', lon: -69.55, lat: -15.85, viewDistance: 90000 },
  { name: 'Colca Canyon', lon: -71.88, lat: -15.62, viewDistance: 30000 },
  { name: 'Lima', lon: -77.0428, lat: -12.0464, viewDistance: 40000 },
];
