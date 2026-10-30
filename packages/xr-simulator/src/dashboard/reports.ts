import {
	CONFIRMED_AFTER_REPORTS,
	REPORT_MAX_DELAY_S,
	REPORT_MIN_DELAY_S,
} from "./constants";
import type { DisasterEvent } from "./events";

export type ReportStatus = "reportado" | "confirmado";

export interface EventReport {
	id: number;
	eventId: string;
	/** 1 for the event's first report. */
	sequence: number;
	status: ReportStatus;
	/** Seconds on the page's clock. */
	receivedAt: number;
}

/**
 * Example live feed over the catalogue until a real source exists: every event is reported
 * once, in random order, before any gets a follow-up report.
 */
export class ReportFeed {
	private readonly counts = new Map<string, number>();
	private nextId = 1;

	constructor(
		private readonly events: DisasterEvent[],
		private readonly random: () => number,
	) {}

	nextDelayS(): number {
		return (
			REPORT_MIN_DELAY_S +
			this.random() * (REPORT_MAX_DELAY_S - REPORT_MIN_DELAY_S)
		);
	}

	next(receivedAt: number): EventReport {
		const unreported = this.events.filter(
			(event) => !this.counts.has(event.id),
		);
		const candidates = unreported.length > 0 ? unreported : this.events;
		const event = candidates[Math.floor(this.random() * candidates.length)];
		const sequence = (this.counts.get(event.id) ?? 0) + 1;
		this.counts.set(event.id, sequence);
		return {
			id: this.nextId++,
			eventId: event.id,
			sequence,
			status: sequence >= CONFIRMED_AFTER_REPORTS ? "confirmado" : "reportado",
			receivedAt,
		};
	}
}

export function formatAgo(seconds: number): string {
	if (seconds < 1) return "ahora";
	if (seconds < 60) return `hace ${Math.floor(seconds)} s`;
	if (seconds < 3_600) return `hace ${Math.floor(seconds / 60)} min`;
	return `hace ${Math.floor(seconds / 3_600)} h`;
}
