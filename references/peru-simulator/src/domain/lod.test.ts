import { describe, expect, it } from 'vitest';
import { createLocalFrame, lonLatToLocal } from './local-frame';
import { morphFactor, screenSpaceError, selectTiles, type LodParams } from './lod';
import { PERU_BOUNDS } from './peru';
import { lonLatToTile, tileBoundsLonLat, tileKey } from './tile-math';
import type { FrustumLike, TileId } from './types';

const frame = createLocalFrame(-75, -9.5);
const acceptAll: FrustumLike = { intersectsBox: () => true };

function cameraAbove(lon: number, lat: number, altitudeMeters: number) {
  const p = lonLatToLocal(frame, lon, lat);
  return { x: p.x, y: altitudeMeters, z: p.z };
}

function params(overrides: Partial<LodParams> = {}): LodParams {
  return {
    cameraPosition: cameraAbove(-75, -9.5, 3_000_000),
    frustum: acceptAll,
    viewportHeightPx: 1000,
    fovYRadians: Math.PI / 3,
    frame,
    rootZoom: 5,
    maxZoom: 14,
    bounds: PERU_BOUNDS,
    maxScreenSpaceError: 4,
    segments: 64,
    heightRange: { min: -500, max: 7000 },
    isReady: () => true,
    ...overrides,
  };
}

function contains(t: TileId, lon: number, lat: number): boolean {
  const b = tileBoundsLonLat(t);
  return lon >= b.west && lon < b.east && lat > b.south && lat <= b.north;
}

function isAncestor(a: TileId, b: TileId): boolean {
  if (a.z >= b.z) return false;
  const shift = b.z - a.z;
  return b.x >> shift === a.x && b.y >> shift === a.y;
}

/** Counts how many display tiles cover each sample point inside Peru. */
function coverageCounts(display: TileId[]): number[] {
  const counts: number[] = [];
  for (let i = 0; i <= 20; i++) {
    for (let j = 0; j <= 20; j++) {
      const lon = PERU_BOUNDS.west + ((PERU_BOUNDS.east - PERU_BOUNDS.west) * (i + 0.5)) / 21.5;
      const lat = PERU_BOUNDS.south + ((PERU_BOUNDS.north - PERU_BOUNDS.south) * (j + 0.5)) / 21.5;
      counts.push(display.filter((t) => contains(t, lon, lat)).length);
    }
  }
  return counts;
}

describe('selectTiles', () => {
  it('stays coarse when the camera is far away', () => {
    const { display } = selectTiles(params());
    expect(display.length).toBeGreaterThan(0);
    expect(Math.max(...display.map((t) => t.z))).toBeLessThanOrEqual(7);
  });

  it('refines near the camera and stays coarse far from it', () => {
    const { display } = selectTiles(params({ cameraPosition: cameraAbove(-72.545, -13.163, 4000) }));
    const near = display.find((t) => contains(t, -72.545, -13.163));
    expect(near).toBeDefined();
    expect(near!.z).toBeGreaterThanOrEqual(12);
    const far = display.find((t) => contains(t, -80.5, -4));
    expect(far).toBeDefined();
    expect(far!.z).toBeLessThan(near!.z - 3);
  });

  it('never exceeds the maximum zoom', () => {
    const { display, requests } = selectTiles(
      params({ cameraPosition: cameraAbove(-72.545, -13.163, 2500), maxZoom: 11 }),
    );
    expect(Math.max(...display.map((t) => t.z))).toBe(11);
    expect(requests.every((r) => r.tile.z <= 11)).toBe(true);
  });

  it('covers every point in Peru exactly once when all tiles are ready', () => {
    const { display } = selectTiles(params({ cameraPosition: cameraAbove(-76, -11, 20_000) }));
    expect(coverageCounts(display).every((c) => c === 1)).toBe(true);
  });

  it('never returns a parent together with one of its children', () => {
    const { display } = selectTiles(
      params({ cameraPosition: cameraAbove(-76, -11, 20_000), isReady: (k) => Number(k.split('/')[0]) <= 9 }),
    );
    for (const a of display) {
      for (const b of display) expect(isAncestor(a, b)).toBe(false);
    }
  });

  it('falls back to ready ancestors so no holes appear while children load', () => {
    const ready = (k: string) => Number(k.split('/')[0]) <= 7;
    const { display, requests } = selectTiles(
      params({ cameraPosition: cameraAbove(-72.545, -13.163, 4000), isReady: ready }),
    );
    expect(display.every((t) => ready(tileKey(t)))).toBe(true);
    expect(coverageCounts(display).every((c) => c === 1)).toBe(true);
    expect(requests.some((r) => r.tile.z > 7)).toBe(true);
    expect(requests.filter((r) => !r.prefetch).every((r) => !ready(r.key))).toBe(true);
  });

  it('requests coarse tiles before fine ones', () => {
    const { requests } = selectTiles(
      params({ cameraPosition: cameraAbove(-72.545, -13.163, 4000), isReady: () => false }),
    );
    expect(requests.length).toBeGreaterThan(0);
    for (let i = 1; i < requests.length; i++) {
      expect(requests[i]!.priority).toBeGreaterThanOrEqual(requests[i - 1]!.priority);
    }
    expect(requests[0]!.tile.z).toBe(5);
  });

  it('culls tiles outside the Peru bounds', () => {
    const { display } = selectTiles(params({ cameraPosition: cameraAbove(-76, -11, 20_000) }));
    for (const t of display) {
      const b = tileBoundsLonLat(t);
      const overlaps =
        b.east > PERU_BOUNDS.west &&
        b.west < PERU_BOUNDS.east &&
        b.north > PERU_BOUNDS.south &&
        b.south < PERU_BOUNDS.north;
      expect(overlaps).toBe(true);
    }
  });

  it('culls tiles outside the view frustum', () => {
    const rejectAll: FrustumLike = { intersectsBox: () => false };
    const result = selectTiles(params({ frustum: rejectAll }));
    expect(result.display).toEqual([]);
    expect(result.requests).toEqual([]);
  });
});

