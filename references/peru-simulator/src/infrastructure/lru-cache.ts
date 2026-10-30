export interface LruCacheOptions<K, V> {
  capacity: number;
  /** Called whenever an entry leaves the cache (eviction, overwrite, delete, clear). */
  onEvict: (key: K, value: V) => void;
  /** Pinned entries are never evicted; the cache may temporarily exceed capacity. */
  isPinned?: (key: K) => boolean;
}

/** Least-recently-used cache backed by Map insertion order. */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly options: LruCacheOptions<K, V>) {}

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Returns the value and marks it as most recently used. */
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    const previous = this.map.get(key);
    if (previous !== undefined) {
      this.map.delete(key);
      if (previous !== value) this.options.onEvict(key, previous);
    }
    this.map.set(key, value);
    this.evictOverflow();
  }

  delete(key: K): void {
    const value = this.map.get(key);
    if (value === undefined) return;
    this.map.delete(key);
    this.options.onEvict(key, value);
  }

  clear(): void {
    const entries = [...this.map];
    this.map.clear();
    for (const [k, v] of entries) this.options.onEvict(k, v);
  }

  private evictOverflow(): void {
    if (this.map.size <= this.options.capacity) return;
    const isPinned = this.options.isPinned ?? (() => false);
    for (const key of [...this.map.keys()]) {
      if (this.map.size <= this.options.capacity) break;
      if (!isPinned(key)) this.delete(key);
    }
  }
}
