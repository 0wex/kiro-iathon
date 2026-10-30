import type { Database } from "@hack-the-andes-project/db";
import {
	RISK_HORIZONS_HOURS,
	roadSegment,
	segmentRiskAssessment,
} from "@hack-the-andes-project/db/schema/risk";
import { incident } from "@hack-the-andes-project/db/schema/scraper";
import {
	and,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
} from "drizzle-orm";
import type { RequestLogger } from "evlog";

import { FLEET_WRITE_BATCH_SIZE_ROWS } from "../constants";
import { incomingValue } from "../fleet/sql";
import type { LatLng } from "../hazards/types";
import {
	ASSESSMENT_BOUNDS_MARGIN_DEG,
	HEURISTIC_MODEL_VERSION,
	HISTORY_EVENT_CATEGORIES,
	HISTORY_RADIUS_M,
	MS_PER_HOUR,
	OFFICIAL_ALERT_CATEGORIES,
	OFFICIAL_ALERT_RADIUS_M,
	OFFICIAL_ALERT_WEIGHT,
	RISK_SCORE_MAX,
	WEATHER_GRID_DEG,
	WEATHER_REQUEST_BATCH_POINTS,
} from "./constants";
import { countEventsNearby, strongestOfficialAlert } from "./exposure";
import { modelFeatureVector, relativeModelScore } from "./model";
import { GENERATED_RISK_MODEL } from "./model.generated";
import { riskLevelForScore, scoreSegmentRisk } from "./score";
import {
	fetchHourlyPrecipitation,
	type PrecipitationSeries,
	summarizePrecipitation,
} from "./weather";

export interface AssessRoadRiskInput {
	db: Database;
	now: Date;
	log: RequestLogger;
	fetchImpl?: typeof fetch;
}

export interface AssessRoadRiskResult {
	segments: number;
	weatherCells: number;
	weatherCellsFailed: number;
	segmentsWithoutWeather: number;
	assessments: number;
}

function weatherCellKey(point: LatLng): string {
	return `${Math.round(point.lat / WEATHER_GRID_DEG)}:${Math.round(point.lng / WEATHER_GRID_DEG)}`;
}

async function fetchWeatherByCell(
	segments: LatLng[],
	fetchImpl: typeof fetch | undefined,
	log: RequestLogger,
): Promise<{ series: Map<string, PrecipitationSeries>; failed: number }> {
	const cells = new Map<string, LatLng>();
	for (const segment of segments) {
		const key = weatherCellKey(segment);
		if (!cells.has(key)) {
			cells.set(key, {
				lat: Math.round(segment.lat / WEATHER_GRID_DEG) * WEATHER_GRID_DEG,
				lng: Math.round(segment.lng / WEATHER_GRID_DEG) * WEATHER_GRID_DEG,
			});
		}
	}

	const keys = [...cells.keys()];
	const series = new Map<string, PrecipitationSeries>();
	let failed = 0;
	for (
		let offset = 0;
		offset < keys.length;
		offset += WEATHER_REQUEST_BATCH_POINTS
	) {
		const batchKeys = keys.slice(offset, offset + WEATHER_REQUEST_BATCH_POINTS);
		try {
			const batchSeries = await fetchHourlyPrecipitation({
				points: batchKeys.flatMap((key) => cells.get(key) ?? []),
				fetchImpl,
			});
			batchKeys.forEach((key, index) => {
				const cellSeries = batchSeries[index];
				if (cellSeries) series.set(key, cellSeries);
			});
		} catch (error) {
			// Segments of failed cells keep their previous assessment (see below).
			failed += batchKeys.length;
			log.set({ riskWeatherError: String(error) });
		}
	}
	return { series, failed };
}

