import { lonLatToMercator } from './tile-math';
import type { MercatorBounds } from './types';
import { mercatorToGridUv, sampleGridUv, type ScalarGrid, type WeatherGridMeta } from './weather-grid';

/**
 * Wind vector grid in m/s, row-major from the north edge (NaN = no data).
 * GRIB convention: u > 0 blows toward the east, v > 0 toward the north.
 */
export interface WindGrid {
  readonly width: number;
  readonly height: number;
  readonly bounds: MercatorBounds;
  readonly u: Float32Array;
  readonly v: Float32Array;
}

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;
/** Below this speed a direction is meaningless. */
const CALM_KMH = 1;

export function windGridFromBands(meta: WeatherGridMeta, bands: readonly Float32Array[]): WindGrid {
  const iu = meta.bands.findIndex((b) => b.name === 'u');
  const iv = meta.bands.findIndex((b) => b.name === 'v');
  const u = bands[iu < 0 ? 0 : iu];
  const v = bands[iv < 0 ? 1 : iv];
  if (!u || !v) throw new Error(`${meta.product}: expected u and v bands`);
  return { width: meta.width, height: meta.height, bounds: meta.mercatorBounds, u, v };
}

/** Bilinear U/V at a lon/lat (same texel-center convention as the GPU), or null outside / no data. */
export function sampleWindLonLat(g: WindGrid, lon: number, lat: number): { u: number; v: number } | null {
  const m = lonLatToMercator(lon, lat);
  const { u, v } = mercatorToGridUv(g.bounds, m.x, m.y);
  const base = { width: g.width, height: g.height, bounds: g.bounds };
  const su = sampleGridUv({ ...base, values: g.u } satisfies ScalarGrid, u, v);
  const sv = sampleGridUv({ ...base, values: g.v } satisfies ScalarGrid, u, v);
  return su === null || sv === null ? null : { u: su, v: sv };
}

export function windSpeed(u: number, v: number): number {
  return Math.hypot(u, v);
}

/** Meteorological direction in degrees, where the wind comes FROM: 0 = north, 90 = east, [0, 360). */
export function windDirectionFrom(u: number, v: number): number {
  const deg = (Math.atan2(-u, -v) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function msToKmh(speed: number): number {
  return speed * 3.6;
}

/** 16-point compass label; each sector spans 22.5° centered on its direction. */
export function compassLabel(directionDeg: number): string {
  const d = ((directionDeg % 360) + 360) % 360;
  return COMPASS_16[Math.floor((d + 11.25) / 22.5) % 16]!;
}

/** "18 km/h from SW (225°)" from U/V in m/s. */
export function formatWind(u: number, v: number): string {
  const kmh = msToKmh(windSpeed(u, v));
  if (kmh < CALM_KMH) return `Calm (< ${CALM_KMH} km/h)`;
  const dir = windDirectionFrom(u, v);
  return `${Math.round(kmh)} km/h from ${compassLabel(dir)} (${Math.round(dir) % 360}°)`;
}
