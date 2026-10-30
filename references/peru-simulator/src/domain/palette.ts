/** RGB(A) in 0..255; alpha defaults to 255. */
export type Rgba = readonly [number, number, number, number?];

export interface ColorStop {
  readonly value: number;
  readonly color: Rgba;
}

/** Piecewise-linear color ramp over ascending stop values (data units). */
export interface Palette {
  readonly stops: readonly ColorStop[];
}

/**
 * Air temperature, -10..40 °C (Andes summits to the Amazon lowlands):
 * blue -> cyan -> green -> yellow -> orange -> red, roughly even in lightness
 * steps so the gradient reads monotonically.
 */
export const TEMPERATURE_PALETTE: Palette = {
  stops: [
    { value: -10, color: [49, 54, 149] },
    { value: -4, color: [69, 117, 180] },
    { value: 2, color: [116, 173, 209] },
    { value: 8, color: [102, 194, 165] },
    { value: 14, color: [166, 217, 106] },
    { value: 20, color: [254, 224, 139] },
    { value: 26, color: [253, 174, 97] },
    { value: 32, color: [244, 109, 67] },
    { value: 40, color: [165, 0, 38] },
  ],
};

/**
 * Wind speed, 0..100 km/h, for particles drawn over imagery: light blue
 * (calm) -> teal -> green -> yellow -> orange -> red -> magenta (gale).
 * Every stop is bright enough to read on dark terrain.
 */
export const WIND_PALETTE: Palette = {
  stops: [
    { value: 0, color: [150, 170, 240] },
    { value: 10, color: [90, 200, 230] },
    { value: 20, color: [100, 220, 140] },
    { value: 35, color: [220, 235, 90] },
    { value: 50, color: [250, 180, 60] },
    { value: 70, color: [240, 90, 70] },
    { value: 100, color: [225, 80, 200] },
  ],
};

export function paletteRange(p: Palette): [number, number] {
  return [p.stops[0]!.value, p.stops.at(-1)!.value];
}

export function paletteColor(p: Palette, value: number): [number, number, number, number] {
  const s = p.stops;
  const rgba = (c: Rgba): [number, number, number, number] => [c[0], c[1], c[2], c[3] ?? 255];
  if (!(value > s[0]!.value)) return rgba(s[0]!.color);
  for (let i = 1; i < s.length; i++) {
    const b = s[i]!;
    if (value <= b.value) {
      const a = s[i - 1]!;
      const t = (value - a.value) / (b.value - a.value);
      const ca = rgba(a.color);
      const cb = rgba(b.color);
      return [0, 1, 2, 3].map((k) => ca[k]! + (cb[k]! - ca[k]!) * t) as [number, number, number, number];
    }
  }
  return rgba(s.at(-1)!.color);
}

/** RGBA8 lookup table of `size` texels spanning the palette range (texel i at its center value). */
export function paletteLut(p: Palette, size = 256): Uint8Array {
  const [min, max] = paletteRange(p);
  const out = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const c = paletteColor(p, min + ((max - min) * i) / (size - 1));
    for (let k = 0; k < 4; k++) out[i * 4 + k] = Math.round(c[k]!);
  }
  return out;
}

export function cssGradient(p: Palette): string {
  const [min, max] = paletteRange(p);
  const parts = p.stops.map((s) => {
    const [r, g, b, a] = s.color;
    const color = a === undefined ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${(a / 255).toFixed(2)})`;
    return `${color} ${Math.round(((s.value - min) / (max - min)) * 100)}%`;
  });
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export function legendTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