export async function assessRoadRisk({
	db,
	now,
	log,
	fetchImpl,
}: AssessRoadRiskInput): Promise<AssessRoadRiskResult> {
	const segments = await db
		.select({
			id: roadSegment.id,
			lat: roadSegment.lat,
			lng: roadSegment.lng,
			terrainSlopeDeg: roadSegment.terrainSlopeDeg,
			massMovementSusceptibility: roadSegment.massMovementSusceptibility,
			floodSusceptibility: roadSegment.floodSusceptibility,
			waterDistanceM: roadSegment.waterDistanceM,
		})
		.from(roadSegment);
	if (segments.length === 0) {
		return {
			segments: 0,
			weatherCells: 0,
			weatherCellsFailed: 0,
			segmentsWithoutWeather: 0,
			assessments: 0,
		};
	}

	const latitudes = segments.map((segment) => segment.lat);
	const longitudes = segments.map((segment) => segment.lng);
	const historyEvents = await db
		.select({ lat: incident.lat, lng: incident.lng })
		.from(incident)
		.where(
			and(
				inArray(incident.category, HISTORY_EVENT_CATEGORIES),
				gte(
					incident.lat,
					Math.min(...latitudes) - ASSESSMENT_BOUNDS_MARGIN_DEG,
				),
				lte(
					incident.lat,
					Math.max(...latitudes) + ASSESSMENT_BOUNDS_MARGIN_DEG,
				),
				gte(
					incident.lng,
					Math.min(...longitudes) - ASSESSMENT_BOUNDS_MARGIN_DEG,
				),
				lte(
					incident.lng,
					Math.max(...longitudes) + ASSESSMENT_BOUNDS_MARGIN_DEG,
				),
			),
		);
	const alerts = await db
		.select({
			severity: incident.severity,
			geometry: incident.geometry,
			lat: incident.lat,
			lng: incident.lng,
		})
		.from(incident)
		.where(
			and(
				eq(incident.active, true),
				inArray(incident.category, OFFICIAL_ALERT_CATEGORIES),
				or(isNull(incident.validUntil), gt(incident.validUntil, now)),
				or(isNotNull(incident.geometry), isNotNull(incident.lat)),
			),
		);

	const historyCounts = countEventsNearby(
		segments,
		historyEvents.flatMap((event) =>
			event.lat === null || event.lng === null
				? []
				: [{ lat: event.lat, lng: event.lng }],
		),
		HISTORY_RADIUS_M,
	);
	const weather = await fetchWeatherByCell(segments, fetchImpl, log);

	const rows = segments.flatMap((segment, index) => {
		const officialAlertSeverity = strongestOfficialAlert(
			segment,
			alerts,
			OFFICIAL_ALERT_RADIUS_M,
		);
		const series = weather.series.get(weatherCellKey(segment));
		// Without weather the rain trigger would read as dry and overwrite a
		// rainy assessment with a lower score; the last known assessment, with
		// its older assessedAt, is the honest answer until the next run.
		if (!series) {
			return [];
		}
		return RISK_HORIZONS_HOURS.map((horizonHours) => {
			const precipitation = summarizePrecipitation(
				series,
				now.getTime(),
				horizonHours,
			);
			const features = {
				...segment,
				historicalEventCount: historyCounts[index] ?? 0,
			};
			const conditions = {
				forecastPrecipitationMm: precipitation.forecastMm,
				antecedentPrecipitationMm: precipitation.antecedentMm,
				officialAlertSeverity,
			};
			const assessment = scoreSegmentRisk(features, conditions);
			// The model is trained on environmental variables only, so official
			// alerts are added on top exactly as the heuristic does.
			const score = GENERATED_RISK_MODEL
				? Math.min(
						RISK_SCORE_MAX,
						relativeModelScore(
							GENERATED_RISK_MODEL,
							GENERATED_RISK_MODEL.predictProbability(
								modelFeatureVector(features, conditions, now),
							),
						) +
							RISK_SCORE_MAX *
								OFFICIAL_ALERT_WEIGHT *
								assessment.components.officialAlert,
					)
				: assessment.score;
			return {
				id: crypto.randomUUID(),
				segmentId: segment.id,
				horizonHours,
				score,
				level: riskLevelForScore(score),
				method: GENERATED_RISK_MODEL
					? ("model" as const)
					: ("heuristic" as const),
				modelVersion: GENERATED_RISK_MODEL?.version ?? HEURISTIC_MODEL_VERSION,
				components: assessment.components,
				forecastPrecipitationMm: precipitation.forecastMm,
				antecedentPrecipitationMm: precipitation.antecedentMm,
				weatherFetchedAt: now,
				validFrom: now,
				validUntil: new Date(now.getTime() + horizonHours * MS_PER_HOUR),
				assessedAt: now,
			};
		});
	});

	for (
		let offset = 0;
		offset < rows.length;
		offset += FLEET_WRITE_BATCH_SIZE_ROWS
	) {
		await db
			.insert(segmentRiskAssessment)
			.values(rows.slice(offset, offset + FLEET_WRITE_BATCH_SIZE_ROWS))
			.onDuplicateKeyUpdate({
				set: {
					score: incomingValue(segmentRiskAssessment.score),
					level: incomingValue(segmentRiskAssessment.level),
					method: incomingValue(segmentRiskAssessment.method),
					modelVersion: incomingValue(segmentRiskAssessment.modelVersion),
					components: incomingValue(segmentRiskAssessment.components),
					forecastPrecipitationMm: incomingValue(
						segmentRiskAssessment.forecastPrecipitationMm,
					),
					antecedentPrecipitationMm: incomingValue(
						segmentRiskAssessment.antecedentPrecipitationMm,
					),
					weatherFetchedAt: incomingValue(
						segmentRiskAssessment.weatherFetchedAt,
					),
					validFrom: incomingValue(segmentRiskAssessment.validFrom),
					validUntil: incomingValue(segmentRiskAssessment.validUntil),
					assessedAt: incomingValue(segmentRiskAssessment.assessedAt),
				},
			});
	}

	return {
		segments: segments.length,
		weatherCells: weather.series.size + weather.failed,
		weatherCellsFailed: weather.failed,
		segmentsWithoutWeather:
			segments.length - rows.length / RISK_HORIZONS_HOURS.length,
		assessments: rows.length,
	};
}
