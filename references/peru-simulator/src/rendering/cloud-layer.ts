import {
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  Vector4,
  type IUniform,
  type Vector3,
} from 'three';
import { cloudLayerFade, cloudRectLocal, type CloudMetadata } from '../domain/cloud-overlay';
import { heightScaleAt, localToLonLat, type LocalFrame } from '../domain/local-frame';
import type { SharedTerrainUniforms } from './terrain-material';

/** Altitude of the lowest cloud sheet in true meters (above the highest Andes peaks). */
export const CLOUD_BASE_ALTITUDE_M = 7000;
/** Vertical spacing between stacked sheets in true meters. */
export const CLOUD_LAYER_SPACING_M = 1000;
const LAYER_COUNT = 3;
/** Darkening of the terrain under a fully opaque cloud. */
const SHADOW_STRENGTH = 0.35;

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform vec4 uRect;
uniform float uOpacity;
uniform float uFade;
uniform float uLayer;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;

void main() {
  #include <logdepthbuf_fragment>
  vec2 uv = (vWorld.xz - uRect.xy) / uRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
  vec4 c = texture(uMap, uv);
  // Every sheet draws the thin cloud faintly; only denser cloud reaches the
  // upper sheets, so thick tops look layered and thin cloud stays translucent.
  float a = c.a * mix(0.6, 0.4, uLayer) * smoothstep(uLayer * 0.6, uLayer * 0.6 + 0.3, c.a);
  // Soft image border instead of a hard rectangle edge.
  vec2 edge = min(uv, 1.0 - uv);
  a *= smoothstep(0.0, 0.03, min(edge.x, edge.y));
  vec3 view = normalize(vWorld - cameraPosition);
  // Fade at grazing angles so a sheet never reads as a flat wall.
  a *= smoothstep(0.02, 0.15, abs(view.y));
  float lum = c.r * mix(0.92, 1.05, uLayer);
  // Seen from below, clouds are lit from the other side: darker undersides.
  if (cameraPosition.y < vWorld.y) lum *= 0.72;
  float dist = length(vWorld - cameraPosition);
  float fog = clamp(1.0 - exp(-pow(dist * uFogDensity * 0.6, 2.0)), 0.0, 1.0);
  vec3 color = mix(vec3(min(lum, 1.0)), uFogColor, fog);
  gl_FragColor = vec4(color, a * uOpacity * uFade);
  if (gl_FragColor.a < 0.004) discard;
}
`;

interface SheetUniforms {
  [name: string]: IUniform;
  uMap: IUniform<Texture | null>;
  uRect: IUniform<Vector4>;
  uOpacity: IUniform<number>;
  uFade: IUniform<number>;
  uLayer: IUniform<number>;
}

type Sheet = Mesh<PlaneGeometry, ShaderMaterial & { uniforms: SheetUniforms }>;

/**
 * Satellite cloud overlay: a few stacked transparent sheets textured with the
 * reprojected GOES image, plus terrain cloud shadows via the shared terrain
 * uniforms. One texture upload per image; nothing is allocated per frame.
 */
export class CloudLayer {
  readonly group = new Group();
  private readonly geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly sheets: Sheet[] = [];
  private readonly rect = new Vector4(0, 0, 1, 1);
  private texture: Texture | null = null;
  private centerLat = 0;
  private enabled = true;
  private opacity = 0.9;

  constructor(
    private readonly frame: LocalFrame,
    private readonly terrain: SharedTerrainUniforms,
  ) {
    for (let i = 0; i < LAYER_COUNT; i++) {
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uMap: { value: null },
          uRect: { value: this.rect },
          uOpacity: { value: this.opacity },
          uFade: { value: 1 },
          uLayer: { value: i / (LAYER_COUNT - 1) },
          uFogColor: terrain.uFogColor,
          uFogDensity: terrain.uFogDensity,
        },
      }) as ShaderMaterial & { uniforms: SheetUniforms };
      const sheet = new Mesh(this.geometry, material) as Sheet;
      sheet.frustumCulled = false;
      this.sheets.push(sheet);
      this.group.add(sheet);
    }
    this.group.visible = false;
  }

  get hasImage(): boolean {
    return this.texture !== null;
  }

  /** Replaces the cloud image; takes ownership of the bitmap and disposes the previous texture. */
  setImage(bitmap: ImageBitmap, meta: CloudMetadata): void {
    const texture = new Texture(bitmap);
    texture.flipY = false; // ImageBitmaps cannot be flipped on upload; v = 0 is the north edge.
    texture.colorSpace = NoColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    const old = this.texture;
    this.texture = texture;
    if (old) {
      (old.image as ImageBitmap | undefined)?.close?.();
      old.dispose();
    }

    const r = cloudRectLocal(this.frame, meta);
    this.rect.set(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ);
    this.centerLat = localToLonLat(this.frame, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2).lat;
    for (const s of this.sheets) {
      s.material.uniforms.uMap.value = texture;
      s.scale.set(r.maxX - r.minX, 1, r.maxZ - r.minZ);
      s.position.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
    }
    this.terrain.uCloudMap.value = texture;
    this.terrain.uCloudRect.value.copy(this.rect);
    this.applyVisibility();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyVisibility();
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    for (const s of this.sheets) s.material.uniforms.uOpacity.value = opacity;
    this.applyVisibility();
  }

  /** Per-frame: sheet heights follow the exaggeration; sheets near the camera fade out. */
  update(cameraPosition: Vector3, exaggeration: number): void {
    if (!this.group.visible) return;
    const scale = heightScaleAt(this.frame, this.centerLat) * exaggeration;
    const spacing = CLOUD_LAYER_SPACING_M * scale;
    const base = CLOUD_BASE_ALTITUDE_M * scale;
    const above = cameraPosition.y > base + spacing;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const s = this.sheets[i]!;
      s.position.y = base + i * spacing;
      s.updateMatrixWorld();
      s.material.uniforms.uFade.value = cloudLayerFade(cameraPosition.y, s.position.y, spacing * 0.5);
      // Transparent sheets share a center, so draw them far-to-near explicitly.
      s.renderOrder = 1_000_000 + (above ? i : LAYER_COUNT - 1 - i);
    }
    this.terrain.uCloudY.value = base;
  }

  dispose(): void {
    for (const s of this.sheets) s.material.dispose();
    this.geometry.dispose();
    this.texture?.dispose();
  }

  private applyVisibility(): void {
    const on = this.enabled && this.texture !== null;
    this.group.visible = on && this.opacity > 0;
    this.terrain.uCloudShadow.value = on ? SHADOW_STRENGTH * this.opacity : 0;
  }
}
