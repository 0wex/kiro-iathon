import { EARTH_RADIUS } from './tile-math';
import type { MercatorBounds } from './types';
import type { LocalRect } from './weather-grid';

/**
 * Particle advection math shared by the GPU simulation (rendering/wind-layer.ts
 * mirrors advectUv in GLSL) and the tests. Positions are grid UV of the wind
 * grid: u grows east, v = 0 at the north edge; the grid is Web Mercator so UV
 * is affine in mercator meters.
 */

/** Rectangle in grid UV (may extend past [0, 1]). */
export interface UvRect {
  readonly u0: number;
  readonly v0: number;
  readonly du: number;
  readonly dv: number;
}

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Moves a particle by a wind of (windU east, windV north) m/s during `seconds`
 * of simulated time (frame dt times the animation speed-up). Mercator meters
 * per true meter is 1 / cos(lat) = cosh(y / R) at mercator y.
 */
export function advectUv(
  u: number,
  v: number,
  windU: number,
  windV: number,
  bounds: MercatorBounds,
  seconds: number,
): { u: number; v: number } {
  const height = bounds.maxY - bounds.minY;
  const y = bounds.maxY - v * height;
  const stretch = Math.cosh(y / EARTH_RADIUS);
  return {
    u: u + (windU * seconds * stretch) / (bounds.maxX - bounds.minX),
    v: v - (windV * seconds * stretch) / height,
  };
}

/**
 * Animation time multiplier for a particle region of `sideMeters` (mercator):
 * a 10 m/s wind crosses ~4% of the region per second at every zoom level, so
 * relative speeds stay real while the motion stays readable.
 */
export function animationSpeedFactor(sideMeters: number): number {
  return (0.04 * sideMeters) / 10;
}

export function rectContains(outer: UvRect, inner: UvRect): boolean {
  return (
    inner.u0 >= outer.u0 &&
    inner.v0 >= outer.v0 &&
    inner.u0 + inner.du <= outer.u0 + outer.du &&
    inner.v0 + inner.dv <= outer.v0 + outer.dv
  );
}

/** Intersection with the grid [0, 1]^2 (empty rects have zero size). */
export function clipRect(r: UvRect): UvRect {
  const u0 = Math.min(1, Math.max(0, r.u0));
  const v0 = Math.min(1, Math.max(0, r.v0));
  const u1 = Math.min(1, Math.max(0, r.u0 + r.du));
  const v1 = Math.min(1, Math.max(0, r.v0 + r.dv));
  return { u0, v0, du: Math.max(0, u1 - u0), dv: Math.max(0, v1 - v0) };
}

/** Footprint padding, new-rect margin and the zoom-in ratio that triggers a smaller rect. */
const FOOTPRINT_PAD = 1.1;
const RECT_MARGIN = 1.35;
const SHRINK_RATIO = 0.35;

/**
 * Region in which particles live and trails are drawn. It is square in
 * mercator meters (`aspect` = grid width / height in meters, so dv = du *
 * aspect) and changes only when the view footprint leaves it or becomes much
 * smaller (hysteresis: every change resamples the trail texture). Layers that
 * redraw from scratch (lightning markers) pass a larger `shrinkRatio`.
 */
export function chooseTrailRect(current: UvRect | null, footprint: UvRect, aspect: number, shrinkRatio = SHRINK_RATIO): UvRect {
  const cu = footprint.u0 + footprint.du / 2;
  const cv = footprint.v0 + footprint.dv / 2;
  // Side in units of the grid width; the grid's larger side bounds it.
  const maxSide = Math.max(1, 1 / aspect);
  const need = Math.min(maxSide, Math.max(footprint.du, footprint.dv / aspect) * FOOTPRINT_PAD);
  if (current && need >= current.du * shrinkRatio) {
    // Footprint box (centered, square) inside the current rect, without allocating.
    const hu = need / 2;
    const hv = (need * aspect) / 2;
    const fits =
      cu - hu >= current.u0 - 1e-12 &&
      cv - hv >= current.v0 - 1e-12 &&
      cu + hu <= current.u0 + current.du + 1e-12 &&
      cv + hv <= current.v0 + current.dv + 1e-12;
    // A rect as large as the grid covers everything that can hold particles.
    if (fits || current.du >= maxSide - 1e-9) return current;
  }
  const side = Math.min(maxSide, need * RECT_MARGIN);
  return clamped({ u0: cu - side / 2, v0: cv - (side * aspect) / 2, du: side, dv: side * aspect });
}

/** Keeps the rect center over the grid, or the grid inside a rect larger than it. */
function clamped(r: UvRect): UvRect {
  let { u0, v0 } = r;
  if (r.du >= 1) u0 = Math.min(0, Math.max(1 - r.du, u0));
  else u0 = Math.min(1 - r.du / 2, Math.max(-r.du / 2, u0));
  if (r.dv >= 1) v0 = Math.min(0, Math.max(1 - r.dv, v0));
  else v0 = Math.min(1 - r.dv / 2, Math.max(-r.dv / 2, v0));
  return { u0, v0, du: r.du, dv: r.dv };
}

/** Mutable rect for per-frame results (no allocation). */
export interface MutableUvRect {
  u0: number;
  v0: number;
  du: number;
  dv: number;
}

/**
 * Bounding box in grid UV of where view rays meet the plane y = groundY.
 * Rays that miss it (above the horizon) or go further than maxDistance are
 * cut at maxDistance. Directions need not be normalized. `rect` is the grid
 * extent in local coordinates; the result is written to `out`.
 */
export function footprintUv(
  origin: Vec3Like,
  directions: readonly Vec3Like[],
  groundY: number,
  maxDistance: number,
  rect: LocalRect,
  out: MutableUvRect,
): MutableUvRect {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const d of directions) {
    const len = Math.hypot(d.x, d.y, d.z);
    if (len === 0) continue;
    const dy = d.y / len;
    let t = dy < -1e-6 ? (groundY - origin.y) / dy : maxDistance;
    if (!(t >= 0) || t > maxDistance) t = maxDistance;
    const x = origin.x + (d.x / len) * t;
    const z = origin.z + (d.z / len) * t;
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  if (!Number.isFinite(x0)) {
    out.u0 = 0;
    out.v0 = 0;
    out.du = 1;
    out.dv = 1;
    return out;
  }
  const sx = rect.maxX - rect.minX;
  const sz = rect.maxZ - rect.minZ;
  out.u0 = (x0 - rect.minX) / sx;
  out.v0 = (z0 - rect.minZ) / sz;
  out.du = (x1 - x0) / sx;
  out.dv = (z1 - z0) / sz;
  return out;
}
