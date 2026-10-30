import { CAPE_CATEGORIES, CAPE_LEGEND_NOTE, CAPE_LEGEND_TITLE } from '../domain/cape';

/** CSS hatching swatch matching the terrain shader's CAPE category look. */
export function capeSwatchCss(color: readonly number[], fill: number, hatchPx: number): string {
  const rgb = color.join(', ');
  const line = `rgba(${rgb}, 0.95)`;
  const bg = `rgba(${rgb}, ${fill})`;
  return `repeating-linear-gradient(-45deg, ${line} 0 1.6px, ${bg} 1.6px ${(hatchPx / Math.SQRT2).toFixed(2)}px)`;
}

/** Legend of the convective potential layer: FORECAST badge, three hatched categories, "not observed" note. */
export function createCapeLegend(): HTMLElement {
  const element = document.createElement('section');
  element.className = 'panel legend cape-legend';
  element.setAttribute('aria-label', 'Convective potential legend');
  element.hidden = true;
  const heading = document.createElement('div');
  heading.className = 'legend-title';
  const badge = document.createElement('span');
  badge.className = 'badge forecast';
  badge.textContent = 'Forecast';
  heading.append(CAPE_LEGEND_TITLE, ' ', badge);
  const list = document.createElement('div');
  list.className = 'legend-swatches';
  CAPE_CATEGORIES.forEach((c, i) => {
    const next = CAPE_CATEGORIES[i + 1];
    const item = document.createElement('span');
    const sw = document.createElement('i');
    sw.className = 'swatch';
    sw.style.background = capeSwatchCss(c.color, c.fill, c.hatchPx);
    item.append(sw, `${c.label} ${next ? `${c.min}–${next.min}` : `≥ ${c.min}`}`);
    list.append(item);
  });
  const note = document.createElement('div');
  note.className = 'legend-note';
  note.textContent = CAPE_LEGEND_NOTE;
  element.append(heading, list, note);
  return element;
}
