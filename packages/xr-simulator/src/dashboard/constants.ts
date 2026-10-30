/** Cells per side of an event's simulation grid; at the native z11 spacing (~37 m) it spans ~4.7 km. */
export const EVENT_GRID_RESOLUTION = 128;
/** Simulated seconds between recorded frames. */
export const RECORD_INTERVAL_S = 10;
/** Flow shallower than this does not count as affected ground (nor for the speed chart). */
export const AFFECTED_DEPTH_M = 0.1;
/** CFL-limited steps allowed per recorded interval; high enough to never fall behind. */
export const MAX_SUBSTEPS_PER_INTERVAL = 100_000;
export const SQUARE_METERS_PER_HECTARE = 10_000;

/** Flow colours per kind of event, shallow → deep: saturated so they stand out on bare relief. */
export const FLOW_COLORS = {
	huayco: { shallow: "#ffb347", deep: "#c2410c" },
	inundacion: { shallow: "#7dd3fc", deep: "#1d4ed8" },
	deslizamiento: { shallow: "#fde68a", deep: "#a16207" },
} as const;
/** Depth at which the flow takes its deepest colour. */
export const FLOW_FULL_COLOR_DEPTH_M = 3;
/** Opacity of the shallowest drawn flow; it grows to 1 at the full-colour depth. */
export const FLOW_MIN_ALPHA = 0.65;
/** The flow surface floats this far above the relief so it never sinks into it. */
export const FLOW_LIFT_M = 4;
/** How often the flow re-reads the drawn relief, which refines as tiles load. */
export const FLOW_RELIEF_REFRESH_MS = 1_000;

/** Simulated seconds played per real second, offered on the timeline; the first is the default. */
export const PLAYBACK_SPEEDS = [30, 60, 120, 10] as const;
/** Camera distance (km) and tilt from the vertical (rad) when flying to an event. */
export const EVENT_VIEW_RADIUS_KM = 3.5;
export const EVENT_VIEW_BETA_RAD = 1.05;
/** Chart drawing box, in SVG units (the SVG stretches to its card). */
export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 80;
