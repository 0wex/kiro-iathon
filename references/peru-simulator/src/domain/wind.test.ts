import { describe, expect, it } from 'vitest';
import { lonLatToMercator } from './tile-math';
import { decodeGridBands, parseWeatherGridMeta } from './weather-grid';
import {
  compassLabel,
  formatWind,
  msToKmh,
  sampleWindLonLat,
  windDirectionFrom,
  windGridFromBands,
  windSpeed,
} from './wind';

const sw = lonLatToMercator(-83.4, -20.4);
const ne = lonLatToMercator(-66.6, 2.0);
const bounds = { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };

function windMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '20261018T0000Z',
    product: 'gfs-wind10m',
    validTime: '2026-10-18T00:00:00Z',
    issueTime: '2026-10-17T18:00:00Z',
    forecastHour: 6,
    units: 'm/s',
    bands: ['u', 'v'],
    width: 2,
    height: 1,
    mercatorBounds: bounds,
    encoding: {
      type: 'uint16',
      byteOrder: 'little',
      layout: 'band-sequential',
      nodata: 65535,
      bands: [
        { name: 'u', scale: 0.5, offset: -10, min: -10, max: 10 },
        { name: 'v', scale: 0.25, offset: -5, min: -5, max: 5 },
      ],
    },
    ...overrides,
  };
}

describe('two-band (U/V) grids', () => {
  it('parses band encodings', () => {
    const m = parseWeatherGridMeta(windMeta());
    expect(m?.bands.map((b) => b.name)).toEqual(['u', 'v']);
    expect(m?.bands[1]).toMatchObject({ scale: 0.25, offset: -5 });
  });

  it('rejects malformed band encodings', () => {
    expect(parseWeatherGridMeta(windMeta({ encoding: { type: 'uint16', nodata: 65535, bands: [{ name: 'u' }] } }))).toBeNull();
    expect(parseWeatherGridMeta(windMeta({ encoding: { type: 'uint16', nodata: 65535, bands: [] } }))).toBeNull();
  });

  it('decodes band-sequential codes with per-band scale/offset and nodata', () => {
    const meta = parseWeatherGridMeta(windMeta())!;
    // u: [0, 26] -> [-10, 3]; v: [65535, 28] -> [NaN, 2]
    const codes = new Uint16Array([0, 26, 65535, 28]);
    const [u, v] = decodeGridBands(codes.buffer, meta);
    expect(Array.from(u!)).toEqual([-10, 3]);
    expect(v![0]).toBeNaN();
    expect(v![1]).toBe(2);
    expect(() => decodeGridBands(new ArrayBuffer(4), meta)).toThrow();
  });

  it('builds a wind grid and samples U/V bilinearly at lon/lat', () => {
    const meta = parseWeatherGridMeta(windMeta())!;
    const g = windGridFromBands(meta, [new Float32Array([2, 4]), new Float32Array([-1, -3])]);
    const west = sampleWindLonLat(g, -79.2, -9.2); // u = 0.25 -> first column center
    expect(west?.u).toBeCloseTo(2);
    expect(west?.v).toBeCloseTo(-1);
    const mid = sampleWindLonLat(g, -75, -9.2);
    expect(mid?.u).toBeCloseTo(3);
    expect(mid?.v).toBeCloseTo(-2);
    expect(sampleWindLonLat(g, -60, -9.2)).toBeNull();
  });
});

describe('wind speed and meteorological direction', () => {
  it('direction is where the wind comes FROM (u > 0 east, v > 0 north)', () => {
    expect(windDirectionFrom(0, -5)).toBeCloseTo(0);
    expect(windDirectionFrom(-5, 0)).toBeCloseTo(90);
    expect(windDirectionFrom(0, 5)).toBeCloseTo(180);
    expect(windDirectionFrom(5, 0)).toBeCloseTo(270);
    expect(windDirectionFrom(3, 3)).toBeCloseTo(225);
  });

  it('speed and units', () => {
    expect(windSpeed(3, 4)).toBe(5);
    expect(msToKmh(5)).toBeCloseTo(18);
  });

  it('16-point compass labels', () => {
    expect(compassLabel(0)).toBe('N');
    expect(compassLabel(11.2)).toBe('N');
    expect(compassLabel(11.3)).toBe('NNE');
    expect(compassLabel(225)).toBe('SW');
    expect(compassLabel(359.9)).toBe('N');
    expect(compassLabel(-90)).toBe('W');
  });

  it('formats a readout like "18 km/h from SW (225°)"', () => {
    expect(formatWind(3.5355, 3.5355)).toBe('18 km/h from SW (225°)');
    expect(formatWind(0, 2.604)).toBe('9 km/h from S (180°)');
    expect(formatWind(0.05, 0.05)).toBe('Calm (< 1 km/h)');
  });
});
