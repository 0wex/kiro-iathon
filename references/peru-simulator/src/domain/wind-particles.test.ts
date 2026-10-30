import { describe, expect, it } from 'vitest';
import { createLocalFrame, localToLonLat } from './local-frame';
import { lonLatToMercator } from './tile-math';
import { gridUvToLocal, localToGridUv, mercatorRectLocal } from './weather-grid';
import {
  advectUv,
  animationSpeedFactor,
  chooseTrailRect,
  clipRect,
  footprintUv,
  rectContains,
  type UvRect,
} from './wind-particles';

const sw = lonLatToMercator(-83.4, -20.4);
const ne = lonLatToMercator(-66.6, 2.0);
const bounds = { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };
const frame = createLocalFrame(-75, -9.2);
const rect = mercatorRectLocal(frame, bounds);
const DEG = Math.PI / 180;

/** Great-circle-free local check: true meters between two lon/lat points (equirectangular, short distances). */
function meters(a: { lon: number; lat: number }, b: { lon: number; lat: number }): { east: number; north: number } {
  const R = 6378137;
  return { east: (b.lon - a.lon) * DEG * R * Math.cos(((a.lat + b.lat) / 2) * DEG), north: (b.lat - a.lat) * DEG * R };
}

describe('advectUv (CPU reference of the particle shader)', () => {
  const start = { u: 0.5, v: 0.5 };

  it('an east wind moves the particle toward +x (east)', () => {
    const p = advectUv(start.u, start.v, 10, 0, bounds, 60);
    expect(p.u).toBeGreaterThan(start.u);
    expect(p.v).toBeCloseTo(start.v, 12);
    const a = gridUvToLocal(rect, start.u, start.v);
    const b = gridUvToLocal(rect, p.u, p.v);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.z).toBeCloseTo(a.z, 6);
  });

  it('a north wind (v > 0) moves the particle north: v decreases, local z decreases', () => {
    const p = advectUv(start.u, start.v, 0, 10, bounds, 60);
    expect(p.v).toBeLessThan(start.v);
    expect(gridUvToLocal(rect, p.u, p.v).z).toBeLessThan(gridUvToLocal(rect, start.u, start.v).z);
  });

  it('moves the true distance speed * time (mercator stretch compensated)', () => {
    for (const v0 of [0.1, 0.5, 0.9]) {
      const p = advectUv(0.5, v0, 6, -8, bounds, 100); // 10 m/s for 100 s = 1000 m
      const a = gridUvToLocal(rect, 0.5, v0);
      const b = gridUvToLocal(rect, p.u, p.v);
      const d = meters(localToLonLat(frame, a.x, a.z), localToLonLat(frame, b.x, b.z));
      expect(d.east).toBeCloseTo(600, -0.5);
      expect(d.north).toBeCloseTo(-800, -0.5);
    }
  });

  it('scales linearly with the animation speed factor (dt * factor)', () => {
    const a = advectUv(0.5, 0.5, 5, 5, bounds, 2 * 1000);
    const b = advectUv(0.5, 0.5, 5, 5, bounds, 1000 * 2);
    expect(a).toEqual(b);
  });
});

describe('mercator <-> local mapping of grid UV', () => {
  it('round-trips and matches the grid corners', () => {
    const nw = gridUvToLocal(rect, 0, 0);
    expect(nw.x).toBeCloseTo(rect.minX);
    expect(nw.z).toBeCloseTo(rect.minZ);
    const p = gridUvToLocal(rect, 0.3, 0.7);
    const uv = localToGridUv(rect, p.x, p.z);
    expect(uv.u).toBeCloseTo(0.3, 12);
    expect(uv.v).toBeCloseTo(0.7, 12);
  });
});

describe('trail rect (view-adaptive particle region)', () => {
  const aspect = (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY);

  it('keeps the current rect while the footprint stays inside and is not much smaller', () => {
    const current: UvRect = { u0: 0.2, v0: 0.2, du: 0.5, dv: 0.5 * aspect };
    const footprint: UvRect = { u0: 0.3, v0: 0.3, du: 0.25, dv: 0.25 * aspect };
    expect(chooseTrailRect(current, footprint, aspect)).toBe(current);
  });

  it('re-centers on a footprint that leaves the rect, square in mercator meters', () => {
    const current: UvRect = { u0: 0.0, v0: 0.0, du: 0.3, dv: 0.3 * aspect };
    const footprint: UvRect = { u0: 0.6, v0: 0.5, du: 0.2, dv: 0.1 };
    const r = chooseTrailRect(current, footprint, aspect);
    expect(r).not.toBe(current);
    expect(rectContains(r, footprint)).toBe(true);
    expect(r.dv / r.du).toBeCloseTo(aspect, 9);
  });

  it('shrinks when zooming in far below the rect size', () => {
    const current: UvRect = { u0: 0, v0: 0, du: 1, dv: aspect };
    const footprint: UvRect = { u0: 0.5, v0: 0.5, du: 0.02, dv: 0.02 };
    const r = chooseTrailRect(current, footprint, aspect);
    expect(r.du).toBeLessThan(0.1);
  });

  it('never exceeds the larger grid side', () => {
    const r = chooseTrailRect(null, { u0: -2, v0: -2, du: 5, dv: 5 }, aspect);
    expect(Math.max(r.du, r.dv / aspect)).toBeLessThanOrEqual(Math.max(1, 1 / aspect) + 1e-9);
  });

  it('clips to the grid', () => {
    expect(clipRect({ u0: -0.5, v0: 0.5, du: 1, dv: 1 })).toEqual({ u0: 0, v0: 0.5, du: 0.5, dv: 0.5 });
  });
});

describe('footprintUv', () => {
  it('top-down view: footprint is the square under the camera', () => {
    const toUv = (x: number, z: number) => localToGridUv(rect, x, z);
    const out = { u0: 0, v0: 0, du: 0, dv: 0 };
    const o = { x: 0, y: 1000, z: 0 };
    const rays = [
      { x: -0.5, y: -1, z: -0.5 },
      { x: 0.5, y: -1, z: -0.5 },
      { x: 0.5, y: -1, z: 0.5 },
      { x: -0.5, y: -1, z: 0.5 },
    ];
    const f = footprintUv(o, rays, 0, 1e6, rect, out);
    expect(f).toBe(out);
    const a = toUv(-500, -500);
    const b = toUv(500, 500);
    expect(f.u0).toBeCloseTo(a.u, 9);
    expect(f.v0).toBeCloseTo(a.v, 9);
    expect(f.u0 + f.du).toBeCloseTo(b.u, 9);
    expect(f.v0 + f.dv).toBeCloseTo(b.v, 9);
  });

  it('rays above the horizon are clamped to the max distance', () => {
    const unit = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
    const out = { u0: 0, v0: 0, du: 0, dv: 0 };
    const f = footprintUv({ x: 0, y: 10, z: 0 }, [{ x: 0, y: 1, z: -1 }, { x: 0, y: -1, z: 0 }], 0, 100, unit, out);
    expect(f.v0).toBeCloseTo(-100 / Math.SQRT2, 6);
  });
});

describe('animationSpeedFactor', () => {
  it('scales with the region size so motion reads the same at every zoom', () => {
    expect(animationSpeedFactor(2_000_000)).toBeCloseTo(2 * animationSpeedFactor(1_000_000));
    // A 10 m/s wind crosses a fixed fraction of the region per second.
    const side = 1_500_000;
    expect((10 * animationSpeedFactor(side)) / side).toBeGreaterThan(0.01);
    expect((10 * animationSpeedFactor(side)) / side).toBeLessThan(0.2);
  });
});
