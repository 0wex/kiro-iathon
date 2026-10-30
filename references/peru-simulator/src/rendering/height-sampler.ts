import { fromHalfFloat } from '../domain/half-float';
import { lonLatToMercator, lonLatToTile, tileBoundsMercator, tileKey } from '../domain/tile-math';
import type { HeightResource } from './tile-resources';

/**
 * Samples terrain height (meters) on the CPU from the finest cached tile.
 * Values come from the same half-float data as the GPU, so they match the
 * rendered surface; precision is within 0.5 m for tiles with < 2048 m relief.
 */
export class HeightSampler {
  constructor(
    private readonly lookup: (key: string) => HeightResource | undefined,
    private readonly maxZoom: () => number,
  ) {}

  /** Returns null when no tile covering the point is cached yet. */
  sample(lon: number, lat: number): number | null {
    const m = lonLatToMercator(lon, lat);
    for (let z = this.maxZoom(); z >= 0; z--) {
      const tile = lonLatToTile(lon, lat, z);
      const resource = this.lookup(tileKey(tile));
      if (!resource) continue;
      const b = tileBoundsMercator(tile);
      const { width, height, heights, offset } = resource.tile;
      const px = Math.min(width - 1, Math.max(0, Math.floor(((m.x - b.minX) / (b.maxX - b.minX)) * width)));
      const py = Math.min(height - 1, Math.max(0, Math.floor(((b.maxY - m.y) / (b.maxY - b.minY)) * height)));
      const bits = heights[py * width + px];
      return bits === undefined ? 0 : Math.max(0, fromHalfFloat(bits) + offset);
    }
    return null;
  }
}
