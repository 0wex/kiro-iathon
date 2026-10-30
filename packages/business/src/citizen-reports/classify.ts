import turfDistance from "@turf/distance";

import { REPORT_PRIORITIES, SAME_HAZARD_BUMP_RADIUS_M } from "./constants";
import type {
	CitizenReport,
	GeoPoint,
	HazardKind,
	ReportPriority,
} from "./schemas";

// Checked in order: the more specific hazards first, so "desborde del dren" is
// a drainage collapse and not a generic flood.
const HAZARD_KEYWORDS: [HazardKind, string[]][] = [
	[
		"erosion-defensa",
		["defensa riberena", "dique", "erosion", "bordo", "enrocado"],
	],
	["colapso-drenaje", ["dren", "alcantarill", "desague", "buzon", "colector"]],
	["huayco", ["huayco", "huaico", "lodo", "avalancha"]],
	["deslizamiento", ["desliz", "derrumbe", "talud", "rocas", "grieta"]],
	["inundacion", ["inund", "aniego", "anegad", "desborde", "agua"]],
];

const BASE_PRIORITY: Record<HazardKind, ReportPriority> = {
	huayco: "alta",
	"erosion-defensa": "alta",
	deslizamiento: "alta",
	inundacion: "media",
	"colapso-drenaje": "media",
	otro: "baja",
};

const PEOPLE_AT_RISK_KEYWORDS = [
	"atrapad",
	"herid",
	"desaparecid",
	"aislad",
	"colapso de vivienda",
	"se cayo la casa",
	"evacuar",
];

const PRIORITY_RANK: Record<ReportPriority, number> = {
	critica: 0,
	alta: 1,
	media: 2,
	baja: 3,
};

function normalize(text: string) {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

export function distanceInMeters(from: GeoPoint, to: GeoPoint) {
	return turfDistance([from.lon, from.lat], [to.lon, to.lat], {
		units: "meters",
	});
}

export function classifyByRules(
	report: { description: string; location: GeoPoint },
	existingReports: CitizenReport[],
): { hazardKind: HazardKind; priority: ReportPriority } {
	const text = normalize(report.description);
	const hazardKind =
		HAZARD_KEYWORDS.find(([, keywords]) =>
			keywords.some((keyword) => text.includes(keyword)),
		)?.[0] ?? "otro";
	if (PEOPLE_AT_RISK_KEYWORDS.some((keyword) => text.includes(keyword))) {
		return { hazardKind, priority: "critica" };
	}
	const basePriority = BASE_PRIORITY[hazardKind];
	const hasSameHazardNearby = existingReports.some(
		(existing) =>
			existing.hazardKind === hazardKind &&
			distanceInMeters(existing.location, report.location) <=
				SAME_HAZARD_BUMP_RADIUS_M,
	);
	if (!hasSameHazardNearby) return { hazardKind, priority: basePriority };
	const raisedRank = Math.max(0, PRIORITY_RANK[basePriority] - 1);
	return {
		hazardKind,
		priority: REPORT_PRIORITIES[raisedRank] ?? basePriority,
	};
}

export function compareReportsByPriority(
	first: CitizenReport,
	second: CitizenReport,
) {
	return (
		PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority] ||
		second.createdAt.getTime() - first.createdAt.getTime()
	);
}

export function reportsNear(
	center: CitizenReport,
	reports: CitizenReport[],
	radiusInMeters: number,
) {
	return reports.filter(
		(report) =>
			report.id !== center.id &&
			distanceInMeters(center.location, report.location) <= radiusInMeters,
	);
}
