import { DataUtils } from 'three';
import { describe, expect, it } from 'vitest';
import { encodeHalfHeights, fromHalfFloat, toHalfFloat } from './half-float';

describe('half-float', () => {
  it('decodes every finite half-float bit pattern like three.js', () => {
    for (let h = 0; h < 0x10000; h++) {
      const exponent = (h >> 10) & 0x1f;
      if (exponent === 0x1f) continue;
      expect(fromHalfFloat(h)).toBe(DataUtils.fromHalfFloat(h));
    }
  });

  it('round-trips values within half a unit in the last place', () => {
    for (const v of [0, 0.25, 1, -1, 3.14159, 812.4, 1023.7, 2047.5, 3812.3, 4314, 6768, -350.2, 65504]) {
      const back = fromHalfFloat(toHalfFloat(v));
      const ulp = v === 0 ? 2 ** -24 : 2 ** (Math.floor(Math.log2(Math.abs(v))) - 10);
      expect(Math.abs(back - v)).toBeLessThanOrEqual(ulp / 2);
    }
  });

  it('encodes heights relative to an offset so a tile with < 2048 m of relief keeps sub-meter precision', () => {
    const heights = new Float32Array([1623, 1623.4, 2500.25, 3671.9, 4314]);
    const data = encodeHalfHeights(heights, 1623);
    expect(data).toBeInstanceOf(Uint16Array);
    heights.forEach((h, i) => expect(Math.abs(fromHalfFloat(data[i]!) + 1623 - h)).toBeLessThanOrEqual(1));
    const local = encodeHalfHeights(new Float32Array([3810.1, 3812.6, 3990.4]), 3810.1);
    expect(Math.abs(fromHalfFloat(local[1]!) + 3810.1 - 3812.6)).toBeLessThan(0.07);
  });
});
