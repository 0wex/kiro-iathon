/** Camera distance (km) and tilt from the vertical (rad) when flying to an event: close enough for houses. */
export const EVENT_VIEW_RADIUS_KM = 5;
export const EVENT_VIEW_BETA_RAD = 1.05;

/** Example live feed: seconds before the first report, then between reports. */
export const FIRST_REPORT_DELAY_S = 1.5;
export const REPORT_MIN_DELAY_S = 3;
export const REPORT_MAX_DELAY_S = 9;
/** An event counts as confirmed from this report on. */
export const CONFIRMED_AFTER_REPORTS = 3;
/** Reports kept in the live panel. */
export const FEED_MAX_ITEMS = 8;
/** How often "hace 12 s" labels refresh. */
export const RELATIVE_TIME_REFRESH_MS = 1_000;
