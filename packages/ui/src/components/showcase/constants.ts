export const COLOR_SAMPLE_SIZE_PX = 1;
export const RGB_CHANNEL_MAX = 255;
export const SRGB_LINEAR_THRESHOLD = 0.04045;
export const SRGB_LINEAR_DIVISOR = 12.92;
export const SRGB_OFFSET = 0.055;
export const SRGB_SCALE = 1.055;
export const SRGB_EXPONENT = 2.4;
export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;
export const CONTRAST_OFFSET = 0.05;
export const CONTRAST_AAA_RATIO = 7;
export const CONTRAST_AA_RATIO = 4.5;
export const CONTRAST_LARGE_RATIO = 3;
export const CONTRAST_DECIMAL_PLACES = 2;
export const HEX_RADIX = 16;
export const HEX_CHANNEL_LENGTH = 2;
export const ROUTE_STROKE_WIDTH_PX = 4;
export const ROUTE_VIEW_BOX = "0 0 640 160";
export const ROUTE_SEGMENTS = [
	{ points: "16,128 80,128 128,88 176,88", className: "stroke-risk-low" },
	{ points: "176,88 240,88 280,48 336,48", className: "stroke-risk-moderate" },
	{ points: "336,48 392,48 440,96 488,96", className: "stroke-risk-high" },
	{ points: "488,96 544,96 584,32 624,32", className: "stroke-risk-critical" },
];
