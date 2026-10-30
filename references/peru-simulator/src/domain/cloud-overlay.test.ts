import { describe, expect, it } from 'vitest';
import {
  cloudLayerFade,
  cloudRectLocal,
  formatScanTime,
  localToCloudUv,
  parseCloudMetadata,
  type CloudMetadata,
} from './cloud-overlay';
import { createLocalFrame, lonLatToLocal } from './local-frame';
import { lonLatToMercator } from './tile-math';

function metadata(): CloudMetadata {
  const sw = lonLatToMercator(-83.4, -20.4);
  const ne = lonLatToMercator(-66.6, 2.0);
  return {
    satellite: 'GOES-19',
    product: 'ABI-L2-ACMF',
    maskVariable: 'Cloud_Probabilities',
    irBand: 13,
    scanStart: '2026-10-17T23:00:20.7Z',
    sourceKey: 'ABI-L2-ACMF/2026/290/23/x.nc',
    image: 'latest.png',
    width: 2048,
    height: 2785,
    mercatorBounds: { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y },
  };
}

function rawJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const m = metadata();
  return {
    version: 1,
    satellite: m.satellite,
    product: m.product,
    maskVariable: m.maskVariable,
    irBand: m.irBand,
    scanStart: m.scanStart,
    sourceKeys: { mask: m.sourceKey, ir: null },
    image: m.image,
    width: m.width,
    height: m.height,
    mercatorBounds: m.mercatorBounds,
    ...overrides,
  };
}

describe('parseCloudMetadata', () => {
  it('accepts the JSON written by the cloud pipeline', () => {
    expect(parseCloudMetadata(rawJson())).toEqual(metadata());
  });

  it('rejects missing or malformed fields', () => {
    expect(parseCloudMetadata(null)).toBeNull();
    expect(parseCloudMetadata(rawJson({ mercatorBounds: { minX: 0 } }))).toBeNull();
    expect(parseCloudMetadata(rawJson({ width: 0 }))).toBeNull();
    expect(parseCloudMetadata(rawJson({ image: '../evil.png' }))).toBeNull();
    expect(parseCloudMetadata(rawJson({ scanStart: 'yesterday' }))).toBeNull();
  });

  it('allows a mask-only product without IR band', () => {
    expect(parseCloudMetadata(rawJson({ irBand: null }))?.irBand).toBeNull();
  });
});

describe('cloud UV mapping in the local frame', () => {
  const frame = createLocalFrame(-75.0, -9.2);
  const rect = cloudRectLocal(frame, metadata());

  it('puts the north-west corner at uv (0, 0) and south-east at (1, 1)', () => {
    const nw = lonLatToLocal(frame, -83.4, 2.0);
    const se = lonLatToLocal(frame, -66.6, -20.4);
    const a = localToCloudUv(rect, nw.x, nw.z);
    const b = localToCloudUv(rect, se.x, se.z);
    expect(a.u).toBeCloseTo(0, 9);
    expect(a.v).toBeCloseTo(0, 9);
    expect(b.u).toBeCloseTo(1, 9);
    expect(b.v).toBeCloseTo(1, 9);
  });

  it('maps Lima to the pixel computed by the Python reprojection (u 775.0, v 1723.3 px)', () => {
    const lima = lonLatToLocal(frame, -77.0428, -12.0464);
    const uv = localToCloudUv(rect, lima.x, lima.z);
    expect(uv.u * 2048).toBeCloseTo(775.0, 0);
    expect(uv.v * 2785).toBeCloseTo(1723.3, 0);
  });

  it('has north at smaller z than south (Three.js -z is north)', () => {
    expect(rect.minZ).toBeLessThan(rect.maxZ);
    expect(rect.minX).toBeLessThan(rect.maxX);
  });
});

describe('cloudLayerFade', () => {
  it('hides a layer the camera is inside and shows it fully when far away', () => {
    expect(cloudLayerFade(1000, 1000, 400)).toBe(0);
    expect(cloudLayerFade(1000 + 4000, 1000, 400)).toBe(1);
    expect(cloudLayerFade(1000 - 4000, 1000, 400)).toBe(1);
    const mid = cloudLayerFade(1000 + 500, 1000, 400);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe('formatScanTime', () => {
  it('formats the scan start in UTC to the minute', () => {
    expect(formatScanTime('2026-10-17T23:00:20.7Z')).toBe('2026-10-17 23:00 UTC');
  });
});
