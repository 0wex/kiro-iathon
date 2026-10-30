"use client";

import { cn } from "cn";
import { type ComponentProps, useMemo } from "react";
import {
	CONTOUR_DEFAULT_SEED,
	CONTOUR_HEIGHT_PX,
	CONTOUR_NOISE_GRID_SIZE,
	CONTOUR_RANDOM_INCREMENT,
	CONTOUR_RANDOM_MULTIPLIER,
	CONTOUR_RANDOM_RANGE,
	CONTOUR_SMOOTHSTEP_LINEAR,
	CONTOUR_SMOOTHSTEP_QUADRATIC,
	CONTOUR_STROKE_WIDTH_PX,
	CONTOUR_WIDTH_PX,
	TOPO_CELL_EDGES,
	TOPO_CELL_SIZE_PX,
	TOPO_DETAIL_SCALE_PX,
	TOPO_DETAIL_WEIGHT,
	TOPO_EDGE_ORIENTATION_COUNT,
	TOPO_LEVEL_COUNT,
	TOPO_LEVEL_MARGIN,
	TOPO_NOISE_SCALE_PX,
	TOPO_SADDLE_EDGE_COUNT,
	TOPO_SEGMENT_ENDPOINT_COUNT,
	TOPO_WARP_AMOUNT_PX,
	TOPO_WARP_OFFSET,
	TOPO_WARP_SCALE_PX,
} from "../lib/constants";

interface ContourArtProps extends Omit<ComponentProps<"svg">, "children"> {
	seed?: number;
}

interface ContourVertex {
	position: string;
	neighbors: number[];
}

function createNoise(seed: number) {
	let randomState = seed >>> 0;
	const lattice = Float64Array.from(
		{ length: CONTOUR_NOISE_GRID_SIZE * CONTOUR_NOISE_GRID_SIZE },
		() => {
			randomState =
				(Math.imul(randomState, CONTOUR_RANDOM_MULTIPLIER) +
					CONTOUR_RANDOM_INCREMENT) >>>
				0;
			return randomState / CONTOUR_RANDOM_RANGE;
		},
	);

	return (horizontal: number, vertical: number) => {
		const column = Math.floor(horizontal);
		const row = Math.floor(vertical);
		const horizontalFraction = horizontal - column;
		const verticalFraction = vertical - row;
		const horizontalBlend =
			horizontalFraction *
			horizontalFraction *
			(CONTOUR_SMOOTHSTEP_LINEAR -
				CONTOUR_SMOOTHSTEP_QUADRATIC * horizontalFraction);
		const verticalBlend =
			verticalFraction *
			verticalFraction *
			(CONTOUR_SMOOTHSTEP_LINEAR -
				CONTOUR_SMOOTHSTEP_QUADRATIC * verticalFraction);
		const left = column % CONTOUR_NOISE_GRID_SIZE;
		const right = (column + 1) % CONTOUR_NOISE_GRID_SIZE;
		const top = (row % CONTOUR_NOISE_GRID_SIZE) * CONTOUR_NOISE_GRID_SIZE;
		const bottom =
			((row + 1) % CONTOUR_NOISE_GRID_SIZE) * CONTOUR_NOISE_GRID_SIZE;
		const topLeft = lattice[top + left] ?? 0;
		const topRight = lattice[top + right] ?? 0;
		const bottomLeft = lattice[bottom + left] ?? 0;
		const bottomRight = lattice[bottom + right] ?? 0;
		const topValue = topLeft + (topRight - topLeft) * horizontalBlend;
		const bottomValue =
			bottomLeft + (bottomRight - bottomLeft) * horizontalBlend;
		return topValue + (bottomValue - topValue) * verticalBlend;
	};
}

