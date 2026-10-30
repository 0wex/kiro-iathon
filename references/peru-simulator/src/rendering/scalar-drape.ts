import { DataTexture, HalfFloatType, LinearFilter, NoColorSpace, RGBAFormat, RGFormat, UnsignedByteType, type WebGLRenderer } from 'three';
import { toHalfFloat } from '../domain/half-float';
import type { LocalFrame } from '../domain/local-frame';
import { paletteLut, paletteRange, type Palette } from '../domain/palette';
import { mercatorRectLocal, type ScalarGrid } from '../domain/weather-grid';
import type { DrapeSlot } from './terrain-material';

/** Cross-fade between two valid times. */
export const SCALAR_FADE_MS = 350;
const TEXTURE_CACHE = 24;

/** RG half-float texels: R = value * validity, G = validity (1 = data, 0 = no data). */
export function encodeScalarTexels(values: Float32Array): Uint16Array {
  const out = new Uint16Array(values.length * 2);
  const one = toHalfFloat(1);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) {
      out[i * 2] = toHalfFloat(v);
      out[i * 2 + 1] = one;
    }
  }
  return out;
}

/**
 * Drapes one scalar grid layer on the terrain through one slot of the shared
 * terrain uniforms (sampled in the fragment shader, so it follows LOD and geomorphing
 * at no geometry cost). Uploaded frames are kept in a small texture cache so
 * timeline playback does not re-upload.
 */
export class ScalarDrape {
  private readonly textures = new Map<string, DataTexture>();
  private palette: DataTexture | null = null;
  private current: string | null = null;
  private fadeStart = 0;
  private enabled = false;
  private opacity = 0.65;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly frame: LocalFrame,
    private readonly slot: DrapeSlot,
  ) {}

  setPalette(palette: Palette): void {
    this.palette?.dispose();
    const tex = new DataTexture(paletteLut(palette, 256), 256, 1, RGBAFormat, UnsignedByteType);
    tex.colorSpace = NoColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.needsUpdate = true;
    this.palette = tex;
    const [min, max] = paletteRange(palette);
    if (this.slot.palette) this.slot.palette.value = tex;
    this.slot.range?.value.set(min, max);
  }

  /** Shows a frame, cross-fading from the current one unless `instant`. */
  show(key: string, grid: ScalarGrid, now: number, instant = false): void {
    if (key === this.current) return;
    const tex = this.texture(key, grid);
    const u = this.slot;
    const previous = this.current ? this.textures.get(this.current) : undefined;
    u.mapA.value = !instant && previous ? previous : tex;
    u.mapB.value = tex;
    u.blend.value = !instant && previous ? 0 : 1;
    this.fadeStart = now;
    this.current = key;
    const r = mercatorRectLocal(this.frame, grid.bounds);
    u.rect.value.set(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ);
    this.apply();
  }

  /** Drops every frame, e.g. when the backend becomes unavailable. */
  clear(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.current = null;
    this.slot.mapA.value = null;
    this.slot.mapB.value = null;
    this.apply();
  }

  get hasFrame(): boolean {
    return this.current !== null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.apply();
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.apply();
  }

  /** Per-frame: advances the cross-fade. */
  update(now: number): void {
    const u = this.slot;
    if (u.blend.value >= 1) return;
    u.blend.value = Math.min(1, (now - this.fadeStart) / SCALAR_FADE_MS);
  }

  private texture(key: string, grid: ScalarGrid): DataTexture {
    let tex = this.textures.get(key);
    if (tex) {
      // Refresh LRU order.
      this.textures.delete(key);
      this.textures.set(key, tex);
      return tex;
    }
    tex = new DataTexture(encodeScalarTexels(grid.values), grid.width, grid.height, RGFormat, HalfFloatType);
    tex.flipY = false; // Row 0 is the north edge, v = 0.
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.renderer.initTexture(tex);
    this.textures.set(key, tex);
    const u = this.slot;
    for (const [k, t] of this.textures) {
      if (this.textures.size <= TEXTURE_CACHE) break;
      if (k === key || k === this.current || t === u.mapA.value) continue;
      t.dispose();
      this.textures.delete(k);
    }
    return tex;
  }

  private apply(): void {
    // Slots without a palette uniform are colored in the shader (CAPE).
    const colored = this.palette !== null || !this.slot.palette;
    this.slot.opacity.value = this.enabled && this.current && colored ? this.opacity : 0;
  }
}
