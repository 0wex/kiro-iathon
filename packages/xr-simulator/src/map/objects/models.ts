import {
	ADOBE_TILE_VARIANTS,
	ADOBE_TIN_VARIANTS,
	APARTMENT_STAIR_HOUSING,
	BRICK_TIN_VARIANTS,
	BUILDING_PLINTH_BOTTOM_M,
	CACTUS_ARM,
	CACTUS_ARM_REACH_M,
	CACTUS_VARIANTS,
	CANOPY_JITTER_RATIO,
	CANOPY_SHAPE,
	type CactusVariant,
	CHURCH,
	COAST_APARTMENT_VARIANTS,
	COAST_FLAT_ROOF_VARIANTS,
	COAST_MATTING_VARIANTS,
	COAST_UNFINISHED_VARIANTS,
	DEGENERATE_TRIANGLE_AREA_M2,
	EUCALYPTUS,
	EUCALYPTUS_VARIANTS,
	type HouseVariant,
	ICHU,
	ICHU_VARIANTS,
	MATTING,
	OBJECT_PALETTE,
	OPENING,
	OPENING_OFFSET_M,
	type PaletteColorName,
	PLANT_BASE_BOTTOM_M,
	PLAZA,
	type PlantVariant,
	QUEUNA,
	QUEUNA_VARIANTS,
	ROOF,
	SEGMENTS,
	THORN_SHRUB,
	THORN_SHRUB_VARIANTS,
	TOLA_VARIANTS,
	UNFINISHED,
} from "./modelConstants";
import {
	createRandom,
	type HouseType,
	hashText,
	type VegetationModel,
} from "./placement";

export type ObjectModel = HouseType | VegetationModel | "church" | "plaza";

/** Flat-shaded geometry in metres: origin at the footprint centre on the ground, +y up, length along +x. */
export interface ModelGeometry {
	positions: Float32Array;
	normals: Float32Array;
	colors: Float32Array;
	indices: Uint32Array;
}

export const OBJECT_MODELS: ObjectModel[] = [
	"coastFlatRoof",
	"coastUnfinished",
	"coastApartment",
	"coastMatting",
	"adobeTile",
	"adobeTin",
	"brickTin",
	"church",
	"plaza",
	"ichu",
	"tola",
	"queuna",
	"eucalyptus",
	"cactus",
	"thornShrub",
];

export const MODEL_VARIANT_COUNT: Record<ObjectModel, number> = {
	coastFlatRoof: COAST_FLAT_ROOF_VARIANTS.length,
	coastUnfinished: COAST_UNFINISHED_VARIANTS.length,
	coastApartment: COAST_APARTMENT_VARIANTS.length,
	coastMatting: COAST_MATTING_VARIANTS.length,
	adobeTile: ADOBE_TILE_VARIANTS.length,
	adobeTin: ADOBE_TIN_VARIANTS.length,
	brickTin: BRICK_TIN_VARIANTS.length,
	church: 1,
	plaza: 1,
	ichu: ICHU_VARIANTS.length,
	tola: TOLA_VARIANTS.length,
	queuna: QUEUNA_VARIANTS.length,
	eucalyptus: EUCALYPTUS_VARIANTS.length,
	cactus: CACTUS_VARIANTS.length,
	thornShrub: THORN_SHRUB_VARIANTS.length,
};

interface Point {
	x: number;
	y: number;
	z: number;
}

type FaceAxis = "x" | "z";

interface WallOpening {
	axis: FaceAxis;
	faceOffsetM: number;
	alongCenterM: number;
	bottomM: number;
	widthM: number;
	heightM: number;
	color: PaletteColorName;
}

const FULL_TURN_RAD = Math.PI * 2;

function subtract(from: Point, to: Point): Point {
	return { x: from.x - to.x, y: from.y - to.y, z: from.z - to.z };
}

function average(points: Point[]): Point {
	const sum = points.reduce((total, point) => ({
		x: total.x + point.x,
		y: total.y + point.y,
		z: total.z + point.z,
	}));
	return {
		x: sum.x / points.length,
		y: sum.y / points.length,
		z: sum.z / points.length,
	};
}

class GeometryBuilder {
	private readonly positions: number[] = [];
	private readonly normals: number[] = [];
	private readonly colors: number[] = [];

