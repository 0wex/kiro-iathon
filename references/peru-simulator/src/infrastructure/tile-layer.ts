import type { TileRequest } from '../domain/lod';
import type { TileId } from '../domain/types';
import { LruCache } from './lru-cache';
import { RequestScheduler } from './request-scheduler';

export interface Disposable {
  dispose(): void;
}

export interface TileLayerOptions<R extends Disposable> {
  load: (tile: TileId, signal: AbortSignal) => Promise<R>;
  /** Resource used after `maxAttempts` failures, so a broken tile never blocks refinement forever. */
  fallback?: (tile: TileId) => R;
  capacity: number;
  maxConcurrent: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  onLoaded?: (key: string) => void;
  now?: () => number;
}

export interface TileLayerStats {
  cached: number;
  queued: number;
  inFlight: number;
}

interface Failure {
  attempts: number;
  retryAt: number;
}

/** One streamed tile dataset: scheduler + bounded LRU cache of disposable resources. */
export class TileLayer<R extends Disposable> {
  private readonly scheduler: RequestScheduler;
  private readonly cache: LruCache<string, R>;
  private readonly failures = new Map<string, Failure>();
  private pinned: ReadonlySet<string> = new Set();
  private generation = 0;
  private readonly now: () => number;

  constructor(private readonly options: TileLayerOptions<R>) {
    this.scheduler = new RequestScheduler({ maxConcurrent: options.maxConcurrent });
    this.cache = new LruCache<string, R>({
      capacity: options.capacity,
      onEvict: (_key, value) => value.dispose(),
      isPinned: (key) => this.pinned.has(key),
    });
    this.now = options.now ?? (() => performance.now());
  }

  get stats(): TileLayerStats {
    return { cached: this.cache.size, ...this.scheduler.stats };
  }

  isReady(key: string): boolean {
    return this.cache.has(key);
  }

  get(key: string): R | undefined {
    return this.cache.peek(key);
  }

  /**
   * Keeps the working set and streams what is missing.
   *
   * `retain` is the working set (displayed tiles, their ancestors, children of
   * incomplete refinements and anything else the caller still uses): cached
   * retained tiles are never evicted. Needed requests are only downloaded
   * into the capacity left beside them, so a working set larger than the
   * cache stops downloading instead of evicting and re-requesting itself.
   * Prefetch requests use spare request slots and the remaining headroom;
   * already cached prefetch tiles count toward that headroom and are kept.
   * Requests no longer wanted are cancelled.
   */
  update(requests: readonly TileRequest[], retain: ReadonlySet<string>): void {
    const pinned = new Set<string>();
    for (const key of retain) {
      if (this.cache.get(key) !== undefined) pinned.add(key);
    }

    const blocked = (key: string) => {
      const failure = this.failures.get(key);
      return failure !== undefined && failure.retryAt > this.now();
    };
    const missing = requests
      .filter((r) => !r.prefetch && !this.cache.has(r.key) && !blocked(r.key))
      .sort((a, b) => a.priority - b.priority);
    const needed = missing.slice(0, Math.max(0, this.options.capacity - pinned.size));

    // Uncached retained tiles still claim their future cache slot.
    const reserved = new Set([...retain, ...needed.map((r) => r.key)]).size;
    const prefetchBudget =
      missing.length >= this.options.maxConcurrent ? 0 : Math.max(0, this.options.capacity - reserved);
    const prefetch: TileRequest[] = [];
    const candidates = requests.filter((r) => r.prefetch && !pinned.has(r.key)).sort((a, b) => a.priority - b.priority);
    for (const r of candidates.slice(0, prefetchBudget)) {
      if (this.cache.get(r.key) !== undefined) pinned.add(r.key);
      else if (!blocked(r.key)) prefetch.push(r);
    }
    this.pinned = pinned;

    const wanted = new Set<string>();
    for (const r of [...needed, ...prefetch]) {
      wanted.add(r.key);
      this.scheduler.schedule(r.key, r.priority, (signal) => this.fetch(r.tile, r.key, signal));
    }
    this.scheduler.retainOnly(wanted);
  }

  /** Cancels all requests and disposes every cached resource. */
  clear(): void {
    this.generation++;
    this.scheduler.cancelAll();
    this.failures.clear();
    this.pinned = new Set();
    this.cache.clear();
  }

  private async fetch(tile: TileId, key: string, signal: AbortSignal): Promise<void> {
    const generation = this.generation;
    try {
      const resource = await this.options.load(tile, signal);
      if (signal.aborted || generation !== this.generation) {
        resource.dispose();
        return;
      }
      this.failures.delete(key);
      this.store(key, resource);
    } catch (error) {
      if (signal.aborted || generation !== this.generation) return;
      const attempts = (this.failures.get(key)?.attempts ?? 0) + 1;
      const maxAttempts = this.options.maxAttempts ?? 3;
      if (attempts >= maxAttempts && this.options.fallback) {
        this.failures.delete(key);
        this.store(key, this.options.fallback(tile));
        return;
      }
      const delay = (this.options.retryDelayMs ?? 3000) * attempts;
      this.failures.set(key, { attempts, retryAt: this.now() + delay });
      console.warn(`Tile ${key} failed (attempt ${attempts})`, error);
    }
  }

  private store(key: string, resource: R): void {
    this.cache.set(key, resource);
    this.options.onLoaded?.(key);
  }
}
