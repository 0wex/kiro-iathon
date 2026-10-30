import { Color, ShaderMaterial, Texture, Vector2, Vector3, Vector4, type IUniform } from 'three';
import { CAPE_CATEGORIES } from '../domain/cape';

export type ShadingMode = 'imagery' | 'hypsometric';

/** Uniforms shared by every tile material (same objects, so one update applies to all). */
export interface SharedTerrainUniforms {
  uExaggeration: IUniform<number>;
  uShading: IUniform<number>;
  uSunDirection: IUniform<Vector3>;
  uFogColor: IUniform<Color>;
  uFogDensity: IUniform<number>;
  /** Cloud overlay image (alpha = cloud opacity), or null when no cloud data. */
  uCloudMap: IUniform<Texture | null>;
  /** Cloud image extent in the local frame: (minX, minZ, sizeX, sizeZ); v = 0 is north. */
  uCloudRect: IUniform<Vector4>;
  /** Scene height of the cloud sheet that casts shadows. */
  uCloudY: IUniform<number>;
  /** Shadow darkening for a fully opaque cloud; 0 disables cloud shadows. */
  uCloudShadow: IUniform<number>;
  /**
   * Draped scalar weather layer (e.g. temperature): two RG16F frames
   * (R = value * validity, G = validity) cross-faded by uScalarBlend, colored
   * through a 1D RGBA palette over uScalarRange. uScalarOpacity 0 disables it.
   */
  uScalarMapA: IUniform<Texture | null>;
  uScalarMapB: IUniform<Texture | null>;
  uScalarBlend: IUniform<number>;
  uScalarPalette: IUniform<Texture | null>;
  /** Palette domain in data units: (min, max). */
  uScalarRange: IUniform<Vector2>;
  /** Grid extent in the local frame: (minX, minZ, sizeX, sizeZ); v = 0 is north. */
  uScalarRect: IUniform<Vector4>;
  uScalarOpacity: IUniform<number>;
  /**
   * Second draped scalar slot for precipitation, drawn over the first one so
   * rain and temperature can be shown together. Same encoding as uScalar*;
   * the palette carries alpha (transparent where it does not rain).
   */
  uRainMapA: IUniform<Texture | null>;
  uRainMapB: IUniform<Texture | null>;
  uRainBlend: IUniform<number>;
  uRainPalette: IUniform<Texture | null>;
  uRainRange: IUniform<Vector2>;
  uRainRect: IUniform<Vector4>;
  uRainOpacity: IUniform<number>;
  /**
   * Wind particle trails: premultiplied RGBA16F texture drawn in grid space by
   * the wind layer and composited over the lit terrain. uWindOpacity 0 disables it.
   */
  uWindTrail: IUniform<Texture | null>;
  /** Trail texture extent in the local frame: (minX, minZ, sizeX, sizeZ); t = 0 is north. */
  uWindRect: IUniform<Vector4>;
  uWindOpacity: IUniform<number>;
  /**
   * Third draped scalar slot: convective potential (GFS CAPE, J/kg). Same
   * encoding as uScalar*, but colored procedurally (discrete hatched
   * categories from domain/cape.ts), so it needs no palette texture: the
   * fragment shader stays within the 16 texture units WebGL2 guarantees.
   */
  uCapeMapA: IUniform<Texture | null>;
  uCapeMapB: IUniform<Texture | null>;
  uCapeBlend: IUniform<number>;
  uCapeRect: IUniform<Vector4>;
  uCapeOpacity: IUniform<number>;
  /** Device pixels per CSS pixel: the CAPE hatching spacing is in CSS pixels. */
  uPixelRatio: IUniform<number>;
  /**
   * Observed lightning markers: premultiplied RGBA canvas drawn in grid space by
   * the lightning layer, composited like the wind trails. uLightningOpacity 0 disables it.
   */
  uLightning: IUniform<Texture | null>;
  uLightningRect: IUniform<Vector4>;
  uLightningOpacity: IUniform<number>;
}

/** The uniforms of one draped scalar slot (see uScalar* / uRain* / uCape*). */
export interface DrapeSlot {
  readonly mapA: IUniform<Texture | null>;
  readonly mapB: IUniform<Texture | null>;
  readonly blend: IUniform<number>;
  /** Absent for slots colored in the shader (CAPE). */
  readonly palette?: IUniform<Texture | null>;
  readonly range?: IUniform<Vector2>;
  readonly rect: IUniform<Vector4>;
  readonly opacity: IUniform<number>;
}

