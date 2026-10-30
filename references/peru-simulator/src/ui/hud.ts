export interface HudStats {
  fps: number;
  visibleTiles: number;
  cachedHeights: number;
  cachedImagery: number;
  inFlight: number;
  queued: number;
  lat: number;
  lon: number;
  altitude: number;
  aboveGround: number | null;
  /** Cloud image scan time, or a short state such as "off" / "no data". */
  clouds: string;
}

const ROWS: [keyof HudStats, string][] = [
  ['fps', 'FPS'],
  ['visibleTiles', 'Visible tiles'],
  ['cachedHeights', 'Cached height'],
  ['cachedImagery', 'Cached imagery'],
  ['inFlight', 'In flight'],
  ['queued', 'Queued'],
  ['lat', 'Latitude'],
  ['lon', 'Longitude'],
  ['altitude', 'Altitude'],
  ['aboveGround', 'Above ground'],
  ['clouds', 'Clouds'],
];

function formatMeters(m: number): string {
  return Math.abs(m) >= 10_000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export class Hud {
  readonly element: HTMLElement;
  private readonly cells = new Map<keyof HudStats, HTMLElement>();

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'panel hud';
    this.element.setAttribute('aria-label', 'Statistics');
    const list = document.createElement('dl');
    for (const [key, label] of ROWS) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      list.append(dt, dd);
      this.cells.set(key, dd);
    }
    this.element.append(list);
  }

  update(s: HudStats): void {
    this.set('fps', s.fps.toFixed(0));
    this.set('visibleTiles', String(s.visibleTiles));
    this.set('cachedHeights', String(s.cachedHeights));
    this.set('cachedImagery', String(s.cachedImagery));
    this.set('inFlight', String(s.inFlight));
    this.set('queued', String(s.queued));
    this.set('lat', `${Math.abs(s.lat).toFixed(4)}° ${s.lat < 0 ? 'S' : 'N'}`);
    this.set('lon', `${Math.abs(s.lon).toFixed(4)}° ${s.lon < 0 ? 'W' : 'E'}`);
    this.set('altitude', formatMeters(s.altitude));
    this.set('aboveGround', s.aboveGround === null ? '—' : formatMeters(s.aboveGround));
    this.set('clouds', s.clouds);
  }

  private set(key: keyof HudStats, text: string): void {
    const cell = this.cells.get(key);
    if (cell && cell.textContent !== text) cell.textContent = text;
  }
}
