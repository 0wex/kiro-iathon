import type { TileId } from '../domain/types';
import type { DecodedHeightTile, ElevationFormat } from './decode-protocol';
import type { DecoderPool } from './decoder-pool';

const ELEVATION_BASE = 'https://elevation-tiles-prod.s3.amazonaws.com';

export interface ElevationSource {
  readonly format: ElevationFormat;
  readonly label: string;
  readonly maxZoom: number;
  url(tile: TileId): string;
}

export const ELEVATION_SOURCES: Record<ElevationFormat, ElevationSource> = {
  geotiff: {
    format: 'geotiff',
    label: 'GeoTIFF (512 px, Int16)',
    maxZoom: 14,
    url: (t) => `${ELEVATION_BASE}/geotiff/${t.z}/${t.x}/${t.y}.tif`,
  },
  terrarium: {
    format: 'terrarium',
    label: 'Terrarium PNG (256 px)',
    maxZoom: 14,
    url: (t) => `${ELEVATION_BASE}/terrarium/${t.z}/${t.x}/${t.y}.png`,
  },
};

export const IMAGERY_SOURCE = {
  maxZoom: 18,
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  url: (t: TileId) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${t.z}/${t.y}/${t.x}`,
};

export const ELEVATION_ATTRIBUTION = 'Elevation: Tilezen Joerd / AWS Terrain Tiles (Mapzen and data providers)';

async function fetchOk(url: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal, mode: 'cors' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

export async function loadHeightTile(
  source: ElevationSource,
  pool: DecoderPool,
  tile: TileId,
  signal: AbortSignal,
): Promise<DecodedHeightTile> {
  const response = await fetchOk(source.url(tile), signal);
  const buffer = await response.arrayBuffer();
  return pool.decode(source.format, buffer, signal);
}

export async function loadImageryTile(tile: TileId, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetchOk(IMAGERY_SOURCE.url(tile), signal);
  const blob = await response.blob();
  // createImageBitmap decodes off the main thread.
  return createImageBitmap(blob);
}
