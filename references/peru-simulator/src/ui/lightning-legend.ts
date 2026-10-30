import { formatUtcClock, lightningAgeStyle, LIGHTNING_PULSE_S, type LightningData } from '../domain/lightning';

export const LIGHTNING_LEGEND_TITLE = 'Lightning — GOES-19 GLM';

export interface LightningLegend {
  readonly element: HTMLElement;
  update(data: LightningData | null): void;
}

/** Observed lightning legend: own "Last N min" window label (not the forecast timeline), age ramp. */
export function createLightningLegend(): LightningLegend {
  const element = document.createElement('section');
  element.className = 'panel legend lightning-legend';
  element.setAttribute('aria-label', 'Lightning legend');
  element.hidden = true;
  const heading = document.createElement('div');
  heading.className = 'legend-title';
  const badge = document.createElement('span');
  badge.className = 'badge observed';
  badge.textContent = 'Observed';
  heading.append(LIGHTNING_LEGEND_TITLE, ' ', badge);
  const windowLabel = document.createElement('div');
  windowLabel.className = 'legend-window';
  const bar = document.createElement('div');
  bar.className = 'legend-bar';
  const ticks = document.createElement('div');
  ticks.className = 'legend-ticks';
  const note = document.createElement('div');
  note.className = 'legend-note';
  note.textContent = `Observed flashes, not a forecast. Regional view: flashes per cell; zoom in for single flashes. Rings: last ${LIGHTNING_PULSE_S / 60} min.`;
  element.append(heading, windowLabel, bar, ticks, note);
  let shownMinutes = 0;

  function setScale(minutes: number): void {
    if (minutes === shownMinutes) return;
    shownMinutes = minutes;
    const w = minutes * 60;
    const stops = [0, 0.05, 0.17, 0.5, 1].map((f) => {
      const s = lightningAgeStyle(f * w, w);
      return `rgba(${s.rgb.join(', ')}, ${s.alpha.toFixed(2)}) ${(f * 100).toFixed(0)}%`;
    });
    bar.style.background = `linear-gradient(to right, ${stops.join(', ')}), #2a2f36`;
    ticks.replaceChildren(
      ...[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const t = document.createElement('span');
        t.style.left = `${f * 100}%`;
        t.textContent = f === 0 ? 'now' : `${Math.round(f * minutes)} min`;
        return t;
      }),
    );
  }

  return {
    element,
    update(data) {
      if (!data) {
        windowLabel.textContent = 'Waiting for GLM data…';
        return;
      }
      setScale(data.windowMinutes);
      const until = data.obsTime === null ? '' : ` · until ${formatUtcClock(data.obsTime)}`;
      const partial =
        data.coverageStart !== null && data.coverageStart > data.windowEnd - data.windowMinutes * 60_000 + 60_000
          ? ` (collected since ${formatUtcClock(data.coverageStart)})`
          : '';
      const count =
        data.count === 0
          ? `No flashes in the last ${data.windowMinutes} min over the Peru area`
          : `${data.count.toLocaleString('en-US')} flashes`;
      const text = `Last ${data.windowMinutes} min${until}${partial} · ${count}`;
      if (windowLabel.textContent !== text) windowLabel.textContent = text;
    },
  };
}
