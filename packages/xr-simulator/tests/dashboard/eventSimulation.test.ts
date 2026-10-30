import { describe, expect, it } from "vitest";
import type { DisasterEvent, DisasterPreset } from "../../src/dashboard/events";
import {
	affectedAreaHectares,
	frameAt,
	simulateEvent,
} from "../../src/dashboard/simulation";
import type { HeightGrid } from "../../src/scenario/terrain";
import { DEFAULT_MATERIAL } from "../../src/solver/params";

const RESOLUTION = 32;
const CELL_SIZE = 10;

/** A plane that drops 0.2 m per metre towards +x (east). */
function slopeGrid(): HeightGrid {
	const heights = new Float32Array(RESOLUTION * RESOLUTION);
	for (let row = 0; row < RESOLUTION; row++)
		for (let column = 0; column < RESOLUTION; column++)
			heights[row * RESOLUTION + column] =
				(RESOLUTION - column) * CELL_SIZE * 0.2;
	return { resolution: RESOLUTION, cellSize: CELL_SIZE, heights };
}

const event: DisasterEvent = {
	id: "test",
	kind: "huayco",
	name: "Prueba",
	place: "Plano",
	region: "Test",
	startedAt: "2026-01-01T00:00:00-05:00",
	rainfallMm: 10,
	center: { lon: -76, lat: -12 },
	release: { lon: -76, lat: -12 },
};

const preset: DisasterPreset = {
	label: "Huayco",
	material: DEFAULT_MATERIAL,
	volumeM3: 2_000,
	peakDischargeM3s: 50,
	releaseRadiusM: 20,
	durationS: 60,
};

describe("simulateEvent", () => {
	it("records one frame per interval from 0 to the preset duration", async () => {
		const run = await simulateEvent(slopeGrid(), event, preset, {
			recordIntervalS: 10,
		});
		expect(run.frames.map((frame) => frame.time)).toEqual([
			0, 10, 20, 30, 40, 50, 60,
		]);
		expect(run.duration).toBe(60);
		for (const frame of run.frames)
			expect(frame.depth).toHaveLength(RESOLUTION ** 2);
	});

	it("starts dry and spreads the release over the terrain", async () => {
		const run = await simulateEvent(slopeGrid(), event, preset, {
			recordIntervalS: 10,
		});
		expect(run.frames[0].affectedAreaHa).toBe(0);
		expect(run.frames[0].volumeM3).toBe(0);
		const last = run.frames[run.frames.length - 1];
		expect(last.affectedAreaHa).toBeGreaterThan(0);
		expect(last.maxSpeed).toBeGreaterThan(0);
		expect(last.volumeM3).toBeGreaterThan(0);
		expect(last.volumeM3).toBeLessThanOrEqual(preset.volumeM3 * 1.01);
	});

	it("moves the flow downhill from the release point", async () => {
		const run = await simulateEvent(slopeGrid(), event, preset, {
			recordIntervalS: 10,
		});
		const depth = run.frames[run.frames.length - 1].depth;
		let weighted = 0;
		let total = 0;
		depth.forEach((value, index) => {
			weighted += value * ((index % RESOLUTION) + 0.5) * CELL_SIZE;
			total += value;
		});
		const releaseX = (RESOLUTION * CELL_SIZE) / 2;
		expect(weighted / total).toBeGreaterThan(releaseX);
	});

	it("reports every frame as soon as it is recorded", async () => {
		const reported: number[] = [];
		const run = await simulateEvent(slopeGrid(), event, preset, {
			recordIntervalS: 10,
			onFrame: (frame) => reported.push(frame.time),
		});
		expect(reported).toEqual(run.frames.map((frame) => frame.time));
	});

	it("rejects a release point outside the grid", async () => {
		const farRelease = { ...event, release: { lon: -75.9, lat: -12 } };
		await expect(
			simulateEvent(slopeGrid(), farRelease, preset),
		).rejects.toThrow(
			'Evento "test": el punto de inicio queda fuera del terreno simulado',
		);
	});
});

describe("affectedAreaHectares", () => {
	it("counts only cells deeper than the threshold", () => {
		const depth = Float32Array.from([0, 0.05, 0.2, 1.5]);
		expect(affectedAreaHectares(depth, 100, 0.1)).toBe(2);
	});
});

describe("frameAt", () => {
	const frames = [0, 10, 20].map((time) => ({
		time,
		depth: new Float32Array(1),
		affectedAreaHa: time,
		maxSpeed: 0,
		volumeM3: 0,
	}));

	it("returns the last frame at or before the time", () => {
		expect(frameAt(frames, 15).time).toBe(10);
		expect(frameAt(frames, 20).time).toBe(20);
	});

	it("clamps times outside the recording", () => {
		expect(frameAt(frames, -5).time).toBe(0);
		expect(frameAt(frames, 99).time).toBe(20);
	});
});
