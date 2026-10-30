import { Matrix, Vector3 } from "@babylonjs/core";
import { worldToLocal } from "../map/lod/quadtree";
import type {
	OverviewOverlay,
	OverviewOverlayContext,
} from "../map/PeruOverview";
import { lonLatToWorld } from "../map/tileMath";
import { DISASTER_KIND_LABELS, type DisasterEvent } from "./events";
import type { EventReport } from "./reports";

interface Marker {
	event: DisasterEvent;
	button: HTMLButtonElement;
	/** Local (x, z) in the overview's kilometres. */
	x: number;
	z: number;
	/** Pins appear with the event's first report. */
	reported: boolean;
}

/**
 * One clickable pin per reported event over the map canvas: HTML buttons placed every frame
 * where the event's ground point projects, so they stay crisp and readable at any zoom.
 */
export class EventMarkers implements OverviewOverlay {
	private readonly markers: Marker[];
	private exaggeration = 1;
	private readonly ground = new Vector3();
	private readonly screen = new Vector3();

	constructor(
		private readonly context: OverviewOverlayContext,
		private readonly container: HTMLElement,
		events: DisasterEvent[],
		onSelect: (event: DisasterEvent) => void,
	) {
		this.markers = events.map((event) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "dash-marker";
			button.dataset.kind = event.kind;
			button.dataset.id = event.id;
			button.title = `${DISASTER_KIND_LABELS[event.kind]}: ${event.name} (${event.place})`;
			button.setAttribute("aria-label", button.title);
			button.onclick = () => onSelect(event);
			container.append(button);
			const world = lonLatToWorld(event.location.lon, event.location.lat);
			const [x, z] = worldToLocal(context.frame, world.x, world.y);
			return { event, button, x, z, reported: false };
		});
	}

	setExaggeration(exaggeration: number): void {
		this.exaggeration = exaggeration;
	}

	/** Shows the event's pin with its status and sends a ripple from it. */
	report(report: EventReport): void {
		const marker = this.markers.find(
			({ event }) => event.id === report.eventId,
		);
		if (!marker) return;
		marker.reported = true;
		marker.button.dataset.status = report.status;
		const ripple = document.createElement("span");
		ripple.className = "dash-marker-ripple";
		ripple.onanimationend = () => ripple.remove();
		marker.button.append(ripple);
	}

	setSelected(eventId: string | null): void {
		for (const { event, button } of this.markers)
			button.setAttribute("aria-pressed", String(event.id === eventId));
	}

	update(): void {
		const scene = this.context.scene;
		const camera = scene.activeCamera;
		if (!camera) return;
		const engine = scene.getEngine();
		const viewport = camera.viewport.toGlobal(
			engine.getRenderWidth(),
			engine.getRenderHeight(),
		);
		const cssPerRenderPixel =
			this.container.clientWidth / engine.getRenderWidth();
		const toWorld = this.context.parent.computeWorldMatrix(true);
		for (const marker of this.markers) {
			this.ground.set(
				marker.x,
				this.context.heightKm(marker.x, marker.z) * this.exaggeration,
				marker.z,
			);
			Vector3.TransformCoordinatesToRef(this.ground, toWorld, this.ground);
			Vector3.ProjectToRef(
				this.ground,
				Matrix.IdentityReadOnly,
				scene.getTransformMatrix(),
				viewport,
				this.screen,
			);
			// Behind the camera or past the far plane: the projection is meaningless.
			marker.button.hidden =
				!marker.reported || this.screen.z < 0 || this.screen.z > 1;
			marker.button.style.transform = `translate(${this.screen.x * cssPerRenderPixel}px, ${this.screen.y * cssPerRenderPixel}px)`;
		}
	}

	dispose(): void {
		for (const { button } of this.markers) button.remove();
	}
}
