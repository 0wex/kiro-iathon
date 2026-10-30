import type { Geometry } from "geojson";
import { z } from "zod";

import { ARCGIS_MAX_PAGES, ARCGIS_PAGE_SIZE } from "../constants";
import { fetchJson, withQuery } from "./http";

const GEOMETRY_TYPES = new Set([
	"Point",
	"MultiPoint",
	"LineString",
	"MultiLineString",
	"Polygon",
	"MultiPolygon",
]);

export const geoJsonGeometrySchema = z.custom<Geometry>(
	(value) =>
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		typeof value.type === "string" &&
		GEOMETRY_TYPES.has(value.type) &&
		"coordinates" in value &&
		Array.isArray(value.coordinates),
	"Expected a GeoJSON geometry",
);

export const geoJsonFeatureSchema = z.object({
	id: z.union([z.string(), z.number()]).optional(),
	properties: z.record(z.string(), z.unknown()),
	geometry: geoJsonGeometrySchema.nullable(),
});

export const geoJsonFeatureCollectionSchema = z.object({
	features: z.array(geoJsonFeatureSchema),
	exceededTransferLimit: z.boolean().optional(),
	properties: z
		.object({ exceededTransferLimit: z.boolean().optional() })
		.optional(),
});

export type GeoJsonFeature = z.infer<typeof geoJsonFeatureSchema>;

// ArcGIS answers HTTP 200 with an error envelope for bad queries, so a plain
// status check is not enough to know the layer accepted the request.
const arcgisErrorSchema = z.object({
	error: z.object({ code: z.number(), message: z.string() }),
});

export interface ArcgisQueryOptions {
	layerUrl: string;
	where: string;
	orderByField: string;
	extraParams?: Record<string, string | number>;
}

export async function queryArcgisLayer(
	options: ArcgisQueryOptions,
): Promise<GeoJsonFeature[]> {
	const features: GeoJsonFeature[] = [];
	for (let page = 0; page < ARCGIS_MAX_PAGES; page += 1) {
		const url = withQuery(`${options.layerUrl}/query`, {
			where: options.where,
			outFields: "*",
			outSR: 4326,
			f: "geojson",
			orderByFields: `${options.orderByField} ASC`,
			resultOffset: page * ARCGIS_PAGE_SIZE,
			resultRecordCount: ARCGIS_PAGE_SIZE,
			...options.extraParams,
		});
		const body = await fetchJson(url);
		const failure = arcgisErrorSchema.safeParse(body);
		if (failure.success) {
			throw new Error(
				`ArcGIS ${options.layerUrl} error ${failure.data.error.code}: ${failure.data.error.message}`,
			);
		}
		const collection = geoJsonFeatureCollectionSchema.parse(body);
		features.push(...collection.features);
		const exceeded =
			collection.exceededTransferLimit ??
			collection.properties?.exceededTransferLimit ??
			false;
		if (!exceeded || collection.features.length < ARCGIS_PAGE_SIZE) {
			break;
		}
	}
	return features;
}

export function epochMsToDate(value: unknown): Date | null {
	return typeof value === "number" && Number.isFinite(value)
		? new Date(value)
		: null;
}
