import { mercatorToLocal, type LocalFrame } from './local-frame';
import { childrenOf, lonLatToMercator, tileBoundsMercator, tileKey, tilesCovering } from './tile-math';
import type { FrustumLike, LonLatBounds, TileId, Vec3 } from './types';

/** A refined tile coarsens only once its SSE drops below `threshold * DEFAULT_HYSTERESIS`. */
export const DEFAULT_HYSTERESIS = 0.75;
/** Children are prefetched once a tile's SSE exceeds `threshold * DEFAULT_PREFETCH_RATIO`. */
export const DEFAULT_PREFETCH_RATIO = 0.7;
/** Upper bound on prefetch candidates per selection, so prefetching cannot thrash the caches. */
export const DEFAULT_MAX_PREFETCH = 32;

export interface LodParams {
  cameraPosition: Vec3;
  frustum: FrustumLike;
  viewportHeightPx: number;
  fovYRadians: number;
  frame: LocalFrame;
  /** Coarsest zoom of the quadtree roots. */
  rootZoom: number;
  maxZoom: number;
  /** Region of interest; tiles that do not intersect it are culled. */
  bounds: LonLatBounds;
  /** Maximum tolerated screen-space error in pixels before refining. */
  maxScreenSpaceError: number;
  /** Grid segments per tile edge in the rendered mesh. */
  segments: number;
  /** Vertical extent of terrain in local units (already exaggerated). */
  heightRange: { min: number; max: number };
  /** Whether a tile's data is loaded and can be displayed. */
  isReady: (key: string) => boolean;
  /** Tiles that were refined in the previous selection (`LodResult.refined`). */
  previouslyRefined?: ReadonlySet<string>;
  /** Fraction of the threshold below which a refined tile coarsens again. */
  hysteresis?: number;
  /** Fraction of the threshold above which children are prefetched. */
  prefetchRatio?: number;
  maxPrefetch?: number;
  /**
   * Upper bound on the working set (`LodResult.needed`). When refining
   * everything would exceed it, the tiles with the largest screen-space error
   * refine first and the rest stay coarser, so the working set always fits
   * the tile caches instead of thrashing them.
   */
  maxTiles?: number;
}

export interface TileRequest {
  tile: TileId;
  key: string;
  /** Lower values are more urgent: needed before prefetch, coarse levels first, then by distance. */
  priority: number;
  /**
   * True when the tile is only loaded ahead of time and not needed for display
   * yet. Prefetch requests may already be ready: caches keep the ones that fit
   * instead of evicting and fetching them again.
   */
  prefetch?: boolean;
}

export interface LodResult {
  /** Non-overlapping set of ready tiles to render. */
  display: TileId[];
  /** Needed tiles that are not ready yet plus the prefetch candidates, sorted by priority. */
  requests: TileRequest[];
  /**
   * Working set: every visited tile (displayed, ancestors of displayed tiles
   * and children of refinements that are still incomplete), ready or not.
   * Caches must keep these tiles; evicting one forces it to be requested again.
   */
  needed: Set<string>;
  /** Tiles that chose to refine; feed back as `previouslyRefined` next time. */
  refined: Set<string>;
  /** Geomorph factor per displayed tile key: 0 = parent's surface, 1 = full detail. */
  morph: Map<string, number>;
}

const ZOOM_PRIORITY_WEIGHT = 1e9;
/** Larger than any needed-tile priority (zoom <= 30), so prefetch always comes after needed tiles. */
const PREFETCH_PRIORITY_OFFSET = 1e12;

/**
 * Geomorph factor of a tile from its parent's screen-space error. The tile
 * appears when the parent crosses `threshold` (factor 0, matching the parent
 * surface) and reaches full detail at `2 * hysteresis * threshold`. Because a
 * parent's SSE is at least twice its child's, the tile is fully detailed both
 * when it refines (SSE = threshold) and when it coarsens back
 * (SSE = hysteresis * threshold), so neither transition pops.
 */
export function morphFactor(parentSse: number, threshold: number, hysteresis = DEFAULT_HYSTERESIS): number {
  const full = Math.max(2 * hysteresis, 1 + 1e-6) * threshold;
  const m = (parentSse - threshold) / (full - threshold);
  return Math.min(1, Math.max(0, m));
}

/** Screen-space error in pixels of a tile's mesh as seen from the camera. */
export function screenSpaceError(tile: TileId, p: LodParams): number {
  const box = tileBox(tile, p);
  return sseOf(box, p);
}

interface Box {
  min: Vec3;
  max: Vec3;
}

function tileBox(tile: TileId, p: LodParams): Box {
  const m = tileBoundsMercator(tile);
  const a = mercatorToLocal(p.frame, m.minX, m.maxY);
  const b = mercatorToLocal(p.frame, m.maxX, m.minY);
  return { min: { x: a.x, y: p.heightRange.min, z: a.z }, max: { x: b.x, y: p.heightRange.max, z: b.z } };
}

function boxDistance(p: LodParams, box: Box): number {
  return Math.max(1, distanceToBox(p.cameraPosition, box.min, box.max));
}

function sseOf(box: Box, p: LodParams): number {
  // Pixels per local unit of error at distance 1.
  const sseFactor = p.viewportHeightPx / (2 * Math.tan(p.fovYRadians / 2));
  const geometricError = (box.max.x - box.min.x) / p.segments;
  return (geometricError * sseFactor) / boxDistance(p, box);
}