describe('LOD hysteresis and prefetch', () => {
  // A tiny region inside one z5 tile keeps the quadtree to a single root.
  const region = { west: -72.6, south: -13.2, east: -72.5, north: -13.1 };
  const root = lonLatToTile(-72.55, -13.15, 5);
  const rootKey = tileKey(root);
  const base = params({
    bounds: region,
    maxZoom: 6,
    cameraPosition: cameraAbove(-72.55, -13.15, 400_000),
  });
  const rootSse = screenSpaceError(root, base);
  /** Threshold that places the root's SSE at `ratio` of it. */
  const thresholdFor = (ratio: number) => rootSse / ratio;

  it('keeps a refined tile refined while its SSE stays above the coarsen threshold', () => {
    const result = selectTiles({ ...base, maxScreenSpaceError: thresholdFor(0.85), previouslyRefined: new Set([rootKey]) });
    expect(result.display.length).toBeGreaterThan(0);
    expect(result.display.every((t) => t.z === 6)).toBe(true);
    expect(result.refined.has(rootKey)).toBe(true);
  });

  it('does not refine a coarse tile until its SSE exceeds the refine threshold', () => {
    const result = selectTiles({ ...base, maxScreenSpaceError: thresholdFor(0.85), previouslyRefined: new Set() });
    expect(result.display).toEqual([root]);
    expect(result.refined.has(rootKey)).toBe(false);
  });

  it('coarsens a refined tile once its SSE drops below the coarsen threshold', () => {
    const result = selectTiles({ ...base, maxScreenSpaceError: thresholdFor(0.7), previouslyRefined: new Set([rootKey]) });
    expect(result.display).toEqual([root]);
    expect(result.refined.has(rootKey)).toBe(false);
  });

  it('refines past the threshold regardless of the previous frame', () => {
    const result = selectTiles({ ...base, maxScreenSpaceError: thresholdFor(1.2) });
    expect(result.display.every((t) => t.z === 6)).toBe(true);
    expect(result.refined.has(rootKey)).toBe(true);
  });

  it('prefetches children near the threshold without displaying them', () => {
    const result = selectTiles({
      ...base,
      maxScreenSpaceError: thresholdFor(0.72),
      isReady: (k) => k === rootKey,
    });
    expect(result.display).toEqual([root]);
    const prefetch = result.requests.filter((r) => r.prefetch);
    expect(prefetch.length).toBeGreaterThan(0);
    expect(prefetch.every((r) => r.tile.z === 6)).toBe(true);
  });

  it('does not prefetch when the SSE is well below the threshold', () => {
    const result = selectTiles({
      ...base,
      maxScreenSpaceError: thresholdFor(0.5),
      isReady: (k) => k === rootKey,
    });
    expect(result.requests).toEqual([]);
  });

  it('gives prefetch requests lower priority than needed tiles and bounds their count', () => {
    const ready = (k: string) => Number(k.split('/')[0]) <= 9;
    const result = selectTiles(
      params({ cameraPosition: cameraAbove(-72.545, -13.163, 4000), isReady: ready, maxPrefetch: 5 }),
    );
    const needed = result.requests.filter((r) => !r.prefetch);
    const prefetch = result.requests.filter((r) => r.prefetch);
    expect(needed.length).toBeGreaterThan(0);
    expect(prefetch.length).toBeGreaterThan(0);
    expect(prefetch.length).toBeLessThanOrEqual(5);
    const worstNeeded = Math.max(...needed.map((r) => r.priority));
    expect(prefetch.every((r) => r.priority > worstNeeded)).toBe(true);
    expect(result.requests.every((r) => !ready(r.key))).toBe(true);
    const shown = new Set(result.display.map(tileKey));
    expect(prefetch.some((r) => shown.has(r.key))).toBe(false);
  });

  it('reports a morph factor in [0, 1] for every displayed tile, full detail at the roots', () => {
    const result = selectTiles(params({ cameraPosition: cameraAbove(-76, -11, 20_000) }));
    for (const t of result.display) {
      const m = result.morph.get(tileKey(t));
      expect(m).toBeDefined();
      expect(m!).toBeGreaterThanOrEqual(0);
      expect(m!).toBeLessThanOrEqual(1);
    }
    const far = selectTiles(params());
    for (const t of far.display.filter((d) => d.z === 5)) expect(far.morph.get(tileKey(t))).toBe(1);
  });
});