	/**
	 * Emits one flat triangle facing away from `interior`. Babylon's StandardMaterial (default
	 * sideOrientation) shows the side (v1 - v0) × (v2 - v0) points away from, so the vertices
	 * are stored in the order whose cross product points inwards.
	 */
	triangle(
		first: Point,
		second: Point,
		third: Point,
		color: PaletteColorName,
		interior: Point,
	): void {
		const edgeA = subtract(second, first);
		const edgeB = subtract(third, first);
		const normal = {
			x: edgeA.y * edgeB.z - edgeA.z * edgeB.y,
			y: edgeA.z * edgeB.x - edgeA.x * edgeB.z,
			z: edgeA.x * edgeB.y - edgeA.y * edgeB.x,
		};
		const doubledArea = Math.hypot(normal.x, normal.y, normal.z);
		if (doubledArea < DEGENERATE_TRIANGLE_AREA_M2) return;
		const away = subtract(average([first, second, third]), interior);
		const facesOut =
			normal.x * away.x + normal.y * away.y + normal.z * away.z >= 0;
		const orientedLength = facesOut ? doubledArea : -doubledArea;
		const [red, green, blue] = OBJECT_PALETTE[color];
		for (const vertex of facesOut
			? [first, third, second]
			: [first, second, third]) {
			this.positions.push(vertex.x, vertex.y, vertex.z);
			this.normals.push(
				normal.x / orientedLength,
				normal.y / orientedLength,
				normal.z / orientedLength,
			);
			this.colors.push(red, green, blue, 1);
		}
	}

	build(): ModelGeometry {
		const vertexCount = this.positions.length / 3;
		return {
			positions: new Float32Array(this.positions),
			normals: new Float32Array(this.normals),
			colors: new Float32Array(this.colors),
			indices: Uint32Array.from({ length: vertexCount }, (_, index) => index),
		};
	}
}

function ring(
	center: Point,
	radius: number,
	segments: number,
	phaseRad = 0,
): Point[] {
	return Array.from({ length: segments }, (_, index) => {
		const angle = phaseRad + (index / segments) * FULL_TURN_RAD;
		return {
			x: center.x + Math.cos(angle) * radius,
			y: center.y,
			z: center.z + Math.sin(angle) * radius,
		};
	});
}

function rectangle(center: Point, sizeX: number, sizeZ: number): Point[] {
	const halfX = sizeX / 2;
	const halfZ = sizeZ / 2;
	return [
		{ x: center.x - halfX, y: center.y, z: center.z - halfZ },
		{ x: center.x + halfX, y: center.y, z: center.z - halfZ },
		{ x: center.x + halfX, y: center.y, z: center.z + halfZ },
		{ x: center.x - halfX, y: center.y, z: center.z + halfZ },
	];
}

/** Joins two rings of equal length into a convex band; caps both ends when a cap colour is given. */
function loft(
	builder: GeometryBuilder,
	firstRing: Point[],
	secondRing: Point[],
	sideColor: PaletteColorName,
	capColor?: PaletteColorName,
): void {
	const interior = average([...firstRing, ...secondRing]);
	for (let index = 0; index < firstRing.length; index++) {
		const next = (index + 1) % firstRing.length;
		builder.triangle(
			firstRing[index],
			firstRing[next],
			secondRing[next],
			sideColor,
			interior,
		);
		builder.triangle(
			firstRing[index],
			secondRing[next],
			secondRing[index],
			sideColor,
			interior,
		);
	}
	if (!capColor) return;
	for (const cap of [firstRing, secondRing]) {
		for (let index = 1; index < cap.length - 1; index++) {
			builder.triangle(cap[0], cap[index], cap[index + 1], capColor, interior);
		}
	}
}

function box(
	builder: GeometryBuilder,
	base: Point,
	sizeX: number,
	sizeZ: number,
	topY: number,
	color: PaletteColorName,
): void {
	loft(
		builder,
		rectangle(base, sizeX, sizeZ),
		rectangle({ ...base, y: topY }, sizeX, sizeZ),
		color,
		color,
	);
}

/** Tapered (or tilted) column between two centres; a zero top radius makes a cone. */
function column(
	builder: GeometryBuilder,
	base: Point,
	top: Point,
	bottomRadius: number,
	topRadius: number,
	segments: number,
	sideColor: PaletteColorName,
	capColor: PaletteColorName = sideColor,
	phaseRad = 0,
): void {
	loft(
		builder,
		ring(base, bottomRadius, segments, phaseRad),
		ring(top, topRadius, segments, phaseRad),
		sideColor,
		capColor,
	);
}

