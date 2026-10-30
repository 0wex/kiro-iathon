import { m } from "@/paraglide/messages";

export interface VisualizationRiskLevel {
	key: "low" | "moderate" | "high" | "critical";
	label: () => string;
	recommendation: () => string;
}

interface VisualizationRouteSegment {
	id: string;
	risk: VisualizationRiskLevel["key"];
	coordinates: [number, number][];
}

export interface VisualizationHazard {
	id: string;
	label: () => string;
	place: string;
	longitude: number;
	latitude: number;
	risk: VisualizationRiskLevel;
	source: string;
	horizonHours: number;
}

export const VIZ_RISK_LEVELS: VisualizationRiskLevel[] = [
	{ key: "low", label: m.risk_low, recommendation: m.recommendation_continue },
	{
		key: "moderate",
		label: m.risk_moderate,
		recommendation: m.recommendation_monitor,
	},
	{ key: "high", label: m.risk_high, recommendation: m.recommendation_delay },
	{
		key: "critical",
		label: m.risk_critical,
		recommendation: m.recommendation_reroute,
	},
];

export const VIZ_MAP_HEIGHT_PX = 420;
export const VIZ_MAP_PADDING_PX = 48;
export const VIZ_MAP_MIN_ZOOM = 5;
export const VIZ_MAP_MAX_ZOOM = 14;
export const VIZ_ROUTE_WIDTH_PX = 4;
export const VIZ_ROUTE_OPACITY = 1;
export const VIZ_MAP_BOUNDS: [[number, number], [number, number]] = [
	[-77.05, -12.1],
	[-75.19, -11.48],
];

export const VIZ_ROUTE_SEGMENTS: VisualizationRouteSegment[] = [
	{
		id: "lima-chosica",
		risk: "low",
		coordinates: [
			[-77.0365, -12.0464],
			[-76.973, -12.056],
			[-76.919, -12.046],
			[-76.876, -12.008],
			[-76.814, -11.981],
			[-76.756, -11.962],
			[-76.694, -11.936],
		],
	},
	{
		id: "chosica-san-mateo",
		risk: "high",
		coordinates: [
			[-76.694, -11.936],
			[-76.642, -11.914],
			[-76.578, -11.906],
			[-76.528, -11.876],
			[-76.458, -11.847],
			[-76.402, -11.833],
			[-76.364, -11.798],
			[-76.3, -11.76],
		],
	},
	{
		id: "san-mateo-ticlio",
		risk: "critical",
		coordinates: [
			[-76.3, -11.76],
			[-76.264, -11.725],
			[-76.234, -11.693],
			[-76.252, -11.665],
			[-76.222, -11.624],
			[-76.193, -11.598],
		],
	},
	{
		id: "ticlio-la-oroya",
		risk: "moderate",
		coordinates: [
			[-76.193, -11.598],
			[-76.151, -11.596],
			[-76.103, -11.577],
			[-76.05, -11.563],
			[-76.01, -11.544],
			[-75.941, -11.521],
			[-75.9, -11.522],
		],
	},
	{
		id: "la-oroya-jauja",
		risk: "low",
		coordinates: [
			[-75.9, -11.522],
			[-75.879, -11.573],
			[-75.826, -11.653],
			[-75.745, -11.718],
			[-75.686, -11.765],
			[-75.613, -11.804],
			[-75.532, -11.775],
			[-75.496, -11.775],
		],
	},
	{
		id: "jauja-huancayo",
		risk: "moderate",
		coordinates: [
			[-75.496, -11.775],
			[-75.435, -11.852],
			[-75.392, -11.91],
			[-75.338, -11.946],
			[-75.281, -12.015],
			[-75.21, -12.067],
		],
	},
];

export const VIZ_HAZARDS: VisualizationHazard[] = [
	{
		id: "H1",
		label: m.ds_viz_hazard_huaico,
		place: "Chosica",
		longitude: -76.694,
		latitude: -11.936,
		risk: VIZ_RISK_LEVELS[2],
		source: "SENAMHI",
		horizonHours: 6,
	},
	{
		id: "H2",
		label: m.ds_viz_hazard_landslide,
		place: "San Mateo",
		longitude: -76.3,
		latitude: -11.76,
		risk: VIZ_RISK_LEVELS[2],
		source: "INGEMMET",
		horizonHours: 12,
	},
	{
		id: "H3",
		label: m.ds_viz_hazard_closure,
		place: "Ticlio",
		longitude: -76.193,
		latitude: -11.598,
		risk: VIZ_RISK_LEVELS[3],
		source: "SUTRAN",
		horizonHours: 0,
	},
	{
		id: "H4",
		label: m.ds_viz_hazard_rain,
		place: "Jauja",
		longitude: -75.496,
		latitude: -11.775,
		risk: VIZ_RISK_LEVELS[1],
		source: "SENAMHI",
		horizonHours: 24,
	},
];

export const VIZ_RISK_SERIES = [
	{ hours: 0, low: 8, moderate: 5, high: 3, critical: 1 },
	{ hours: 6, low: 7, moderate: 7, high: 4, critical: 2 },
	{ hours: 12, low: 6, moderate: 8, high: 6, critical: 3 },
	{ hours: 24, low: 7, moderate: 6, high: 5, critical: 2 },
	{ hours: 48, low: 9, moderate: 5, high: 2, critical: 1 },
];

export const VIZ_STATIONS = [
	{
		key: "matucana",
		label: "Matucana",
		color: "var(--chart-1)",
		dashArray: undefined,
	},
	{
		key: "laOroya",
		label: "La Oroya",
		color: "var(--chart-2)",
		dashArray: "6 3",
	},
	{ key: "jauja", label: "Jauja", color: "var(--chart-3)", dashArray: "2 3" },
];

export const VIZ_PRECIPITATION_SERIES = [
	{ hours: 0, matucana: 0, laOroya: 0, jauja: 0 },
	{ hours: 6, matucana: 6, laOroya: 3, jauja: 2 },
	{ hours: 12, matucana: 17, laOroya: 9, jauja: 6 },
	{ hours: 24, matucana: 32, laOroya: 21, jauja: 14 },
	{ hours: 48, matucana: 44, laOroya: 29, jauja: 22 },
];

export const VIZ_CHART_HEIGHT_PX = 288;
export const VIZ_CHART_AXIS_WIDTH_PX = 36;
export const VIZ_CHART_TICK_MARGIN_PX = 8;
export const VIZ_CHART_LINE_WIDTH_PX = 2;
export const VIZ_CHART_DOT_RADIUS_PX = 3;
export const VIZ_CHART_MARGIN_PX = { top: 16, right: 16, bottom: 8, left: 0 };
