import type { LonLatBox } from "../tileMath";
import type { LandCoverArea, PolygonRings } from "./placement";

/**
 * INEI's public WFS (city blocks, populated places) and MINAM's land-cover ArcGIS service,
 * reached through same-origin proxies (`/inei-api`, `/minam-api`) because INEI sends no CORS headers.
 */
export const INEI_API_BASE = "/inei-api";
export const MINAM_API_BASE = "/minam-api";

const INEI_WFS_PATH = "/Interoperabilidad/ows";
const MINAM_LAND_COVER_PATH =
	"/arcgis/rest/services/Servicios_GeoPERU/ServicioCoberturaVegetal_MINAM/MapServer/0/query";
/** Simplification of MINAM's polygons (degrees, ~50 m): a raw tile answer is ~6× heavier. */
const LAND_COVER_SIMPLIFY_DEGREES = 0.0005;
const LAND_COVER_PRECISION_DIGITS = 5;
const REQUEST_TIMEOUT_MS = 20_000;
/** INEI's `ambito` code for urban populated places. */
const URBAN_PLACE_SCOPE = 1;

export interface CityBlock {
	/** INEI `idmanzana` plus the part index, unique per polygon. */
	id: string;
	rings: PolygonRings;
}

export interface PopulatedPlace {
	id: string;
	name: string;
	lon: number;
	lat: number;
}

interface GeoJsonGeometry {
	type: string;
	coordinates: unknown;
}

interface GeoJsonFeature {
	type: "Feature";
	properties: Record<string, unknown> | null;
	geometry: GeoJsonGeometry | null;
}

export interface GeoJsonFeatureCollection {
	type: "FeatureCollection";
	features: GeoJsonFeature[];
}

export interface ObjectSourcesApi {
	blocks(box: LonLatBox): Promise<CityBlock[]>;
	populatedPlaces(box: LonLatBox): Promise<PopulatedPlace[]>;
	landCover(box: LonLatBox): Promise<LandCoverArea[]>;
}

function wfsUrl(base: string, layer: string, box: LonLatBox): string {
	const params = new URLSearchParams({
		service: "WFS",
		version: "2.0.0",
		request: "GetFeature",
		typeNames: `Interoperabilidad:${layer}`,
		outputFormat: "application/json",
		// EPSG:4326 as a URN means lat/lon axis order in WFS 2.0.
		bbox: `${box.south},${box.west},${box.north},${box.east},urn:ogc:def:crs:EPSG::4326`,
	});
	return `${base}${INEI_WFS_PATH}?${params}`;
}

export function blocksUrl(base: string, box: LonLatBox): string {
	return wfsUrl(base, "ig_manzana", box);
}

export function populatedPlacesUrl(base: string, box: LonLatBox): string {
	return wfsUrl(base, "ig_centropoblado", box);
}

export function landCoverUrl(base: string, box: LonLatBox): string {
	const params = new URLSearchParams({
		where: "1=1",
		geometry: `${box.west},${box.south},${box.east},${box.north}`,
		geometryType: "esriGeometryEnvelope",
		inSR: "4326",
		outSR: "4326",
		spatialRel: "esriSpatialRelIntersects",
		outFields: "CobVeg2013",
		maxAllowableOffset: String(LAND_COVER_SIMPLIFY_DEGREES),
		geometryPrecision: String(LAND_COVER_PRECISION_DIGITS),
		f: "geojson",
	});
	return `${base}${MINAM_LAND_COVER_PATH}?${params}`;
}

/** Each polygon of a Polygon or MultiPolygon geometry; other geometry types yield none. */
function polygonsOf(geometry: GeoJsonGeometry | null): PolygonRings[] {
	if (!geometry || !Array.isArray(geometry.coordinates)) return [];
	if (geometry.type === "Polygon") return [geometry.coordinates];
	if (geometry.type === "MultiPolygon") return geometry.coordinates;
	return [];
}

export function blocksFromGeoJson(
	collection: GeoJsonFeatureCollection,
): CityBlock[] {
	return collection.features.flatMap((feature) =>
		polygonsOf(feature.geometry).map((rings, part) => ({
			id: `${String(feature.properties?.idmanzana)}#${part}`,
			rings,
		})),
	);
}

export function populatedPlacesFromGeoJson(
	collection: GeoJsonFeatureCollection,
): PopulatedPlace[] {
	return collection.features.flatMap((feature) => {
		const geometry = feature.geometry;
		if (
			feature.properties?.ambito !== URBAN_PLACE_SCOPE ||
			geometry?.type !== "Point" ||
			!Array.isArray(geometry.coordinates)
		)
			return [];
		const [lon, lat] = geometry.coordinates;
		return [
			{
				id: String(feature.properties.idccpp),
				name: String(feature.properties.nombccpp),
				lon: Number(lon),
				lat: Number(lat),
			},
		];
	});
}

export function landCoverFromGeoJson(
	collection: GeoJsonFeatureCollection,
): LandCoverArea[] {
	return collection.features.flatMap((feature) =>
		polygonsOf(feature.geometry).map((rings) => ({
			landCover: String(feature.properties?.CobVeg2013),
			rings,
		})),
	);
}

export function httpObjectSourcesApi(
	ineiBase: string,
	minamBase: string,
	credentials: RequestCredentials = "same-origin",
): ObjectSourcesApi {
	const getCollection = async (
		url: string,
	): Promise<GeoJsonFeatureCollection> => {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			credentials,
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.json();
	};
	return {
		blocks: async (box) =>
			blocksFromGeoJson(await getCollection(blocksUrl(ineiBase, box))),
		populatedPlaces: async (box) =>
			populatedPlacesFromGeoJson(
				await getCollection(populatedPlacesUrl(ineiBase, box)),
			),
		landCover: async (box) =>
			landCoverFromGeoJson(await getCollection(landCoverUrl(minamBase, box))),
	};
}