export function selectTiles(p: LodParams): LodResult {
  const regionM = {
    min: lonLatToMercator(p.bounds.west, p.bounds.south),
    max: lonLatToMercator(p.bounds.east, p.bounds.north),
  };
  const threshold = p.maxScreenSpaceError;
  const hysteresis = p.hysteresis ?? DEFAULT_HYSTERESIS;
  const prefetchThreshold = threshold * (p.prefetchRatio ?? DEFAULT_PREFETCH_RATIO);
  const previouslyRefined = p.previouslyRefined ?? new Set<string>();
  const display: TileId[] = [];
  const requests: TileRequest[] = [];
  const prefetch: TileRequest[] = [];
  const refined = new Set<string>();
  const needed = new Set<string>();
  const morph = new Map<string, number>();

  /** Box of a tile when it intersects both the region and the frustum, else null. */
  const visibleBox = (tile: TileId): Box | null => {
    const m = tileBoundsMercator(tile);
    if (m.maxX <= regionM.min.x || m.minX >= regionM.max.x || m.maxY <= regionM.min.y || m.minY >= regionM.max.y) {
      return null;
    }
    const box = tileBox(tile, p);
    return p.frustum.intersectsBox(box.min, box.max) ? box : null;
  };

  const refineThreshold = (key: string) => (previouslyRefined.has(key) ? threshold * hysteresis : threshold);
  const roots = tilesCovering(p.bounds, p.rootZoom);
  const allowed = p.maxTiles === undefined ? null : budgetRefinements(roots, p, visibleBox, refineThreshold, p.maxTiles);

  /** Returns the tiles that fully cover this node's visible area, or null if it cannot be covered yet. */
  const visit = (tile: TileId, parentSse: number): TileId[] | null => {
    const box = visibleBox(tile);
    if (!box) return [];

    const key = tileKey(tile);
    needed.add(key);
    const ready = p.isReady(key);
    const distance = boxDistance(p, box);
    if (!ready) requests.push({ tile, key, priority: tile.z * ZOOM_PRIORITY_WEIGHT + distance });

    const sse = sseOf(box, p);
    const refineAt = refineThreshold(key);
    const refine = allowed ? allowed.has(key) : tile.z < p.maxZoom && sse > refineAt;
    if (refine) {
      refined.add(key);
      const covered: TileId[] = [];
      let complete = true;
      for (const child of childrenOf(tile)) {
        const r = visit(child, sse);
        if (r === null) complete = false;
        else if (complete) covered.push(...r);
      }
      if (complete) return covered;
    } else if (tile.z < p.maxZoom && sse > prefetchThreshold) {
      // Most imminent refinements first: the closer the SSE is to the threshold, the sooner.
      const imminence = (1 - sse / refineAt) * ZOOM_PRIORITY_WEIGHT;
      for (const child of childrenOf(tile)) {
        const childBox = visibleBox(child);
        if (!childBox) continue;
        const childKey = tileKey(child);
        const priority = PREFETCH_PRIORITY_OFFSET + imminence + boxDistance(p, childBox);
        prefetch.push({ tile: child, key: childKey, priority, prefetch: true });
      }
    }
    if (!ready) return null;
    morph.set(key, morphFactor(parentSse, threshold, hysteresis));
    return [tile];
  };

  for (const root of roots) {
    const r = visit(root, Infinity);
    if (r) display.push(...r);
  }
  prefetch.sort((x, y) => x.priority - y.priority);
  // Ready candidates are included so caches keep them; the limit bounds the prefetched set.
  requests.push(...prefetch.slice(0, p.maxPrefetch ?? DEFAULT_MAX_PREFETCH));
  requests.sort((x, y) => x.priority - y.priority);
  // Drop morph entries of ready tiles whose covering was discarded by an incomplete parent.
  const shown = new Set(display.map(tileKey));
  for (const key of [...morph.keys()]) if (!shown.has(key)) morph.delete(key);
  return { display, requests, needed, refined, morph };
}

/**
 * Chooses which tiles refine so that the visited tree (roots plus the visible
 * children of every refined tile) holds at most `maxTiles` tiles. Tiles are
 * refined in order of decreasing screen-space error; refinement stops at the
 * first tile whose children no longer fit, keeping detail uniform.
 */
function budgetRefinements(
  roots: readonly TileId[],
  p: LodParams,
  visibleBox: (tile: TileId) => Box | null,
  refineThreshold: (key: string) => number,
  maxTiles: number,
): Set<string> {
  const allowed = new Set<string>();
  const candidates: { tile: TileId; key: string; sse: number }[] = [];
  let count = 0;
  const consider = (tile: TileId): void => {
    const box = visibleBox(tile);
    if (!box) return;
    count++;
    if (tile.z >= p.maxZoom) return;
    const key = tileKey(tile);
    const sse = sseOf(box, p);
    if (sse > refineThreshold(key)) candidates.push({ tile, key, sse });
  };
  for (const root of roots) consider(root);
  while (candidates.length > 0) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++) if (candidates[i]!.sse > candidates[best]!.sse) best = i;
    const next = candidates[best]!;
    candidates[best] = candidates[candidates.length - 1]!;
    candidates.pop();
    const children = childrenOf(next.tile).filter((c) => visibleBox(c) !== null);
    if (count + children.length > maxTiles) break;
    allowed.add(next.key);
    for (const child of children) consider(child);
  }
  return allowed;
}

function distanceToBox(p: Vec3, min: Vec3, max: Vec3): number {
  const dx = Math.max(min.x - p.x, 0, p.x - max.x);
  const dy = Math.max(min.y - p.y, 0, p.y - max.y);
  const dz = Math.max(min.z - p.z, 0, p.z - max.z);
  return Math.hypot(dx, dy, dz);
}