export function scalarSlot(u: SharedTerrainUniforms): DrapeSlot {
  return { mapA: u.uScalarMapA, mapB: u.uScalarMapB, blend: u.uScalarBlend, palette: u.uScalarPalette, range: u.uScalarRange, rect: u.uScalarRect, opacity: u.uScalarOpacity };
}

export function rainSlot(u: SharedTerrainUniforms): DrapeSlot {
  return { mapA: u.uRainMapA, mapB: u.uRainMapB, blend: u.uRainBlend, palette: u.uRainPalette, range: u.uRainRange, rect: u.uRainRect, opacity: u.uRainOpacity };
}

export function capeSlot(u: SharedTerrainUniforms): DrapeSlot {
  return { mapA: u.uCapeMapA, mapB: u.uCapeMapB, blend: u.uCapeBlend, rect: u.uCapeRect, opacity: u.uCapeOpacity };
}

export function createSharedUniforms(): SharedTerrainUniforms {
  return {
    uExaggeration: { value: 3 },
    uShading: { value: 0 },
    uSunDirection: { value: new Vector3(-0.45, 0.75, -0.5).normalize() },
    uFogColor: { value: new Color(0x9fb4c8) },
    uFogDensity: { value: 1 / 1_000_000 },
    uCloudMap: { value: null },
    uCloudRect: { value: new Vector4(0, 0, 1, 1) },
    uCloudY: { value: 0 },
    uCloudShadow: { value: 0 },
    uScalarMapA: { value: null },
    uScalarMapB: { value: null },
    uScalarBlend: { value: 1 },
    uScalarPalette: { value: null },
    uScalarRange: { value: new Vector2(0, 1) },
    uScalarRect: { value: new Vector4(0, 0, 1, 1) },
    uScalarOpacity: { value: 0 },
    uRainMapA: { value: null },
    uRainMapB: { value: null },
    uRainBlend: { value: 1 },
    uRainPalette: { value: null },
    uRainRange: { value: new Vector2(0, 1) },
    uRainRect: { value: new Vector4(0, 0, 1, 1) },
    uRainOpacity: { value: 0 },
    uWindTrail: { value: null },
    uWindRect: { value: new Vector4(0, 0, 1, 1) },
    uWindOpacity: { value: 0 },
    uCapeMapA: { value: null },
    uCapeMapB: { value: null },
    uCapeBlend: { value: 1 },
    uCapeRect: { value: new Vector4(0, 0, 1, 1) },
    uCapeOpacity: { value: 0 },
    uPixelRatio: { value: 1 },
    uLightning: { value: null },
    uLightningRect: { value: new Vector4(0, 0, 1, 1) },
    uLightningOpacity: { value: 0 },
  };
}

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

attribute float aSkirt;

uniform sampler2D uHeight;
uniform vec2 uHeightTexel;
uniform float uHeightOffset;
uniform vec2 uOrigin;
uniform float uSize;
uniform float uHeightScale;
uniform float uExaggeration;
uniform float uSegments;
uniform float uMorph;

varying vec2 vUv;
varying vec3 vWorld;

float heightAt(vec2 uv) {
  // Map tile edges onto edge texel centers.
  vec2 st = uHeightTexel * 0.5 + uv * (1.0 - uHeightTexel);
  return max(texture(uHeight, st).r + uHeightOffset, 0.0);
}

// Height of the parent's coarser surface at this vertex. The parent grid has
// half the resolution and lands on even child indices, so odd vertices are
// interpolated from their even neighbours along the parent's triangulation
// (cells are split along the diagonal from (i + 1, j) to (i, j + 1)).
float coarseHeightAt(vec2 uv, float fine) {
  vec2 odd = mod(floor(uv * uSegments + 0.5), 2.0);
  float s = 1.0 / uSegments;
  if (odd.x > 0.5 && odd.y > 0.5) return 0.5 * (heightAt(uv + vec2(s, -s)) + heightAt(uv + vec2(-s, s)));
  if (odd.x > 0.5) return 0.5 * (heightAt(uv - vec2(s, 0.0)) + heightAt(uv + vec2(s, 0.0)));
  if (odd.y > 0.5) return 0.5 * (heightAt(uv - vec2(0.0, s)) + heightAt(uv + vec2(0.0, s)));
  return fine;
}

