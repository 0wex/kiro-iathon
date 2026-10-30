import type { HeightGrid } from "../scenario/terrain";
import { DISASTER_PRESETS, type DisasterEvent } from "./events";
import { type EventFrame, simulateEvent } from "./simulation";

export interface SimulationRequest {
	event: DisasterEvent;
	grid: HeightGrid;
}

export type SimulationMessage =
	| { type: "frame"; frame: EventFrame }
	| { type: "done" }
	| { type: "error"; message: string };

function send(message: SimulationMessage, transfer: Transferable[] = []): void {
	self.postMessage(message, { transfer });
}

/** Runs one event off the main thread, streaming each frame as soon as it is recorded. */
self.onmessage = async ({ data }: MessageEvent<SimulationRequest>) => {
	try {
		await simulateEvent(
			data.grid,
			data.event,
			DISASTER_PRESETS[data.event.kind],
			{
				onFrame: (frame) =>
					send({ type: "frame", frame }, [frame.depth.buffer]),
			},
		);
		send({ type: "done" });
	} catch (error) {
		send({ type: "error", message: String(error) });
	}
};
