import { fromArrayBuffer } from 'geotiff';
import type { FloatHeightTile } from './decode-protocol';

/** Tilezen GeoTIFF tiles are 512x512 single-band Int16 with nodata -32768. */
const NODATA = -32768;

export async function decodeGeoTiff(buffer: ArrayBuffer): Promise<FloatHeightTile> {
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = await image.readRasters({ interleave: true, samples: [0] });
  if (typeof raster === 'number') throw new Error('Unexpected scalar raster');
  const nodata = image.getGDALNoData() ?? NODATA;
  const heights = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    const raw = Number(raster[i]);
    const h = raw === nodata ? 0 : raw;
    heights[i] = h;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return { heights, width, height, min, max };
}
