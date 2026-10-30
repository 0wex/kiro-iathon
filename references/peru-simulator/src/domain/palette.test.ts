import { describe, expect, it } from 'vitest';
import { cssGradient, legendTicks, paletteColor, paletteLut, TEMPERATURE_PALETTE, type Palette } from './palette';

const simple: Palette = {
  stops: [
    { value: 0, color: [0, 0, 255] },
    { value: 10, color: [255, 0, 0] },
  ],
};

describe('palette', () => {
  it('interpolates linearly between stops and clamps outside', () => {
    expect(paletteColor(simple, 5)).toEqual([127.5, 0, 127.5, 255]);
    expect(paletteColor(simple, -3)).toEqual([0, 0, 255, 255]);
    expect(paletteColor(simple, 99)).toEqual([255, 0, 0, 255]);
  });

  it('temperature palette runs cold blue to hot red over -10..40 °C', () => {
    const cold = paletteColor(TEMPERATURE_PALETTE, -10);
    const hot = paletteColor(TEMPERATURE_PALETTE, 40);
    expect(cold[2]).toBeGreaterThan(cold[0]);
    expect(hot[0]).toBeGreaterThan(hot[2]);
    expect(TEMPERATURE_PALETTE.stops[0]!.value).toBe(-10);
    expect(TEMPERATURE_PALETTE.stops.at(-1)!.value).toBe(40);
    const values = TEMPERATURE_PALETTE.stops.map((s) => s.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it('builds an RGBA lookup table spanning the palette range', () => {
    const lut = paletteLut(simple, 3);
    expect(lut.length).toBe(12);
    expect(Array.from(lut.slice(0, 4))).toEqual([0, 0, 255, 255]);
    expect(Array.from(lut.slice(4, 8))).toEqual([128, 0, 128, 255]);
    expect(Array.from(lut.slice(8, 12))).toEqual([255, 0, 0, 255]);
  });

  it('supports transparent stops (for layers such as rain)', () => {
    const p: Palette = { stops: [{ value: 0, color: [0, 0, 0, 0] }, { value: 1, color: [0, 0, 255, 255] }] };
    expect(paletteColor(p, 0)[3]).toBe(0);
  });

  it('renders a CSS gradient and legend ticks', () => {
    expect(cssGradient(simple)).toBe('linear-gradient(to right, rgb(0 0 255) 0%, rgb(255 0 0) 100%)');
    expect(legendTicks(-10, 40, 10)).toEqual([-10, 0, 10, 20, 30, 40]);
  });
});