function blob(
	builder: GeometryBuilder,
	base: Point,
	height: number,
	radius: number,
	color: PaletteColorName,
	random: () => number,
	segments: number = SEGMENTS.CANOPY,
): void {
	const jitter = (index: number, points: Point[]): Point => {
		const scale = 1 + (random() * 2 - 1) * CANOPY_JITTER_RATIO;
		const point = points[index];
		return {
			x: base.x + (point.x - base.x) * scale,
			y: point.y,
			z: base.z + (point.z - base.z) * scale,
		};
	};
	const lowerRing = ring(
		{ ...base, y: base.y + height * CANOPY_SHAPE.LOWER_RING_HEIGHT_RATIO },
		radius,
		segments,
	);
	const upperRing = ring(
		{ ...base, y: base.y + height * CANOPY_SHAPE.UPPER_RING_HEIGHT_RATIO },
		radius * CANOPY_SHAPE.UPPER_RING_RADIUS_RATIO,
		segments,
		Math.PI / segments,
	);
	const jitteredLower = lowerRing.map((_, index) => jitter(index, lowerRing));
	const jitteredUpper = upperRing.map((_, index) => jitter(index, upperRing));
	const bottomTip = Array.from({ length: segments }, () => base);
	const topTip = Array.from({ length: segments }, () => ({
		...base,
		y: base.y + height,
	}));
	loft(builder, bottomTip, jitteredLower, color);
	loft(builder, jitteredLower, jitteredUpper, color);
	loft(builder, jitteredUpper, topTip, color);
}

/** Triangular prism along x whose two gable ends take the wall colour. */
function gableRoof(
	builder: GeometryBuilder,
	baseY: number,
	lengthM: number,
	widthM: number,
	ridgeHeightM: number,
	roofColor: PaletteColorName,
	gableColor: PaletteColorName,
	centerX = 0,
): void {
	const gable = (x: number): Point[] => [
		{ x, y: baseY, z: -widthM / 2 },
		{ x, y: baseY + ridgeHeightM, z: 0 },
		{ x, y: baseY, z: widthM / 2 },
	];
	loft(
		builder,
		gable(centerX - lengthM / 2),
		gable(centerX + lengthM / 2),
		roofColor,
		gableColor,
	);
}

/** Flat panel just proud of a wall whose outward normal is ±axis, chosen by the sign of faceOffsetM. */
function wallOpening(builder: GeometryBuilder, opening: WallOpening): void {
	const face =
		opening.faceOffsetM + Math.sign(opening.faceOffsetM) * OPENING_OFFSET_M;
	const place = (along: number, y: number): Point =>
		opening.axis === "z" ? { x: along, y, z: face } : { x: face, y, z: along };
	const left = opening.alongCenterM - opening.widthM / 2;
	const right = opening.alongCenterM + opening.widthM / 2;
	const top = opening.bottomM + opening.heightM;
	const corners = [
		place(left, opening.bottomM),
		place(right, opening.bottomM),
		place(right, top),
		place(left, top),
	];
	const interior = place(
		opening.alongCenterM,
		opening.bottomM + opening.heightM / 2,
	);
	const inward = -Math.sign(opening.faceOffsetM);
	if (opening.axis === "z") interior.z += inward;
	else interior.x += inward;
	builder.triangle(corners[0], corners[1], corners[2], opening.color, interior);
	builder.triangle(corners[0], corners[2], corners[3], opening.color, interior);
}

/** Front door plus a row of windows per floor on the front (+z) and back (-z) walls. */
function houseOpenings(builder: GeometryBuilder, house: HouseVariant): void {
	const halfDepth = house.depthM / 2;
	wallOpening(builder, {
		axis: "z",
		faceOffsetM: halfDepth,
		alongCenterM: 0,
		bottomM: 0,
		widthM: OPENING.DOOR_WIDTH_M,
		heightM: OPENING.DOOR_HEIGHT_M,
		color: "woodBrown",
	});
	const windowsPerFloor = Math.max(
		1,
		Math.floor(house.lengthM / OPENING.WINDOW_SPACING_M),
	);
	const doorClearance = (OPENING.DOOR_WIDTH_M + OPENING.WINDOW_WIDTH_M) / 2;
	for (let floor = 0; floor < house.floors; floor++) {
		for (let window = 0; window < windowsPerFloor; window++) {
			const alongCenterM =
				(window - (windowsPerFloor - 1) / 2) * OPENING.WINDOW_SPACING_M;
			for (const faceOffsetM of [halfDepth, -halfDepth]) {
				const blocksDoor =
					floor === 0 &&
					faceOffsetM > 0 &&
					Math.abs(alongCenterM) < doorClearance;
				if (blocksDoor) continue;
				wallOpening(builder, {
					axis: "z",
					faceOffsetM,
					alongCenterM,
					bottomM: floor * house.floorHeightM + OPENING.WINDOW_SILL_M,
					widthM: OPENING.WINDOW_WIDTH_M,
					heightM: OPENING.WINDOW_HEIGHT_M,
					color: "shadowBlack",
				});
			}
		}
	}
}

