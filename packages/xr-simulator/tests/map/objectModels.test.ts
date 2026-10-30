import { describe, expect, it } from "vitest";
import { OBJECT_PALETTE } from "../../src/map/objects/modelConstants";
import {
	buildModel,
	MODEL_VARIANT_COUNT,
	type ModelGeometry,
	OBJECT_MODELS,
	type ObjectModel,
} from "../../src/map/objects/models";

const BUILDINGS: ObjectModel[] = [
	"coastFlatRoof",
	"coastUnfinished",
	"coastApartment",
	"coastMatting",
	"adobeTile",
	"adobeTin",
	"brickTin",
	"church",
];
const HOUSES: ObjectModel[] = BUILDINGS.filter((model) => model !== "church");
const VEGETATION: ObjectModel[] = [
	"ichu",
	"tola",
	"queuna",
	"eucalyptus",
	"cactus",
	"thornShrub",
];
const MAX_FOOTPRINT_M: Record<ObjectModel, number> = {
	coastFlatRoof: 12,
	coastUnfinished: 12,
	coastMatting: 12,
	adobeTile: 12,
	adobeTin: 12,
	brickTin: 12,
	coastApartment: 14,
	church: 30,
	plaza: 44,
	ichu: 2,
	tola: 3,
	queuna: 8,
	eucalyptus: 10,
	cactus: 4,
	thornShrub: 5,
};
const MAX_TRIANGLES: Record<ObjectModel, number> = {
	coastFlatRoof: 300,
	coastUnfinished: 300,
	coastMatting: 300,
	adobeTile: 300,
	adobeTin: 300,
	brickTin: 300,
	coastApartment: 300,
	church: 300,
	plaza: 600,
	ichu: 200,
	tola: 200,
	queuna: 200,
	eucalyptus: 200,
	cactus: 200,
	thornShrub: 200,
};
const UNIT_TOLERANCE = 1e-4;

function everyVariant(): {
	model: ObjectModel;
	variant: number;
	geometry: ModelGeometry;
}[] {
	return OBJECT_MODELS.flatMap((model) =>
		Array.from({ length: MODEL_VARIANT_COUNT[model] }, (_, variant) => ({
			model,
			variant,
			geometry: buildModel(model, variant),
		})),
	);
}

function verticalRange(geometry: ModelGeometry): {
	minY: number;
	maxY: number;
} {
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let index = 1; index < geometry.positions.length; index += 3) {
		minY = Math.min(minY, geometry.positions[index]);
		maxY = Math.max(maxY, geometry.positions[index]);
	}
	return { minY, maxY };
}

function horizontalExtent(geometry: ModelGeometry): {
	sizeX: number;
	sizeZ: number;
} {
	const xs = geometry.positions.filter((_, index) => index % 3 === 0);
	const zs = geometry.positions.filter((_, index) => index % 3 === 2);
	return {
		sizeX: Math.max(...xs) - Math.min(...xs),
		sizeZ: Math.max(...zs) - Math.min(...zs),
	};
}