void main() {
  vec2 uv = position.xz;
  vUv = uv;
  float fine = heightAt(uv);
  // Geomorph: 0 = parent's surface (no pop when appearing), 1 = full detail.
  float morphed = uMorph >= 1.0 ? fine : mix(coarseHeightAt(uv, fine), fine, uMorph);
  float h = morphed * uHeightScale * uExaggeration;
  float skirtDepth = max(uSize * 0.03, 50.0);
  h -= aSkirt * skirtDepth;
  vec3 world = vec3(uOrigin.x + uv.x * uSize, h, uOrigin.y + uv.y * uSize);
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const glslVec3 = (c: readonly number[]) => `vec3(${c.map((x) => (x / 255).toFixed(4)).join(', ')})`;
const glslFloat = (x: number) => x.toFixed(4);
const [CAPE_LO, CAPE_MID, CAPE_HI] = CAPE_CATEGORIES as [(typeof CAPE_CATEGORIES)[0], (typeof CAPE_CATEGORIES)[0], (typeof CAPE_CATEGORIES)[0]];

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>

uniform sampler2D uHeight;
uniform sampler2D uImagery;
uniform float uHasImagery;
uniform sampler2D uParentImagery;
uniform vec3 uParentUv;
uniform float uParentFade;
uniform float uMorph;
uniform vec2 uHeightTexel;
uniform float uHeightOffset;
uniform float uSize;
uniform float uHeightScale;
uniform float uExaggeration;
uniform float uShading;
uniform vec3 uSunDirection;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform sampler2D uCloudMap;
uniform vec4 uCloudRect;
uniform float uCloudY;
uniform float uCloudShadow;
uniform sampler2D uScalarMapA;
uniform sampler2D uScalarMapB;
uniform float uScalarBlend;
uniform sampler2D uScalarPalette;
uniform vec2 uScalarRange;
uniform vec4 uScalarRect;
uniform float uScalarOpacity;
uniform sampler2D uRainMapA;
uniform sampler2D uRainMapB;
uniform float uRainBlend;
uniform sampler2D uRainPalette;
uniform vec2 uRainRange;
uniform vec4 uRainRect;
uniform float uRainOpacity;
uniform sampler2D uWindTrail;
uniform vec4 uWindRect;
uniform float uWindOpacity;
uniform sampler2D uCapeMapA;
uniform sampler2D uCapeMapB;
uniform float uCapeBlend;
uniform vec4 uCapeRect;
uniform float uCapeOpacity;
uniform float uPixelRatio;
uniform sampler2D uLightning;
uniform vec4 uLightningRect;
uniform float uLightningOpacity;

varying vec2 vUv;
varying vec3 vWorld;

// Premultiplied wind particle trails at this ground position (same xz argument as drape).
vec4 windTrails() {
  if (uWindOpacity <= 0.0) return vec4(0.0);
  vec2 st = (vWorld.xz - uWindRect.xy) / uWindRect.zw;
  if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) return vec4(0.0);
  vec4 t = texture(uWindTrail, st);
  return vec4(t.rgb, min(t.a, 1.0)) * uWindOpacity;
}

// Premultiplied lightning markers at this ground position.
vec4 lightningMarks() {
  if (uLightningOpacity <= 0.0) return vec4(0.0);
  vec2 st = (vWorld.xz - uLightningRect.xy) / uLightningRect.zw;
  if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) return vec4(0.0);
  return texture(uLightning, st) * uLightningOpacity;
}

