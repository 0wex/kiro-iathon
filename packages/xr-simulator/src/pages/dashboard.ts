import "./app.css";
import "./dashboard.css";
import {
	CONFIRMED_AFTER_REPORTS,
	EVENT_VIEW_BETA_RAD,
	EVENT_VIEW_RADIUS_KM,
	FEED_MAX_ITEMS,
	FIRST_REPORT_DELAY_S,
	RELATIVE_TIME_REFRESH_MS,
} from "../dashboard/constants";
import { EventMarkers } from "../dashboard/EventMarkers";
import {
	DISASTER_EVENTS,
	DISASTER_KIND_LABELS,
	type DisasterEvent,
} from "../dashboard/events";
import { type EventReport, formatAgo, ReportFeed } from "../dashboard/reports";
import { createRandom, hashText } from "../map/objects/placement";
import { INEI_API_BASE, MINAM_API_BASE } from "../map/objects/sources";
import { fetchLocalGrid } from "../map/peruTerrain";
import { TilesClient } from "../map/tilesClient";
import { createXrViewer } from "../viewer/createXrViewer";

function element<Found extends Element>(selector: string): Found {
	const found = document.querySelector<Found>(selector);
	if (!found) throw new Error(`Falta el elemento ${selector}`);
	return found;
}

const numberFormat = new Intl.NumberFormat("es-PE", {
	maximumFractionDigits: 4,
});
const dateFormat = new Intl.DateTimeFormat("es-PE", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Lima",
});
const STATUS_LABELS = {
	reportado: "Reportado",
	confirmado: "Confirmado",
} as const;

const eventList = element<HTMLUListElement>(".dash-event-list");
const waiting = element<HTMLElement>(".dash-waiting");
const mapElement = element<HTMLElement>(".dash-map");
const cardEmpty = element<HTMLElement>(".dash-card-empty");
const cardBody = element<HTMLElement>(".dash-card-body");
const cardKind = element<HTMLElement>(".dash-card-kind");
const cardTitle = element<HTMLElement>(".dash-card-title");
const cardFacts = element<HTMLElement>(".dash-card-facts");
const feedList = element<HTMLOListElement>(".dash-feed-list");

const handle = createXrViewer(mapElement, {
	objectSources: { ineiBaseUrl: INEI_API_BASE, minamBaseUrl: MINAM_API_BASE },
});
const tiles = new TilesClient();
const feed = new ReportFeed(
	DISASTER_EVENTS,
	createRandom(hashText(String(Date.now()))),
);
/** Latest report per event: its status, count and time. */
const latestReports = new Map<string, EventReport>();
let markers: EventMarkers | null = null;
let selectedId: string | null = null;

const secondsNow = () => performance.now() / 1000;

/** A "hace 12 s" label that the periodic refresh keeps current. */
function agoLabel(receivedAt: number): HTMLElement {
	const label = document.createElement("time");
	label.className = "dash-ago";
	label.dataset.receivedAt = String(receivedAt);
	label.textContent = formatAgo(secondsNow() - receivedAt);
	return label;
}

function eventById(eventId: string): DisasterEvent {
	const event = DISASTER_EVENTS.find((candidate) => candidate.id === eventId);
	if (!event) throw new Error(`Evento desconocido: ${eventId}`);
	return event;
}

function fact(label: string, value: string | HTMLElement): void {
	const term = document.createElement("dt");
	term.textContent = label;
	const detail = document.createElement("dd");
	detail.append(value);
	cardFacts.append(term, detail);
}

function renderCard(event: DisasterEvent): void {
	const latest = latestReports.get(event.id);
	cardEmpty.hidden = true;
	cardBody.hidden = false;
	cardKind.textContent = DISASTER_KIND_LABELS[event.kind];
	cardKind.dataset.kind = event.kind;
	cardTitle.textContent = event.name;
	cardFacts.replaceChildren();
	if (latest) {
		fact("Estado", STATUS_LABELS[latest.status]);
		fact("Reportes", String(latest.sequence));
		fact("Último reporte", agoLabel(latest.receivedAt));
	}
	fact("Lugar", `${event.place}, ${event.region}`);
	fact("Inicio", dateFormat.format(new Date(event.startedAt)));
	fact("Lluvia acumulada", `${numberFormat.format(event.rainfallMm)} mm`);
	fact(
		"Coordenadas",
		`${numberFormat.format(event.location.lat)}, ${numberFormat.format(event.location.lon)}`,
	);
}

