import {
	Color3,
	Mesh,
	StandardMaterial,
	VertexBuffer,
	VertexData,
} from "@babylonjs/core";
import { worldToLocal } from "../map/lod/quadtree";
import type {
	OverviewOverlay,
	OverviewOverlayContext,
} from "../map/PeruOverview";
import { lonLatToWorld, metresPerWorldUnit } from "../map/tileMath";
import {
	AFFECTED_DEPTH_M,
	FLOW_FULL_COLOR_DEPTH_M,
	FLOW_LIFT_M,
	FLOW_MIN_ALPHA,
	FLOW_RELIEF_REFRESH_MS,
} from "./constants";
import type { LonLat } from "./events";

const METERS_PER_KM = 1_000;

export interface FlowGridPlacement {
	center: LonLat;
	resolution: number;
	cellSize: number;
}

export interface FlowPalette {
	shallow: string;
	deep: string;
}

/**
 * One recorded flow drawn on the Peru overview: a vertex per simulation cell, placed like
 * `buildLocalGrid` samples them, standing on the drawn relief and coloured by depth.
 */
export class FlowLayer implements OverviewOverlay {
	private readonly mesh: Mesh;
	private readonly material: StandardMaterial;
	/** Local (x, z) of each vertex, in the overview's kilometres. */
	private readonly localPoints: Float32Array;
	private readonly reliefKm: Float32Array;
	private readonly positions: Float32Array;
	private readonly colors: Float32Array;
	private readonly shallow: Color3;
	private readonly deep: Color3;
	private depth: Float32Array;
	private exaggeration = 1;
	private lastReliefRead = Number.NEGATIVE_INFINITY;

	constructor(
		private readonly context: OverviewOverlayContext,
		placement: FlowGridPlacement,
		palette: FlowPalette,
	) {
		const { center, resolution, cellSize } = placement;
		const cells = resolution * resolution;
		const centerWorld = lonLatToWorld(center.lon, center.lat);
		const worldPerMeter = 1 / metresPerWorldUnit(center.lat);
		const span = resolution * cellSize;
		this.localPoints = new Float32Array(cells * 2);
		for (let row = 0; row < resolution; row++) {
			const north = (row + 0.5) * cellSize - span / 2;
			for (let column = 0; column < resolution; column++) {
				const east = (column + 0.5) * cellSize - span / 2;
				const [x, z] = worldToLocal(
					context.frame,
					centerWorld.x + east * worldPerMeter,
					centerWorld.y - north * worldPerMeter,
				);
				this.localPoints[(row * resolution + column) * 2] = x;
				this.localPoints[(row * resolution + column) * 2 + 1] = z;
			}
		}
		this.reliefKm = new Float32Array(cells);
		this.positions = new Float32Array(cells * 3);
		this.colors = new Float32Array(cells * 4);
		this.depth = new Float32Array(cells);
		this.shallow = Color3.FromHexString(palette.shallow);
		this.deep = Color3.FromHexString(palette.deep);

		const indices: number[] = [];
		for (let row = 0; row < resolution - 1; row++)
			for (let column = 0; column < resolution - 1; column++) {
				const corner = row * resolution + column;
				indices.push(corner, corner + 1, corner + resolution);
				indices.push(corner + 1, corner + resolution + 1, corner + resolution);
			}
		this.mesh = new Mesh("dashboard-flow", context.scene);
		const vertexData = new VertexData();
		vertexData.positions = this.positions;
		vertexData.colors = this.colors;
		vertexData.indices = indices;
		vertexData.applyToMesh(this.mesh, true);
		this.mesh.hasVertexAlpha = true;
		this.mesh.isPickable = false;
		this.mesh.parent = context.parent;
		this.material = new StandardMaterial("dashboard-flow-mat", context.scene);
		this.material.disableLighting = true;
		this.material.emissiveColor = Color3.White();
		this.material.backFaceCulling = false;
		this.mesh.material = this.material;
	}

	setExaggeration(exaggeration: number): void {
		this.exaggeration = exaggeration;
		this.writePositions();
	}

	update(now: number): void {
		if (now - this.lastReliefRead < FLOW_RELIEF_REFRESH_MS) return;
		this.lastReliefRead = now;
		for (let cell = 0; cell < this.reliefKm.length; cell++)
			this.reliefKm[cell] = this.context.heightKm(
				this.localPoints[cell * 2],
				this.localPoints[cell * 2 + 1],
			);
		this.writePositions();
	}

	/** Shows one recorded frame: depth per cell (m), in the simulation grid's order. */
	setDepth(depth: Float32Array): void {
		this.depth = depth;
		depth.forEach((value, cell) => {
			const strength = Math.min(1, value / FLOW_FULL_COLOR_DEPTH_M);
			this.colors[cell * 4] =
				this.shallow.r + (this.deep.r - this.shallow.r) * strength;
			this.colors[cell * 4 + 1] =
				this.shallow.g + (this.deep.g - this.shallow.g) * strength;
			this.colors[cell * 4 + 2] =
				this.shallow.b + (this.deep.b - this.shallow.b) * strength;
			this.colors[cell * 4 + 3] =
				value > AFFECTED_DEPTH_M
					? FLOW_MIN_ALPHA + (1 - FLOW_MIN_ALPHA) * strength
					: 0;
		});
		this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors);
		this.writePositions();
	}

	dispose(): void {
		this.mesh.dispose();
		this.material.dispose();
	}

	private writePositions(): void {
		for (let cell = 0; cell < this.reliefKm.length; cell++) {
			this.positions[cell * 3] = this.localPoints[cell * 2];
			this.positions[cell * 3 + 1] =
				(this.reliefKm[cell] +
					(this.depth[cell] + FLOW_LIFT_M) / METERS_PER_KM) *
				this.exaggeration;
			this.positions[cell * 3 + 2] = this.localPoints[cell * 2 + 1];
		}
		this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions);
		this.mesh.refreshBoundingInfo();
	}
}
