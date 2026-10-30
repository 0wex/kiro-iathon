import {
	Color3,
	DirectionalLight,
	HemisphericLight,
	Matrix,
	Mesh,
	Quaternion,
	type Scene,
	StandardMaterial,
	type TransformNode,
	Vector3,
	VertexData,
} from "@babylonjs/core";
import { type LocalFrame, localToLonLat, worldToLocal } from "../lod/quadtree";
import { lonLatToWorld, tileBoundsLonLat } from "../tileMath";
import { OBJECT_TILE_CACHE_SIZE, OBJECTS_UPDATE_INTERVAL_MS } from "./constants";
import { buildModel, MODEL_VARIANT_COUNT, type ObjectModel } from "./models";
import { objectTileKey, objectTilesAround } from "./objectTiles";
import type { ObjectSourcesApi } from "./sources";
import { type PlacedObject, placeTileObjects } from "./tilePlacement";

/** Requests in flight at once: each tile asks three services. */
const MAX_TILES_IN_FLIGHT = 3;
/** Models are built in metres; the overview scene is in kilometres. */
const SCENE_UNITS_PER_METER = 0.001;
const PLANT_MIN_SCALE = 0.8;
const PLANT_SCALE_RANGE = 0.4;

export interface ObjectsVisibility {
	houses: boolean;
	vegetation: boolean;
}

export interface ObjectsLayerStats {
	tilesWanted: number;
	tilesLoaded: number;
	tilesInFlight: number;
	tilesFailed: number;
	objectsDrawn: number;
}

interface ObjectTile {
	objects: PlacedObject[] | null;
	failed: boolean;
}

/**
 * Houses, landmarks and vegetation of the object tiles around what the camera looks at,
 * one thin-instanced mesh per model variant, parented to the map root and standing on
 * the drawn relief (same heights as the terrain mesh, scaled by the vertical exaggeration).
 */
