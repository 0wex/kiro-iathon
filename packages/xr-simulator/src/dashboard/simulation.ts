import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LON_AT_EQUATOR,
} from "../map/objects/constants";
import type { HeightGrid } from "../scenario/terrain";
import { CpuSolver } from "../solver/cpu/CpuSolver";
import { triangularHydrograph } from "../solver/params";
import {
	AFFECTED_DEPTH_M,
	MAX_SUBSTEPS_PER_INTERVAL,
	RECORD_INTERVAL_S,
	SQUARE_METERS_PER_HECTARE,
} from "./constants";
import type { DisasterEvent, DisasterPreset } from "./events";

export interface EventFrame {
	/** Simulated seconds since the release started. */
	time: number;
	/** Flow depth per cell (m), row-major from the south-west corner (index = row·n + column). */
	depth: Float32Array;
	affectedAreaHa: number;
	/** Fastest flow among the affected cells (m/s). */
	maxSpeed: number;
	volumeM3: number;
}

export interface EventRun {
	resolution: number;
	cellSize: number;
	frames: EventFrame[];
	duration: number;
}

export interface SimulateEventOptions {
	recordIntervalS?: number;
	/** Every recorded frame, as soon as it is recorded (the first one at time 0 included). */
	onFrame?: (frame: EventFrame) => void;
}

export function affectedAreaHectares(
	depth: Float32Array,
	cellSize: number,
	thresholdM: number,
): number {
	let affectedCells = 0;
	for (const value of depth) if (value > thresholdM) affectedCells++;
	return (affectedCells * cellSize * cellSize) / SQUARE_METERS_PER_HECTARE;
}

function recordFrame(solver: CpuSolver, time: number): EventFrame {
	const state = solver.stateSync();
	let maxSpeed = 0;
	state.h.forEach((depth, index) => {
		if (depth > AFFECTED_DEPTH_M)
			maxSpeed = Math.max(
				maxSpeed,
				Math.hypot(state.hu[index], state.hv[index]) / depth,
			);
	});
	return {
		time,
		depth: state.h,
		affectedAreaHa: affectedAreaHectares(
			state.h,
			solver.cellSize,
			AFFECTED_DEPTH_M,
		),
		maxSpeed,
		volumeM3: solver.statsSync().volume,
	};
}

/**
 * Runs the event on its terrain with the CPU solver, recording the flow every interval.
 * Yields after each frame so a worker can still receive messages meanwhile.
 */
export async function simulateEvent(
	grid: HeightGrid,
	event: DisasterEvent,
	preset: DisasterPreset,
	options: SimulateEventOptions = {},
): Promise<EventRun> {
	const recordIntervalS = options.recordIntervalS ?? RECORD_INTERVAL_S;
	const span = grid.resolution * grid.cellSize;
	const releaseX =
		span / 2 +
		(event.release.lon - event.center.lon) *
			METERS_PER_DEGREE_LON_AT_EQUATOR *
			Math.cos((event.center.lat * Math.PI) / 180);
	const releaseZ =
		span / 2 + (event.release.lat - event.center.lat) * METERS_PER_DEGREE_LAT;
	if (releaseX < 0 || releaseX > span || releaseZ < 0 || releaseZ > span)
		throw new Error(
			`Evento "${event.id}": el punto de inicio queda fuera del terreno simulado`,
		);
	const solver = new CpuSolver(grid.resolution, grid.cellSize, grid.heights);
	solver.setMaterial(preset.material);
	solver.setEmitters([
		{
			position: [releaseX, releaseZ],
			radius: preset.releaseRadiusM,
			hydrograph: triangularHydrograph(
				preset.volumeM3,
				preset.peakDischargeM3s,
			),
			enabled: true,
			startTime: 0,
		},
	]);
	const frames: EventFrame[] = [];
	const intervals = Math.round(preset.durationS / recordIntervalS);
	for (let interval = 0; interval <= intervals; interval++) {
		if (interval > 0)
			solver.advance(recordIntervalS, MAX_SUBSTEPS_PER_INTERVAL);
		const frame = recordFrame(solver, interval * recordIntervalS);
		frames.push(frame);
		options.onFrame?.(frame);
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	return {
		resolution: grid.resolution,
		cellSize: grid.cellSize,
		frames,
		duration: intervals * recordIntervalS,
	};
}

/** The last frame recorded at or before `time`; the first or last one outside the recording. */
export function frameAt(frames: EventFrame[], time: number): EventFrame {
	let found = frames[0];
	for (const frame of frames) {
		if (frame.time > time) break;
		found = frame;
	}
	return found;
}
