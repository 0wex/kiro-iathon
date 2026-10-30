import { cssGradient } from '../domain/palette';
import { RAIN_INDEX_PALETTE, RAIN_MODES, RAIN_SCALES, rainLegendStops, type RainMode } from '../domain/rain';

export const RAIN_LEGEND_TITLE = 'Forecast precipitation — GFS';

export interface RainLegend {
  readonly element: HTMLElement;
  setMode(mode: RainMode): void;
}

/** Rain legend: forecast badge, rate / accumulation switch, intensity scale with threshold ticks. */
export function createRainLegend(onMode: (mode: RainMode) => void): RainLegend {
  const element = document.createElement('section');
  element.className = 'panel legend rain-legend';
  element.setAttribute('aria-label', `${RAIN_LEGEND_TITLE} legend`);
  element.hidden = true;

  const heading = document.createElement('div');
  heading.className = 'legend-title';
  const title = document.createElement('span');
  const badge = document.createElement('span');
  badge.className = 'badge forecast';
  badge.textContent = 'Forecast';
  heading.append(title, ' ', badge);

  const modes = document.createElement('div');
  modes.className = 'segmented legend-modes';
  modes.setAttribute('role', 'radiogroup');
  modes.setAttribute('aria-label', 'Precipitation display');
  const buttons = new Map<RainMode, HTMLButtonElement>();
  for (const mode of RAIN_MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = RAIN_SCALES[mode].label;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      setMode(mode);
      onMode(mode);
    });
    buttons.set(mode, b);
    modes.append(b);
  }

  const bar = document.createElement('div');
  bar.className = 'legend-bar rain-bar';
  bar.style.background = cssGradient(RAIN_INDEX_PALETTE);
  const ticks = document.createElement('div');
  ticks.className = 'legend-ticks';
  const note = document.createElement('div');
  note.className = 'legend-note';

  function setMode(mode: RainMode): void {
    const scale = RAIN_SCALES[mode];
    title.textContent = `${RAIN_LEGEND_TITLE} (${scale.units})`;
    for (const [m, b] of buttons) b.setAttribute('aria-checked', String(m === mode));
    ticks.replaceChildren(
      ...rainLegendStops(mode).map((s) => {
        const t = document.createElement('span');
        t.style.left = `${s.position * 100}%`;
        t.textContent = s.label;
        return t;
      }),
    );
    note.textContent =
      mode === 'rate'
        ? `Model forecast, not observed rain. Transparent below ${scale.thresholds[0]} mm/h; 3-h mean rate ending at the valid time.`
        : `Model forecast, not observed rain. Total since the GFS run start; transparent below ${scale.thresholds[0]} mm.`;
  }

  setMode('rate');
  element.append(heading, modes, bar, ticks, note);
  return { element, setMode };
}
