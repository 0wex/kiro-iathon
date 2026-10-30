/// <reference lib="webworker" />
import { encodeHalfHeights } from '../domain/half-float';
import { decodeTerrarium } from '../domain/terrarium';
import type { DecodeRequest, DecodeResponse, FloatHeightTile } from './decode-protocol';
import { decodeGeoTiff } from './geotiff-decoder';

declare const self: DedicatedWorkerGlobalScope;

async function decodeTerrariumPng(buffer: ArrayBuffer): Promise<FloatHeightTile> {
  // Disable color management and premultiplication: pixel values encode heights.
  const bitmap = await createImageBitmap(new Blob([buffer], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable in worker');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  return { ...decodeTerrarium(data, width, height), width, height };
}

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, format, buffer } = event.data;
  try {
    const tile = format === 'geotiff' ? await decodeGeoTiff(buffer) : await decodeTerrariumPng(buffer);
    // Relative to the tile minimum, half-floats keep sub-meter precision for typical tile relief.
    const offset = Number.isFinite(tile.min) ? tile.min : 0;
    const heights = encodeHalfHeights(tile.heights, offset);
    const response: DecodeResponse = { id, ok: true, ...tile, heights, offset };
    self.postMessage(response, [heights.buffer as ArrayBuffer]);
  } catch (error) {
    const response: DecodeResponse = { id, ok: false, error: String(error) };
    self.postMessage(response);
  }
};