describe("procedural low-poly object models", () => {
	it("lists the 15 phase-1 models, each with 1 to 3 variants", () => {
		expect(new Set(OBJECT_MODELS).size).toBe(15);
		expect([...BUILDINGS, ...VEGETATION, "plaza"].sort()).toEqual(
			[...OBJECT_MODELS].sort(),
		);
		for (const model of OBJECT_MODELS) {
			expect(MODEL_VARIANT_COUNT[model]).toBeGreaterThanOrEqual(1);
			expect(MODEL_VARIANT_COUNT[model]).toBeLessThanOrEqual(3);
		}
	});

	it("builds every variant of every model with consistent array lengths", () => {
		for (const { geometry } of everyVariant()) {
			const vertexCount = geometry.positions.length / 3;
			expect(vertexCount).toBeGreaterThan(0);
			expect(Number.isInteger(vertexCount)).toBe(true);
			expect(geometry.normals.length).toBe(vertexCount * 3);
			expect(geometry.colors.length).toBe(vertexCount * 4);
			expect(geometry.indices.length % 3).toBe(0);
			expect(Math.max(...geometry.indices)).toBeLessThan(vertexCount);
		}
	});

	// Babylon's StandardMaterial culls with its own ComputeNormals convention: the visible side
	// of a triangle is the one (v1 - v0) × (v2 - v0) points away from (seen in the viewer).
	it("uses unit flat normals opposite to (v1 - v0) × (v2 - v0), as Babylon draws front faces", () => {
		for (const { geometry } of everyVariant()) {
			const { positions, normals, indices } = geometry;
			for (let corner = 0; corner < indices.length; corner += 3) {
				const [first, second, third] = [
					indices[corner],
					indices[corner + 1],
					indices[corner + 2],
				];
				const edgeA = [0, 1, 2].map(
					(axis) => positions[second * 3 + axis] - positions[first * 3 + axis],
				);
				const edgeB = [0, 1, 2].map(
					(axis) => positions[third * 3 + axis] - positions[first * 3 + axis],
				);
				const cross = [
					edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
					edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
					edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0],
				];
				for (const vertex of [first, second, third]) {
					const normal = [0, 1, 2].map((axis) => normals[vertex * 3 + axis]);
					expect(Math.hypot(...normal)).toBeCloseTo(1, 4);
					const alignment =
						normal[0] * cross[0] + normal[1] * cross[1] + normal[2] * cross[2];
					expect(alignment / Math.hypot(...cross)).toBeLessThan(
						-(1 - UNIT_TOLERANCE),
					);
				}
			}
		}
	});

	it("colours every vertex with an opaque palette colour", () => {
		const palette = Object.values(OBJECT_PALETTE).map((color) =>
			color.join(","),
		);
		for (const { geometry } of everyVariant()) {
			for (let vertex = 0; vertex < geometry.colors.length; vertex += 4) {
				const rgb = Array.from(
					geometry.colors.subarray(vertex, vertex + 3),
				).map((channel) => Math.round(channel * 1000) / 1000);
				expect(palette).toContain(rgb.join(","));
				expect(geometry.colors[vertex + 3]).toBe(1);
			}
		}
	});

	it("sinks buildings to y = -2 m and vegetation to y = -0.5 m, with positive height", () => {
		for (const { model, geometry } of everyVariant()) {
			const { minY, maxY } = verticalRange(geometry);
			expect(maxY).toBeGreaterThan(0);
			if (BUILDINGS.includes(model)) expect(minY).toBeLessThanOrEqual(-2);
			if (VEGETATION.includes(model)) expect(minY).toBeLessThanOrEqual(-0.5);
		}
	});

	it("keeps footprints inside the slot limits", () => {
		for (const { model, geometry } of everyVariant()) {
			const { sizeX, sizeZ } = horizontalExtent(geometry);
			expect(Math.max(sizeX, sizeZ)).toBeLessThanOrEqual(
				MAX_FOOTPRINT_M[model],
			);
			if (HOUSES.includes(model) && model !== "coastApartment") {
				expect(Math.min(sizeX, sizeZ)).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it("stays within the triangle budget of each model", () => {
		for (const { model, geometry } of everyVariant()) {
			expect(geometry.indices.length / 3).toBeLessThanOrEqual(
				MAX_TRIANGLES[model],
			);
		}
	});

	it("is deterministic for the same model and variant", () => {
		for (const model of OBJECT_MODELS) {
			expect(buildModel(model, 0)).toEqual(buildModel(model, 0));
		}
	});

	it("rejects a variant index outside 0..count-1 or not an integer", () => {
		expect(() => buildModel("church", -1)).toThrow(RangeError);
		expect(() => buildModel("church", MODEL_VARIANT_COUNT.church)).toThrow(
			RangeError,
		);
		expect(() => buildModel("adobeTile", 0.5)).toThrow(RangeError);
	});
});