const GROUND_CENTER: Point = { x: 0, y: 0, z: 0 };
const PLINTH_CENTER: Point = { x: 0, y: BUILDING_PLINTH_BOTTOM_M, z: 0 };

/** Walls, a concrete slab and openings; returns the height of the slab top. */
function flatRoofHouse(
	builder: GeometryBuilder,
	house: HouseVariant,
	upperWallColor = house.wallColor,
): number {
	const wallTopM = house.floors * house.floorHeightM;
	box(
		builder,
		PLINTH_CENTER,
		house.lengthM,
		house.depthM,
		house.floorHeightM,
		house.wallColor,
	);
	if (house.floors > 1) {
		box(
			builder,
			{ x: 0, y: house.floorHeightM, z: 0 },
			house.lengthM,
			house.depthM,
			wallTopM,
			upperWallColor,
		);
	}
	const slabOverhang = 2 * ROOF.SLAB_OVERHANG_M;
	const roofTopM = wallTopM + ROOF.SLAB_THICKNESS_M;
	box(
		builder,
		{ x: 0, y: wallTopM, z: 0 },
		house.lengthM + slabOverhang,
		house.depthM + slabOverhang,
		roofTopM,
		house.roofColor,
	);
	houseOpenings(builder, house);
	return roofTopM;
}

function unfinishedHouse(builder: GeometryBuilder, house: HouseVariant): void {
	const roofTopM = flatRoofHouse(builder, house, "brickOrange");
	const rebarInsetX = house.lengthM / 2 - UNFINISHED.REBAR_INSET_M;
	const rebarInsetZ = house.depthM / 2 - UNFINISHED.REBAR_INSET_M;
	for (const [signX, signZ] of [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	]) {
		box(
			builder,
			{ x: signX * rebarInsetX, y: roofTopM, z: signZ * rebarInsetZ },
			UNFINISHED.REBAR_THICKNESS_M,
			UNFINISHED.REBAR_THICKNESS_M,
			roofTopM + UNFINISHED.REBAR_HEIGHT_M,
			"tinRust",
		);
	}
	const tankBase = { x: house.lengthM / 4, y: roofTopM, z: -house.depthM / 4 };
	column(
		builder,
		tankBase,
		{ ...tankBase, y: roofTopM + UNFINISHED.TANK_HEIGHT_M },
		UNFINISHED.TANK_RADIUS_M,
		UNFINISHED.TANK_RADIUS_M,
		UNFINISHED.TANK_SEGMENTS,
		"shadowBlack",
	);
}

function apartmentBlock(builder: GeometryBuilder, house: HouseVariant): void {
	const roofTopM = flatRoofHouse(builder, house);
	box(
		builder,
		{ x: -house.lengthM / 4, y: roofTopM, z: 0 },
		APARTMENT_STAIR_HOUSING.LENGTH_M,
		APARTMENT_STAIR_HOUSING.DEPTH_M,
		roofTopM + APARTMENT_STAIR_HOUSING.HEIGHT_M,
		house.wallColor,
	);
}

function mattingShack(builder: GeometryBuilder, house: HouseVariant): void {
	const wallTopM = house.floorHeightM;
	box(
		builder,
		PLINTH_CENTER,
		house.lengthM,
		house.depthM,
		wallTopM,
		house.wallColor,
	);
	for (const corner of rectangle(PLINTH_CENTER, house.lengthM, house.depthM)) {
		box(
			builder,
			corner,
			MATTING.POST_THICKNESS_M,
			MATTING.POST_THICKNESS_M,
			wallTopM,
			"woodBrown",
		);
	}
	const roofOverhang = 2 * MATTING.ROOF_OVERHANG_M;
	box(
		builder,
		{ x: 0, y: wallTopM, z: 0 },
		house.lengthM + roofOverhang,
		house.depthM + roofOverhang,
		wallTopM + MATTING.ROOF_THICKNESS_M,
		house.roofColor,
	);
	wallOpening(builder, {
		axis: "z",
		faceOffsetM: house.depthM / 2,
		alongCenterM: 0,
		bottomM: 0,
		widthM: OPENING.DOOR_WIDTH_M,
		heightM: OPENING.DOOR_HEIGHT_M - OPENING.WINDOW_SILL_M / 2,
		color: "shadowBlack",
	});
}

