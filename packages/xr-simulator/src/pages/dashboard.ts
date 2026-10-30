import "./app.css";
import "./dashboard.css";
import {
	EVENT_VIEW_BETA_RAD,
	EVENT_VIEW_RADIUS_KM,
} from "../dashboard/constants";
import { EventMarkers } from "../dashboard/EventMarkers";
import {
	DISASTER_EVENTS,
	DISASTER_KIND_LABELS,
	type DisasterEvent,
} from "../dashboard/events";
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

const eventList = element<HTMLUListElement>(".dash-event-list");
const mapElement = element<HTMLElement>(".dash-map");
const cardEmpty = element<HTMLElement>(".dash-card-empty");
const cardBody = element<HTMLElement>(".dash-card-body");
const cardKind = element<HTMLElement>(".dash-card-kind");
const cardTitle = element<HTMLElement>(".dash-card-title");
const cardFacts = element<HTMLElement>(".dash-card-facts");

const handle = createXrViewer(mapElement, {
	objectSources: { ineiBaseUrl: INEI_API_BASE, minamBaseUrl: MINAM_API_BASE },
});
const tiles = new TilesClient();
let markers: EventMarkers | null = null;
let selectedId: string | null = null;

function fact(label: string, value: string): void {
	const term = document.createElement("dt");
	term.textContent = label;
	const detail = document.createElement("dd");
	detail.textContent = value;
	cardFacts.append(term, detail);
}

async function selectEvent(event: DisasterEvent): Promise<void> {
	selectedId = event.id;
	for (const item of eventList.querySelectorAll<HTMLButtonElement>("button"))
		item.setAttribute("aria-current", String(item.dataset.id === event.id));
	markers?.setSelected(event.id);
	cardEmpty.hidden = true;
	cardBody.hidden = false;
	cardKind.textContent = DISASTER_KIND_LABELS[event.kind];
	cardKind.dataset.kind = event.kind;
	cardTitle.textContent = event.name;
	cardFacts.replaceChildren();
	fact("Lugar", `${event.place}, ${event.region}`);
	fact("Inicio", dateFormat.format(new Date(event.startedAt)));
	fact("Lluvia acumulada", `${numberFormat.format(event.rainfallMm)} mm`);
	fact(
		"Coordenadas",
		`${numberFormat.format(event.location.lat)}, ${numberFormat.format(event.location.lon)}`,
	);
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

for (const event of DISASTER_EVENTS) {
	const item = document.createElement("li");
	const button = document.createElement("button");
	button.type = "button";
	button.dataset.id = event.id;
	button.dataset.kind = event.kind;
	const kind = document.createElement("span");
	kind.className = "dash-event-kind";
	kind.textContent = DISASTER_KIND_LABELS[event.kind];
	const name = document.createElement("strong");
	name.textContent = event.name;
	const place = document.createElement("span");
	place.className = "dash-event-place";
	place.textContent = `${event.place}, ${event.region} · ${dateFormat.format(new Date(event.startedAt))}`;
	button.append(kind, name, place);
	// Flying needs the map: until it is ready the list waits (buttons start disabled).
	button.disabled = true;
	button.onclick = () => void selectEvent(event);
	item.append(button);
	eventList.append(item);
}

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
		for (const button of eventList.querySelectorAll<HTMLButtonElement>(
			"button",
		))
			button.disabled = false;
		// Debug/verification hooks of the standalone page only.
		Object.assign(window, { __app: { viewer: handle.viewer, overview } });
	})
	.catch((error: unknown) => {
		cardEmpty.textContent = `No se pudo iniciar el mapa: ${String(error)}`;
	});
