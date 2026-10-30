import { mercatorToLocal, type LocalFrame } from './local-frame';
import { lonLatToMercator } from './tile-math';
import type { MercatorBounds } from './types';

/** Quantization of a served grid: value = code * scale + offset; `nodata` marks missing cells. */
export interface GridEncoding {
  readonly scale: number;
  readonly offset: number;
  readonly nodata: number;
}

/** One band of a band-sequential multi-band grid (e.g. wind u and v). */
export interface BandEncoding {
  readonly name: string;
  readonly scale: number;
  readonly offset: number;
}

/** Metadata of one valid time of a weather product (GET /api/layers/{id}/{time}/meta). */
export interface WeatherGridMeta {
  readonly id: string;
  readonly product: string;
  /** Epoch milliseconds (UTC). */
  readonly validTime: number;
  readonly issueTime: number;
  readonly forecastHour: number;
  readonly units: string;
  readonly width: number;
  readonly height: number;
  /** Extent in Web Mercator meters; row 0 is the north edge, cells are sampled at their centers. */
  readonly mercatorBounds: MercatorBounds;
  /** First band's quantization (the only band of scalar grids). */
  readonly encoding: GridEncoding;
  /** Every band in file order; one entry ("value") for scalar grids. */
  readonly bands: readonly BandEncoding[];
}

/** Decoded scalar field in data units (NaN = no data), row-major from the north edge. */
export interface ScalarGrid {
  readonly width: number;
  readonly height: number;
  readonly bounds: MercatorBounds;
  readonly values: Float32Array;
}

/** Grid extent in local scene coordinates (minZ is the north edge). */
export interface LocalRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export function parseMercatorBounds(v: unknown): MercatorBounds | null {
  if (!isRecord(v)) return null;
  const { minX, minY, maxX, maxY } = v;
  if (!isFiniteNumber(minX) || !isFiniteNumber(minY) || !isFiniteNumber(maxX) || !isFiniteNumber(maxY)) return null;
  if (minX >= maxX || minY >= maxY) return null;
  return { minX, minY, maxX, maxY };
}

export function parseUtc(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function parseBands(encoding: Record<string, unknown>): BandEncoding[] | null {
  if (!Array.isArray(encoding.bands)) {
    const { scale, offset } = encoding;
    return isFiniteNumber(scale) && isFiniteNumber(offset) ? [{ name: 'value', scale, offset }] : null;
  }
  if (encoding.bands.length === 0) return null;
  const bands: BandEncoding[] = [];
  for (const b of encoding.bands) {
    if (!isRecord(b) || !isFiniteNumber(b.scale) || !isFiniteNumber(b.offset)) return null;
    bands.push({ name: String(b.name ?? `band${bands.length}`), scale: b.scale, offset: b.offset });
  }
  return bands;
}

/** Validates untrusted metadata JSON; returns null when it is not usable. */
export function parseWeatherGridMeta(json: unknown): WeatherGridMeta | null {
  if (!isRecord(json) || !isRecord(json.encoding)) return null;
  const bounds = parseMercatorBounds(json.mercatorBounds);
  const validTime = parseUtc(json.validTime);
  const issueTime = parseUtc(json.issueTime);
  const { width, height, id, product, units, forecastHour } = json;
  const { type, nodata } = json.encoding;
  if (!bounds || validTime === null || issueTime === null) return null;
  if (!isPositiveInt(width) || !isPositiveInt(height) || typeof id !== 'string') return null;
  if (type !== 'uint16' || !Number.isInteger(nodata)) return null;
  const bands = parseBands(json.encoding);
  if (!bands) return null;
  return {
    id,
    product: String(product ?? ''),
    validTime,
    issueTime,
    forecastHour: isFiniteNumber(forecastHour) ? forecastHour : 0,
    units: String(units ?? ''),
    width,
    height,
    mercatorBounds: bounds,
    encoding: { scale: bands[0]!.scale, offset: bands[0]!.offset, nodata: nodata as number },
    bands,
  };
}

/** Decodes a little-endian Uint16 grid (GET /api/layers/{id}/{time}/grid) to data units (first band). */
export function decodeGridValues(buffer: ArrayBuffer, meta: WeatherGridMeta): Float32Array {
  const n = meta.width * meta.height;
  if (buffer.byteLength !== n * 2 * meta.bands.length) {
    throw new Error(`grid size ${buffer.byteLength} B, expected ${n * 2 * meta.bands.length} B`);
  }
  return decodeBand(new DataView(buffer), 0, n, meta.encoding.scale, meta.encoding.offset, meta.encoding.nodata);
}

/** Decodes every band of a band-sequential Uint16 grid (NaN = no data). */
export function decodeGridBands(buffer: ArrayBuffer, meta: WeatherGridMeta): Float32Array[] {
  const n = meta.width * meta.height;
  const expected = n * 2 * meta.bands.length;
  if (buffer.byteLength !== expected) throw new Error(`grid size ${buffer.byteLength} B, expected ${expected} B`);
  const view = new DataView(buffer);
  return meta.bands.map((b, i) => decodeBand(view, i * n * 2, n, b.scale, b.offset, meta.encoding.nodata));
}

function decodeBand(view: DataView, byteOffset: number, n: number, scale: number, offset: number, nodata: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const code = view.getUint16(byteOffset + i * 2, true);
    out[i] = code === nodata ? NaN : code * scale + offset;
  }
  return out;
}