function gabledHouse(
	builder: GeometryBuilder,
	house: HouseVariant,
	ridgeHeightM: number,
): void {
	const wallTopM = house.floors * house.floorHeightM;
	box(
		builder,
		PLINTH_CENTER,
		house.lengthM,
		house.depthM,
		wallTopM,
		house.wallColor,
	);
	gableRoof(
		builder,
		wallTopM,
		house.lengthM + ROOF.EAVE_OVERHANG_M,
		house.depthM + 2 * ROOF.EAVE_OVERHANG_M,
		ridgeHeightM,
		house.roofColor,
		house.wallColor,
	);
	houseOpenings(builder, house);
}

function church(builder: GeometryBuilder): void {
	const naveCenterX = -CHURCH.TOWER_SIDE_M / 2;
	const facadeX = naveCenterX + CHURCH.NAVE_LENGTH_M / 2;
	const halfDepth = CHURCH.NAVE_DEPTH_M / 2;
	box(
		builder,
		{ ...PLINTH_CENTER, x: naveCenterX },
		CHURCH.NAVE_LENGTH_M,
		CHURCH.NAVE_DEPTH_M,
		CHURCH.NAVE_WALL_HEIGHT_M,
		"plasterWhite",
	);
	gableRoof(
		builder,
		CHURCH.NAVE_WALL_HEIGHT_M,
		CHURCH.NAVE_LENGTH_M + ROOF.EAVE_OVERHANG_M,
		CHURCH.NAVE_DEPTH_M + 2 * ROOF.EAVE_OVERHANG_M,
		CHURCH.NAVE_RIDGE_HEIGHT_M,
		"roofTileRed",
		"plasterWhite",
		naveCenterX,
	);
	const tower: Point = {
		x: facadeX + CHURCH.TOWER_SIDE_M / 2,
		y: BUILDING_PLINTH_BOTTOM_M,
		z: -halfDepth + CHURCH.TOWER_SIDE_M / 2,
	};
	box(
		builder,
		tower,
		CHURCH.TOWER_SIDE_M,
		CHURCH.TOWER_SIDE_M,
		CHURCH.TOWER_HEIGHT_M,
		"plasterWhite",
	);
	column(
		builder,
		{ ...tower, y: CHURCH.TOWER_HEIGHT_M },
		{ ...tower, y: CHURCH.TOWER_HEIGHT_M + CHURCH.TOWER_CAP_HEIGHT_M },
		CHURCH.TOWER_SIDE_M / Math.SQRT2,
		0,
		SEGMENTS.PYRAMID,
		"roofTileRed",
		"roofTileRed",
		Math.PI / 4,
	);
	const belfryBottomM =
		CHURCH.TOWER_HEIGHT_M -
		CHURCH.BELFRY_OPENING_HEIGHT_M -
		OPENING.WINDOW_SILL_M;
	const halfTower = CHURCH.TOWER_SIDE_M / 2;
	for (const [axis, faceOffsetM, alongCenterM] of [
		["x", tower.x + halfTower, tower.z],
		["x", tower.x - halfTower, tower.z],
		["z", tower.z + halfTower, tower.x],
		["z", tower.z - halfTower, tower.x],
	] satisfies [FaceAxis, number, number][]) {
		wallOpening(builder, {
			axis,
			faceOffsetM,
			alongCenterM,
			bottomM: belfryBottomM,
			widthM: OPENING.WINDOW_WIDTH_M,
			heightM: CHURCH.BELFRY_OPENING_HEIGHT_M,
			color: "shadowBlack",
		});
	}
	wallOpening(builder, {
		axis: "x",
		faceOffsetM: facadeX,
		alongCenterM: halfDepth / 2,
		bottomM: 0,
		widthM: CHURCH.DOOR_WIDTH_M,
		heightM: CHURCH.DOOR_HEIGHT_M,
		color: "woodBrown",
	});
	for (let window = 0; window < CHURCH.SIDE_WINDOWS; window++) {
		const alongCenterM =
			naveCenterX +
			(window - (CHURCH.SIDE_WINDOWS - 1) / 2) * CHURCH.SIDE_WINDOW_SPACING_M;
		for (const faceOffsetM of [halfDepth, -halfDepth]) {
			wallOpening(builder, {
				axis: "z",
				faceOffsetM,
				alongCenterM,
				bottomM: CHURCH.SIDE_WINDOW_SILL_M,
				widthM: OPENING.WINDOW_WIDTH_M,
				heightM: CHURCH.SIDE_WINDOW_HEIGHT_M,
				color: "shadowBlack",
			});
		}
	}
}

