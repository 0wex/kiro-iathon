import { parseCatalog, type LayerCatalog } from '../domain/layer-catalog';
import { decodeGridBands, decodeGridValues, parseWeatherGridMeta, type ScalarGrid, type WeatherGridMeta } from '../domain/weather-grid';
import { parseLightning, type LightningData } from '../domain/lightning';
import { rainGridFromBands, type RainGrid } from '../domain/rain';
import { windGridFromBands, type WindGrid } from '../domain/wind';

/** Proxied to the weather backend (`npm run weather`) by the Vite dev server. */
export const WEATHER_API = '/api';
export const CATALOG_POLL_MS = 60_000;
export const CATALOG_RETRY_MS = 20_000;

export interface LoadedGrid {
  readonly meta: WeatherGridMeta;
  readonly grid: ScalarGrid;
}

export interface LoadedWindGrid {
  readonly meta: WeatherGridMeta;
  readonly grid: WindGrid;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal });
  // Without the backend the Vite dev server answers /api/* with index.html or a proxy error.
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function fetchCatalog(signal?: AbortSignal): Promise<LayerCatalog> {
  const catalog = parseCatalog(await getJson(`${WEATHER_API}/layers`, signal));
  if (!catalog) throw new Error('invalid layer catalog');
  return catalog;
}

async function fetchGridData(productId: string, timeId: string, signal?: AbortSignal): Promise<{ meta: WeatherGridMeta; buffer: ArrayBuffer }> {
  const base = `${WEATHER_API}/layers/${encodeURIComponent(productId)}/${encodeURIComponent(timeId)}`;
  const meta = parseWeatherGridMeta(await getJson(`${base}/meta`, signal));
  if (!meta) throw new Error(`invalid grid metadata for ${productId}/${timeId}`);
  const res = await fetch(`${base}/grid`, { signal });
  if (!res.ok) throw new Error(`grid ${productId}/${timeId}: HTTP ${res.status}`);
  return { meta, buffer: await res.arrayBuffer() };
}

export async function fetchGrid(productId: string, timeId: string, signal?: AbortSignal): Promise<LoadedGrid> {
  const { meta, buffer } = await fetchGridData(productId, timeId, signal);
  const values = decodeGridValues(buffer, meta);
  return { meta, grid: { width: meta.width, height: meta.height, bounds: meta.mercatorBounds, values } };
}

/** Two-band U/V grid of a vector product (m/s). */
export async function fetchWindGrid(productId: string, timeId: string, signal?: AbortSignal): Promise<LoadedWindGrid> {
  const { meta, buffer } = await fetchGridData(productId, timeId, signal);
  return { meta, grid: windGridFromBands(meta, decodeGridBands(buffer, meta)) };
}

export interface LoadedRainGrid {
  readonly meta: WeatherGridMeta;
  readonly grid: RainGrid;
}

/** Two-band precipitation grid (rate mm/h, accumulation mm). */
export async function fetchRainGrid(productId: string, timeId: string, signal?: AbortSignal): Promise<LoadedRainGrid> {
  const { meta, buffer } = await fetchGridData(productId, timeId, signal);
  return { meta, grid: rainGridFromBands(meta, decodeGridBands(buffer, meta)) };
}

/** Observed lightning of the last `minutes` (GET /api/lightning). */
export async function fetchLightning(minutes: number, signal?: AbortSignal): Promise<LightningData> {
  const data = parseLightning(await getJson(`${WEATHER_API}/lightning?minutes=${encodeURIComponent(String(minutes))}`, signal));
  if (!data) throw new Error('invalid lightning response');
  return data;
}

/** GLM files arrive every 20 s; the backend ingests them about once a minute. */
export const LIGHTNING_POLL_MS = 60_000;

export interface PointValue {
  readonly value: number | null;
  readonly units: string;
  readonly validTime: string;
  /** Vector products only: components in m/s (u east, v north). */
  readonly u: number | null;
  readonly v: number | null;
  /** Multi-band scalar products: value of every band (e.g. rate, accum). */
  readonly bands: Readonly<Record<string, number | null>>;
  readonly issueTime: number | null;
}

export async function fetchPoint(productId: string, lat: number, lon: number, timeId: string): Promise<PointValue> {
  const q = new URLSearchParams({ lat: lat.toFixed(5), lon: lon.toFixed(5), time: timeId });
  const json = (await getJson(`${WEATHER_API}/layers/${encodeURIComponent(productId)}/point?${q}`)) as Record<string, unknown>;
  return {
    value: typeof json.value === 'number' ? json.value : null,
    units: String(json.units ?? ''),
    validTime: String(json.validTime ?? ''),
    u: typeof json.u === 'number' ? json.u : null,
    v: typeof json.v === 'number' ? json.v : null,
    bands: parsePointBands(json.bands),
    issueTime: typeof json.issueTime === 'string' && !Number.isNaN(Date.parse(json.issueTime)) ? Date.parse(json.issueTime) : null,
  };
}

function parsePointBands(v: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const [k, x] of Object.entries(v)) out[k] = typeof x === 'number' && Number.isFinite(x) ? x : null;
  return out;
}

/**
 * Grid downloads keyed by product, issue time and valid time, so a new
 * forecast cycle never reuses stale frames. Bounded; oldest entries go first.
 */
export class GridCache<T = LoadedGrid> {
  private readonly entries = new Map<string, Promise<T>>();
  private readonly ready = new Map<string, T>();

  constructor(
    private readonly fetcher: (productId: string, timeId: string) => Promise<T>,
    private readonly capacity = 48,
  ) {}

  static key(productId: string, issueTime: number, timeId: string): string {
    return `${productId}|${issueTime}|${timeId}`;
  }

  peek(key: string): T | undefined {
    return this.ready.get(key);
  }

  load(productId: string, issueTime: number, timeId: string): Promise<T> {
    const key = GridCache.key(productId, issueTime, timeId);
    let p = this.entries.get(key);
    if (!p) {
      p = this.fetcher(productId, timeId).then((g) => {
        this.ready.set(key, g);
        return g;
      });
      // A failed download is retried on the next request.
      p.catch(() => this.entries.delete(key));
      this.entries.set(key, p);
      while (this.entries.size > this.capacity) {
        const oldest = this.entries.keys().next().value as string;
        this.entries.delete(oldest);
        this.ready.delete(oldest);
      }
    }
    return p;
  }
}

/** Polls the layer catalog; reports the backend as unavailable when it cannot be reached. */
export class CatalogFeed {
  private timer: number | undefined;
  private stopped = false;

  constructor(
    private readonly onCatalog: (catalog: LayerCatalog) => void,
    private readonly onUnavailable: (error: Error) => void,
  ) {}

  start(): void {
    this.stopped = false;
    void this.poll();
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.timer);
  }

  /** Re-polls immediately (e.g. when a layer is switched on). */
  refresh(): void {
    window.clearTimeout(this.timer);
    void this.poll();
  }

  private async poll(): Promise<void> {
    let delay = CATALOG_POLL_MS;
    try {
      this.onCatalog(await fetchCatalog());
    } catch (err) {
      delay = CATALOG_RETRY_MS;
      this.onUnavailable(err as Error);
    }
    if (!this.stopped) {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.poll(), delay);
    }
  }
}
