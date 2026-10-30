import { describe, expect, it } from "vitest";
import {
	blocksFromGeoJson,
	blocksUrl,
	landCoverFromGeoJson,
	landCoverUrl,
	populatedPlacesFromGeoJson,
	populatedPlacesUrl,
} from "../../src/map/objects/sources";

const tileBox = { west: -76.4, south: -11.86, east: -76.38, north: -11.84 };

describe("INEI WFS urls", () => {
	it("asks the block layer as GeoJSON inside the tile, lat/lon axis order", () => {
		const url = new URL(blocksUrl("/inei-api", tileBox), "http://viewer.test");
		expect(url.pathname).toBe("/inei-api/Interoperabilidad/ows");
		expect(url.searchParams.get("service")).toBe("WFS");
		expect(url.searchParams.get("request")).toBe("GetFeature");
		expect(url.searchParams.get("typeNames")).toBe(
			"Interoperabilidad:ig_manzana",
		);
		expect(url.searchParams.get("outputFormat")).toBe("application/json");
		expect(url.searchParams.get("bbox")).toBe(
			"-11.86,-76.4,-11.84,-76.38,urn:ogc:def:crs:EPSG::4326",
		);
	});
	it("asks the populated-place layer the same way", () => {
		const url = new URL(
			populatedPlacesUrl("/inei-api", tileBox),
			"http://viewer.test",
		);
		expect(url.searchParams.get("typeNames")).toBe(
			"Interoperabilidad:ig_centropoblado",
		);
	});
});

describe("MINAM land cover url", () => {
	it("asks the class field as simplified GeoJSON intersecting the tile", () => {
		const url = new URL(
			landCoverUrl("/minam-api", tileBox),
			"http://viewer.test",
		);
		expect(url.pathname).toBe(
			"/minam-api/arcgis/rest/services/Servicios_GeoPERU/ServicioCoberturaVegetal_MINAM/MapServer/0/query",
		);
		expect(url.searchParams.get("geometry")).toBe("-76.4,-11.86,-76.38,-11.84");
		expect(url.searchParams.get("inSR")).toBe("4326");
		expect(url.searchParams.get("outSR")).toBe("4326");
		expect(url.searchParams.get("outFields")).toBe("CobVeg2013");
		expect(url.searchParams.get("f")).toBe("geojson");
		expect(Number(url.searchParams.get("maxAllowableOffset"))).toBeGreaterThan(
			0,
		);
	});
});

describe("blocksFromGeoJson", () => {
	const ring = [
		[-76.39, -11.85],
		[-76.389, -11.85],
		[-76.389, -11.849],
		[-76.39, -11.85],
	];
	it("splits MultiPolygon blocks into one polygon each, keeping the block id", () => {
		const blocks = blocksFromGeoJson({
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { idmanzana: "15070100100011" },
					geometry: { type: "MultiPolygon", coordinates: [[ring], [ring]] },
				},
				{
					type: "Feature",
					properties: { idmanzana: "15070100100012" },
					geometry: { type: "Polygon", coordinates: [ring] },
				},
			],
		});
		expect(blocks.map((block) => block.id)).toEqual([
			"15070100100011#0",
			"15070100100011#1",
			"15070100100012#0",
		]);
		expect(blocks[0].rings).toEqual([ring]);
	});
	it("skips features without geometry", () => {
		expect(
			blocksFromGeoJson({
				type: "FeatureCollection",
				features: [
					{ type: "Feature", properties: { idmanzana: "x" }, geometry: null },
				],
			}),
		).toEqual([]);
	});
});

describe("populatedPlacesFromGeoJson", () => {
	it("keeps urban places (ambito 1) with their point", () => {
		const places = populatedPlacesFromGeoJson({
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { idccpp: "1507010001", nombccpp: "MATUCANA", ambito: 1 },
					geometry: { type: "Point", coordinates: [-76.38, -11.84] },
				},
				{
					type: "Feature",
					properties: { idccpp: "1507010099", nombccpp: "CASERIO", ambito: 2 },
					geometry: { type: "Point", coordinates: [-76.37, -11.83] },
				},
			],
		});
		expect(places).toEqual([
			{ id: "1507010001", name: "MATUCANA", lon: -76.38, lat: -11.84 },
		]);
	});
});

describe("landCoverFromGeoJson", () => {
	it("reads the CobVeg2013 class of every polygon part", () => {
		const ring = [
			[-76.4, -11.86],
			[-76.39, -11.86],
			[-76.39, -11.85],
			[-76.4, -11.86],
		];
		expect(
			landCoverFromGeoJson({
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						properties: { CobVeg2013: "Cardonal" },
						geometry: { type: "Polygon", coordinates: [ring] },
					},
				],
			}),
		).toEqual([{ landCover: "Cardonal", rings: [ring] }]);
	});
});