function plaza(builder: GeometryBuilder, random: () => number): void {
	box(
		builder,
		PLINTH_CENTER,
		PLAZA.SIDE_M,
		PLAZA.SIDE_M,
		PLAZA.PAVING_TOP_M,
		"concreteGrey",
	);
	const pavingTop: Point = { ...GROUND_CENTER, y: PLAZA.PAVING_TOP_M };
	const basinTopM = PLAZA.PAVING_TOP_M + PLAZA.FOUNTAIN_BASIN_HEIGHT_M;
	column(
		builder,
		pavingTop,
		{ ...pavingTop, y: basinTopM },
		PLAZA.FOUNTAIN_BASIN_RADIUS_M,
		PLAZA.FOUNTAIN_BASIN_RADIUS_M,
		SEGMENTS.FOUNTAIN,
		"plasterWhite",
		"plasterBlue",
	);
	const pillarTopM = basinTopM + PLAZA.FOUNTAIN_PILLAR_HEIGHT_M;
	column(
		builder,
		{ ...pavingTop, y: basinTopM },
		{ ...pavingTop, y: pillarTopM },
		PLAZA.FOUNTAIN_PILLAR_RADIUS_M,
		PLAZA.FOUNTAIN_BOWL_RADIUS_M,
		SEGMENTS.FOUNTAIN,
		"plasterWhite",
		"plasterBlue",
	);
	const edgeM = PLAZA.SIDE_M / 2 - PLAZA.EDGE_INSET_M;
	const quarterM = PLAZA.SIDE_M / 4;
	for (const [x, z] of [
		[quarterM, edgeM],
		[-quarterM, edgeM],
		[quarterM, -edgeM],
		[-quarterM, -edgeM],
		[edgeM, quarterM],
		[edgeM, -quarterM],
		[-edgeM, quarterM],
		[-edgeM, -quarterM],
	]) {
		const trunkBase: Point = { x, y: PLAZA.PAVING_TOP_M, z };
		const trunkTop: Point = {
			x,
			y: PLAZA.PAVING_TOP_M + PLAZA.TREE_TRUNK_HEIGHT_M,
			z,
		};
		column(
			builder,
			trunkBase,
			trunkTop,
			PLAZA.TREE_TRUNK_RADIUS_M,
			PLAZA.TREE_TRUNK_RADIUS_M,
			SEGMENTS.PLAZA_TREE_TRUNK,
			"woodBrown",
		);
		blob(
			builder,
			trunkTop,
			PLAZA.TREE_CANOPY_HEIGHT_M,
			PLAZA.TREE_CANOPY_RADIUS_M,
			"foliageGreen",
			random,
			SEGMENTS.PLAZA_TREE_CANOPY,
		);
	}
	for (const [x, z, alongX] of [
		[0, edgeM, true],
		[0, -edgeM, true],
		[edgeM, 0, false],
		[-edgeM, 0, false],
	] satisfies [number, number, boolean][]) {
		box(
			builder,
			{ x, y: PLAZA.PAVING_TOP_M, z },
			alongX ? PLAZA.BENCH_LENGTH_M : PLAZA.BENCH_DEPTH_M,
			alongX ? PLAZA.BENCH_DEPTH_M : PLAZA.BENCH_LENGTH_M,
			PLAZA.PAVING_TOP_M + PLAZA.BENCH_HEIGHT_M,
			"woodBrown",
		);
	}
}

const PLANT_BASE: Point = { x: 0, y: PLANT_BASE_BOTTOM_M, z: 0 };

function ichu(
	builder: GeometryBuilder,
	plant: PlantVariant,
	random: () => number,
): void {
	for (let bundle = 0; bundle < ICHU.BLADE_BUNDLES; bundle++) {
		const angle = ((bundle + random()) / ICHU.BLADE_BUNDLES) * FULL_TURN_RAD;
		const apex = {
			x: Math.cos(angle) * plant.radiusM,
			y: plant.heightM,
			z: Math.sin(angle) * plant.radiusM,
		};
		column(
			builder,
			PLANT_BASE,
			apex,
			plant.radiusM * ICHU.BASE_RADIUS_RATIO,
			0,
			SEGMENTS.BLADE,
			plant.foliageColor,
		);
	}
}

