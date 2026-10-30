export interface DecodedHeights {
  heights: Float32Array;
  min: number;
  max: number;
}

/** Terrarium encoding: height = R * 256 + G + B / 256 - 32768 (meters). */
export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function decodeTerrarium(rgba: ArrayLike<number>, width: number, height: number): DecodedHeights {
  const count = width * height;
  if (rgba.length !== count * 4) {
    throw new Error(`Expected ${count * 4} RGBA bytes, got ${rgba.length}`);
  }
  const heights = new Float32Array(count);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const h = terrariumHeight(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!);
    heights[i] = h;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return { heights, min, max };
}
