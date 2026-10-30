import { formatAge } from './timeline';
import { EARTH_RADIUS, lonLatToMercator } from './tile-math';
import type { LonLatBounds } from './types';
import { parseUtc } from './weather-grid';

/**
 * Observed lightning (GOES-19 GLM flashes, GET /api/lightning): a rolling
 * window ending now, independent of the forecast timeline. Times are epoch
 * ms (UTC); ages are measured against the wall clock, so markers keep aging
 * between polls.
 */
export interface LightningData {
  readonly windowMinutes: number;
  readonly windowEnd: number;
  /** End of the newest ingested GLM file, or null when none yet. */
  readonly obsTime: number | null;
  /** Flashes are complete from here (later than the window start while backfilling). */
  readonly coverageStart: number | null;
  readonly status: string;
  readonly count: number;
  readonly bounds: LonLatBounds;
  readonly lat: Float64Array;
  readonly lon: Float64Array;
  /** Flash time (first optical event), epoch ms. */
  readonly time: Float64Array;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseBounds(v: unknown): LonLatBounds | null {
  if (!isRecord(v)) return null;
  const { west, south, east, north } = v;
  if (!finite(west) || !finite(south) || !finite(east) || !finite(north) || west >= east || south >= north) return null;
  return { west, south, east, north };
}

/** Validates the untrusted /api/lightning JSON; flashes with non-finite fields are dropped. */
export function parseLightning(json: unknown): LightningData | null {
  if (!isRecord(json) || !isRecord(json.flashes)) return null;
  const windowEnd = parseUtc(json.windowEnd);
  const bounds = parseBounds(json.bounds);
  if (windowEnd === null || bounds === null || !finite(json.windowMinutes) || json.windowMinutes <= 0) return null;
  const { lat, lon, age } = json.flashes;
  if (!Array.isArray(lat) || !Array.isArray(lon) || !Array.isArray(age)) return null;
  const n = Math.min(lat.length, lon.length, age.length);
  const la: number[] = [];
  const lo: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = lat[i];
    const b = lon[i];
    const s = age[i];
    if (!finite(a) || !finite(b) || !finite(s)) continue;
    la.push(a);
    lo.push(b);
    t.push(windowEnd - s * 1000);
  }
  return {
    windowMinutes: json.windowMinutes,
    windowEnd,
    obsTime: parseUtc(json.obsTime),
    coverageStart: parseUtc(json.coverageStart),
    status: typeof json.status === 'string' ? json.status : 'ready',
    count: t.length,
    bounds,
    lat: Float64Array.from(la),
    lon: Float64Array.from(lo),
    time: Float64Array.from(t),
  };
}

/** Flashes younger than this pulse (seconds). */
export const LIGHTNING_PULSE_S = 120;
/** Pulse period of recent flashes (seconds of wall-clock time). */
const PULSE_PERIOD_S = 1.4;

export interface AgeStyle {
  readonly rgb: readonly [number, number, number];
  readonly alpha: number;
}

/** Age ramp: white-yellow (now) -> yellow (10 min) -> orange (window end), fading. */
const AGE_STOPS: readonly { age: number; rgb: [number, number, number]; alpha: number }[] = [
  { age: 0, rgb: [255, 255, 225], alpha: 1 },
  { age: 120, rgb: [255, 245, 150], alpha: 1 },
  { age: 600, rgb: [255, 215, 60], alpha: 0.85 },
  { age: 1800, rgb: [255, 160, 40], alpha: 0.5 },
  { age: 3600, rgb: [230, 110, 40], alpha: 0.22 },
];