export class ObjectsLayer {
	private readonly tiles = new Map<string, ObjectTile>();
	private readonly meshes = new Map<string, Mesh>();
	private readonly material: StandardMaterial;
	private lights: { sky: HemisphericLight; sun: DirectionalLight } | null = null;
	private wantedKeys: string[] = [];
	private inFlight = 0;
	private lastUpdate = 0;
	private dirty = false;
	private exaggeration = 1;
	private visibility: ObjectsVisibility = { houses: true, vegetation: true };
	private objectsDrawn = 0;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		private readonly parent: TransformNode,
		private readonly frame: LocalFrame,
		private readonly api: ObjectSourcesApi,
		/** Unexaggerated ground height (km) of the drawn relief at a local (x, z). */
		private readonly heightKm: (x: number, z: number) => number,
	) {
		this.material = new StandardMaterial("peru-objects-mat", scene);
		this.material.specularColor = Color3.Black();
	}

	setExaggeration(exaggeration: number): void {
		this.exaggeration = exaggeration;
		this.dirty = true;
	}

	setVisibility(visibility: ObjectsVisibility): void {
		this.visibility = visibility;
		this.dirty = true;
	}

	get stats(): ObjectsLayerStats {
		const entries = [...this.tiles.values()];
		return {
			tilesWanted: this.wantedKeys.length,
			tilesLoaded: entries.filter((tile) => tile.objects).length,
			tilesInFlight: this.inFlight,
			tilesFailed: entries.filter((tile) => tile.failed).length,
			objectsDrawn: this.objectsDrawn,
		};
	}

	/** `focus` is the local point the camera looks at; `viewKm` how far the camera is from it. */
	update(now: number, focus: { x: number; z: number }, viewKm: number): void {
		if (now - this.lastUpdate >= OBJECTS_UPDATE_INTERVAL_MS) {
			this.lastUpdate = now;
			const wanted = objectTilesAround(localToLonLat(this.frame, focus.x, focus.z), viewKm);
			const keys = wanted.map(objectTileKey);
			if (keys.join() !== this.wantedKeys.join()) {
				this.wantedKeys = keys;
				this.dirty = true;
			}
			for (const tile of wanted) {
				const key = objectTileKey(tile);
				if (this.inFlight >= MAX_TILES_IN_FLIGHT) break;
				if (!this.tiles.has(key)) void this.loadTile(key, tileBoundsLonLat(tile));
			}
			// At most one rebuild per interval, even when several tiles land together.
			if (this.dirty) this.rebuild();
		}
	}

	dispose(): void {
		this.disposed = true;
		for (const mesh of this.meshes.values()) mesh.dispose();
		this.material.dispose();
		this.lights?.sky.dispose();
		this.lights?.sun.dispose();
	}

	private elevationMeters(lon: number, lat: number): number {
		const world = lonLatToWorld(lon, lat);
		const [x, z] = worldToLocal(this.frame, world.x, world.y);
		return this.heightKm(x, z) * 1000;
	}

	private async loadTile(key: string, box: ReturnType<typeof tileBoundsLonLat>): Promise<void> {
		const tile: ObjectTile = { objects: null, failed: false };
		this.tiles.set(key, tile);
		this.inFlight++;
		// A failing source only removes its own objects (no vegetation when MINAM is down).
		const [blocks, places, landCover] = await Promise.allSettled([
			this.api.blocks(box),
			this.api.populatedPlaces(box),
			this.api.landCover(box),
		]);
		this.inFlight--;
		if (this.disposed) return;
		const valueOf = <Value>(result: PromiseSettledResult<Value[]>): Value[] =>
			result.status === "fulfilled" ? result.value : [];
		tile.failed = [blocks, places, landCover].every((result) => result.status === "rejected");
		tile.objects = placeTileObjects(
			key,
			box,
			{ blocks: valueOf(blocks), places: valueOf(places), landCover: valueOf(landCover) },
			(lon, lat) => this.elevationMeters(lon, lat),
		);
		this.evictUnwanted();
		if (this.wantedKeys.includes(key)) this.dirty = true;
	}

	private evictUnwanted(): void {
		for (const key of this.tiles.keys()) {
			if (this.tiles.size <= OBJECT_TILE_CACHE_SIZE) return;
			if (!this.wantedKeys.includes(key)) this.tiles.delete(key);
		}
	}

	private meshFor(model: ObjectModel, variantIndex: number): Mesh {
		const key = `peru-object-${model}:${variantIndex}`;
		const existing = this.meshes.get(key);
		if (existing) return existing;
		const geometry = buildModel(model, variantIndex);
		const mesh = new Mesh(key, this.scene);
		const vertexData = new VertexData();
		vertexData.positions = geometry.positions;
		vertexData.normals = geometry.normals;
		vertexData.colors = geometry.colors;
		vertexData.indices = geometry.indices;
		vertexData.applyToMesh(mesh);
		mesh.material = this.material;
		mesh.parent = this.parent;
		mesh.isPickable = false;
		this.meshes.set(key, mesh);
		this.lightMesh(mesh);
		return mesh;
	}

	/**
	 * The overview has no lights (the relief has its own shader), so the objects bring theirs,
	 * restricted to their meshes: an empty include list would light every mesh of the scene.
	 */
	private lightMesh(mesh: Mesh): void {
		if (!this.lights) {
			const sky = new HemisphericLight("peru-objects-sky", new Vector3(0, 1, 0), this.scene);
			sky.intensity = 0.65;
			sky.groundColor = new Color3(0.35, 0.3, 0.25);
			const sun = new DirectionalLight("peru-objects-sun", new Vector3(-0.4, -1, 0.3), this.scene);
			sun.intensity = 0.7;
			this.lights = { sky, sun };
		}
		this.lights.sky.includedOnlyMeshes.push(mesh);
		this.lights.sun.includedOnlyMeshes.push(mesh);
	}

	private isVisible(object: PlacedObject): boolean {
		return object.kind === "plant" ? this.visibility.vegetation : this.visibility.houses;
	}

	private rebuild(): void {
		this.dirty = false;
		const variantIndexOf = (object: PlacedObject) =>
			Math.min(
				MODEL_VARIANT_COUNT[object.model] - 1,
				Math.floor(object.variant * MODEL_VARIANT_COUNT[object.model]),
			);
		const groups = new Map<string, PlacedObject[]>();
		for (const key of this.wantedKeys)
			for (const object of this.tiles.get(key)?.objects ?? []) {
				if (!this.isVisible(object)) continue;
				const meshKey = this.meshFor(object.model, variantIndexOf(object)).name;
				const group = groups.get(meshKey) ?? [];
				group.push(object);
				groups.set(meshKey, group);
			}
		const matrix = new Matrix();
		const rotation = new Quaternion();
		const scaling = new Vector3();
		const translation = new Vector3();
		this.objectsDrawn = 0;
		for (const mesh of this.meshes.values()) {
			const group = groups.get(mesh.name) ?? [];
			mesh.setEnabled(group.length > 0);
			if (group.length === 0) continue;
			const buffer = new Float32Array(group.length * 16);
			group.forEach((object, index) => {
				const world = lonLatToWorld(object.lon, object.lat);
				const [x, z] = worldToLocal(this.frame, world.x, world.y);
				scaling.setAll(
					SCENE_UNITS_PER_METER *
						(object.kind === "plant" ? PLANT_MIN_SCALE + PLANT_SCALE_RANGE * object.variant : 1),
				);
				translation.set(x, this.heightKm(x, z) * this.exaggeration, z);
				// Babylon's left-handed yaw turns +x towards -z, so the heading (east → north) is negated.
				Quaternion.RotationYawPitchRollToRef(-object.heading, 0, 0, rotation);
				Matrix.ComposeToRef(scaling, rotation, translation, matrix);
				matrix.copyToArray(buffer, index * 16);
			});
			mesh.thinInstanceSetBuffer("matrix", buffer, 16, false);
			mesh.thinInstanceRefreshBoundingInfo(false);
			this.objectsDrawn += group.length;
		}
	}
}
