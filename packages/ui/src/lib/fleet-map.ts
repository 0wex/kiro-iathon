import type { Geometry, Position } from "geojson";

export function geometryPositions(geometry: Geometry): Position[] {
	switch (geometry.type) {
		case "Point":
			return [geometry.coordinates];
		case "MultiPoint":
		case "LineString":
			return geometry.coordinates;
		case "MultiLineString":
		case "Polygon":
			return geometry.coordinates.flat();
		case "MultiPolygon":
			return geometry.coordinates.flatMap((polygon) => polygon.flat());
		case "GeometryCollection":
			return geometry.geometries.flatMap(geometryPositions);
	}
}
