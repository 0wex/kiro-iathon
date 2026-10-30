/** Flat sRGB colours (0..1) shared by every object model; tuned for desert and Andean light. */
export const OBJECT_PALETTE = {
	brickOrange: [0.722, 0.392, 0.231],
	plasterYellow: [0.886, 0.784, 0.478],
	plasterBlue: [0.494, 0.659, 0.773],
	plasterPink: [0.847, 0.584, 0.573],
	plasterWhite: [0.925, 0.91, 0.871],
	adobeOchre: [0.678, 0.522, 0.369],
	roofTileRed: [0.659, 0.278, 0.192],
	tinGrey: [0.627, 0.651, 0.659],
	tinRust: [0.553, 0.333, 0.22],
	concreteGrey: [0.565, 0.561, 0.545],
	shadowBlack: [0.137, 0.141, 0.149],
	woodBrown: [0.42, 0.29, 0.184],
	mattingTan: [0.788, 0.682, 0.494],
	strawYellow: [0.796, 0.718, 0.427],
	foliageGreen: [0.302, 0.459, 0.231],
	foliageOlive: [0.451, 0.494, 0.29],
	foliageBlueGreen: [0.369, 0.525, 0.506],
	barkReddish: [0.553, 0.29, 0.204],
	barkPale: [0.788, 0.761, 0.706],
	cactusGreen: [0.353, 0.506, 0.329],
} satisfies Record<string, [number, number, number]>;

export type PaletteColorName = keyof typeof OBJECT_PALETTE;

/** Buildings sink this far below the ground origin so they never float on slopes. */
export const BUILDING_PLINTH_BOTTOM_M = -2;
/** Trunks and plant bases sink this far below the ground origin. */
export const PLANT_BASE_BOTTOM_M = -0.5;
/** Openings sit just proud of their wall so they never z-fight with it. */
export const OPENING_OFFSET_M = 0.03;

export const OPENING = {
	DOOR_WIDTH_M: 1,
	DOOR_HEIGHT_M: 2.1,
	WINDOW_WIDTH_M: 1.2,
	WINDOW_HEIGHT_M: 1.1,
	WINDOW_SILL_M: 0.9,
	WINDOW_SPACING_M: 3,
};

export const ROOF = {
	SLAB_THICKNESS_M: 0.2,
	SLAB_OVERHANG_M: 0.2,
	EAVE_OVERHANG_M: 0.5,
	TILE_RIDGE_HEIGHT_M: 1.6,
	TIN_RIDGE_HEIGHT_M: 0.9,
};

export interface HouseVariant {
	lengthM: number;
	depthM: number;
	floors: number;
	floorHeightM: number;
	wallColor: PaletteColorName;
	roofColor: PaletteColorName;
}

export const COAST_FLAT_ROOF_VARIANTS: HouseVariant[] = [
	{
		lengthM: 9,
		depthM: 8,
		floors: 1,
		floorHeightM: 3,
		wallColor: "plasterYellow",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 10,
		depthM: 7,
		floors: 1,
		floorHeightM: 3,
		wallColor: "plasterBlue",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 8,
		depthM: 9,
		floors: 1,
		floorHeightM: 3,
		wallColor: "plasterPink",
		roofColor: "concreteGrey",
	},
];

export const COAST_UNFINISHED_VARIANTS: HouseVariant[] = [
	{
		lengthM: 9,
		depthM: 8,
		floors: 2,
		floorHeightM: 2.7,
		wallColor: "plasterYellow",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 10,
		depthM: 8,
		floors: 3,
		floorHeightM: 2.7,
		wallColor: "plasterWhite",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 8,
		depthM: 9,
		floors: 3,
		floorHeightM: 2.7,
		wallColor: "plasterPink",
		roofColor: "concreteGrey",
	},
];

export const UNFINISHED = {
	REBAR_HEIGHT_M: 1,
	REBAR_THICKNESS_M: 0.08,
	REBAR_INSET_M: 0.3,
	TANK_RADIUS_M: 0.6,
	TANK_HEIGHT_M: 1.1,
	TANK_SEGMENTS: 8,
};

export const COAST_APARTMENT_VARIANTS: HouseVariant[] = [
	{
		lengthM: 12,
		depthM: 10,
		floors: 4,
		floorHeightM: 2.7,
		wallColor: "plasterWhite",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 13,
		depthM: 11,
		floors: 5,
		floorHeightM: 2.7,
		wallColor: "plasterYellow",
		roofColor: "concreteGrey",
	},
	{
		lengthM: 12,
		depthM: 12,
		floors: 6,
		floorHeightM: 2.7,
		wallColor: "plasterBlue",
		roofColor: "concreteGrey",
	},
];