describe('morphFactor', () => {
  const t = 4;

  it('is 0 when the parent just crossed the refine threshold', () => {
    expect(morphFactor(t, t)).toBe(0);
    expect(morphFactor(t * 0.5, t)).toBe(0);
  });

  it('reaches full detail by the time the tile itself could coarsen', () => {
    // Parent SSE is at least twice the child SSE, so 2 * 0.75 * t covers the coarsen point.
    expect(morphFactor(2 * 0.75 * t, t)).toBe(1);
    expect(morphFactor(10 * t, t)).toBe(1);
    expect(morphFactor(Infinity, t)).toBe(1);
  });

  it('is monotone and clamped to [0, 1]', () => {
    let previous = -1;
    for (let s = 0; s <= 3 * t; s += 0.01) {
      const m = morphFactor(s, t);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
      expect(m).toBeGreaterThanOrEqual(previous);
      previous = m;
    }
  });
});

describe('LOD working set and tile budget', () => {
  const close = cameraAbove(-72.545, -13.163, 4000);

  it('reports every visited tile as needed, including ready ancestors and ready children of incomplete refinements', () => {
    // One z9 tile on the refinement path is missing, so its ready siblings stay undisplayed.
    const full = selectTiles(params({ cameraPosition: close }));
    const missingTile = lonLatToTile(-72.545, -13.163, 9);
    const missing = tileKey(missingTile);
    const underMissing = (k: string) => {
      const [z, x, y] = k.split('/').map(Number) as [number, number, number];
      const t = { z, x, y };
      return k === missing || isAncestor(missingTile, t);
    };
    const result = selectTiles(params({ cameraPosition: close, isReady: (k) => !underMissing(k) }));
    const shown = new Set(result.display.map(tileKey));
    for (const key of shown) expect(result.needed.has(key)).toBe(true);
    for (const r of result.requests.filter((r) => !r.prefetch)) expect(result.needed.has(r.key)).toBe(true);
    const parent = lonLatToTile(-72.545, -13.163, 8);
    expect(shown.has(tileKey(parent))).toBe(true);
    // Ready siblings of the missing child are not displayed but must be kept.
    const siblings = [0, 1, 2, 3]
      .map((i) => tileKey({ z: 9, x: parent.x * 2 + (i & 1), y: parent.y * 2 + (i >> 1) }))
      .filter((k) => k !== missing);
    expect(siblings).toHaveLength(3);
    for (const k of siblings) expect(result.needed.has(k)).toBe(true);
    for (const k of siblings) expect(shown.has(k)).toBe(false);
    // Ancestors of displayed tiles are visited too.
    for (const t of full.display) {
      for (let z = 5; z < t.z; z++) expect(full.needed.has(tileKey({ z, x: t.x >> (t.z - z), y: t.y >> (t.z - z) }))).toBe(true);
    }
  });

  it('keeps the working set within maxTiles by refining less, without holes or overlaps', () => {
    const unbounded = selectTiles(params({ cameraPosition: close }));
    expect(unbounded.needed.size).toBeGreaterThan(150);
    const budget = 120;
    const result = selectTiles(params({ cameraPosition: close, maxTiles: budget }));
    expect(result.needed.size).toBeLessThanOrEqual(budget);
    expect(result.needed.size).toBeGreaterThan(budget - 8);
    expect(coverageCounts(result.display).every((c) => c === 1)).toBe(true);
    const maxZ = (r: typeof result) => Math.max(...r.display.map((t) => t.z));
    expect(maxZ(result)).toBeLessThanOrEqual(maxZ(unbounded));
  });

  it('does not change the selection when the budget is not reached', () => {
    const unbounded = selectTiles(params({ cameraPosition: close }));
    const result = selectTiles(params({ cameraPosition: close, maxTiles: unbounded.needed.size }));
    expect(result.display.map(tileKey).sort()).toEqual(unbounded.display.map(tileKey).sort());
  });
});
