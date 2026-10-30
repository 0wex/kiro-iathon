import { describe, expect, it } from 'vitest';
import { createLocalFrame, lonLatToLocal } from './local-frame';
import { lonLatToMercator } from './tile-math';
import {
  decodeGridValues,
  localToGridUv,
  mercatorRectLocal,
  mercatorToGridUv,
  parseWeatherGridMeta,
  sampleGridLonLat,
  sampleGridUv,
  type ScalarGrid,
} from './weather-grid';

const sw = lonLatToMercator(-83.4, -20.4);
const ne = lonLatToMercator(-66.6, 2.0);
const bounds = { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };

function rawMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '20261018T0000Z',
    product: 'gfs-t2m',
    validTime: '2026-10-18T00:00:00Z',
    issueTime: '2026-10-17T18:00:00Z',
    forecastHour: 6,
    units: '°C',
    width: 2,
    height: 2,
    mercatorBounds: bounds,
    encoding: { type: 'uint16', byteOrder: 'little', scale: 0.5, offset: -10, nodata: 65535, min: -10, max: 20 },
    ...overrides,
  };
}

/** 2x2 grid: row 0 (north) = [0, 10], row 1 (south) = [20, 30]. */
function grid2x2(): ScalarGrid {
  return { width: 2, height: 2, bounds, values: new Float32Array([0, 10, 20, 30]) };
}

describe('parseWeatherGridMeta', () => {
  it('accepts backend metadata', () => {
    const m = parseWeatherGridMeta(rawMeta());
    expect(m?.forecastHour).toBe(6);
    expect(m?.encoding.scale).toBe(0.5);
    expect(m?.mercatorBounds.maxY).toBeCloseTo(ne.y);
  });

  it('rejects malformed metadata', () => {
    expect(parseWeatherGridMeta(null)).toBeNull();
    expect(parseWeatherGridMeta(rawMeta({ width: 0 }))).toBeNull();
    expect(parseWeatherGridMeta(rawMeta({ validTime: 'nope' }))).toBeNull();
    expect(parseWeatherGridMeta(rawMeta({ encoding: { type: 'float16' } }))).toBeNull();
    expect(parseWeatherGridMeta(rawMeta({ mercatorBounds: { ...bounds, minX: bounds.maxX } }))).toBeNull();
  });
});

describe('decodeGridValues', () => {
  it('applies scale/offset and maps nodata to NaN', () => {
    const meta = parseWeatherGridMeta(rawMeta())!;
    const codes = new Uint16Array([0, 20, 65535, 60]);
    const values = decodeGridValues(codes.buffer, meta);
    expect(Array.from(values.slice(0, 2))).toEqual([-10, 0]);
    expect(values[2]).toBeNaN();
    expect(values[3]).toBe(20);
  });

  it('rejects a buffer of the wrong size', () => {
    const meta = parseWeatherGridMeta(rawMeta())!;
    expect(() => decodeGridValues(new ArrayBuffer(6), meta)).toThrow();
  });
});

describe('grid sampling', () => {
  it('returns texel values at pixel centers (v = 0 is north)', () => {
    const g = grid2x2();
    expect(sampleGridUv(g, 0.25, 0.25)).toBe(0);
    expect(sampleGridUv(g, 0.75, 0.25)).toBe(10);
    expect(sampleGridUv(g, 0.25, 0.75)).toBe(20);
  });

  it('interpolates bilinearly between centers and clamps at edges', () => {
    const g = grid2x2();
    expect(sampleGridUv(g, 0.5, 0.5)).toBeCloseTo(15);
    expect(sampleGridUv(g, 0.5, 0.25)).toBeCloseTo(5);
    expect(sampleGridUv(g, 0, 0)).toBe(0);
    expect(sampleGridUv(g, 1, 1)).toBe(30);
    expect(sampleGridUv(g, -0.01, 0.5)).toBeNull();
    expect(sampleGridUv(g, 0.5, 1.01)).toBeNull();
  });

  it('returns null when interpolation touches nodata', () => {
    const g: ScalarGrid = { ...grid2x2(), values: new Float32Array([0, NaN, 20, 30]) };
    expect(sampleGridUv(g, 0.25, 0.75)).toBe(20);
    expect(sampleGridUv(g, 0.5, 0.5)).toBeNull();
  });

  it('maps mercator and lon/lat to grid UV', () => {
    expect(mercatorToGridUv(bounds, bounds.minX, bounds.maxY)).toEqual({ u: 0, v: 0 });
    const c = mercatorToGridUv(bounds, (bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
    expect(c.u).toBeCloseTo(0.5);
    expect(c.v).toBeCloseTo(0.5);
    const se = lonLatToMercator(-66.6, -20.4);
    const uv = mercatorToGridUv(bounds, se.x, se.y);
    expect(uv.u).toBeCloseTo(1);
    expect(uv.v).toBeCloseTo(1);
    expect(sampleGridLonLat(grid2x2(), -83.4, 2.0)).toBe(0);
    expect(sampleGridLonLat(grid2x2(), -60, -10)).toBeNull();
  });

  it('local scene coordinates map to the same UV as mercator (draped in the shader)', () => {
    const frame = createLocalFrame(-75, -9.2);
    const rect = mercatorRectLocal(frame, bounds);
    const lima = lonLatToLocal(frame, -77.04, -12.05);
    const m = lonLatToMercator(-77.04, -12.05);
    const a = localToGridUv(rect, lima.x, lima.z);
    const b = mercatorToGridUv(bounds, m.x, m.y);
    expect(a.u).toBeCloseTo(b.u, 9);
    expect(a.v).toBeCloseTo(b.v, 9);
    expect(rect.minZ).toBeLessThan(rect.maxZ);
  });
});
