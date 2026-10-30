import type { LonLat, LonLatBounds, MercatorBounds, TileId } from './types';

export const EARTH_RADIUS = 6378137;
/** Half the width of the Web Mercator world square, in meters. */
export const WORLD_HALF_SIZE = Math.PI * EARTH_RADIUS;
export const MAX_MERCATOR_LAT = 85.0511287798066;

const DEG = Math.PI / 180;

export function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * DEG) / 2)),
  };
}

export function mercatorToLonLat(x: number, y: number): LonLat {
  return {
    lon: x / EARTH_RADIUS / DEG,
    lat: (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) / DEG,
  };
}

export function lonLatToTile(lon: number, lat: number, z: number): TileId {
  const n = 2 ** z;
  const m = lonLatToMercator(lon, lat);
  const fx = (m.x + WORLD_HALF_SIZE) / (2 * WORLD_HALF_SIZE);
  const fy = (WORLD_HALF_SIZE - m.y) / (2 * WORLD_HALF_SIZE);
  const clamp = (v: number) => Math.max(0, Math.min(n - 1, Math.floor(v * n)));
  return { z, x: clamp(fx), y: clamp(fy) };
}

export function tileBoundsMercator(t: TileId): MercatorBounds {
  const size = (2 * WORLD_HALF_SIZE) / 2 ** t.z;
  const minX = -WORLD_HALF_SIZE + t.x * size;
  const maxY = WORLD_HALF_SIZE - t.y * size;
  return { minX, maxX: minX + size, maxY, minY: maxY - size };
}

export function tileBoundsLonLat(t: TileId): LonLatBounds {
  const m = tileBoundsMercator(t);
  const sw = mercatorToLonLat(m.minX, m.minY);
  const ne = mercatorToLonLat(m.maxX, m.maxY);
  return { west: sw.lon, south: sw.lat, east: ne.lon, north: ne.lat };
}

export function tileKey(t: TileId): string {
  return `${t.z}/${t.x}/${t.y}`;
}

export function parseTileKey(key: string): TileId {
  const [z, x, y] = key.split('/').map(Number);
  if (z === undefined || x === undefined || y === undefined || [z, x, y].some(Number.isNaN)) {
    throw new Error(`Invalid tile key: ${key}`);
  }
  return { z, x, y };
}

export function childrenOf(t: TileId): TileId[] {
  const z = t.z + 1;
  const x = t.x * 2;
  const y = t.y * 2;
  return [
    { z, x, y },
    { z, x: x + 1, y },
    { z, x, y: y + 1 },
    { z, x: x + 1, y: y + 1 },
  ];
}

export function parentOf(t: TileId): TileId | null {
  if (t.z === 0) return null;
  return { z: t.z - 1, x: t.x >> 1, y: t.y >> 1 };
}

/** All tiles at zoom `z` that intersect the given lon/lat bounds. */
export function tilesCovering(bounds: LonLatBounds, z: number): TileId[] {
  const nw = lonLatToTile(bounds.west, bounds.north, z);
  const se = lonLatToTile(bounds.east, bounds.south, z);
  const tiles: TileId[] = [];
  for (let y = nw.y; y <= se.y; y++) {
    for (let x = nw.x; x <= se.x; x++) tiles.push({ z, x, y });
  }
  return tiles;
}

/** Placement of a descendant tile inside its ancestor's [0, 1]^2 texture space (v grows southward). */
export interface AncestorUv {
  offsetU: number;
  offsetV: number;
  scale: number;
}

export function ancestorUvTransform(tile: TileId, ancestor: TileId): AncestorUv {
  const dz = tile.z - ancestor.z;
  if (dz < 0 || tile.x >> dz !== ancestor.x || tile.y >> dz !== ancestor.y) {
    throw new Error(`${tileKey(ancestor)} is not an ancestor of ${tileKey(tile)}`);
  }
  const scale = 1 / 2 ** dz;
  return {
    offsetU: (tile.x - ancestor.x * 2 ** dz) * scale,
    offsetV: (tile.y - ancestor.y * 2 ** dz) * scale,
    scale,
  };
}
