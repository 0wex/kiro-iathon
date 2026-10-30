import { lonLatToMercator, mercatorToLonLat } from './tile-math';
import type { LonLat } from './types';

/**
 * Local metric frame: Web Mercator meters relative to an origin, scaled by
 * cos(originLat) so that distances are true meters near the origin.
 * Axes follow Three.js conventions: +x east, +y up, -z north.
 */
export interface LocalFrame {
  readonly originX: number;
  readonly originY: number;
  readonly originLat: number;
  /** Local units per mercator meter. */
  readonly scale: number;
}

const DEG = Math.PI / 180;

export function createLocalFrame(originLon: number, originLat: number): LocalFrame {
  const m = lonLatToMercator(originLon, originLat);
  return { originX: m.x, originY: m.y, originLat, scale: Math.cos(originLat * DEG) };
}

export function mercatorToLocal(frame: LocalFrame, mx: number, my: number): { x: number; z: number } {
  return { x: (mx - frame.originX) * frame.scale, z: -(my - frame.originY) * frame.scale };
}

export function localToMercator(frame: LocalFrame, x: number, z: number): { x: number; y: number } {
  return { x: x / frame.scale + frame.originX, y: -z / frame.scale + frame.originY };
}

export function lonLatToLocal(frame: LocalFrame, lon: number, lat: number): { x: number; z: number } {
  const m = lonLatToMercator(lon, lat);
  return mercatorToLocal(frame, m.x, m.y);
}

export function localToLonLat(frame: LocalFrame, x: number, z: number): LonLat {
  const m = localToMercator(frame, x, z);
  return mercatorToLonLat(m.x, m.y);
}

/** Local units per true vertical meter at the given latitude (matches the horizontal mercator stretch). */
export function heightScaleAt(frame: LocalFrame, lat: number): number {
  return frame.scale / Math.cos(lat * DEG);
}
