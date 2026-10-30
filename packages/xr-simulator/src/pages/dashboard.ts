import "./app.css";
import "./dashboard.css";
import { chartPolyline, formatClock } from "../dashboard/chart";
import {
	CHART_HEIGHT,
	CHART_WIDTH,
	EVENT_GRID_RESOLUTION,
	EVENT_VIEW_BETA_RAD,
	EVENT_VIEW_RADIUS_KM,
	FLOW_COLORS,
	PLAYBACK_SPEEDS,
	RECORD_INTERVAL_S,
} from "../dashboard/constants";
import {
	DISASTER_EVENTS,
	DISASTER_PRESETS,
	type DisasterEvent,
} from "../dashboard/events";
import { FlowLayer } from "../dashboard/FlowLayer";
import { type EventFrame, frameAt } from "../dashboard/simulation";
import type {
	SimulationMessage,
	SimulationRequest,
} from "../dashboard/simulation.worker";
import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LON_AT_EQUATOR,
} from "../map/objects/constants";
import { INEI_API_BASE, MINAM_API_BASE } from "../map/objects/sources";
import { fetchLocalGrid } from "../map/peruTerrain";
import { TilesClient } from "../map/tilesClient";
import { syncRangeFill } from "../ui/web/mayu";
import { createXrViewer } from "../viewer/createXrViewer";

type ChartMetric = "affectedAreaHa" | "maxSpeed";

interface Selection {
	event: DisasterEvent;
	frames: EventFrame[];
	duration: number;
	done: boolean;
	worker: Worker | null;
	flow: FlowLayer | null;
	shownFrame: EventFrame | null;
}