// Convective potential (CAPE, J/kg): discrete categories, transparent below the first,
// diagonal screen-space hatching (denser for stronger categories) over a light fill.
vec4 capeOverlay() {
  if (uCapeOpacity <= 0.0) return vec4(0.0);
  vec2 uv = (vWorld.xz - uCapeRect.xy) / uCapeRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  vec2 s = mix(texture(uCapeMapA, uv).rg, texture(uCapeMapB, uv).rg, uCapeBlend);
  if (s.g < 0.02) return vec4(0.0);
  float v = s.r / s.g;
  if (v < ${glslFloat(CAPE_LO.min)}) return vec4(0.0);
  vec3 c = ${glslVec3(CAPE_LO.color)};
  float fill = ${glslFloat(CAPE_LO.fill)};
  float spacing = ${glslFloat(CAPE_LO.hatchPx)};
  if (v >= ${glslFloat(CAPE_MID.min)}) { c = ${glslVec3(CAPE_MID.color)}; fill = ${glslFloat(CAPE_MID.fill)}; spacing = ${glslFloat(CAPE_MID.hatchPx)}; }
  if (v >= ${glslFloat(CAPE_HI.min)}) { c = ${glslVec3(CAPE_HI.color)}; fill = ${glslFloat(CAPE_HI.fill)}; spacing = ${glslFloat(CAPE_HI.hatchPx)}; }
  float px = spacing * uPixelRatio;
  // Anti-aliased line of ~1.6 CSS px across the diagonal.
  float d = abs(fract((gl_FragCoord.x + gl_FragCoord.y) / px) - 0.5) * px;
  float line = 1.0 - smoothstep(0.8 * uPixelRatio - 0.5, 0.8 * uPixelRatio + 0.5, d);
  float a = mix(fill, 0.95, line);
  return vec4(c, a * smoothstep(0.02, 0.5, s.g) * uCapeOpacity);
}

// Draped weather layer color (rgb) and coverage (a) at this ground position.
// vWorld.xz does not depend on height, so it is exact for every LOD and geomorph state.
vec4 drape(sampler2D mapA, sampler2D mapB, float blend, sampler2D palette, vec2 range, vec4 rect, float opacity) {
  if (opacity <= 0.0) return vec4(0.0);
  vec2 uv = (vWorld.xz - rect.xy) / rect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  vec2 s = mix(texture(mapA, uv).rg, texture(mapB, uv).rg, blend);
  if (s.g < 0.02) return vec4(0.0);
  // R holds value * validity, so dividing by the filtered validity keeps no-data cells from bleeding in.
  float t = clamp((s.r / s.g - range.x) / (range.y - range.x), 0.0, 1.0);
  vec4 c = texture(palette, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, 0.5));
  return vec4(c.rgb, c.a * smoothstep(0.02, 0.5, s.g) * opacity);
}

// Fraction of sunlight blocked by the cloud sheet along the sun direction.
float cloudShadow() {
  if (uCloudShadow <= 0.0) return 0.0;
  vec3 p = vWorld + uSunDirection * ((uCloudY - vWorld.y) / max(uSunDirection.y, 0.15));
  vec2 uv = (p.xz - uCloudRect.xy) / uCloudRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  // Mip bias blurs the shadow a little: shadows of high clouds are soft.
  return uCloudShadow * texture(uCloudMap, uv, 1.5).a;
}

float rawHeight(vec2 uv) {
  vec2 st = uHeightTexel * 0.5 + clamp(uv, 0.0, 1.0) * (1.0 - uHeightTexel);
  return texture(uHeight, st).r + uHeightOffset;
}

vec3 hypsometric(float h) {
  if (h <= 0.0) return mix(vec3(0.10, 0.26, 0.42), vec3(0.04, 0.12, 0.24), clamp(-h / 3000.0, 0.0, 1.0));
  vec3 c = vec3(0.16, 0.42, 0.22);
  c = mix(c, vec3(0.38, 0.55, 0.28), smoothstep(0.0, 600.0, h));
  c = mix(c, vec3(0.62, 0.60, 0.36), smoothstep(600.0, 1800.0, h));
  c = mix(c, vec3(0.62, 0.48, 0.34), smoothstep(1800.0, 3200.0, h));
  c = mix(c, vec3(0.50, 0.42, 0.38), smoothstep(3200.0, 4300.0, h));
  c = mix(c, vec3(0.93, 0.94, 0.96), smoothstep(4700.0, 5400.0, h));
  return c;
}

