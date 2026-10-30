import { describe, expect, it, vi } from 'vitest';
import { createLocalFrame, lonLatToLocal } from '../domain/local-frame';
import { selectTiles, type LodParams } from '../domain/lod';
import { PERU_BOUNDS } from '../domain/peru';
import type { TileRequest } from '../domain/lod';
import { tileKey } from '../domain/tile-math';
import type { TileId } from '../domain/types';
import { TileLayer } from './tile-layer';

const flush = () => new Promise((r) => setTimeout(r, 0));

function req(z: number, x: number, y: number, priority = z): TileRequest {
  const tile: TileId = { z, x, y };
  return { tile, key: tileKey(tile), priority };
}

function resource(name: string) {
  return { name, dispose: vi.fn() };
}

describe('TileLayer', () => {
  it('loads requested tiles and reports them ready', async () => {
    const onLoaded = vi.fn();
    const layer = new TileLayer({
      load: async (t) => resource(tileKey(t)),
      capacity: 10,
      maxConcurrent: 4,
      onLoaded,
    });
    layer.update([req(5, 8, 16)], new Set());
    expect(layer.isReady('5/8/16')).toBe(false);
    await flush();
    expect(layer.isReady('5/8/16')).toBe(true);
    expect(layer.get('5/8/16')?.name).toBe('5/8/16');
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('evicts least recently used tiles but keeps displayed ones, disposing evicted resources', async () => {
    const made: ReturnType<typeof resource>[] = [];
    const layer = new TileLayer({
      load: async (t) => {
        const r = resource(tileKey(t));
        made.push(r);
        return r;
      },
      capacity: 2,
      maxConcurrent: 4,
    });
    layer.update([req(5, 0, 0), req(5, 1, 0)], new Set());
    await flush();
    layer.update([req(5, 2, 0)], new Set(['5/0/0']));
    await flush();
    expect(layer.isReady('5/0/0')).toBe(true);
    expect(layer.isReady('5/1/0')).toBe(false);
    expect(made.find((m) => m.name === '5/1/0')!.dispose).toHaveBeenCalledTimes(1);
    expect(layer.stats.cached).toBe(2);
  });

  it('cancels requests that are no longer wanted', async () => {
    const signals: AbortSignal[] = [];
    const layer = new TileLayer({
      load: (_t, signal) => {
        signals.push(signal);
        return new Promise<never>(() => {});
      },
      capacity: 10,
      maxConcurrent: 4,
    });
    layer.update([req(5, 0, 0)], new Set());
    layer.update([], new Set());
    expect(signals[0]!.aborted).toBe(true);
    expect(layer.stats.inFlight).toBe(0);
  });

  it('uses the fallback after repeated failures so the tile does not block forever', async () => {
    let now = 0;
    const layer = new TileLayer({
      load: async () => {
        throw new Error('network');
      },
      fallback: (t) => resource(`fallback ${tileKey(t)}`),
      capacity: 10,
      maxConcurrent: 4,
      maxAttempts: 2,
      retryDelayMs: 1000,
      now: () => now,
    });
    layer.update([req(5, 0, 0)], new Set());
    await flush();
    expect(layer.isReady('5/0/0')).toBe(false);
    layer.update([req(5, 0, 0)], new Set());
    expect(layer.stats.inFlight).toBe(0);
    now = 2000;
    layer.update([req(5, 0, 0)], new Set());
    await flush();
    expect(layer.get('5/0/0')?.name).toBe('fallback 5/0/0');
  });

  it('only prefetches into cache headroom left after displayed and needed tiles', async () => {
    const loaded: string[] = [];
    const layer = new TileLayer({
      load: (t) => {
        loaded.push(tileKey(t));
        return new Promise<never>(() => {});
      },
      capacity: 4,
      maxConcurrent: 10,
    });
    const prefetch = (x: number, priority: number): TileRequest => ({ ...req(6, x, 0, priority), prefetch: true });
    // 2 displayed + 1 needed leaves room for exactly one prefetch, the most urgent one.
    layer.update([req(5, 0, 0), prefetch(1, 101), prefetch(0, 100), prefetch(2, 102)], new Set(['5/1/0', '5/2/0']));
    expect(loaded.sort()).toEqual(['5/0/0', '6/0/0']);
  });

  it('schedules every prefetch request when the cache has room', () => {
    const loaded: string[] = [];
    const layer = new TileLayer({
      load: (t) => {
        loaded.push(tileKey(t));
        return new Promise<never>(() => {});
      },
      capacity: 10,
      maxConcurrent: 10,
    });
    layer.update([{ ...req(6, 0, 0), prefetch: true }, { ...req(6, 1, 0), prefetch: true }], new Set());
    expect(loaded.sort()).toEqual(['6/0/0', '6/1/0']);
  });

  it('does not prefetch while needed tiles saturate the request slots', () => {
    const loaded: string[] = [];
    const layer = new TileLayer({
      load: (t) => {
        loaded.push(tileKey(t));
        return new Promise<never>(() => {});
      },
      capacity: 100,
      maxConcurrent: 2,
    });
    layer.update([req(5, 0, 0), req(5, 1, 0), { ...req(6, 0, 0, 1e12), prefetch: true }], new Set());
    expect(loaded.sort()).toEqual(['5/0/0', '5/1/0']);
    expect(layer.stats.queued).toBe(0);
  });

  it('disposes everything on clear', async () => {
    const r = resource('a');
    const layer = new TileLayer({ load: async () => r, capacity: 10, maxConcurrent: 4 });
    layer.update([req(5, 0, 0)], new Set());
    await flush();
    layer.clear();
    expect(r.dispose).toHaveBeenCalledTimes(1);
    expect(layer.isReady('5/0/0')).toBe(false);
  });

  it('never evicts retained working-set tiles, even when they are not displayed', async () => {
    const made: ReturnType<typeof resource>[] = [];
    const layer = new TileLayer({
      load: async (t) => {
        const r = resource(tileKey(t));
        made.push(r);
        return r;
      },
      capacity: 3,
      maxConcurrent: 4,
    });
    layer.update([req(5, 0, 0), req(5, 1, 0), req(5, 2, 0)], new Set());
    await flush();
    // 5/1/0 and 5/2/0 are ready but undisplayed children of an incomplete refinement.
    layer.update([req(5, 3, 0)], new Set(['5/0/0', '5/1/0']));
    await flush();
    expect(layer.isReady('5/0/0')).toBe(true);
    expect(layer.isReady('5/1/0')).toBe(true);
    expect(layer.isReady('5/2/0')).toBe(false);
    expect(made.filter((m) => m.dispose.mock.calls.length > 0).map((m) => m.name)).toEqual(['5/2/0']);
  });

  it('does not download needed tiles beyond the capacity left by retained tiles', async () => {
    let loads = 0;
    const layer = new TileLayer({
      load: async (t) => {
        loads++;
        return resource(tileKey(t));
      },
      capacity: 3,
      maxConcurrent: 8,
    });
    const working = [0, 1, 2, 3, 4].map((x) => req(5, x, 0));
    for (let tick = 0; tick < 10; tick++) {
      const missing = working.filter((r) => !layer.isReady(r.key));
      layer.update(missing, new Set(working.map((r) => r.key)));
      await flush();
    }
    expect(loads).toBe(3);
    expect(layer.stats.cached).toBe(3);
  });

  it('settles to zero new requests under a stable LOD whose working set exceeds the cache', async () => {
    const frame = createLocalFrame(-75, -9.5);
    const p = lonLatToLocal(frame, -72.545, -13.163);
    const capacity = 120;
    let loads = 0;
    const layer = new TileLayer({
      load: async (t) => {
        loads++;
        return resource(tileKey(t));
      },
      capacity,
      maxConcurrent: 8,
    });
    let refined: ReadonlySet<string> = new Set();
    const lodParams = (maxTiles?: number): LodParams => ({
      cameraPosition: { x: p.x, y: 4000, z: p.z },
      frustum: { intersectsBox: () => true },
      viewportHeightPx: 1000,
      fovYRadians: Math.PI / 3,
      frame,
      rootZoom: 5,
      maxZoom: 14,
      bounds: PERU_BOUNDS,
      maxScreenSpaceError: 4,
      segments: 64,
      heightRange: { min: -500, max: 7000 },
      isReady: (k) => layer.isReady(k),
      previouslyRefined: refined,
      maxTiles,
    });
    expect(selectTiles({ ...lodParams(), isReady: () => true }).needed.size).toBeGreaterThan(capacity);
    const tick = async (maxTiles?: number) => {
      const result = selectTiles(lodParams(maxTiles));
      refined = result.refined;
      layer.update(result.requests, result.needed);
      await flush();
    };
    // Without a LOD budget the layer itself must stop downloading what cannot fit.
    for (let i = 0; i < 80; i++) await tick();
    let settled = loads;
    for (let i = 0; i < 30; i++) await tick();
    expect(loads).toBe(settled);
    expect(layer.stats.cached).toBeLessThanOrEqual(capacity);
    // With a budget the working set fits and the view still settles.
    for (let i = 0; i < 80; i++) await tick(capacity - 10);
    settled = loads;
    for (let i = 0; i < 30; i++) await tick(capacity - 10);
    expect(loads).toBe(settled);
    expect(layer.stats.cached).toBeLessThanOrEqual(capacity);
  });
});
