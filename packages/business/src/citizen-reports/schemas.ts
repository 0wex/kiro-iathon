import { z } from "zod";

import {
	type HAZARD_KINDS,
	PHOTO_MAX_BYTES,
	PHOTO_MEDIA_TYPES,
	PIURA_BOUNDS,
	PLAN_ITEM_MAX_CHARS,
	PLAN_MAX_ACTIONS,
	PLAN_MAX_LIST_ITEMS,
	PLAN_MIN_ACTIONS,
	PLAN_POPULATION_MESSAGE_MAX_CHARS,
	PLAN_SITUATION_MAX_CHARS,
	type PLAN_SOURCES,
	REPORT_DESCRIPTION_MAX_CHARS,
	REPORT_DESCRIPTION_MIN_CHARS,
	type REPORT_PRIORITIES,
} from "./constants";

export type HazardKind = (typeof HAZARD_KINDS)[number];
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];
export type PlanSource = (typeof PLAN_SOURCES)[number];
export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];

export interface GeoPoint {
	lon: number;
	lat: number;
}

export interface ReportPhoto {
	mediaType: PhotoMediaType;
	base64: string;
}

export interface CreateCitizenReportInput {
	description: string;
	location: GeoPoint;
	photo?: ReportPhoto;
}

export interface ContingencyPlanContent {
	situation: string;
	actions: string[];
	resources: string[];
	responsibles: string[];
	populationMessage: string;
}

export interface ContingencyPlan extends ContingencyPlanContent {
	source: PlanSource;
	generatedAt: Date;
}

export interface CitizenReport {
	id: string;
	description: string;
	location: GeoPoint;
	photoUrl: string | null;
	hazardKind: HazardKind;
	priority: ReportPriority;
	isExample: boolean;
	createdAt: Date;
	plan: ContingencyPlan | null;
}

export const geoPointSchema = z.object({
	lon: z.number().min(-180).max(180),
	lat: z.number().min(-90).max(90),
});

const piuraPointSchema = geoPointSchema.refine(
	({ lon, lat }) =>
		lon >= PIURA_BOUNDS.west &&
		lon <= PIURA_BOUNDS.east &&
		lat >= PIURA_BOUNDS.south &&
		lat <= PIURA_BOUNDS.north,
	"El punto debe estar dentro de la región Piura.",
);

const BASE64_BYTES_PER_CHAR = 3 / 4;

export const createCitizenReportInputSchema = z.object({
	description: z
		.string()
		.trim()
		.min(
			REPORT_DESCRIPTION_MIN_CHARS,
			`Describe el punto crítico con al menos ${REPORT_DESCRIPTION_MIN_CHARS} caracteres.`,
		)
		.max(
			REPORT_DESCRIPTION_MAX_CHARS,
			`La descripción no puede pasar de ${REPORT_DESCRIPTION_MAX_CHARS} caracteres.`,
		),
	location: piuraPointSchema,
	photo: z
		.object({
			mediaType: z.enum(PHOTO_MEDIA_TYPES),
			base64: z
				.string()
				.min(1)
				.refine(
					(base64) =>
						Math.floor(base64.length * BASE64_BYTES_PER_CHAR) <=
						PHOTO_MAX_BYTES,
					"La foto es demasiado pesada.",
				),
		})
		.optional(),
}) satisfies z.ZodType<CreateCitizenReportInput>;

export const generatePlanInputSchema = z.object({
	reportId: z.string().min(1),
});

const planItemSchema = z.string().trim().min(1).max(PLAN_ITEM_MAX_CHARS);

export const contingencyPlanContentSchema = z.object({
	situation: z.string().trim().min(1).max(PLAN_SITUATION_MAX_CHARS),
	actions: z.array(planItemSchema).min(PLAN_MIN_ACTIONS).max(PLAN_MAX_ACTIONS),
	resources: z.array(planItemSchema).min(1).max(PLAN_MAX_LIST_ITEMS),
	responsibles: z.array(planItemSchema).min(1).max(PLAN_MAX_LIST_ITEMS),
	populationMessage: z
		.string()
		.trim()
		.min(1)
		.max(PLAN_POPULATION_MESSAGE_MAX_CHARS),
}) satisfies z.ZodType<ContingencyPlanContent>;
