import { describe, expect, it } from 'vitest';
import { fromHalfFloat } from '../domain/half-float';
import { encodeWindTexels } from './wind-layer';

describe('encodeWindTexels', () => {
  it('stores (u, v, validity, 1) and zeroes missing vectors', () => {
    const t = encodeWindTexels(new Float32Array([3.5, NaN, 1]), new Float32Array([-2, 1, NaN]));
    expect(Array.from(t.slice(0, 4), fromHalfFloat)).toEqual([3.5, -2, 1, 1]);
    expect(Array.from(t.slice(4, 8), fromHalfFloat)).toEqual([0, 0, 0, 1]);
    expect(Array.from(t.slice(8, 12), fromHalfFloat)).toEqual([0, 0, 0, 1]);
  });
});