function tola(
	builder: GeometryBuilder,
	plant: PlantVariant,
	random: () => number,
): void {
	blob(
		builder,
		PLANT_BASE,
		plant.heightM - PLANT_BASE_BOTTOM_M,
		plant.radiusM,
		plant.foliageColor,
		random,
	);
}

function queuna(
	builder: GeometryBuilder,
	plant: PlantVariant,
	random: () => number,
): void {
	const trunkPath = QUEUNA.TRUNK_HEIGHT_RATIOS.map((ratio, index) => {
		const sway = index === 0 ? 0 : (random() * 2 - 1) * QUEUNA.TRUNK_SWAY_M;
		return {
			x: sway,
			y: index === 0 ? PLANT_BASE_BOTTOM_M : plant.heightM * ratio,
			z: sway / 2,
		};
	});
	for (let index = 0; index < trunkPath.length - 1; index++) {
		const taper = 1 - index * QUEUNA.TRUNK_TAPER_RATIO;
		column(
			builder,
			trunkPath[index],
			trunkPath[index + 1],
			QUEUNA.TRUNK_RADIUS_M * taper,
			QUEUNA.TRUNK_RADIUS_M * (taper - QUEUNA.TRUNK_TAPER_RATIO),
			SEGMENTS.TRUNK,
			"barkReddish",
		);
	}
	const crown = trunkPath[trunkPath.length - 1];
	const canopyHeight = plant.heightM - crown.y;
	blob(builder, crown, canopyHeight, plant.radiusM, plant.foliageColor, random);
	blob(
		builder,
		{
			x: crown.x - plant.radiusM / 2,
			y: crown.y - canopyHeight / 3,
			z: crown.z + plant.radiusM / 3,
		},
		canopyHeight * QUEUNA.SIDE_CANOPY_RATIO,
		plant.radiusM * QUEUNA.SIDE_CANOPY_RATIO,
		plant.foliageColor,
		random,
	);
}

function eucalyptus(
	builder: GeometryBuilder,
	plant: PlantVariant,
	random: () => number,
): void {
	column(
		builder,
		PLANT_BASE,
		{ x: 0, y: plant.heightM * EUCALYPTUS.TRUNK_TOP_RATIO, z: 0 },
		EUCALYPTUS.TRUNK_RADIUS_M,
		EUCALYPTUS.TRUNK_RADIUS_M * EUCALYPTUS.TRUNK_TIP_RATIO,
		SEGMENTS.TRUNK,
		"barkPale",
	);
	const canopyBottomM = plant.heightM * EUCALYPTUS.CANOPY_START_RATIO;
	blob(
		builder,
		{ x: 0, y: canopyBottomM, z: 0 },
		plant.heightM - canopyBottomM,
		plant.radiusM,
		plant.foliageColor,
		random,
	);
}

function cactus(builder: GeometryBuilder, plant: CactusVariant): void {
	column(
		builder,
		PLANT_BASE,
		{ x: 0, y: plant.heightM, z: 0 },
		plant.radiusM,
		plant.radiusM * CACTUS_ARM.TIP_RATIO,
		SEGMENTS.COLUMN,
		plant.foliageColor,
	);
	const armDirections = [
		{ x: 1, z: 0 },
		{ x: -1, z: 0 },
		{ x: 0, z: 1 },
	];
	const armRadius = plant.radiusM * CACTUS_ARM.TIP_RATIO;
	for (let arm = 0; arm < plant.arms; arm++) {
		const direction = armDirections[arm];
		const branchY =
			plant.heightM *
			(CACTUS_ARM.FIRST_BRANCH_RATIO + arm * CACTUS_ARM.BRANCH_STEP_RATIO);
		const elbowThickness = 2 * armRadius;
		box(
			builder,
			{
				x: (direction.x * CACTUS_ARM_REACH_M) / 2,
				y: branchY,
				z: (direction.z * CACTUS_ARM_REACH_M) / 2,
			},
			direction.x === 0 ? elbowThickness : CACTUS_ARM_REACH_M,
			direction.z === 0 ? elbowThickness : CACTUS_ARM_REACH_M,
			branchY + elbowThickness,
			plant.foliageColor,
		);
		const armBase = {
			x: direction.x * CACTUS_ARM_REACH_M,
			y: branchY,
			z: direction.z * CACTUS_ARM_REACH_M,
		};
		column(
			builder,
			armBase,
			{ ...armBase, y: branchY + plant.heightM * CACTUS_ARM.RISE_RATIO },
			armRadius,
			armRadius * CACTUS_ARM.TIP_RATIO,
			SEGMENTS.COLUMN,
			plant.foliageColor,
		);
	}
}

