import { mercatorToLocal, type LocalFrame } from './local-frame';
import type { MercatorBounds } from './types';

/** Metadata of the cloud overlay image written by `npm run clouds` (public/clouds/*.json). */
export interface CloudMetadata {
  readonly satellite: string;
  readonly product: string;
  /** ACMF variable the opacity came from (Cloud_Probabilities or ACM). */
  readonly maskVariable: string;
  /** IR band that shaped brightness and opacity, or null for a mask-only image. */
  readonly irBand: number | null;
  /** Scan start time, ISO 8601 UTC. */
  readonly scanStart: string;
  /** Bucket key of the mask file; identifies the image for change detection. */
  readonly sourceKey: string;
  /** Image file name, relative to the metadata URL. */
  readonly image: string;
  readonly width: number;
  readonly height: number;
  /** Image extent in Web Mercator meters; row 0 is the north edge. */
  readonly mercatorBounds: MercatorBounds;
}

/** Cloud image extent in local scene coordinates (minZ is the north edge). */
export interface CloudRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const IMAGE_NAME = /^[\w.-]+\.png$/;

/** Validates untrusted metadata JSON; returns null when it is not usable. */
export function parseCloudMetadata(json: unknown): CloudMetadata | null {
  if (!isRecord(json) || !isRecord(json.mercatorBounds) || !isRecord(json.sourceKeys)) return null;
  const b = json.mercatorBounds;
  const { minX, minY, maxX, maxY } = b;
  if (![minX, minY, maxX, maxY].every(isFiniteNumber)) return null;
  if ((minX as number) >= (maxX as number) || (minY as number) >= (maxY as number)) return null;
  const { width, height, image, scanStart, irBand } = json;
  if (!Number.isInteger(width) || !Number.isInteger(height) || (width as number) <= 0 || (height as number) <= 0) return null;
  if (typeof image !== 'string' || !IMAGE_NAME.test(image) || image.startsWith('.')) return null;
  if (typeof scanStart !== 'string' || Number.isNaN(Date.parse(scanStart))) return null;
  if (irBand !== null && !Number.isInteger(irBand)) return null;
  const sourceKey = json.sourceKeys.mask;
  if (typeof sourceKey !== 'string') return null;
  return {
    satellite: String(json.satellite ?? 'GOES'),
    product: String(json.product ?? ''),
    maskVariable: String(json.maskVariable ?? ''),
    irBand: irBand as number | null,
    scanStart,
    sourceKey,
    image,
    width: width as number,
    height: height as number,
    mercatorBounds: { minX: minX as number, minY: minY as number, maxX: maxX as number, maxY: maxY as number },
  };
}

export function cloudRectLocal(frame: LocalFrame, meta: CloudMetadata): CloudRect {
  const b = meta.mercatorBounds;
  const nw = mercatorToLocal(frame, b.minX, b.maxY);
  const se = mercatorToLocal(frame, b.maxX, b.minY);
  return { minX: nw.x, maxX: se.x, minZ: nw.z, maxZ: se.z };
}

/**
 * Local scene position -> cloud texture UV. The local frame is linear in
 * Web Mercator, so this is affine. v = 0 is the north edge (image row 0; the
 * texture is uploaded without a vertical flip).
 */
export function localToCloudUv(rect: CloudRect, x: number, z: number): { u: number; v: number } {
  return { u: (x - rect.minX) / (rect.maxX - rect.minX), v: (z - rect.minZ) / (rect.maxZ - rect.minZ) };
}

/**
 * Visibility of a cloud layer as the camera approaches its altitude: 0 inside
 * the layer (|dy| <= halfThickness), easing to 1 at 4x that distance, which
 * avoids looking at a flat textured wall edge-on.
 */
export function cloudLayerFade(cameraY: number, layerY: number, halfThickness: number): number {
  const d = Math.abs(cameraY - layerY);
  const t = Math.min(1, Math.max(0, (d - halfThickness) / (3 * halfThickness)));
  return t * t * (3 - 2 * t);
}

export function formatScanTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