export const APARTMENT_STAIR_HOUSING = {
	LENGTH_M: 3,
	DEPTH_M: 3,
	HEIGHT_M: 2.4,
};

export const COAST_MATTING_VARIANTS: HouseVariant[] = [
	{
		lengthM: 6,
		depthM: 5,
		floors: 1,
		floorHeightM: 2.2,
		wallColor: "mattingTan",
		roofColor: "tinGrey",
	},
	{
		lengthM: 7,
		depthM: 5,
		floors: 1,
		floorHeightM: 2.2,
		wallColor: "mattingTan",
		roofColor: "woodBrown",
	},
];

export const MATTING = {
	POST_THICKNESS_M: 0.12,
	ROOF_THICKNESS_M: 0.05,
	ROOF_OVERHANG_M: 0.3,
};

export const ADOBE_TILE_VARIANTS: HouseVariant[] = [
	{
		lengthM: 9,
		depthM: 7,
		floors: 1,
		floorHeightM: 2.6,
		wallColor: "adobeOchre",
		roofColor: "roofTileRed",
	},
	{
		lengthM: 10,
		depthM: 6,
		floors: 1,
		floorHeightM: 2.6,
		wallColor: "plasterWhite",
		roofColor: "roofTileRed",
	},
	{
		lengthM: 8,
		depthM: 7,
		floors: 2,
		floorHeightM: 2.5,
		wallColor: "adobeOchre",
		roofColor: "roofTileRed",
	},
];

export const ADOBE_TIN_VARIANTS: HouseVariant[] = [
	{
		lengthM: 9,
		depthM: 7,
		floors: 1,
		floorHeightM: 2.5,
		wallColor: "adobeOchre",
		roofColor: "tinGrey",
	},
	{
		lengthM: 8,
		depthM: 6,
		floors: 1,
		floorHeightM: 2.5,
		wallColor: "adobeOchre",
		roofColor: "tinRust",
	},
];

export const BRICK_TIN_VARIANTS: HouseVariant[] = [
	{
		lengthM: 9,
		depthM: 8,
		floors: 2,
		floorHeightM: 2.6,
		wallColor: "brickOrange",
		roofColor: "tinGrey",
	},
	{
		lengthM: 10,
		depthM: 8,
		floors: 3,
		floorHeightM: 2.6,
		wallColor: "brickOrange",
		roofColor: "tinRust",
	},
];

export const CHURCH = {
	NAVE_LENGTH_M: 22,
	NAVE_DEPTH_M: 9,
	NAVE_WALL_HEIGHT_M: 7,
	NAVE_RIDGE_HEIGHT_M: 3,
	TOWER_SIDE_M: 4,
	TOWER_HEIGHT_M: 13,
	TOWER_CAP_HEIGHT_M: 2.5,
	BELFRY_OPENING_HEIGHT_M: 1.8,
	DOOR_WIDTH_M: 2,
	DOOR_HEIGHT_M: 3.5,
	SIDE_WINDOWS: 3,
	SIDE_WINDOW_SPACING_M: 5,
	SIDE_WINDOW_SILL_M: 3.5,
	SIDE_WINDOW_HEIGHT_M: 1.6,
};

export const PLAZA = {
	SIDE_M: 40,
	PAVING_TOP_M: 0.15,
	FOUNTAIN_BASIN_RADIUS_M: 2.5,
	FOUNTAIN_BASIN_HEIGHT_M: 0.6,
	FOUNTAIN_WATER_RADIUS_M: 2.2,
	FOUNTAIN_PILLAR_RADIUS_M: 0.3,
	FOUNTAIN_PILLAR_HEIGHT_M: 1.8,
	FOUNTAIN_BOWL_RADIUS_M: 0.9,
	EDGE_INSET_M: 3,
	TREES_PER_SIDE: 2,
	TREE_TRUNK_HEIGHT_M: 1.8,
	TREE_TRUNK_RADIUS_M: 0.15,
	TREE_CANOPY_HEIGHT_M: 2.4,
	TREE_CANOPY_RADIUS_M: 1.4,
	BENCH_LENGTH_M: 1.8,
	BENCH_DEPTH_M: 0.5,
	BENCH_HEIGHT_M: 0.45,
};

export interface PlantVariant {
	heightM: number;
	radiusM: number;
	foliageColor: PaletteColorName;
}