function thornShrub(
	builder: GeometryBuilder,
	plant: PlantVariant,
	random: () => number,
): void {
	for (let branch = 0; branch < THORN_SHRUB.BRANCHES; branch++) {
		const angle = ((branch + random()) / THORN_SHRUB.BRANCHES) * FULL_TURN_RAD;
		const reach = plant.radiusM * THORN_SHRUB.BRANCH_REACH_RATIO;
		const tip = {
			x: Math.cos(angle) * reach,
			y: plant.heightM * THORN_SHRUB.BRANCH_TOP_RATIO,
			z: Math.sin(angle) * reach,
		};
		column(
			builder,
			PLANT_BASE,
			tip,
			THORN_SHRUB.BRANCH_RADIUS_M,
			0,
			SEGMENTS.BLADE,
			"woodBrown",
		);
		if (branch % 2 === 0) {
			const canopyHeight = plant.heightM * THORN_SHRUB.CANOPY_HEIGHT_RATIO;
			blob(
				builder,
				{ ...tip, y: plant.heightM - canopyHeight },
				canopyHeight,
				plant.radiusM * THORN_SHRUB.CANOPY_RADIUS_RATIO,
				plant.foliageColor,
				random,
			);
		}
	}
}

const MODEL_BUILDERS: Record<
	ObjectModel,
	(builder: GeometryBuilder, variantIndex: number, random: () => number) => void
> = {
	coastFlatRoof: (builder, index) =>
		flatRoofHouse(builder, COAST_FLAT_ROOF_VARIANTS[index]),
	coastUnfinished: (builder, index) =>
		unfinishedHouse(builder, COAST_UNFINISHED_VARIANTS[index]),
	coastApartment: (builder, index) =>
		apartmentBlock(builder, COAST_APARTMENT_VARIANTS[index]),
	coastMatting: (builder, index) =>
		mattingShack(builder, COAST_MATTING_VARIANTS[index]),
	adobeTile: (builder, index) =>
		gabledHouse(builder, ADOBE_TILE_VARIANTS[index], ROOF.TILE_RIDGE_HEIGHT_M),
	adobeTin: (builder, index) =>
		gabledHouse(builder, ADOBE_TIN_VARIANTS[index], ROOF.TIN_RIDGE_HEIGHT_M),
	brickTin: (builder, index) =>
		gabledHouse(builder, BRICK_TIN_VARIANTS[index], ROOF.TIN_RIDGE_HEIGHT_M),
	church: (builder) => church(builder),
	plaza: (builder, _index, random) => plaza(builder, random),
	ichu: (builder, index, random) => ichu(builder, ICHU_VARIANTS[index], random),
	tola: (builder, index, random) => tola(builder, TOLA_VARIANTS[index], random),
	queuna: (builder, index, random) =>
		queuna(builder, QUEUNA_VARIANTS[index], random),
	eucalyptus: (builder, index, random) =>
		eucalyptus(builder, EUCALYPTUS_VARIANTS[index], random),
	cactus: (builder, index) => cactus(builder, CACTUS_VARIANTS[index]),
	thornShrub: (builder, index, random) =>
		thornShrub(builder, THORN_SHRUB_VARIANTS[index], random),
};

/** Deterministic: canopy jitter is seeded from the model id and variant. Throws on a variant outside 0..count-1. */
export function buildModel(
	model: ObjectModel,
	variantIndex: number,
): ModelGeometry {
	const variantCount = MODEL_VARIANT_COUNT[model];
	if (
		!Number.isInteger(variantIndex) ||
		variantIndex < 0 ||
		variantIndex >= variantCount
	) {
		throw new RangeError(
			`${model} has variants 0..${variantCount - 1}, got ${variantIndex}`,
		);
	}
	const builder = new GeometryBuilder();
	MODEL_BUILDERS[model](
		builder,
		variantIndex,
		createRandom(hashText(`${model}:${variantIndex}`)),
	);
	return builder.build();
}