/** Marker color and opacity for a flash `ageSeconds` old in a window of `windowSeconds`. */
export function lightningAgeStyle(ageSeconds: number, windowSeconds: number): AgeStyle {
  const age = Math.max(0, ageSeconds);
  if (age > windowSeconds) return { rgb: AGE_STOPS.at(-1)!.rgb, alpha: 0 };
  // The ramp is defined for a 60-min window and stretched to the configured one.
  const a = (age * 3600) / windowSeconds;
  for (let i = 1; i < AGE_STOPS.length; i++) {
    const p = AGE_STOPS[i - 1]!;
    const q = AGE_STOPS[i]!;
    if (a <= q.age) {
      const k = (a - p.age) / (q.age - p.age);
      const mix = (x: number, y: number) => Math.round(x + (y - x) * k);
      return {
        rgb: [mix(p.rgb[0], q.rgb[0]), mix(p.rgb[1], q.rgb[1]), mix(p.rgb[2], q.rgb[2])],
        alpha: p.alpha + (q.alpha - p.alpha) * k,
      };
    }
  }
  const last = AGE_STOPS.at(-1)!;
  return { rgb: last.rgb, alpha: last.alpha };
}

/**
 * Pulse strength 0..1 of a flash `ageSeconds` old at wall-clock `nowMs`:
 * zero after LIGHTNING_PULSE_S; otherwise a ring cycle whose amplitude decays with age.
 */
export function pulsePhase(ageSeconds: number, nowMs: number): number {
  if (!(ageSeconds < LIGHTNING_PULSE_S)) return 0;
  const strength = 1 - Math.max(0, ageSeconds) / LIGHTNING_PULSE_S;
  const cycle = ((nowMs / 1000) % PULSE_PERIOD_S) / PULSE_PERIOD_S;
  return strength * (0.5 + 0.5 * Math.cos(cycle * 2 * Math.PI));
}

export interface FlashCell {
  /** Centroid, mercator meters. */
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Most recent flash, epoch ms. */
  readonly latest: number;
}

/** Grid binning in mercator meters (cells of `cellMeters`), largest cells first. */
export function clusterFlashes(data: LightningData, cellMeters: number): FlashCell[] {
  const cells = new Map<string, { sx: number; sy: number; count: number; latest: number }>();
  for (let i = 0; i < data.count; i++) {
    const m = lonLatToMercator(data.lon[i]!, data.lat[i]!);
    const key = `${Math.floor(m.x / cellMeters)},${Math.floor(m.y / cellMeters)}`;
    const c = cells.get(key);
    const t = data.time[i]!;
    if (c) {
      c.sx += m.x;
      c.sy += m.y;
      c.count++;
      if (t > c.latest) c.latest = t;
    } else cells.set(key, { sx: m.x, sy: m.y, count: 1, latest: t });
  }
  return [...cells.values()]
    .map((c) => ({ x: c.sx / c.count, y: c.sy / c.count, count: c.count, latest: c.latest }))
    .sort((a, b) => b.count - a.count);
}

/** Views wider than this (mercator meters) show clusters; closer views show every flash. */
export const CLUSTER_ABOVE_M = 300_000;
const CELLS_ACROSS = 24;

export function clusterMode(regionMeters: number): { mode: 'clusters' | 'flashes'; cellMeters: number } {
  return regionMeters > CLUSTER_ABOVE_M
    ? { mode: 'clusters', cellMeters: regionMeters / CELLS_ACROSS }
    : { mode: 'flashes', cellMeters: 0 };
}

export function formatFlashCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return (2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)))) / 1000;
}

/** Readout search radius around a clicked point (km). */
export const LIGHTNING_READOUT_KM = 20;

export function lightningSummary(data: LightningData, lon: number, lat: number, radiusKm: number): { count: number; latest: number | null } {
  let count = 0;
  let latest: number | null = null;
  for (let i = 0; i < data.count; i++) {
    if (haversineKm(lon, lat, data.lon[i]!, data.lat[i]!) > radiusKm) continue;
    count++;
    const t = data.time[i]!;
    if (latest === null || t > latest) latest = t;
  }
  return { count, latest };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatUtcClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function formatLightningReadout(
  s: { count: number; latest: number | null },
  radiusKm: number,
  windowMinutes: number,
  nowMs: number,
): string {
  const where = `within ${radiusKm} km in the last ${windowMinutes} min`;
  if (s.count === 0 || s.latest === null) return `No flashes ${where}`;
  const what = `${s.count.toLocaleString('en-US')} flash${s.count === 1 ? '' : 'es'}`;
  return `${what} ${where} · latest ${formatUtcClock(s.latest)} (${formatAge((nowMs - s.latest) / 1000)} ago)`;
}