function element<Found extends Element>(selector: string): Found {
	const found = document.querySelector<Found>(selector);
	if (!found) throw new Error(`Falta el elemento ${selector}`);
	return found;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const numberFormat = new Intl.NumberFormat("es-PE", {
	maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("es-PE", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Lima",
});

const eventList = element<HTMLUListElement>(".dash-event-list");
const mapElement = element<HTMLElement>(".dash-map");
const cardKind = element<HTMLElement>(".dash-card-kind");
const cardTitle = element<HTMLElement>(".dash-card-title");
const cardFacts = element<HTMLElement>(".dash-card-facts");
const cardStatus = element<HTMLElement>(".dash-card-status");
const playButton = element<HTMLButtonElement>(".dash-play");
const scrub = element<HTMLInputElement>(".dash-scrub");
const clock = element<HTMLElement>(".dash-clock");
const speedSelect = element<HTMLSelectElement>(".dash-speed select");

const tiles = new TilesClient();
const handle = createXrViewer(mapElement, {
	objectSources: { ineiBaseUrl: INEI_API_BASE, minamBaseUrl: MINAM_API_BASE },
});

let selection: Selection | null = null;
let playbackTime = 0;
let playing = true;
let speed: number = PLAYBACK_SPEEDS[0];

for (const option of PLAYBACK_SPEEDS)
	speedSelect.append(new Option(`${option}×`, String(option)));
speedSelect.onchange = () => {
	speed = Number(speedSelect.value);
};

const charts = [...document.querySelectorAll<HTMLElement>(".dash-chart")].map(
	(figure) => {
		const svg = document.createElementNS(SVG_NAMESPACE, "svg");
		svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
		svg.setAttribute("preserveAspectRatio", "none");
		svg.setAttribute("role", "img");
		const line = document.createElementNS(SVG_NAMESPACE, "polyline");
		line.classList.add("dash-chart-line");
		const cursor = document.createElementNS(SVG_NAMESPACE, "line");
		cursor.classList.add("dash-chart-cursor");
		cursor.setAttribute("y1", "0");
		cursor.setAttribute("y2", String(CHART_HEIGHT));
		svg.append(line, cursor);
		const axis = document.createElement("div");
		axis.className = "dash-chart-axis";
		const tooltip = document.createElement("div");
		tooltip.className = "dash-chart-tooltip";
		tooltip.hidden = true;
		figure.append(svg, axis, tooltip);
		const metric: ChartMetric =
			figure.dataset.metric === "maxSpeed" ? "maxSpeed" : "affectedAreaHa";
		const chart = {
			metric,
			unit: figure.dataset.unit ?? "",
			svg,
			line,
			cursor,
			axis,
			tooltip,
			value: figure.querySelector<HTMLElement>(".dash-chart-value"),
		};
		const timeAtPointer = (pointer: PointerEvent) => {
			const box = svg.getBoundingClientRect();
			return (
				((pointer.clientX - box.left) / box.width) * (selection?.duration ?? 0)
			);
		};
		svg.onpointermove = (pointer) => {
			if (!selection?.frames.length) return;
			const frame = frameAt(selection.frames, timeAtPointer(pointer));
			tooltip.hidden = false;
			tooltip.textContent = `${formatClock(frame.time)} · ${numberFormat.format(frame[metric])} ${chart.unit}`;
			tooltip.style.left = `${pointer.clientX - figure.getBoundingClientRect().left}px`;
		};
		svg.onpointerleave = () => {
			tooltip.hidden = true;
		};
		svg.onclick = (pointer) => seek(timeAtPointer(pointer));
		return chart;
	},
);

function seek(time: number): void {
	if (!selection?.frames.length) return;
	playbackTime = Math.max(
		0,
		Math.min(time, selection.frames[selection.frames.length - 1].time),
	);
}

function setPlaying(next: boolean): void {
	playing = next;
	playButton.textContent = next ? "Pausar" : "Reproducir";
	playButton.setAttribute("aria-label", playButton.textContent);
}

playButton.onclick = () => {
	if (
		selection &&
		!playing &&
		selection.done &&
		playbackTime >= selection.duration
	)
		playbackTime = 0;
	setPlaying(!playing);
};
scrub.oninput = () => seek(Number(scrub.value));

function fact(label: string, value: string, metric?: ChartMetric): void {
	const term = document.createElement("dt");
	term.textContent = label;
	const detail = document.createElement("dd");
	detail.textContent = value;
	if (metric) detail.dataset.metric = metric;
	cardFacts.append(term, detail);
}

function renderCard(event: DisasterEvent): void {
	const preset = DISASTER_PRESETS[event.kind];
	cardKind.textContent = preset.label;
	cardKind.dataset.kind = event.kind;
	cardTitle.textContent = event.name;
	cardFacts.replaceChildren();
	fact("Lugar", `${event.place}, ${event.region}`);
	fact("Inicio", dateFormat.format(new Date(event.startedAt)));
	fact("Lluvia acumulada", `${numberFormat.format(event.rainfallMm)} mm`);
	fact("Volumen liberado", `${numberFormat.format(preset.volumeM3)} m³`);
	fact("Área afectada", "—", "affectedAreaHa");
	fact("Velocidad máxima", "—", "maxSpeed");
}

function renderFrameFacts(frame: EventFrame): void {
	for (const detail of cardFacts.querySelectorAll<HTMLElement>(
		"dd[data-metric]",
	)) {
		const metric: ChartMetric =
			detail.dataset.metric === "maxSpeed" ? "maxSpeed" : "affectedAreaHa";
		detail.textContent = `${numberFormat.format(frame[metric])} ${metric === "maxSpeed" ? "m/s" : "ha"}`;
	}
}

function renderCharts(current: Selection): void {
	for (const chart of charts) {
		const points = current.frames.map((frame) => ({
			time: frame.time,
			value: frame[chart.metric],
		}));
		const maxValue = Math.max(0, ...points.map((point) => point.value));
		chart.line.setAttribute(
			"points",
			chartPolyline(
				points,
				current.duration,
				maxValue,
				CHART_WIDTH,
				CHART_HEIGHT,
			),
		);
		chart.axis.textContent = `máx. ${numberFormat.format(maxValue)} ${chart.unit}`;
	}
}

async function selectEvent(event: DisasterEvent): Promise<void> {
	if (selection) {
		selection.worker?.terminate();
		if (selection.flow) handle.viewer.overview?.removeOverlay(selection.flow);
	}
	const preset = DISASTER_PRESETS[event.kind];
	const current: Selection = {
		event,
		frames: [],
		duration: preset.durationS,
		done: false,
		worker: null,
		flow: null,
		shownFrame: null,
	};
	selection = current;
	playbackTime = 0;
	setPlaying(true);
	scrub.max = String(current.duration);
	scrub.step = String(RECORD_INTERVAL_S);
	document.documentElement.dataset.kind = event.kind;
	for (const item of eventList.querySelectorAll<HTMLButtonElement>("button"))
		item.setAttribute("aria-current", String(item.dataset.id === event.id));
	renderCard(event);
	renderCharts(current);
	cardStatus.textContent = "Cargando el terreno…";
	try {
		await handle.ready;
		const overview = handle.viewer.overview;
		if (!overview) throw new Error("El mapa del Perú no está disponible");
		const grid = await fetchLocalGrid(
			tiles,
			event.center.lon,
			event.center.lat,
			EVENT_GRID_RESOLUTION,
		);
		if (selection !== current) return;
		// Aim between the release and the town, from the town's side: the flow runs towards the camera.
		const target = {
			lon: (event.center.lon + event.release.lon) / 2,
			lat: (event.center.lat + event.release.lat) / 2,
		};
		const span = grid.resolution * grid.cellSize;
		const column = Math.floor(
			((target.lon - event.center.lon) *
				METERS_PER_DEGREE_LON_AT_EQUATOR *
				Math.cos((event.center.lat * Math.PI) / 180) +
				span / 2) /
				grid.cellSize,
		);
		const row = Math.floor(
			((target.lat - event.center.lat) * METERS_PER_DEGREE_LAT + span / 2) /
				grid.cellSize,
		);
		overview.focusOn(
			{ ...target, elevationM: grid.heights[row * grid.resolution + column] },
			event.center,
			EVENT_VIEW_RADIUS_KM,
			EVENT_VIEW_BETA_RAD,
		);
		current.flow = overview.addOverlay(
			(context) =>
				new FlowLayer(
					context,
					{
						center: event.center,
						resolution: grid.resolution,
						cellSize: grid.cellSize,
					},
					FLOW_COLORS[event.kind],
				),
		);
		const worker = new Worker(
			new URL("../dashboard/simulation.worker.ts", import.meta.url),
			{
				type: "module",
			},
		);
		current.worker = worker;
		worker.onmessage = ({ data }: MessageEvent<SimulationMessage>) => {
			if (data.type === "frame") {
				current.frames.push(data.frame);
				cardStatus.textContent = `Simulando… ${Math.round((data.frame.time / current.duration) * 100)} %`;
				renderCharts(current);
			} else if (data.type === "done") {
				current.done = true;
				cardStatus.textContent = "Simulación completa";
				worker.terminate();
			} else {
				cardStatus.textContent = `No se pudo simular: ${data.message}`;
				worker.terminate();
			}
		};
		const request: SimulationRequest = { event, grid };
		worker.postMessage(request, [grid.heights.buffer]);
	} catch (error) {
		if (selection === current)
			cardStatus.textContent = `No se pudo cargar el evento: ${String(error)}`;
	}
}

for (const event of DISASTER_EVENTS) {
	const item = document.createElement("li");
	const button = document.createElement("button");
	button.type = "button";
	button.dataset.id = event.id;
	button.dataset.kind = event.kind;
	const kind = document.createElement("span");
	kind.className = "dash-event-kind";
	kind.textContent = DISASTER_PRESETS[event.kind].label;
	const name = document.createElement("strong");
	name.textContent = event.name;
	const place = document.createElement("span");
	place.className = "dash-event-place";
	place.textContent = `${event.place}, ${event.region} · ${dateFormat.format(new Date(event.startedAt))}`;
	button.append(kind, name, place);
	button.onclick = () => void selectEvent(event);
	item.append(button);
	eventList.append(item);
}

let lastTick = performance.now();
function tick(now: number): void {
	const elapsedSeconds = (now - lastTick) / 1000;
	lastTick = now;
	const current = selection;
	if (current?.frames.length) {
		const latest = current.frames[current.frames.length - 1].time;
		if (playing)
			playbackTime = Math.min(playbackTime + elapsedSeconds * speed, latest);
		if (playing && current.done && playbackTime >= current.duration)
			setPlaying(false);
		const frame = frameAt(current.frames, playbackTime);
		if (frame !== current.shownFrame && current.flow) {
			current.shownFrame = frame;
			current.flow.setDepth(frame.depth);
			renderFrameFacts(frame);
			for (const chart of charts)
				chart.value?.replaceChildren(
					`${numberFormat.format(frame[chart.metric])} ${chart.unit}`,
				);
		}
		const cursorX = String((playbackTime / current.duration) * CHART_WIDTH);
		for (const chart of charts) {
			chart.cursor.setAttribute("x1", cursorX);
			chart.cursor.setAttribute("x2", cursorX);
		}
		scrub.value = String(playbackTime);
		syncRangeFill(scrub);
		clock.textContent = `${formatClock(playbackTime)} / ${formatClock(current.duration)}`;
	}
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

handle.ready
	.then(() => {
		// Debug/verification hooks of the standalone page only.
		Object.assign(window, {
			__app: { viewer: handle.viewer, overview: handle.viewer.overview },
		});
	})
	.catch((error: unknown) => {
		cardStatus.textContent = `No se pudo iniciar el mapa: ${String(error)}`;
	});

void selectEvent(DISASTER_EVENTS[0]);