export function TopoBackground({
	className,
	seed = CONTOUR_DEFAULT_SEED,
	...props
}: ContourArtProps) {
	const contourPath = useMemo(() => {
		const noise = createNoise(seed);
		const columnCount = Math.ceil(CONTOUR_WIDTH_PX / TOPO_CELL_SIZE_PX) + 1;
		const rowCount = Math.ceil(CONTOUR_HEIGHT_PX / TOPO_CELL_SIZE_PX) + 1;
		const heightField = new Float64Array(columnCount * rowCount);
		let minimumHeight = Number.POSITIVE_INFINITY;
		let maximumHeight = Number.NEGATIVE_INFINITY;

		for (let row = 0; row < rowCount; row++) {
			for (let column = 0; column < columnCount; column++) {
				const horizontal = column * TOPO_CELL_SIZE_PX;
				const vertical = row * TOPO_CELL_SIZE_PX;
				const warpedHorizontal =
					horizontal +
					noise(
						horizontal / TOPO_WARP_SCALE_PX,
						vertical / TOPO_WARP_SCALE_PX,
					) *
						TOPO_WARP_AMOUNT_PX;
				const warpedVertical =
					vertical +
					noise(
						horizontal / TOPO_WARP_SCALE_PX + TOPO_WARP_OFFSET,
						vertical / TOPO_WARP_SCALE_PX + TOPO_WARP_OFFSET,
					) *
						TOPO_WARP_AMOUNT_PX;
				const height =
					noise(
						warpedHorizontal / TOPO_NOISE_SCALE_PX,
						warpedVertical / TOPO_NOISE_SCALE_PX,
					) +
					TOPO_DETAIL_WEIGHT *
						noise(
							warpedHorizontal / TOPO_DETAIL_SCALE_PX,
							warpedVertical / TOPO_DETAIL_SCALE_PX,
						);
				heightField[row * columnCount + column] = height;
				minimumHeight = Math.min(minimumHeight, height);
				maximumHeight = Math.max(maximumHeight, height);
			}
		}

		const firstLevel =
			minimumHeight + (maximumHeight - minimumHeight) * TOPO_LEVEL_MARGIN;
		const levelStep =
			((maximumHeight - minimumHeight) *
				(1 - TOPO_LEVEL_MARGIN - TOPO_LEVEL_MARGIN)) /
			(TOPO_LEVEL_COUNT - 1);
		const contours = Array.from(
			{ length: TOPO_LEVEL_COUNT },
			(_unusedValue, levelIndex) => ({
				level: firstLevel + levelIndex * levelStep,
				vertices: new Map<number, ContourVertex>(),
			}),
		);
		for (let row = 0; row < rowCount - 1; row++) {
			for (let column = 0; column < columnCount - 1; column++) {
				const topLeft = heightField[row * columnCount + column] ?? 0;
				const topRight = heightField[row * columnCount + column + 1] ?? 0;
				const bottomLeft = heightField[(row + 1) * columnCount + column] ?? 0;
				const bottomRight =
					heightField[(row + 1) * columnCount + column + 1] ?? 0;
				const firstCrossing = Math.max(
					0,
					Math.ceil(
						(Math.min(topLeft, topRight, bottomLeft, bottomRight) -
							firstLevel) /
							levelStep,
					),
				);
				const lastCrossing = Math.min(
					TOPO_LEVEL_COUNT - 1,
					Math.floor(
						(Math.max(topLeft, topRight, bottomLeft, bottomRight) -
							firstLevel) /
							levelStep,
					),
				);
				for (
					let levelIndex = firstCrossing;
					levelIndex <= lastCrossing;
					levelIndex++
				) {
					const contour = contours[levelIndex];
					if (!contour) continue;
					const { level, vertices } = contour;
					const intersections: number[] = [];
					for (const edge of TOPO_CELL_EDGES) {
						const startColumn = column + edge.startColumn;
						const startRow = row + edge.startRow;
						const endColumn = column + edge.endColumn;
						const endRow = row + edge.endRow;
						const startIndex = startRow * columnCount + startColumn;
						const startHeight = heightField[startIndex] ?? 0;
						const endHeight =
							heightField[endRow * columnCount + endColumn] ?? 0;
						if (startHeight >= level === endHeight >= level) continue;
						const vertexId =
							startIndex * TOPO_EDGE_ORIENTATION_COUNT + edge.orientation;
						if (!vertices.has(vertexId)) {
							const fraction =
								(level - startHeight) / (endHeight - startHeight);
							const horizontal = Math.round(
								(startColumn + (endColumn - startColumn) * fraction) *
									TOPO_CELL_SIZE_PX,
							);
							const vertical = Math.round(
								(startRow + (endRow - startRow) * fraction) * TOPO_CELL_SIZE_PX,
							);
							vertices.set(vertexId, {
								position: `${horizontal},${vertical}`,
								neighbors: [],
							});
						}
						intersections.push(vertexId);
					}
					if (intersections.length === TOPO_SADDLE_EDGE_COUNT) {
						if (
							(topLeft - level) * (bottomRight - level) <
							(topRight - level) * (bottomLeft - level)
						) {
							const firstIntersection = intersections.shift();
							if (firstIntersection !== undefined)
								intersections.push(firstIntersection);
						}
					}
					for (
						let endpoint = 0;
						endpoint < intersections.length;
						endpoint += TOPO_SEGMENT_ENDPOINT_COUNT
					) {
						const startId = intersections[endpoint];
						const endId = intersections[endpoint + 1];
						if (startId === undefined || endId === undefined) continue;
						vertices.get(startId)?.neighbors.push(endId);
						vertices.get(endId)?.neighbors.push(startId);
					}
				}
			}
		}

		const paths: string[] = [];
		for (const { vertices } of contours) {
			const visited = new Set<number>();
			const openEnds = [...vertices.keys()].filter(
				(vertexId) => vertices.get(vertexId)?.neighbors.length === 1,
			);
			for (const startId of [...openEnds, ...vertices.keys()]) {
				if (visited.has(startId)) continue;
				let currentId: number | undefined = startId;
				let path = "";
				while (currentId !== undefined) {
					const vertex = vertices.get(currentId);
					if (!vertex) break;
					visited.add(currentId);
					path += `${path ? "L" : "M"}${vertex.position}`;
					const nextId = vertex.neighbors.find(
						(neighbor) => !visited.has(neighbor),
					);
					if (
						nextId === undefined &&
						vertex.neighbors.includes(startId) &&
						vertex.neighbors.length > 1
					)
						path += "Z";
					currentId = nextId;
				}
				paths.push(path);
			}
		}
		return paths.join("");
	}, [seed]);

	return (
		<svg
			viewBox={`0 0 ${CONTOUR_WIDTH_PX} ${CONTOUR_HEIGHT_PX}`}
			preserveAspectRatio="xMidYMid slice"
			{...props}
			className={cn(
				"pointer-events-none absolute inset-0 size-full",
				className,
			)}
			aria-hidden="true"
			focusable="false"
		>
			<path
				d={contourPath}
				fill="none"
				stroke="currentColor"
				strokeWidth={CONTOUR_STROKE_WIDTH_PX}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
