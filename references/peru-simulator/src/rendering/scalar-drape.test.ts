import { describe, expect, it } from 'vitest';
import { fromHalfFloat } from '../domain/half-float';
import { encodeScalarTexels } from './scalar-drape';

describe('encodeScalarTexels', () => {
  it('stores value and validity as half floats, zero for no data', () => {
    const t = encodeScalarTexels(new Float32Array([21.5, NaN, -3.25]));
    expect(Array.from(t, fromHalfFloat)).toEqual([21.5, 1, 0, 0, -3.25, 1]);
  });
});
