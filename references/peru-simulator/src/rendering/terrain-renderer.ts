import { Group, Mesh, type BufferGeometry, type ShaderMaterial, type Vector3 } from 'three';
import { heightScaleAt, mercatorToLocal, type LocalFrame } from '../domain/local-frame';
import { ancestorUvTransform, mercatorToLonLat, parentOf, tileBoundsMercator, tileKey } from '../domain/tile-math';
import type { TileId } from '../domain/types';
import { createTerrainMaterial, type SharedTerrainUniforms, type TileUniforms } from './terrain-material';
import { createTileGeometry } from './tile-geometry';
import type { HeightResource, ImageryResource } from './tile-resources';

type TileMesh = Mesh<BufferGeometry, ShaderMaterial & { uniforms: TileUniforms }>;

/** Duration of the geomorph ramp and imagery cross-fade of a newly refined tile. */
export const TRANSITION_MS = 300;

interface ActiveTile {
  mesh: TileMesh;
  /** Geomorph factor requested by the LOD selection. */
  lodMorph: number;
  appearedAt: number;
  /** True when the tile replaced a displayed ancestor, so it transitions in over time. */
  refining: boolean;
  /** Key of the ancestor whose imagery is being faded out, if any. */
  fadeKey: string | null;
}

export interface TileTextures {
  height(key: string): HeightResource | undefined;
  imagery(key: string): ImageryResource | undefined;
}

/**
 * Draws the displayed tile set with one shared grid geometry. Meshes and
 * materials are pooled so steady-state navigation allocates nothing.
 */
export class TerrainRenderer {
  readonly group = new Group();
  readonly segments: number;
  private readonly geometry: BufferGeometry;
  private readonly active = new Map<string, ActiveTile>();
  private readonly pool: TileMesh[] = [];

  constructor(
    private readonly frame: LocalFrame,
    private readonly shared: SharedTerrainUniforms,
    segments = 64,
  ) {
    this.segments = segments;
    this.geometry = createTileGeometry(segments);
  }

  get visibleCount(): number {
    return this.active.size;
  }

  /** Ancestor keys whose imagery is still sampled by a cross-fade; keep them cached. */
  get fadeSourceKeys(): Set<string> {
    const keys = new Set<string>();
    for (const a of this.active.values()) if (a.fadeKey) keys.add(a.fadeKey);
    return keys;
  }

  setDisplay(
    display: readonly TileId[],
    morph: ReadonlyMap<string, number>,
    textures: TileTextures,
    cameraPosition: Vector3,
    now: number,
  ): void {
    const wanted = new Map(display.map((t) => [tileKey(t), t] as const));
    const previous = new Set(this.active.keys());
    for (const [key, entry] of this.active) {
      if (!wanted.has(key)) {
        this.active.delete(key);
        this.release(entry.mesh);
      }
    }
    const order: { mesh: TileMesh; distance: number }[] = [];
    for (const [key, tile] of wanted) {
      const height = textures.height(key);
      if (!height) continue;
      let entry = this.active.get(key);
      if (!entry) {
        entry = this.activate(tile, previous, textures, now);
        this.active.set(key, entry);
      }
      entry.lodMorph = morph.get(key) ?? 1;
      const mesh = entry.mesh;
      const u = mesh.material.uniforms;
      u.uHeight.value = height.texture;
      u.uHeightTexel.value.set(1 / height.tile.width, 1 / height.tile.height);
      u.uHeightOffset.value = height.tile.offset;
      const imagery = textures.imagery(key)?.texture ?? null;
      u.uImagery.value = imagery;
      u.uHasImagery.value = imagery ? 1 : 0;
      const cx = u.uOrigin.value.x + u.uSize.value / 2 - cameraPosition.x;
      const cz = u.uOrigin.value.y + u.uSize.value / 2 - cameraPosition.z;
      order.push({ mesh, distance: cx * cx + cz * cz });
    }
    // Front-to-back order maximizes early depth rejection.
    order.sort((a, b) => a.distance - b.distance);
    order.forEach((o, i) => (o.mesh.renderOrder = i));
    this.update(now);
  }

  /** Advances time-based transitions; call once per frame before rendering. */
  update(now: number): void {
    for (const entry of this.active.values()) {
      const u = entry.mesh.material.uniforms;
      const t = entry.refining ? Math.min(1, Math.max(0, (now - entry.appearedAt) / TRANSITION_MS)) : 1;
      // A refined tile starts on its parent's surface even if its data arrived late.
      u.uMorph.value = Math.min(entry.lodMorph, t);
      if (entry.fadeKey && t >= 1) {
        entry.fadeKey = null;
        u.uParentImagery.value = null;
      }
      u.uParentFade.value = entry.fadeKey ? 1 - t : 0;
    }
  }

  dispose(): void {
    for (const mesh of [...[...this.active.values()].map((a) => a.mesh), ...this.pool]) mesh.material.dispose();
    this.active.clear();
    this.pool.length = 0;
    this.geometry.dispose();
  }

  private activate(tile: TileId, previous: ReadonlySet<string>, textures: TileTextures, now: number): ActiveTile {
    const mesh = this.acquire();
    this.place(mesh, tile);
    const entry: ActiveTile = { mesh, lodMorph: 1, appearedAt: now, refining: false, fadeKey: null };
    let ancestor = parentOf(tile);
    while (ancestor && !previous.has(tileKey(ancestor))) ancestor = parentOf(ancestor);
    if (!ancestor) return entry;
    entry.refining = true;
    const ancestorKey = tileKey(ancestor);
    const texture = textures.imagery(ancestorKey)?.texture ?? null;
    if (texture) {
      const uv = ancestorUvTransform(tile, ancestor);
      const u = mesh.material.uniforms;
      u.uParentImagery.value = texture;
      u.uParentUv.value.set(uv.offsetU, uv.offsetV, uv.scale);
      entry.fadeKey = ancestorKey;
    }
    return entry;
  }

  private place(mesh: TileMesh, tile: TileId): void {
    const m = tileBoundsMercator(tile);
    const nw = mercatorToLocal(this.frame, m.minX, m.maxY);
    const se = mercatorToLocal(this.frame, m.maxX, m.minY);
    const centerLat = mercatorToLonLat((m.minX + m.maxX) / 2, (m.minY + m.maxY) / 2).lat;
    const u = mesh.material.uniforms;
    u.uOrigin.value.set(nw.x, nw.z);
    u.uSize.value = se.x - nw.x;
    u.uHeightScale.value = heightScaleAt(this.frame, centerLat);
  }

  private acquire(): TileMesh {
    const mesh = this.pool.pop() ?? this.createMesh();
    this.group.add(mesh);
    return mesh;
  }

  private release(mesh: TileMesh): void {
    this.group.remove(mesh);
    mesh.material.uniforms.uHeight.value = null;
    mesh.material.uniforms.uImagery.value = null;
    mesh.material.uniforms.uParentImagery.value = null;
    mesh.material.uniforms.uParentFade.value = 0;
    mesh.material.uniforms.uMorph.value = 1;
    this.pool.push(mesh);
  }

  private createMesh(): TileMesh {
    const mesh = new Mesh(this.geometry, createTerrainMaterial(this.shared, this.segments)) as TileMesh;
    // Culling is done by the quadtree; the unit-square bounds would be wrong anyway.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}