/** Web Mercator -> grid UV (u east, v = 0 at the north edge); affine because the grid is mercator. */
export function mercatorToGridUv(b: MercatorBounds, mx: number, my: number): { u: number; v: number } {
  return { u: (mx - b.minX) / (b.maxX - b.minX), v: (b.maxY - my) / (b.maxY - b.minY) };
}

export function mercatorRectLocal(frame: LocalFrame, b: MercatorBounds): LocalRect {
  const nw = mercatorToLocal(frame, b.minX, b.maxY);
  const se = mercatorToLocal(frame, b.maxX, b.minY);
  return { minX: nw.x, maxX: se.x, minZ: nw.z, maxZ: se.z };
}

/** Local scene position -> grid UV; the terrain shader does the same with the rect uniform. */
export function localToGridUv(rect: LocalRect, x: number, z: number): { u: number; v: number } {
  return { u: (x - rect.minX) / (rect.maxX - rect.minX), v: (z - rect.minZ) / (rect.maxZ - rect.minZ) };
}

/** Grid UV -> local scene position (inverse of localToGridUv). */
export function gridUvToLocal(rect: LocalRect, u: number, v: number): { x: number; z: number } {
  return { x: rect.minX + u * (rect.maxX - rect.minX), z: rect.minZ + v * (rect.maxZ - rect.minZ) };
}

/**
 * Bilinear sample with texel centers at (i + 0.5) / size, matching GPU linear
 * filtering with clamp-to-edge. Null outside [0, 1]^2 or when a contributing
 * cell has no data.
 */
export function sampleGridUv(g: ScalarGrid, u: number, v: number): number | null {
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  const fx = Math.min(g.width - 1, Math.max(0, u * g.width - 0.5));
  const fy = Math.min(g.height - 1, Math.max(0, v * g.height - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, g.width - 1);
  const y1 = Math.min(y0 + 1, g.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number, w: number) => (w === 0 ? 0 : w * g.values[y * g.width + x]!);
  const value =
    at(x0, y0, (1 - tx) * (1 - ty)) + at(x1, y0, tx * (1 - ty)) + at(x0, y1, (1 - tx) * ty) + at(x1, y1, tx * ty);
  return Number.isFinite(value) ? value : null;
}

export function sampleGridLonLat(g: ScalarGrid, lon: number, lat: number): number | null {
  const m = lonLatToMercator(lon, lat);
  const { u, v } = mercatorToGridUv(g.bounds, m.x, m.y);
  return sampleGridUv(g, u, v);
}
