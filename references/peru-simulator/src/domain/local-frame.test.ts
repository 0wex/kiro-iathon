import { describe, expect, it } from 'vitest';
import { createLocalFrame, heightScaleAt, localToLonLat, lonLatToLocal } from './local-frame';

describe('local metric frame', () => {
  const frame = createLocalFrame(-75, -9.5);

  it('places the origin at (0, 0)', () => {
    const p = lonLatToLocal(frame, -75, -9.5);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('points east to +x and north to -z', () => {
    const east = lonLatToLocal(frame, -74, -9.5);
    const north = lonLatToLocal(frame, -75, -8.5);
    expect(east.x).toBeGreaterThan(0);
    expect(north.z).toBeLessThan(0);
  });

  it('uses true meters at the origin latitude', () => {
    // One degree of longitude at latitude 9.5 is ~109.8 km.
    const east = lonLatToLocal(frame, -74, -9.5);
    expect(east.x / 1000).toBeCloseTo(109.8, 0);
  });

  it('round-trips lon/lat', () => {
    const p = lonLatToLocal(frame, -71.97, -13.53);
    const ll = localToLonLat(frame, p.x, p.z);
    expect(ll.lon).toBeCloseTo(-71.97, 9);
    expect(ll.lat).toBeCloseTo(-13.53, 9);
  });

  it('scales heights by the mercator stretch relative to the origin', () => {
    expect(heightScaleAt(frame, -9.5)).toBeCloseTo(1, 9);
    expect(heightScaleAt(frame, -18)).toBeGreaterThan(1);
    expect(heightScaleAt(frame, 0)).toBeLessThan(1);
  });
});
