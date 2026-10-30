import type { Incident } from "@hack-the-andes-project/ui/lib/incident";

export interface HeroHazard {
	category: Incident["category"];
	severity: Incident["severity"];
	name: string;
	place: string;
	longitude: number;
	latitude: number;
}

export const HERO_HAZARDS: HeroHazard[] = [
	{
		category: "rain_warning",
		severity: "critical",
		name: "Lluvias intensas, nivel rojo",
		place: "Piura y Tumbes",
		longitude: -80.63,
		latitude: -5.19,
	},
	{
		category: "flood_warning",
		severity: "critical",
		name: "Río Chira sobre umbral",
		place: "Sullana",
		longitude: -80.69,
		latitude: -4.9,
	},
	{
		category: "landslide",
		severity: "critical",
		name: "Huaico, Carretera Central restringida",
		place: "Chosica, km 38",
		longitude: -76.7,
		latitude: -11.93,
	},
	{
		category: "weather",
		severity: "warning",
		name: "Aviso de heladas",
		place: "Puno y Cusco alto",
		longitude: -70.02,
		latitude: -15.84,
	},
	{
		category: "wildfire",
		severity: "warning",
		name: "Focos de incendio",
		place: "Madre de Dios",
		longitude: -69.19,
		latitude: -12.6,
	},
	{
		category: "weather",
		severity: "warning",
		name: "Oleaje anómalo, puerto cerrado",
		place: "Matarani",
		longitude: -72.1,
		latitude: -17.0,
	},
	{
		category: "road_block",
		severity: "warning",
		name: "Bloqueo de vía",
		place: "Panamericana Sur, km 290",
		longitude: -75.73,
		latitude: -14.07,
	},
	{
		category: "road_block",
		severity: "info",
		name: "Paro regional anunciado",
		place: "Juliaca",
		longitude: -70.13,
		latitude: -15.5,
	},
];

export const PANAMERICANA_NORTE_LIMA_PIURA: [number, number][] = [
	[-77.03, -12.05],
	[-77.61, -11.11],
	[-77.76, -10.75],
	[-78.3, -9.47],
	[-78.59, -9.07],
	[-79.03, -8.11],
	[-79.57, -7.4],
	[-79.84, -6.77],
	[-80.63, -5.19],
];

export interface FeedEntry {
	severity: Incident["severity"];
	time: string;
	corridor: string;
	message: string;
}

export const HERO_FEED: FeedEntry[] = [
	{
		severity: "critical",
		time: "06:40",
		corridor: "Lima – Piura",
		message:
			"Lluvias nivel rojo en Piura hasta el jueves. 3 despachos programados pasan por la zona.",
	},
	{
		severity: "critical",
		time: "06:12",
		corridor: "Lima – La Oroya",
		message:
			"Huaico en Chosica. Carretera Central a un carril, demora estimada 4 h.",
	},
	{
		severity: "warning",
		time: "05:55",
		corridor: "Arequipa – Matarani",
		message: "Puerto cerrado por oleaje. Reapertura prevista mañana 10:00.",
	},
	{
		severity: "warning",
		time: "Ayer",
		corridor: "Ica – Nasca",
		message: "Bloqueo anunciado en km 290 desde el lunes 08:00.",
	},
];
