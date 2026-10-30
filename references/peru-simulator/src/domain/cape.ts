/**
 * Convective potential from the GFS surface-based CAPE forecast (J/kg).
 * Discrete categories, drawn hatched in violet/magenta so they are never
 * mistaken for rain (blue/green/yellow/red) or observed lightning (white/yellow).
 * The terrain shader embeds these values (rendering/terrain-material.ts).
 */
export interface CapeCategory {
  /** Lower bound in J/kg (inclusive). */
  readonly min: number;
  readonly label: string;
  /** RGB 0..255. */
  readonly color: readonly [number, number, number];
  /** Solid fill alpha between hatch lines. */
  readonly fill: number;
  /** Hatch line spacing in CSS pixels (screen space). */
  readonly hatchPx: number;
}

export const CAPE_CATEGORIES: readonly CapeCategory[] = [
  { min: 250, label: 'Marginal', color: [190, 160, 255], fill: 0.12, hatchPx: 11 },
  { min: 1000, label: 'Moderate', color: [160, 80, 245], fill: 0.26, hatchPx: 8 },
  { min: 2500, label: 'High', color: [235, 50, 215], fill: 0.4, hatchPx: 5 },
];

export const CAPE_LEGEND_TITLE = 'Convective potential (forecast) — GFS CAPE, J/kg';
export const CAPE_LEGEND_NOTE =
  'Potential, not observed storms: model instability (surface-based CAPE). Transparent below 250 J/kg.';

export function capeCategory(value: number): CapeCategory | null {
  if (!(value >= CAPE_CATEGORIES[0]!.min)) return null;
  let found = CAPE_CATEGORIES[0]!;
  for (const c of CAPE_CATEGORIES) if (value >= c.min) found = c;
  return found;
}

export function formatCape(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'No data here';
  const c = capeCategory(value);
  const v = Math.round(value).toLocaleString('en-US');
  return `${v} J/kg · ${c ? `${c.label.toLowerCase()} potential` : 'no significant potential'} (forecast)`;
}
