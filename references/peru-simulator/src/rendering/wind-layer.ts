import {
  BufferGeometry,
  Color,
  CustomBlending,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LineSegments,
  Mesh,
  NearestFilter,
  NoBlending,
  NoColorSpace,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { toHalfFloat } from '../domain/half-float';
import type { LocalFrame } from '../domain/local-frame';
import { paletteLut, paletteRange, WIND_PALETTE } from '../domain/palette';
import type { MercatorBounds } from '../domain/types';
import { mercatorRectLocal, type LocalRect } from '../domain/weather-grid';
import type { WindGrid } from '../domain/wind';
import { animationSpeedFactor, chooseTrailRect, clipRect, footprintUv, type MutableUvRect, type UvRect } from '../domain/wind-particles';
import type { SharedTerrainUniforms } from './terrain-material';

/** Cross-fade of the wind field between two valid times. */
export const WIND_FADE_MS = 350;
/** Trail half-life in seconds: sets the streak length together with the animation speed. */
const TRAIL_HALF_LIFE_S = 0.35;
/** Particle lifetime range in seconds (randomized per particle so respawns stay spread out). */
const LIFE_MIN_S = 2.5;
const LIFE_MAX_S = 6;
const TEXTURE_CACHE = 24;
/** 5 x 5 screen rays for the view footprint. */
const FOOTPRINT_STEPS = 5;

/** RGBA half-float texels: (u * validity, v * validity, validity, 1), validity 1 = data. */
export function encodeWindTexels(u: Float32Array, v: Float32Array): Uint16Array {
  const out = new Uint16Array(u.length * 4);
  const one = toHalfFloat(1);
  for (let i = 0; i < u.length; i++) {
    const a = u[i]!;
    const b = v[i]!;
    out[i * 4 + 3] = one;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      out[i * 4] = toHalfFloat(a);
      out[i * 4 + 1] = toHalfFloat(b);
      out[i * 4 + 2] = one;
    }
  }
  return out;
}

const quadVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Shared wind lookup: bilinear U/V (m/s) cross-faded between two valid times.
const windChunk = /* glsl */ `
uniform sampler2D uWindA;
uniform sampler2D uWindB;
uniform float uWindBlend;
// (u, v, validity); u, v are premultiplied by validity.
vec3 windAt(vec2 uv) {
  return mix(texture(uWindA, uv).rgb, texture(uWindB, uv).rgb, uWindBlend);
}
`;

// Particle state texel: (u, v, age, lifetime); u, v are grid UV (v = 0 north).
// Mirrors advectUv in domain/wind-particles.ts.
const simFragment = /* glsl */ `
precision highp float;
uniform sampler2D uState;
uniform vec4 uSpawn;
uniform vec4 uRect;
uniform vec3 uMerc;
uniform float uSeconds;
uniform float uDt;
uniform float uSeed;
uniform float uReset;
${windChunk}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 s = texelFetch(uState, ivec2(gl_FragCoord.xy), 0);
  vec2 pos = s.xy;
  float age = s.z;
  float life = s.w;
  vec3 w = windAt(pos);
  vec2 lo = max(uRect.xy, vec2(0.0));
  vec2 hi = min(uRect.xy + uRect.zw, vec2(1.0));
  bool inside = all(greaterThanEqual(pos, lo)) && all(lessThanEqual(pos, hi));
  if (uReset > 0.5 || age >= life || !inside || w.z < 0.5) {
    vec2 seed = gl_FragCoord.xy + vec2(uSeed, uSeed * 1.37);
    pos = uSpawn.xy + vec2(hash(seed), hash(seed + 17.31)) * uSpawn.zw;
    life = mix(${LIFE_MIN_S.toFixed(1)}, ${LIFE_MAX_S.toFixed(1)}, hash(seed + 41.7));
    // After a reset ages are spread so particles do not all expire together.
    age = uReset > 0.5 ? hash(seed + 7.13) * life : 0.0;
  } else {
    vec2 vel = w.xy / w.z;
    // Mercator meters per true meter: 1 / cos(lat) = cosh(y / R).
    float stretch = cosh((uMerc.z - pos.y * uMerc.y) / 6378137.0);
    pos += vec2(vel.x, -vel.y) * (uSeconds * stretch) / uMerc.xy;
    age += uDt;
  }
  gl_FragColor = vec4(pos, age, life);
}
`;

// Copies the previous trails (resampled when the region moved) with exponential fading.
const fadeFragment = /* glsl */ `
precision highp float;
uniform sampler2D uTrail;
uniform vec4 uRemap;
uniform vec2 uSize;
uniform float uFade;
void main() {
  vec2 st = (gl_FragCoord.xy / uSize) * uRemap.zw + uRemap.xy;
  vec4 c = vec4(0.0);
  if (all(greaterThanEqual(st, vec2(0.0))) && all(lessThanEqual(st, vec2(1.0)))) c = texture(uTrail, st) * uFade;
  gl_FragColor = c.a < 0.01 ? vec4(0.0) : c;
}
`;

