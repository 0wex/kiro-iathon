/** Below this elevation a block counts as coast (Lima to Chosica); above it, highland. */
export const COAST_MAX_ELEVATION_M = 1800;
/** Above this elevation the thorny shrub gives way to tola (puna). */
export const PUNA_MIN_ELEVATION_M = 3600;

/** Distance between house slots along a block, in both directions. */
export const HOUSE_SPACING_M = 11;
/** Random shift of each house slot so rows do not look ruled. */
export const HOUSE_JITTER_M = 1.5;

/** Side of the vegetation sampling cell: at most one plant per cell. */
export const VEGETATION_CELL_M = 20;
/** Random shift of a plant inside its cell, as a fraction of the cell side. */
export const VEGETATION_JITTER_RATIO = 0.8;
/** Latitude strips per row of cells a plant can stand on, so rows don't read as ruled lines. */
export const VEGETATION_ROW_STRIPS = 4;

/** Equirectangular approximation of the Earth's metres per degree, good at block scale. */
export const METERS_PER_DEGREE_LAT = 110_540;
export const METERS_PER_DEGREE_LON_AT_EQUATOR = 111_320;

/** Web Mercator zoom of the object tiles (~2.4 km side in Peru): one WFS/REST request each. */
export const OBJECT_TILE_ZOOM = 14;
/** Objects only appear when the camera is at most this far from what it looks at. */
export const OBJECTS_MAX_VIEW_KM = 6;
/** Object tiles loaded around the point the camera looks at. */
export const OBJECTS_LOAD_RADIUS_KM = 3;
/** Placed tiles kept in memory, shown or not. */
export const OBJECT_TILE_CACHE_SIZE = 40;
/** How often the layer re-evaluates which tiles it needs. */
export const OBJECTS_UPDATE_INTERVAL_MS = 400;
/** Houses are left out of this radius around a town's plaza. */
export const PLAZA_CLEAR_RADIUS_M = 34;
/** The church stands on the plaza's east side, this far from its centre. */
export const CHURCH_OFFSET_M = 40;