export const ICHU_VARIANTS: PlantVariant[] = [
	{ heightM: 0.6, radiusM: 0.3, foliageColor: "strawYellow" },
	{ heightM: 0.7, radiusM: 0.4, foliageColor: "strawYellow" },
];
export const ICHU = { BLADE_BUNDLES: 5, BASE_RADIUS_RATIO: 0.4 };

export const TOLA_VARIANTS: PlantVariant[] = [
	{ heightM: 0.9, radiusM: 0.7, foliageColor: "foliageOlive" },
	{ heightM: 1.1, radiusM: 0.9, foliageColor: "foliageGreen" },
];

export const QUEUNA_VARIANTS: PlantVariant[] = [
	{ heightM: 3.5, radiusM: 1.6, foliageColor: "foliageGreen" },
	{ heightM: 5, radiusM: 2.2, foliageColor: "foliageGreen" },
	{ heightM: 6, radiusM: 2.6, foliageColor: "foliageOlive" },
];
/** The twisted trunk bends at these fractions of the tree height; its first point is the sunk base. */
export const QUEUNA = {
	TRUNK_HEIGHT_RATIOS: [0, 0.25, 0.45, 0.6],
	TRUNK_RADIUS_M: 0.25,
	TRUNK_SWAY_M: 0.4,
	TRUNK_TAPER_RATIO: 0.2,
	SIDE_CANOPY_RATIO: 0.6,
};

export const EUCALYPTUS_VARIANTS: PlantVariant[] = [
	{ heightM: 16, radiusM: 2.2, foliageColor: "foliageBlueGreen" },
	{ heightM: 20, radiusM: 2.6, foliageColor: "foliageBlueGreen" },
	{ heightM: 24, radiusM: 3, foliageColor: "foliageBlueGreen" },
];
/** Heights as fractions of the tree height; the narrow canopy hides the trunk tip. */
export const EUCALYPTUS = {
	TRUNK_RADIUS_M: 0.35,
	TRUNK_TOP_RATIO: 0.85,
	TRUNK_TIP_RATIO: 0.3,
	CANOPY_START_RATIO: 0.4,
};

export interface CactusVariant extends PlantVariant {
	arms: number;
}

export const CACTUS_VARIANTS: CactusVariant[] = [
	{ heightM: 2.2, radiusM: 0.22, foliageColor: "cactusGreen", arms: 1 },
	{ heightM: 3, radiusM: 0.25, foliageColor: "cactusGreen", arms: 2 },
	{ heightM: 4, radiusM: 0.3, foliageColor: "cactusGreen", arms: 3 },
];
export const CACTUS_ARM_REACH_M = 0.7;
/** Arms branch between these fractions of the column height and rise this fraction above. */
export const CACTUS_ARM = {
	FIRST_BRANCH_RATIO: 0.35,
	BRANCH_STEP_RATIO: 0.1,
	RISE_RATIO: 0.35,
	TIP_RATIO: 0.8,
};

export const THORN_SHRUB_VARIANTS: PlantVariant[] = [
	{ heightM: 1.6, radiusM: 1.1, foliageColor: "foliageOlive" },
	{ heightM: 2.4, radiusM: 1.5, foliageColor: "foliageOlive" },
];
export const THORN_SHRUB = {
	BRANCHES: 4,
	BRANCH_RADIUS_M: 0.08,
	BRANCH_REACH_RATIO: 0.6,
	BRANCH_TOP_RATIO: 0.8,
	CANOPY_HEIGHT_RATIO: 0.35,
	CANOPY_RADIUS_RATIO: 0.6,
};

export const SEGMENTS = {
	PYRAMID: 4,
	PLAZA_TREE_TRUNK: 4,
	TRUNK: 5,
	CANOPY: 6,
	COLUMN: 6,
	BLADE: 4,
	FOUNTAIN: 8,
	PLAZA_TREE_CANOPY: 5,
};
/** Low-poly blob canopy: two rings between a bottom and a top point, as fractions of its height/radius. */
export const CANOPY_SHAPE = {
	LOWER_RING_HEIGHT_RATIO: 0.35,
	UPPER_RING_HEIGHT_RATIO: 0.75,
	UPPER_RING_RADIUS_RATIO: 0.7,
};
/** Triangles whose doubled area is below this (m²) are dropped, e.g. the collapsed tip of a cone. */
export const DEGENERATE_TRIANGLE_AREA_M2 = 1e-9;
/** Canopy vertices move up to this fraction of the radius so blobs look hand-made. */
export const CANOPY_JITTER_RATIO = 0.15;
