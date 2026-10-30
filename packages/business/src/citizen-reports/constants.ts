export const HAZARD_KINDS = [
	"inundacion",
	"huayco",
	"deslizamiento",
	"colapso-drenaje",
	"erosion-defensa",
	"otro",
] as const;

export const REPORT_PRIORITIES = ["critica", "alta", "media", "baja"] as const;

export const PLAN_SOURCES = ["bedrock", "plantilla"] as const;

export const PHOTO_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export const PIURA_BOUNDS = {
	west: -81.4,
	east: -79.1,
	south: -6.4,
	north: -4.0,
};

export const REPORT_DESCRIPTION_MIN_CHARS = 10;
export const REPORT_DESCRIPTION_MAX_CHARS = 600;
export const PHOTO_MAX_BYTES = 600 * 1024;

export const SAME_HAZARD_BUMP_RADIUS_M = 500;
export const PLAN_CONTEXT_RADIUS_M = 2000;
export const PLAN_CONTEXT_MAX_REPORTS = 10;

export const PLAN_SITUATION_MAX_CHARS = 400;
export const PLAN_POPULATION_MESSAGE_MAX_CHARS = 280;
export const PLAN_ITEM_MAX_CHARS = 200;
export const PLAN_MIN_ACTIONS = 3;
export const PLAN_MAX_ACTIONS = 6;
export const PLAN_MAX_LIST_ITEMS = 8;
