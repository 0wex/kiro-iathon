import { describe, expect, it } from 'vitest';
import {
  clusterFlashes,
  clusterMode,
  formatFlashCount,
  formatLightningReadout,
  LIGHTNING_PULSE_S,
  lightningAgeStyle,
  lightningSummary,
  parseLightning,
  pulsePhase,
  type LightningData,
} from './lightning';
import { lonLatToMercator } from './tile-math';

const END = Date.UTC(2026, 9, 18, 0, 30, 0);

function response(flashes: { lat: number; lon: number; age: number }[]) {
  return {
    id: 'glm-lightning',
    kind: 'observed',
    status: 'ready',
    windowMinutes: 60,
    windowStart: '2026-10-17T23:30:00Z',
    windowEnd: '2026-10-18T00:30:00Z',
    obsTime: '2026-10-18T00:29:40Z',
    coverageStart: '2026-10-17T23:30:00Z',
    count: flashes.length,
    bounds: { west: -83.4, south: -20.4, east: -66.6, north: 2 },
    flashes: {
      lat: flashes.map((f) => f.lat),
      lon: flashes.map((f) => f.lon),
      age: flashes.map((f) => f.age),
      energyFj: flashes.map(() => 12.5),
    },
  };
}

describe('parseLightning', () => {
  it('converts ages to absolute flash times and validates the payload', () => {
    const d = parseLightning(response([{ lat: -12, lon: -77, age: 90 }, { lat: -9, lon: -75, age: 5 }]))!;
    expect(d.windowMinutes).toBe(60);
    expect(d.windowEnd).toBe(END);
    expect(d.obsTime).toBe(Date.UTC(2026, 9, 18, 0, 29, 40));
    expect(d.count).toBe(2);
    expect(Array.from(d.time)).toEqual([END - 90_000, END - 5_000]);
    expect(d.lat[1]).toBeCloseTo(-9);
    expect(d.bounds.west).toBe(-83.4);
  });

  it('rejects malformed payloads and drops non-finite flashes', () => {
    expect(parseLightning(null)).toBeNull();
    expect(parseLightning({ ...response([]), windowEnd: 'nope' })).toBeNull();
    const bad = response([{ lat: -12, lon: -77, age: 1 }]);
    (bad.flashes.lat as unknown[]).push('x');
    (bad.flashes.lon as unknown[]).push(-70);
    (bad.flashes.age as unknown[]).push(3);
    expect(parseLightning(bad)!.count).toBe(1);
    const empty = parseLightning(response([]))!;
    expect(empty.count).toBe(0);
  });
});

describe('age styling', () => {
  it('is bright white/yellow when recent and fades with age', () => {
    const fresh = lightningAgeStyle(10, 3600);
    const mid = lightningAgeStyle(20 * 60, 3600);
    const old = lightningAgeStyle(59 * 60, 3600);
    expect(fresh.alpha).toBe(1);
    expect(fresh.rgb[0]).toBe(255);
    expect(fresh.rgb[2]).toBeGreaterThan(180); // near white
    expect(mid.rgb[2]).toBeLessThan(fresh.rgb[2]); // yellow / orange
    expect(mid.alpha).toBeLessThan(fresh.alpha);
    expect(old.alpha).toBeLessThan(mid.alpha);
    expect(old.alpha).toBeGreaterThanOrEqual(0.2);
    // Outside the window: invisible; future flashes (clock skew) count as now.
    expect(lightningAgeStyle(3700, 3600).alpha).toBe(0);
    expect(lightningAgeStyle(-5, 3600)).toEqual(lightningAgeStyle(0, 3600));
  });

  it('pulses only flashes from the last two minutes, from the real clock', () => {
    expect(LIGHTNING_PULSE_S).toBe(120);
    expect(pulsePhase(30, 0)).toBeGreaterThan(0);
    expect(pulsePhase(30, 0)).toBeLessThanOrEqual(1);
    expect(pulsePhase(121, 0)).toBe(0);
    // The phase depends on wall-clock time, so the same flash pulses over time.
    expect(pulsePhase(30, 0)).not.toBeCloseTo(pulsePhase(30, 600));
    // Strength decays with age.
    expect(pulsePhase(100, 0)).toBeLessThan(pulsePhase(10, 0));
  });
});

describe('clustering', () => {
  const pts = [
    { lat: -12.0, lon: -77.0, age: 600 },
    { lat: -12.01, lon: -77.01, age: 60 },
    { lat: -12.02, lon: -77.02, age: 300 },
    { lat: -5.0, lon: -75.0, age: 30 },
  ];
  const data = parseLightning(response(pts))!;

  it('bins flashes in mercator cells with count, centroid and latest time', () => {
    const cells = clusterFlashes(data, 50_000);
    expect(cells.map((c) => c.count).sort()).toEqual([1, 3]);
    const big = cells.find((c) => c.count === 3)!;
    expect(big.latest).toBe(END - 60_000);
    const m = lonLatToMercator(-77.01, -12.01);
    expect(big.x).toBeCloseTo(m.x, -1);
    expect(big.y).toBeCloseTo(m.y, -1);
    expect(clusterFlashes(data, 5_000_000)).toHaveLength(1);
  });

  it('clusters at regional zoom and shows individual flashes up close', () => {
    expect(clusterMode(2_500_000).mode).toBe('clusters');
    expect(clusterMode(2_500_000).cellMeters).toBeCloseTo(2_500_000 / 24);
    expect(clusterMode(150_000).mode).toBe('flashes');
  });

  it('formats cluster counts compactly', () => {
    expect(formatFlashCount(1)).toBe('1');
    expect(formatFlashCount(999)).toBe('999');
    expect(formatFlashCount(1234)).toBe('1.2k');
    expect(formatFlashCount(15_600)).toBe('16k');
  });
});

describe('readout', () => {
  const data: LightningData = parseLightning(
    response([
      { lat: -12.0, lon: -77.0, age: 600 },
      { lat: -12.1, lon: -77.0, age: 120 }, // ~11 km south
      { lat: -12.5, lon: -77.0, age: 30 }, // ~55 km south: outside 20 km
    ]),
  )!;

  it('counts flashes within the radius and reports the most recent', () => {
    const s = lightningSummary(data, -77.0, -12.0, 20);
    expect(s.count).toBe(2);
    expect(s.latest).toBe(END - 120_000);
    expect(lightningSummary(data, -60, -30, 20)).toEqual({ count: 0, latest: null });
  });

  it('formats the readout with the window and the latest UTC time', () => {
    const now = END + 60_000;
    expect(formatLightningReadout(lightningSummary(data, -77, -12, 20), 20, 60, now)).toBe(
      '2 flashes within 20 km in the last 60 min · latest 00:28 UTC (3 min ago)',
    );
    expect(formatLightningReadout({ count: 1, latest: END - 30_000 }, 20, 60, END)).toBe(
      '1 flash within 20 km in the last 60 min · latest 00:29 UTC (30 s ago)',
    );
    expect(formatLightningReadout({ count: 0, latest: null }, 20, 60, now)).toBe('No flashes within 20 km in the last 60 min');
  });
});
