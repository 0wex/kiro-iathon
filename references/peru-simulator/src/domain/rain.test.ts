import { describe, expect, it } from 'vitest';
import {
  formatRain,
  formatRainAccum,
  formatRainRate,
  RAIN_INDEX_PALETTE,
  RAIN_SCALES,
  rainColor,
  rainGridFromBands,
  rainIndex,
  rainIndexGrid,
  rainLegendStops,
  sampleRainLonLat,
} from './rain';
import { paletteRange } from './palette';
import { parseWeatherGridMeta } from './weather-grid';

const ISSUE = Date.UTC(2026, 9, 17, 18);

describe('rain scales', () => {
  it('uses the agreed intensity thresholds per mode', () => {
    expect(RAIN_SCALES.rate.thresholds).toEqual([0.1, 1, 2.5, 5, 10, 25, 50]);
    expect(RAIN_SCALES.rate.units).toBe('mm/h');
    expect(RAIN_SCALES.rate.band).toBe('rate');
    expect(RAIN_SCALES.rate.label).toBe('Rate (mm/h)');
    expect(RAIN_SCALES.accum.thresholds).toEqual([0.5, 2, 5, 10, 25, 50, 100]);
    expect(RAIN_SCALES.accum.units).toBe('mm');
    expect(RAIN_SCALES.accum.band).toBe('accum');
    expect(RAIN_SCALES.accum.label).toBe('Accumulated (mm)');
    // The index palette spans one unit per threshold.
    expect(paletteRange(RAIN_INDEX_PALETTE)).toEqual([0, 7]);
  });

  it('maps values piecewise-linearly onto threshold indices', () => {
    const t = RAIN_SCALES.rate.thresholds;
    expect(rainIndex(0, t)).toBe(0);
    expect(rainIndex(0.05, t)).toBeCloseTo(0.5);
    expect(rainIndex(0.1, t)).toBeCloseTo(1);
    expect(rainIndex(1, t)).toBeCloseTo(2);
    expect(rainIndex(1.75, t)).toBeCloseTo(2.5);
    expect(rainIndex(50, t)).toBeCloseTo(7);
    expect(rainIndex(400, t)).toBe(7);
    expect(rainIndex(-1, t)).toBe(0);
    expect(rainIndex(Number.NaN, t)).toBeNaN();
  });
});

describe('rain palette', () => {
  it('is transparent at and below the rain threshold, with a soft edge above it', () => {
    expect(rainColor(0, 'rate')[3]).toBe(0);
    expect(rainColor(0.05, 'rate')[3]).toBe(0);
    expect(rainColor(0.1, 'rate')[3]).toBe(0);
    const edge = rainColor(0.15, 'rate')[3];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(rainColor(1, 'rate')[3]);
    expect(rainColor(0.4, 'accum')[3]).toBe(0);
    expect(rainColor(Number.NaN, 'rate')[3]).toBe(0);
  });

  it('goes blue/green (light) -> yellow (moderate) -> orange/red (heavy)', () => {
    const [r1, g1, b1] = rainColor(1, 'rate');
    expect(b1).toBeGreaterThan(r1);
    expect(b1).toBeGreaterThan(g1);
    const [r2, g2, b2] = rainColor(2.5, 'rate');
    expect(g2).toBeGreaterThan(r2);
    expect(g2).toBeGreaterThan(b2);
    const [r5, g5, b5] = rainColor(5, 'rate');
    expect(r5).toBeGreaterThan(200);
    expect(g5).toBeGreaterThan(200);
    expect(b5).toBeLessThan(100);
    const [r10, g10] = rainColor(10, 'rate');
    expect(r10).toBeGreaterThan(200);
    expect(g10).toBeLessThan(180);
    const [r25, g25, b25] = rainColor(25, 'rate');
    expect(r25).toBeGreaterThan(200);
    expect(g25).toBeLessThan(80);
    expect(b25).toBeLessThan(80);
    // Opacity never decreases with intensity.
    let last = 0;
    for (const v of [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50, 100]) {
      const a = rainColor(v, 'rate')[3];
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });

  it('colors accumulations on the analogous scale', () => {
    expect(rainColor(10, 'accum')).toEqual(rainColor(5, 'rate'));
    expect(rainColor(100, 'accum')).toEqual(rainColor(50, 'rate'));
  });

  it('places legend stops evenly at the thresholds', () => {
    const stops = rainLegendStops('rate');
    expect(stops.map((s) => s.label)).toEqual(['0.1', '1', '2.5', '5', '10', '25', '50']);
    expect(stops[0]!.position).toBeCloseTo(1 / 7);
    expect(stops.at(-1)!.position).toBeCloseTo(1);
  });
});

describe('rain readout', () => {
  it('formats forecast rates', () => {
    expect(formatRainRate(2.34)).toBe('2.3 mm/h (forecast)');
    expect(formatRainRate(12.6)).toBe('13 mm/h (forecast)');
    expect(formatRainRate(0.04)).toBe('No rain (< 0.1 mm/h, forecast)');
    expect(formatRainRate(null)).toBe('No data here');
  });

  it('formats accumulations since the run start', () => {
    expect(formatRainAccum(14.2, ISSUE)).toBe('14 mm accumulated since 2026-10-17 18:00 UTC');
    expect(formatRainAccum(3.25, ISSUE)).toBe('3.3 mm accumulated since 2026-10-17 18:00 UTC');
    expect(formatRainAccum(0.2, ISSUE)).toBe('< 0.5 mm accumulated since 2026-10-17 18:00 UTC');
    expect(formatRainAccum(null, ISSUE)).toBe('No data here');
  });

  it('switches the formatted value with the mode', () => {
    expect(formatRain({ rate: 2.3, accum: 14 }, 'rate', ISSUE)).toBe('2.3 mm/h (forecast)');
    expect(formatRain({ rate: 2.3, accum: 14 }, 'accum', ISSUE)).toBe('14 mm accumulated since 2026-10-17 18:00 UTC');
  });
});

describe('rain grid', () => {
  const meta = parseWeatherGridMeta({
    id: '20261018T0000Z',
    product: 'gfs-precip',
    validTime: '2026-10-18T00:00:00Z',
    issueTime: '2026-10-17T18:00:00Z',
    forecastHour: 6,
    units: 'mm/h',
    width: 2,
    height: 1,
    mercatorBounds: { minX: -9_000_000, minY: -2_000_000, maxX: -7_000_000, maxY: -1_000_000 },
    encoding: {
      type: 'uint16',
      nodata: 65535,
      bands: [
        { name: 'rate', scale: 1, offset: 0 },
        { name: 'accum', scale: 1, offset: 0 },
      ],
    },
  })!;
  const grid = rainGridFromBands(meta, [new Float32Array([0, 5]), new Float32Array([2, 10])]);

  it('picks the band and threshold scale of the selected mode', () => {
    expect(Array.from(rainIndexGrid(grid, 'rate').values)).toEqual([0, 4]);
    expect(Array.from(rainIndexGrid(grid, 'accum').values)).toEqual([2, 4]);
    expect(rainIndexGrid(grid, 'rate').bounds).toBe(grid.bounds);
  });

  it('samples both bands at a lon/lat', () => {
    const v = sampleRainLonLat(grid, -73.5, -14);
    expect(v).not.toBeNull();
    expect(v!.rate).toBeGreaterThanOrEqual(0);
    expect(v!.accum).toBeGreaterThanOrEqual(2);
    expect(sampleRainLonLat(grid, 0, 40)).toBeNull();
  });
});
