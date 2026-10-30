import { forecastLabel, formatUtc, type TimeEntry } from '../domain/timeline';

export interface TimelineHandlers {
  onSelect(index: number): void;
  onPlayToggle(): void;
}

export interface TimelineBar {
  readonly element: HTMLElement;
  setTimes(times: readonly TimeEntry[], issueTime: number | null): void;
  setIndex(index: number): void;
  setPlaying(playing: boolean): void;
  setVisible(visible: boolean): void;
}

/** Forecast time controls: play/pause, slider over valid times, UTC and lead-time labels. */
export function createTimelineBar(handlers: TimelineHandlers): TimelineBar {
  const element = document.createElement('section');
  element.className = 'panel timeline';
  element.setAttribute('aria-label', 'Forecast time');
  element.hidden = true;

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'play';
  play.addEventListener('click', () => handlers.onPlayToggle());

  const body = document.createElement('div');
  body.className = 'timeline-body';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Forecast valid time');
  slider.addEventListener('input', () => handlers.onSelect(Number(slider.value)));
  const valid = document.createElement('div');
  valid.className = 'timeline-valid';
  const lead = document.createElement('div');
  lead.className = 'hint timeline-lead';
  body.append(valid, slider, lead);
  element.append(play, body);

  let times: readonly TimeEntry[] = [];
  let issue: number | null = null;
  let index = -1;
  const render = () => {
    const t = times[index];
    valid.textContent = t ? `Valid ${formatUtc(t.validTime)}` : 'No forecast times';
    lead.textContent = t && issue !== null ? forecastLabel(t.validTime, issue) : '';
  };
  const setPlaying = (playing: boolean) => {
    play.textContent = playing ? '❚❚' : '▶';
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  setPlaying(false);

  return {
    element,
    setTimes: (t, issueTime) => {
      times = t;
      issue = issueTime;
      slider.max = String(Math.max(0, t.length - 1));
      slider.disabled = t.length < 2;
      play.disabled = t.length < 2;
      render();
    },
    setIndex: (i) => {
      index = i;
      slider.value = String(Math.max(0, i));
      render();
    },
    setPlaying,
    setVisible: (visible) => {
      element.hidden = !visible;
    },
  };
}
