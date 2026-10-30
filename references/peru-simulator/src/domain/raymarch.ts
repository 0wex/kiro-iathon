import type { Vec3 } from './types';

export interface RaymarchOptions {
  readonly maxDistance: number;
  /** Smallest march step in scene units. */
  readonly minStep?: number;
  /** Fraction of the height above ground used as the next step (lower = safer on steep relief). */
  readonly stepFactor?: number;
  readonly maxSteps?: number;
}

/**
 * First intersection of a ray with a height field y = heightAt(x, z).
 * Marches with steps proportional to the clearance above the ground, then
 * refines the crossing by bisection. `dir` must be normalized.
 */
export function intersectHeightfield(
  origin: Vec3,
  dir: Vec3,
  heightAt: (x: number, z: number) => number,
  opts: RaymarchOptions,
): Vec3 | null {
  const minStep = opts.minStep ?? 1;
  const factor = opts.stepFactor ?? 0.25;
  const maxSteps = opts.maxSteps ?? 2000;
  const at = (t: number) => ({ x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t });
  const clearance = (t: number) => {
    const p = at(t);
    return p.y - heightAt(p.x, p.z);
  };
  let prev = 0;
  let c = clearance(0);
  if (c <= 0) return at(0);
  for (let i = 0; i < maxSteps && prev < opts.maxDistance; i++) {
    const t = Math.min(opts.maxDistance, prev + Math.max(minStep, c * factor));
    const ct = clearance(t);
    if (ct <= 0) {
      let lo = prev;
      let hi = t;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (clearance(mid) > 0) lo = mid;
        else hi = mid;
      }
      return at(hi);
    }
    // Climbing away from the terrain with no relief above it: no hit possible.
    if (dir.y >= 0 && ct > c && i > 64) return null;
    prev = t;
    c = ct;
  }
  return null;
}