void main() {
  #include <logdepthbuf_fragment>

  // Normals follow the geomorph: at morph 0 the differences span two texels,
  // matching the parent's coarser texel spacing.
  vec2 d = uHeightTexel * (2.0 - uMorph);
  float scale = uHeightScale * uExaggeration;
  float hL = max(rawHeight(vUv - vec2(d.x, 0.0)), 0.0) * scale;
  float hR = max(rawHeight(vUv + vec2(d.x, 0.0)), 0.0) * scale;
  float hU = max(rawHeight(vUv - vec2(0.0, d.y)), 0.0) * scale;
  float hD = max(rawHeight(vUv + vec2(0.0, d.y)), 0.0) * scale;
  float spacing = 2.0 * uSize * d.x;
  vec3 normal = normalize(vec3(-(hR - hL) / spacing, 1.0, -(hD - hU) / spacing));

  float elevation = rawHeight(vUv);
  float diffuse = max(dot(normal, uSunDirection), 0.0);
  vec3 color;
  if (uShading < 0.5 && uHasImagery > 0.5) {
    // Imagery already contains baked shadows; apply gentle relief lighting.
    color = texture(uImagery, vUv).rgb * (0.55 + 0.6 * diffuse);
  } else {
    color = hypsometric(elevation) * (0.3 + 0.85 * diffuse);
  }
  if (uShading < 0.5 && uParentFade > 0.0) {
    // Cross-fade from the ancestor imagery this tile replaced.
    vec3 parent = texture(uParentImagery, uParentUv.xy + vUv * uParentUv.z).rgb * (0.55 + 0.6 * diffuse);
    color = mix(color, parent, uParentFade);
  }

  vec4 overlay = drape(uScalarMapA, uScalarMapB, uScalarBlend, uScalarPalette, uScalarRange, uScalarRect, uScalarOpacity);
  if (overlay.a > 0.0) color = mix(color, overlay.rgb * (0.62 + 0.5 * diffuse), overlay.a);
  // Rain over temperature: its palette is transparent where it does not rain.
  vec4 rain = drape(uRainMapA, uRainMapB, uRainBlend, uRainPalette, uRainRange, uRainRect, uRainOpacity);
  if (rain.a > 0.0) color = mix(color, rain.rgb * (0.7 + 0.4 * diffuse), rain.a);
  // Convective potential over rain: hatched, so rain stays visible between the lines.
  vec4 cape = capeOverlay();
  if (cape.a > 0.0) color = mix(color, cape.rgb * (0.75 + 0.35 * diffuse), cape.a);

  color *= 1.0 - cloudShadow();

  // Particles are data marks: drawn after lighting and cloud shadows so they stay legible.
  vec4 wind = windTrails();
  if (wind.a > 0.0) color = color * (1.0 - wind.a) + wind.rgb;
  // Observed lightning on top of every forecast layer.
  vec4 flash = lightningMarks();
  if (flash.a > 0.0) color = color * (1.0 - min(flash.a, 1.0)) + flash.rgb;

  float dist = length(vWorld - cameraPosition);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  gl_FragColor = vec4(mix(color, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
`;

export interface TileUniforms {
  uHeight: IUniform<Texture | null>;
  uImagery: IUniform<Texture | null>;
  uHasImagery: IUniform<number>;
  /** Ancestor imagery that a newly refined tile fades in from. */
  uParentImagery: IUniform<Texture | null>;
  /** (offsetU, offsetV, scale) of this tile inside the ancestor texture. */
  uParentUv: IUniform<Vector3>;
  /** 1 = ancestor imagery only, 0 = own imagery only. */
  uParentFade: IUniform<number>;
  /** Geomorph factor: 0 = parent's coarser surface, 1 = full detail. */
  uMorph: IUniform<number>;
  uSegments: IUniform<number>;
  uHeightTexel: IUniform<Vector2>;
  /** Meters added to every height texel (heights are stored relative to the tile minimum). */
  uHeightOffset: IUniform<number>;
  uOrigin: IUniform<Vector2>;
  uSize: IUniform<number>;
  uHeightScale: IUniform<number>;
}

export function createTerrainMaterial(
  shared: SharedTerrainUniforms,
  segments: number,
): ShaderMaterial & { uniforms: TileUniforms } {
  const tile: TileUniforms = {
    uHeight: { value: null },
    uImagery: { value: null },
    uHasImagery: { value: 0 },
    uParentImagery: { value: null },
    uParentUv: { value: new Vector3(0, 0, 1) },
    uParentFade: { value: 0 },
    uMorph: { value: 1 },
    uSegments: { value: segments },
    uHeightTexel: { value: new Vector2(1 / 512, 1 / 512) },
    uHeightOffset: { value: 0 },
    uOrigin: { value: new Vector2() },
    uSize: { value: 1 },
    uHeightScale: { value: 1 },
  };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { ...shared, ...tile },
  });
  return material as ShaderMaterial & { uniforms: TileUniforms };
}
