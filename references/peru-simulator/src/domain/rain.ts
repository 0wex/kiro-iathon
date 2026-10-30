import { paletteColor, type Palette } from './palette';
import { formatUtc } from './timeline';
import { lonLatToMercator } from './tile-math';
import type { MercatorBounds } from './types';
import { mercatorToGridUv, sampleGridUv, type ScalarGrid, type WeatherGridMeta } from './weather-grid';

/** Rain display mode: forecast rate (mm/h) or accumulation since the run start (mm). */
export type RainMode = 'rate' | 'accum';

export interface RainScale {
  readonly mode: RainMode;
  /** Backend band name (gfs-precip: "rate", "accum"). */
  readonly band: RainMode;
  /** Mode switch label. */
  readonly label: string;
  readonly units: string;
  /** Ascending intensity thresholds; values at or below the first are transparent. */
  readonly thresholds: readonly number[];
}

export const RAIN_SCALES: Readonly<Record<RainMode, RainScale>> = {
  rate: { mode: 'rate', band: 'rate', label: 'Rate (mm/h)', units: 'mm/h', thresholds: [0.1, 1, 2.5, 5, 10, 25, 50] },
  accum: { mode: 'accum', band: 'accum', label: 'Accumulated (mm)', units: 'mm', thresholds: [0.5, 2, 5, 10, 25, 50, 100] },
};

export const RAIN_MODES: readonly RainMode[] = ['rate', 'accum'];

/**
 * Rain palette in threshold-index space (index i = i-th threshold, 0 = no rain),
 * so the strongly skewed intensity scale gets even color steps. Transparent up to
 * the first threshold with a soft edge just above it; light rain blue/green,
 * moderate yellow, heavy orange/red, extreme magenta.
 */
export const RAIN_INDEX_PALETTE: Palette = {
  stops: [
    { value: 0, color: [150, 200, 255, 0] },
    { value: 1, color: [150, 200, 255, 0] },
    { value: 1.15, color: [130, 190, 250, 165] },
    { value: 2, color: [60, 140, 230, 215] },
    { value: 3, color: [40, 185, 90, 225] },
    { value: 4, color: [245, 225, 50, 235] },
    { value: 5, color: [250, 150, 30, 240] },
    { value: 6, color: [230, 40, 40, 245] },
    { value: 7, color: [180, 30, 170, 250] },
  ],
};

/** Piecewise-linear value -> threshold index in [0, thresholds.length]; NaN stays NaN. */
export function rainIndex(value: number, thresholds: readonly number[]): number {
  if (Number.isNaN(value)) return Number.NaN;
  if (!(value > 0)) return 0;
  let lo = 0;
  for (let i = 0; i < thresholds.length; i++) {
    const hi = thresholds[i]!;
    if (value <= hi) return i + (value - lo) / (hi - lo);
    lo = hi;
  }
  return thresholds.length;
}

export function rainColor(value: number, mode: RainMode): [number, number, number, number] {
  const index = rainIndex(value, RAIN_SCALES[mode].thresholds);
  return Number.isNaN(index) ? [0, 0, 0, 0] : paletteColor(RAIN_INDEX_PALETTE, index);
}

/** Legend ticks: each threshold at its even position along the index palette (0..1). */
export function rainLegendStops(mode: RainMode): { position: number; label: string }[] {
  const t = RAIN_SCALES[mode].thresholds;
  return t.map((v, i) => ({ position: (i + 1) / t.length, label: String(v) }));
}

/** Precipitation grid of gfs-precip: rate (mm/h) and accumulation (mm), NaN = no data. */
export interface RainGrid {
  readonly width: number;
  readonly height: number;
  readonly bounds: MercatorBounds;
  readonly rate: Float32Array;
  readonly accum: Float32Array;
  /** GFS run (epoch ms): the accumulation starts here. */
  readonly issueTime: number;
}

export function rainGridFromBands(meta: WeatherGridMeta, bands: readonly Float32Array[]): RainGrid {
  const at = (name: string, fallback: number) => {
    const i = meta.bands.findIndex((b) => b.name === name);
    return bands[i < 0 ? fallback : i];
  };
  const rate = at('rate', 0);
  const accum = at('accum', 1);
  if (!rate || !accum) throw new Error(`${meta.product}: expected rate and accum bands`);
  return { width: meta.width, height: meta.height, bounds: meta.mercatorBounds, rate, accum, issueTime: meta.issueTime };
}

/** Scalar grid of the selected mode in threshold-index space (what the terrain drape colors). */
export function rainIndexGrid(g: RainGrid, mode: RainMode): ScalarGrid {
  const { band, thresholds } = RAIN_SCALES[mode];
  const src = g[band];
  const values = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) values[i] = rainIndex(src[i]!, thresholds);
  return { width: g.width, height: g.height, bounds: g.bounds, values };
}

export interface RainValue {
  readonly rate: number | null;
  readonly accum: number | null;
}

/** Bilinear rate and accumulation at a lon/lat, or null outside the grid. */
export function sampleRainLonLat(g: RainGrid, lon: number, lat: number): RainValue | null {
  const m = lonLatToMercator(lon, lat);
  const { u, v } = mercatorToGridUv(g.bounds, m.x, m.y);
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  const base = { width: g.width, height: g.height, bounds: g.bounds };
  return { rate: sampleGridUv({ ...base, values: g.rate }, u, v), accum: sampleGridUv({ ...base, values: g.accum }, u, v) };
}

const amount = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v)));

/** "2.3 mm/h (forecast)". */
export function formatRainRate(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'No data here';
  const min = RAIN_SCALES.rate.thresholds[0]!;
  if (value < min) return `No rain (< ${min} mm/h, forecast)`;
  return `${amount(value)} mm/h (forecast)`;
}

/** "14 mm accumulated since 2026-10-17 18:00 UTC". */
export function formatRainAccum(value: number | null, issueTime: number): string {
  if (value === null || Number.isNaN(value)) return 'No data here';
  const min = RAIN_SCALES.accum.thresholds[0]!;
  const since = `accumulated since ${formatUtc(issueTime)}`;
  return value < min ? `< ${min} mm ${since}` : `${amount(value)} mm ${since}`;
}

export function formatRain(value: RainValue, mode: RainMode, issueTime: number): string {
  return mode === 'rate' ? formatRainRate(value.rate) : formatRainAccum(value.accum, issueTime);
}