// One line segment per particle from its previous to its current position.
const lineVertex = /* glsl */ `
uniform sampler2D uPrev;
uniform sampler2D uCur;
uniform vec4 uRect;
uniform sampler2D uPalette;
uniform vec2 uRange;
${windChunk}
varying vec4 vColor;
void main() {
  ivec2 texel = ivec2(position.xy);
  vec4 c = texelFetch(uCur, texel, 0);
  vec4 p = texelFetch(uPrev, texel, 0);
  // A respawned particle restarts its age: draw nothing instead of a jump.
  bool jumped = c.z <= p.z;
  vec2 pos = (position.z > 0.5 || jumped) ? c.xy : p.xy;
  gl_Position = vec4(((pos - uRect.xy) / uRect.zw) * 2.0 - 1.0, 0.0, 1.0);
  vec3 w = windAt(c.xy);
  float kmh = length(w.xy / max(w.z, 1e-3)) * 3.6;
  float t = clamp((kmh - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
  vec3 color = texture(uPalette, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
  float a = jumped ? 0.0 : 0.95 * smoothstep(0.0, 0.5, c.z) * (1.0 - smoothstep(c.w - 0.8, c.w, c.z));
  vColor = vec4(color * a, a);
}
`;

const lineFragment = /* glsl */ `
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`;

interface WindUniforms {
  uWindA: { value: Texture | null };
  uWindB: { value: Texture | null };
  uWindBlend: { value: number };
}

