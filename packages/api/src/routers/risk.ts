import { compareRiskAwareRoutes } from "@hack-the-andes-project/business/risk/compare-routes";
import {
	RISK_HORIZONS_HOURS,
	RISK_LEVELS,
	RISK_METHODS,
	roadSegment,
	segmentRiskAssessment,
} from "@hack-the-andes-project/db/schema/risk";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import {
	DEFAULT_RISK_HORIZON_HOURS,
	DEFAULT_RISK_SEGMENT_LIMIT_ROWS,
	MAX_RISK_SEGMENT_LIMIT_ROWS,
	RISK_DISCLAIMER_MESSAGE,
} from "../constants";
import { getBoundingBoxFilter } from "../filters";
import { protectedProcedure } from "../index";
import {
	boundingBoxSchema,
	geometrySchema,
	latLngSchema,
	lineStringSchema,
} from "../schemas";

const horizonHoursSchema = z
	.literal(RISK_HORIZONS_HOURS)
	.default(DEFAULT_RISK_HORIZON_HOURS);

const riskComponentsSchema = z.object({
	staticSusceptibility: z.number(),
	massMovement: z.number(),
	slope: z.number(),
	floodExposure: z.number(),
	history: z.number(),
	trigger: z.number(),
	forecastRain: z.number(),
	antecedentRain: z.number(),
	officialAlert: z.number(),
});

const evaluatedRouteSchema = z.object({
	geometry: lineStringSchema,
	distanceM: z.number(),
	durationS: z.number(),
	meanRiskScore: z.number(),
	maxRiskScore: z.number(),
	highRiskDistanceM: z.number(),
	unassessedDistanceM: z.number(),
});

export const riskRouter = {
	segments: protectedProcedure
		.input(
			z.object({
				horizonHours: horizonHoursSchema,
				bbox: boundingBoxSchema.optional(),
				roadCode: z.string().optional(),
				minScore: z.number().min(0).max(100).optional(),
				limit: z
					.number()
					.int()
					.positive()
					.max(MAX_RISK_SEGMENT_LIMIT_ROWS)
					.default(DEFAULT_RISK_SEGMENT_LIMIT_ROWS),
			}),
		)
		.output(
			z.object({
				segments: z.array(
					z.object({
						id: z.string(),
						roadCode: z.string().nullable(),
						roadName: z.string().nullable(),
						geometry: geometrySchema,
						lat: z.number(),
						lng: z.number(),
						lengthM: z.number(),
						elevationM: z.number().nullable(),
						terrainSlopeDeg: z.number().nullable(),
						massMovementSusceptibility: z.number().nullable(),
						floodSusceptibility: z.number().nullable(),
						waterDistanceM: z.number().nullable(),
						builtAt: z.date(),
						assessment: z
							.object({
								score: z.number(),
								level: z.enum(RISK_LEVELS),
								method: z.enum(RISK_METHODS),
								modelVersion: z.string(),
								components: riskComponentsSchema,
								forecastPrecipitationMm: z.number().nullable(),
								antecedentPrecipitationMm: z.number().nullable(),
								weatherFetchedAt: z.date().nullable(),
								validFrom: z.date(),
								validUntil: z.date(),
								assessedAt: z.date(),
							})
							.nullable(),
					}),
				),
				disclaimer: z.string(),
			}),
		)
		.handler(async ({ context, input }) => {
			const rows = await context.db
				.select({
					segment: {
						id: roadSegment.id,
						roadCode: roadSegment.roadCode,
						roadName: roadSegment.roadName,
						geometry: roadSegment.geometry,
						lat: roadSegment.lat,
						lng: roadSegment.lng,
						lengthM: roadSegment.lengthM,
						elevationM: roadSegment.elevationM,
						terrainSlopeDeg: roadSegment.terrainSlopeDeg,
						massMovementSusceptibility: roadSegment.massMovementSusceptibility,
						floodSusceptibility: roadSegment.floodSusceptibility,
						waterDistanceM: roadSegment.waterDistanceM,
						builtAt: roadSegment.builtAt,
					},
					assessment: {
						score: segmentRiskAssessment.score,
						level: segmentRiskAssessment.level,
						method: segmentRiskAssessment.method,
						modelVersion: segmentRiskAssessment.modelVersion,
						components: segmentRiskAssessment.components,
						forecastPrecipitationMm:
							segmentRiskAssessment.forecastPrecipitationMm,
						antecedentPrecipitationMm:
							segmentRiskAssessment.antecedentPrecipitationMm,
						weatherFetchedAt: segmentRiskAssessment.weatherFetchedAt,
						validFrom: segmentRiskAssessment.validFrom,
						validUntil: segmentRiskAssessment.validUntil,
						assessedAt: segmentRiskAssessment.assessedAt,
					},
				})
				.from(roadSegment)
				.leftJoin(
					segmentRiskAssessment,
					and(
						eq(segmentRiskAssessment.segmentId, roadSegment.id),
						eq(segmentRiskAssessment.horizonHours, input.horizonHours),
					),
				)
				.where(
					and(
						getBoundingBoxFilter(roadSegment, input.bbox),
						input.roadCode
							? eq(roadSegment.roadCode, input.roadCode)
							: undefined,
						input.minScore === undefined
							? undefined
							: gte(segmentRiskAssessment.score, input.minScore),
					),
				)
				.orderBy(desc(segmentRiskAssessment.score))
				.limit(input.limit);

			context.log.set({
				risk: {
					segments: rows.length,
					horizonHours: input.horizonHours,
					hasBbox: Boolean(input.bbox),
				},
			});
			return {
				segments: rows.map((row) => ({
					...row.segment,
					assessment: row.assessment,
				})),
				disclaimer: RISK_DISCLAIMER_MESSAGE,
			};
		}),

	compareRoutes: protectedProcedure
		.input(
			z.object({
				origin: latLngSchema,
				destination: latLngSchema,
				horizonHours: horizonHoursSchema,
			}),
		)
		.output(
			z.object({
				horizonHours: z.literal(RISK_HORIZONS_HOURS),
				fastest: evaluatedRouteSchema.nullable(),
				safest: evaluatedRouteSchema.nullable(),
				closures: z.array(
					z.object({
						id: z.string(),
						title: z.string(),
						roadCode: z.string().nullable(),
						lat: z.number(),
						lng: z.number(),
					}),
				),
				officialDetours: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						geometry: geometrySchema.nullable(),
						roadCodes: z.array(z.string()).nullable(),
					}),
				),
				assessedFrom: z.date().nullable(),
				assessedUntil: z.date().nullable(),
				disclaimer: z.string(),
			}),
		)
		.handler(async ({ context, input }) => {
			const comparison = await compareRiskAwareRoutes({
				db: context.db,
				origin: input.origin,
				destination: input.destination,
				horizonHours: input.horizonHours,
				now: new Date(),
			});

			context.log.set({
				risk: {
					horizonHours: input.horizonHours,
					routed: Boolean(comparison.fastest),
					closures: comparison.closures.length,
					officialDetours: comparison.officialDetours.length,
				},
			});
			return {
				...comparison,
				horizonHours: input.horizonHours,
				disclaimer: RISK_DISCLAIMER_MESSAGE,
			};
		}),
};
