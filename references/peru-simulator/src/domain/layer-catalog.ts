import type { TimeEntry } from './timeline';
import { parseUtc } from './weather-grid';

export type LayerKind = 'observed' | 'forecast';
export type ProductStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

/** One backend product as listed by GET /api/layers. Times are epoch ms (UTC). */
export interface LayerProduct {
  readonly id: string;
  readonly title: string;
  readonly kind: LayerKind;
  readonly source: string;
  readonly attribution: string;
  readonly units: string;
  readonly displayRange: readonly [number, number] | null;
  readonly status: ProductStatus;
  readonly error: string | null;
  readonly issueTime: number | null;
  readonly times: readonly TimeEntry[];
}

export interface LayerCatalog {
  readonly generatedAt: number | null;
  readonly layers: readonly LayerProduct[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const STATUSES: readonly ProductStatus[] = ['idle', 'loading', 'ready', 'stale', 'error'];
/** Ids end up in request paths: keep them to a safe charset. */
const SAFE_ID = /^[\w-]+$/;

function parseRange(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  return v[0] < v[1] ? [v[0], v[1]] : null;
}

function parseTimes(v: unknown): TimeEntry[] {
  if (!Array.isArray(v)) return [];
  const out: TimeEntry[] = [];
  for (const t of v) {
    if (!isRecord(t) || typeof t.id !== 'string' || !SAFE_ID.test(t.id)) continue;
    const validTime = parseUtc(t.validTime);
    if (validTime === null) continue;
    out.push({ id: t.id, validTime, forecastHour: typeof t.forecastHour === 'number' ? t.forecastHour : 0 });
  }
  return out.sort((a, b) => a.validTime - b.validTime);
}

function parseLayer(v: unknown): LayerProduct | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !SAFE_ID.test(v.id)) return null;
  if (v.kind !== 'observed' && v.kind !== 'forecast') return null;
  const status = STATUSES.includes(v.status as ProductStatus) ? (v.status as ProductStatus) : 'error';
  return {
    id: v.id,
    title: String(v.title ?? v.id),
    kind: v.kind,
    source: String(v.source ?? ''),
    attribution: String(v.attribution ?? ''),
    units: String(v.units ?? ''),
    displayRange: parseRange(v.displayRange),
    status,
    error: typeof v.error === 'string' ? v.error : null,
    issueTime: parseUtc(v.issueTime),
    times: parseTimes(v.times),
  };
}

/** Validates the untrusted catalog JSON; invalid layers are dropped. */
export function parseCatalog(json: unknown): LayerCatalog | null {
  if (!isRecord(json) || !Array.isArray(json.layers)) return null;
  return {
    generatedAt: parseUtc(json.generatedAt),
    layers: json.layers.map(parseLayer).filter((l): l is LayerProduct => l !== null),
  };
}