function floatTarget(width: number, height: number, type: typeof FloatType | typeof HalfFloatType, filter: typeof NearestFilter | typeof LinearFilter): WebGLRenderTarget {
  const t = new WebGLRenderTarget(width, height, {
    type,
    format: RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  t.texture.colorSpace = NoColorSpace;
  return t;
}

export interface WindLayerOptions {
  /** Particle state texture size: width * height particles. */
  readonly stateWidth: number;
  readonly stateHeight: number;
  /** Trail texture side in texels (pixel cost cap of the per-frame fade pass). */
  readonly trailSize: number;
}

export function defaultWindOptions(coarsePointer: boolean): WindLayerOptions {
  return coarsePointer ? { stateWidth: 128, stateHeight: 128, trailSize: 1024 } : { stateWidth: 256, stateHeight: 192, trailSize: 2048 };
}

/**
 * Animated wind particles (GPU). Particle positions live in a ping-pong
 * RGBA32F texture in grid UV and are advected by the bilinear U/V field with
 * real m/s scaled by a zoom-dependent speed-up. Each frame draws a line per
 * particle into a trail texture in grid space (faded and resampled from the
 * previous frame), which the terrain fragment shader drapes like the scalar
 * layers: trails sit exactly on the rendered surface for every LOD, geomorph
 * and camera, with no height lookup. The particle region follows the view
 * footprint, so density adapts to the zoom. Nothing is allocated per frame.
 */
export class WindLayer {
  readonly supported: boolean;
  readonly particleCount: number;
  private readonly states: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly trails: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly simScene = new Scene();
  private readonly trailScene = new Scene();
  private readonly quad = new PlaneGeometry(2, 2);
  private readonly lineGeometry = new BufferGeometry();
  private readonly wind: WindUniforms = { uWindA: { value: null }, uWindB: { value: null }, uWindBlend: { value: 1 } };
  private readonly simMaterial: ShaderMaterial;
  private readonly fadeMaterial: ShaderMaterial;
  private readonly lineMaterial: ShaderMaterial;
  private readonly lines: LineSegments;
  private readonly palette: DataTexture;
  private readonly textures = new Map<string, DataTexture>();
  private current: string | null = null;
  private fadeStart = 0;
  private enabled = false;
  private opacity = 0.8;
  private needsReset = true;
  private bounds: MercatorBounds | null = null;
  private gridRect: LocalRect | null = null;
  private rect: UvRect | null = null;
  private speedUp = 0;
  private seed = 0;
  // Per-frame scratch (no allocations in update()).
  private readonly footprint: MutableUvRect = { u0: 0, v0: 0, du: 1, dv: 1 };
  private readonly rays: Vector3[] = [];
  private readonly clearColor = new Color();

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly frame: LocalFrame,
    private readonly terrain: SharedTerrainUniforms,
    options: WindLayerOptions,
  ) {
    const { stateWidth: w, stateHeight: h, trailSize } = options;
    this.particleCount = w * h;
    this.supported = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    this.states = [floatTarget(w, h, FloatType, NearestFilter), floatTarget(w, h, FloatType, NearestFilter)];
    this.trails = [floatTarget(trailSize, trailSize, HalfFloatType, LinearFilter), floatTarget(trailSize, trailSize, HalfFloatType, LinearFilter)];
    for (let i = 0; i < FOOTPRINT_STEPS * FOOTPRINT_STEPS; i++) this.rays.push(new Vector3());

    this.palette = new DataTexture(paletteLut(WIND_PALETTE, 256), 256, 1, RGBAFormat, UnsignedByteType);
    this.palette.colorSpace = NoColorSpace;
    this.palette.minFilter = LinearFilter;
    this.palette.magFilter = LinearFilter;
    this.palette.needsUpdate = true;

    this.simMaterial = new ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: simFragment,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...this.wind,
        uState: { value: null },
        uSpawn: { value: new Vector4(0, 0, 1, 1) },
        uRect: { value: new Vector4(0, 0, 1, 1) },
        uMerc: { value: new Vector3(1, 1, 0) },
        uSeconds: { value: 0 },
        uDt: { value: 0 },
        uSeed: { value: 0 },
        uReset: { value: 1 },
      },
    });
    this.fadeMaterial = new ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: fadeFragment,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTrail: { value: null },
        uRemap: { value: new Vector4(0, 0, 1, 1) },
        uSize: { value: new Vector2(trailSize, trailSize) },
        uFade: { value: 1 },
      },
    });
    this.lineMaterial = new ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        ...this.wind,
        uPrev: { value: null },
        uCur: { value: null },
        uRect: { value: new Vector4(0, 0, 1, 1) },
        uPalette: { value: this.palette },
        uRange: { value: new Vector2(...paletteRange(WIND_PALETTE)) },
      },
    });

    // Two vertices per particle: (texel x, texel y, end 0 = previous / 1 = current position).
    const positions = new Float32Array(this.particleCount * 6);
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 6) {
        positions.set([x, y, 0, x, y, 1], i);
      }
    }
    this.lineGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.lines = new LineSegments(this.lineGeometry, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;
    const sim = new Mesh(this.quad, this.simMaterial);
    sim.frustumCulled = false;
    this.simScene.add(sim);
    const fade = new Mesh(this.quad, this.fadeMaterial);
    fade.frustumCulled = false;
    fade.renderOrder = 0;
    this.trailScene.add(fade, this.lines);
  }

  get hasFrame(): boolean {
    return this.current !== null;
  }

  /** Current animation time multiplier (simulated seconds per real second); 0 before the first frame. */
  get animationSpeedUp(): number {
    return this.speedUp;
  }

  /** Shows a frame, cross-fading the field from the current one unless `instant`. */
  show(key: string, grid: WindGrid, now: number, instant = false): void {
    if (key === this.current) return;
    const tex = this.texture(key, grid);
    const previous = this.current ? this.textures.get(this.current) : undefined;
    this.wind.uWindA.value = !instant && previous ? previous : tex;
    this.wind.uWindB.value = tex;
    this.wind.uWindBlend.value = !instant && previous ? 0 : 1;
    this.fadeStart = now;
    this.current = key;
    if (!this.bounds || !sameBounds(this.bounds, grid.bounds)) {
      this.bounds = grid.bounds;
      this.gridRect = mercatorRectLocal(this.frame, grid.bounds);
      const u = this.simMaterial.uniforms.uMerc!.value as Vector3;
      u.set(grid.bounds.maxX - grid.bounds.minX, grid.bounds.maxY - grid.bounds.minY, grid.bounds.maxY);
      this.rect = null;
      this.needsReset = true;
    }
    this.apply();
  }

  clear(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.current = null;
    this.wind.uWindA.value = null;
    this.wind.uWindB.value = null;
    this.apply();
  }

  setEnabled(enabled: boolean): void {
    if (enabled && !this.enabled) this.needsReset = true;
    this.enabled = enabled;
    this.apply();
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.apply();
  }

  /**
   * Per-frame: cross-fade, view region, particle step and trail drawing.
   * `groundY` is the scene height of the terrain under the camera; it only
   * shapes the view footprint. Paused (no GPU work) while hidden.
   */
  update(now: number, dt: number, camera: PerspectiveCamera, groundY: number, fogDistance: number): void {
    if (!this.active || !this.bounds || !this.gridRect) return;
    if (this.wind.uWindBlend.value < 1) this.wind.uWindBlend.value = Math.min(1, (now - this.fadeStart) / WIND_FADE_MS);
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    const previousRect = this.rect;
    this.updateRegion(camera, groundY, fogDistance);
    const rect = this.rect!;
    const b = this.bounds;
    this.speedUp = animationSpeedFactor(rect.du * (b.maxX - b.minX));

    const sim = this.simMaterial.uniforms;
    if (rect !== previousRect) {
      // Particles spawn where the region overlaps the grid.
      const spawn = clipRect(rect);
      (sim.uSpawn!.value as Vector4).set(spawn.u0, spawn.v0, spawn.du, spawn.dv);
      (sim.uRect!.value as Vector4).set(rect.u0, rect.v0, rect.du, rect.dv);
      (this.lineMaterial.uniforms.uRect!.value as Vector4).set(rect.u0, rect.v0, rect.du, rect.dv);
    }
    sim.uDt!.value = dt;
    sim.uSeconds!.value = dt * this.speedUp;
    this.seed = (this.seed + 1) % 4096;
    sim.uSeed!.value = this.seed * 0.618;

    const reset = this.needsReset;
    this.needsReset = false;
    sim.uReset!.value = reset ? 1 : 0;
    sim.uState!.value = this.states[0].texture;
    renderer.setRenderTarget(this.states[1]);
    renderer.render(this.simScene, this.camera);
    this.states.reverse();

    if (reset) {
      renderer.setClearColor(0x000000, 0);
      for (const t of this.trails) {
        renderer.setRenderTarget(t);
        renderer.clear(true, false, false);
      }
    } else {
      const fade = this.fadeMaterial.uniforms;
      fade.uTrail!.value = this.trails[0].texture;
      fade.uFade!.value = Math.pow(0.5, dt / TRAIL_HALF_LIFE_S);
      const remap = fade.uRemap!.value as Vector4;
      if (previousRect && previousRect !== rect) {
        remap.set(
          (rect.u0 - previousRect.u0) / previousRect.du,
          (rect.v0 - previousRect.v0) / previousRect.dv,
          rect.du / previousRect.du,
          rect.dv / previousRect.dv,
        );
      } else {
        remap.set(0, 0, 1, 1);
      }
      const line = this.lineMaterial.uniforms;
      line.uPrev!.value = this.states[1].texture;
      line.uCur!.value = this.states[0].texture;
      renderer.setRenderTarget(this.trails[1]);
      renderer.render(this.trailScene, this.camera);
      this.trails.reverse();
    }

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.clearColor, previousAlpha);
    this.terrain.uWindTrail.value = this.trails[0].texture;
    // Grid UV -> local is affine (gridUvToLocal), so the trail rect maps to a local rect.
    const g = this.gridRect;
    const sx = g.maxX - g.minX;
    const sz = g.maxZ - g.minZ;
    this.terrain.uWindRect.value.set(g.minX + rect.u0 * sx, g.minZ + rect.v0 * sz, rect.du * sx, rect.dv * sz);
  }

  dispose(): void {
    for (const t of [...this.states, ...this.trails]) t.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.palette.dispose();
    this.quad.dispose();
    this.lineGeometry.dispose();
    this.simMaterial.dispose();
    this.fadeMaterial.dispose();
    this.lineMaterial.dispose();
  }

  private get active(): boolean {
    return this.supported && this.enabled && this.current !== null && this.opacity > 0;
  }

  /** Trail region from the camera footprint (changes only past the hysteresis in chooseTrailRect). */
  private updateRegion(camera: PerspectiveCamera, groundY: number, fogDistance: number): void {
    const n = FOOTPRINT_STEPS - 1;
    for (let j = 0, k = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++, k++) {
        const r = this.rays[k]!;
        r.set((i / n) * 2 - 1, (j / n) * 2 - 1, 0.5).unproject(camera).sub(camera.position);
      }
    }
    const b = this.bounds!;
    const aspect = (b.maxX - b.minX) / (b.maxY - b.minY);
    footprintUv(camera.position, this.rays, groundY, fogDistance, this.gridRect!, this.footprint);
    this.rect = chooseTrailRect(this.rect, this.footprint, aspect);
  }

  private texture(key: string, grid: WindGrid): DataTexture {
    let tex = this.textures.get(key);
    if (tex) {
      this.textures.delete(key);
      this.textures.set(key, tex);
      return tex;
    }
    tex = new DataTexture(encodeWindTexels(grid.u, grid.v), grid.width, grid.height, RGBAFormat, HalfFloatType);
    tex.flipY = false; // Row 0 is the north edge, v = 0.
    tex.colorSpace = NoColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.renderer.initTexture(tex);
    this.textures.set(key, tex);
    for (const [k, t] of this.textures) {
      if (this.textures.size <= TEXTURE_CACHE) break;
      if (k === key || k === this.current || t === this.wind.uWindA.value) continue;
      t.dispose();
      this.textures.delete(k);
    }
    return tex;
  }

  private apply(): void {
    this.terrain.uWindOpacity.value = this.active ? this.opacity : 0;
  }
}

function sameBounds(a: MercatorBounds, b: MercatorBounds): boolean {
  return a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}
