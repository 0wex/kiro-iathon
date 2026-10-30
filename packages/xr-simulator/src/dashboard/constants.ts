/** Cells per side of an event's simulation grid; at the native z11 spacing (~37 m) it spans ~4.7 km. */
export const EVENT_GRID_RESOLUTION = 128;
/** Simulated seconds between recorded frames. */
export const RECORD_INTERVAL_S = 10;
/** Flow shallower than this does not count as affected ground (nor for the speed chart). */
export const AFFECTED_DEPTH_M = 0.1;
/** CFL-limited steps allowed per recorded interval; high enough to never fall behind. */
export const MAX_SUBSTEPS_PER_INTERVAL = 100_000;
export const SQUARE_METERS_PER_HECTARE = 10_000;
