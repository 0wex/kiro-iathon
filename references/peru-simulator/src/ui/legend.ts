import { cssGradient, legendTicks, paletteRange, type Palette } from '../domain/palette';

/** Color scale legend for a draped scalar layer. */
export function createLegend(title: string, palette: Palette, units: string, step: number): HTMLElement {
  const element = document.createElement('section');
  element.className = 'panel legend';
  element.setAttribute('aria-label', `${title} legend`);
  element.hidden = true;
  const heading = document.createElement('div');
  heading.className = 'legend-title';
  heading.textContent = `${title} (${units})`;
  const bar = document.createElement('div');
  bar.className = 'legend-bar';
  bar.style.background = cssGradient(palette);
  const ticks = document.createElement('div');
  ticks.className = 'legend-ticks';
  const [min, max] = paletteRange(palette);
  for (const v of legendTicks(min, max, step)) {
    const t = document.createElement('span');
    t.style.left = `${((v - min) / (max - min)) * 100}%`;
    t.textContent = String(v);
    ticks.append(t);
  }
  element.append(heading, bar, ticks);
  return element;
}