async function selectEvent(event: DisasterEvent): Promise<void> {
	selectedId = event.id;
	renderList();
	markers?.setSelected(event.id);
	renderCard(event);
	// The overview's coarse relief misplaces valleys by hundreds of metres: read the real ground.
	const ground = await fetchLocalGrid(
		tiles,
		event.location.lon,
		event.location.lat,
		2,
	);
	if (selectedId !== event.id) return;
	handle.viewer.overview?.focusOn(
		{ ...event.location, elevationM: ground.heights[0] },
		EVENT_VIEW_RADIUS_KM,
		EVENT_VIEW_BETA_RAD,
	);
}

/** Reported events, the most recently reported first. */
function renderList(freshEventId?: string): void {
	const reported = [...latestReports.values()].sort(
		(first, second) => second.receivedAt - first.receivedAt,
	);
	waiting.hidden = reported.length > 0;
	eventList.replaceChildren(
		...reported.map((latest) => {
			const event = eventById(latest.eventId);
			const item = document.createElement("li");
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.id = event.id;
			button.dataset.kind = event.kind;
			button.setAttribute("aria-current", String(event.id === selectedId));
			if (event.id === freshEventId) button.classList.add("dash-fresh");
			const kind = document.createElement("span");
			kind.className = "dash-event-kind";
			kind.textContent = DISASTER_KIND_LABELS[event.kind];
			const status = document.createElement("span");
			status.className = "dash-status";
			status.dataset.status = latest.status;
			status.textContent = STATUS_LABELS[latest.status];
			kind.append(status);
			const name = document.createElement("strong");
			name.textContent = event.name;
			const place = document.createElement("span");
			place.className = "dash-event-place";
			place.append(
				`${event.place}, ${event.region} · ${latest.sequence} ${latest.sequence === 1 ? "reporte" : "reportes"} · `,
				agoLabel(latest.receivedAt),
			);
			button.append(kind, name, place);
			button.onclick = () => void selectEvent(event);
			item.append(button);
			return item;
		}),
	);
}

function feedText(report: EventReport, event: DisasterEvent): string {
	const subject = `${DISASTER_KIND_LABELS[event.kind]} en ${event.place}`;
	if (report.sequence === 1) return `Primer reporte: ${subject}`;
	if (report.sequence === CONFIRMED_AFTER_REPORTS)
		return `Confirmado: ${subject}`;
	return `Nuevo reporte (n.º ${report.sequence}): ${subject}`;
}

function addToFeed(report: EventReport): void {
	const event = eventById(report.eventId);
	const item = document.createElement("li");
	const button = document.createElement("button");
	button.type = "button";
	button.dataset.kind = event.kind;
	const text = document.createElement("span");
	text.textContent = feedText(report, event);
	button.append(text, agoLabel(report.receivedAt));
	button.onclick = () => void selectEvent(event);
	item.append(button);
	feedList.prepend(item);
	while (feedList.children.length > FEED_MAX_ITEMS)
		feedList.lastElementChild?.remove();
}

function receiveReport(): void {
	const report = feed.next(secondsNow());
	latestReports.set(report.eventId, report);
	markers?.report(report);
	addToFeed(report);
	renderList(report.eventId);
	if (report.eventId === selectedId) renderCard(eventById(report.eventId));
	setTimeout(receiveReport, feed.nextDelayS() * 1000);
}

setInterval(() => {
	for (const label of document.querySelectorAll<HTMLElement>(".dash-ago"))
		label.textContent = formatAgo(
			secondsNow() - Number(label.dataset.receivedAt),
		);
}, RELATIVE_TIME_REFRESH_MS);

handle.ready
	.then(() => {
		const overview = handle.viewer.overview;
		if (!overview) throw new Error("El mapa del Perú no está disponible");
		markers = overview.addOverlay(
			(context) =>
				new EventMarkers(
					context,
					mapElement,
					DISASTER_EVENTS,
					(event) => void selectEvent(event),
				),
		);
		// Reports start once the map can show them.
		setTimeout(receiveReport, FIRST_REPORT_DELAY_S * 1000);
		// Debug/verification hooks of the standalone page only.
		Object.assign(window, { __app: { viewer: handle.viewer, overview } });
	})
	.catch((error: unknown) => {
		cardEmpty.textContent = `No se pudo iniciar el mapa: ${String(error)}`;
	});
