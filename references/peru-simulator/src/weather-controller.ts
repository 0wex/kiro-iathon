import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { formatCape } from './domain/cape';
import { formatScanTime } from './domain/cloud-overlay';
import type { LayerCatalog, LayerProduct } from './domain/layer-catalog';
import type { LocalFrame } from './domain/local-frame';
import { formatAge, forecastLabel, formatUtc, mergeTimes, nearestIndex, stepIndex, type TimeEntry } from './domain/timeline';
import { sampleGridLonLat, type ScalarGrid } from './domain/weather-grid';
import {
  formatLightningReadout,
  formatUtcClock,
  LIGHTNING_READOUT_KM,
  lightningSummary,
  type LightningData,
} from './domain/lightning';
import { formatRain, sampleRainLonLat, type RainGrid, type RainMode } from './domain/rain';
import { formatWind, sampleWindLonLat, type WindGrid } from './domain/wind';
import { LAYER_DEFINITIONS, type LayerDefinition, type LayerId } from './domain/weather-layers';
import {
  CatalogFeed,
  fetchGrid,
  fetchLightning,
  fetchPoint,
  fetchRainGrid,
  fetchWindGrid,
  GridCache,
  LIGHTNING_POLL_MS,
  type PointValue,
} from './infrastructure/weather-api';
import type { CloudLayer } from './rendering/cloud-layer';
import { LightningLayer } from './rendering/lightning-layer';
import { RainDrape } from './rendering/rain-drape';
import { ScalarDrape } from './rendering/scalar-drape';
import { capeSlot, rainSlot, scalarSlot, type SharedTerrainUniforms } from './rendering/terrain-material';
import { defaultWindOptions, WindLayer } from './rendering/wind-layer';
import { createLayerPanel, type LayerPanel } from './ui/layer-panel';
import { createCapeLegend } from './ui/cape-legend';
import { createLegend } from './ui/legend';
import { createLightningLegend, type LightningLegend } from './ui/lightning-legend';
import { PointReadout, type ReadoutLine } from './ui/point-readout';
import { createRainLegend, type RainLegend } from './ui/rain-legend';
import { ProvenancePanel, type ProvenanceEntry } from './ui/provenance-panel';
import { createTimelineBar, type TimelineBar } from './ui/timeline-bar';

/** Playback speed: one valid time per second. */
const PLAY_STEP_MS = 1000;

export interface CloudInfo {
  readonly scanStart: string;
  readonly product: string;
  /** "mask only" or "mask + C13 IR". */
  readonly ir: string;
  readonly sample: boolean;
}

const CLOUD_SOURCE = 'NOAA GOES-19 ABI L2 cloud mask (ACMF) + band 13 IR (CMIPF)';
const CLOUD_ATTRIBUTION = 'NOAA GOES-19 via NOAA Open Data Dissemination (AWS)';
/** Ask for the backend's whole rolling window (it caps the request to its configured window). */
const LIGHTNING_REQUEST_MINUTES = 24 * 60;

/** Rendering side of a backend product layer (draped scalar, wind particles, ...). */
interface GridView<G> {
  show(key: string, grid: G, now: number, instant: boolean): void;
  clear(): void;
  setEnabled(on: boolean): void;
  setOpacity(opacity: number): void;
}

/** Type-erased glue between a layer, its grid cache, its view and its point readout. */
interface ProductBinding {
  readonly id: LayerId;
  /** Readout caption, e.g. "2 m temperature". */
  readonly label: string;
  readonly view: Omit<GridView<unknown>, 'show'>;
  isLoaded(productId: string, issueTime: number, timeId: string): boolean;
  load(productId: string, issueTime: number, timeId: string): Promise<(now: number, instant: boolean) => void>;
  /** Readout value from the client-side grid, or undefined when it is not loaded yet. */
  valueFromGrid(productId: string, issueTime: number, timeId: string, lon: number, lat: number): string | undefined;
  valueFromPoint(point: PointValue): string;
  /** Extra provenance line (e.g. what the shown quantity means). */
  note?(): string;
}

function bindProduct<G>(
  id: LayerId,
  label: string,
  cache: GridCache<{ grid: G }>,
  view: GridView<G>,
  fromGrid: (grid: G, lon: number, lat: number) => string,
  fromPoint: (point: PointValue) => string,
): ProductBinding {
  return {
    id,
    label,
    view,
    isLoaded: (pid, issue, tid) => cache.peek(GridCache.key(pid, issue, tid)) !== undefined,
    load: async (pid, issue, tid) => {
      const key = GridCache.key(pid, issue, tid);
      const loaded = await cache.load(pid, issue, tid);
      return (now, instant) => view.show(key, loaded.grid, now, instant);
    },
    valueFromGrid: (pid, issue, tid, lon, lat) => {
      const loaded = cache.peek(GridCache.key(pid, issue, tid));
      return loaded ? fromGrid(loaded.grid, lon, lat) : undefined;
    },
    valueFromPoint: fromPoint,
  };
}

/**
 * Weather layer framework: layer selector, forecast timeline, provenance,
 * legend and point queries. Clouds (fed by the static GOES pipeline) and
 * backend products (GET /api/layers) share the same toggles and opacity.
 * Backend product layers are bound through ProductBinding (temperature drape,
 * wind particles, rain drape, convective potential drape). Observed
 * lightning is not a forecast product: it has its own feed (a rolling window
 * ending now) and never joins the forecast timeline.
 */
export class WeatherController {
  readonly panel: LayerPanel;
  readonly timeline: TimelineBar;
  readonly provenance = new ProvenancePanel();
  readonly readout = new PointReadout();
  readonly legends = new Map<LayerId, HTMLElement>();
  private readonly defs = new Map<LayerId, LayerDefinition>(LAYER_DEFINITIONS.map((d) => [d.id, d]));
  private readonly enabled = new Map<LayerId, boolean>();
  private readonly drape: ScalarDrape;
  private readonly wind: WindLayer;
  private readonly rain: RainDrape;
  private readonly rainLegend: RainLegend;
  private readonly cape: ScalarDrape;
  private readonly lightning: LightningLayer;
  private readonly lightningLegend: LightningLegend;
  private lightningData: LightningData | null = null;
  private lightningError: string | null = null;
  private lightningTimer: number | undefined;
  private readonly windNote = document.createElement('div');
  private readonly bindings: ProductBinding[];
  private readonly feed: CatalogFeed;
  private catalog: LayerCatalog | null = null;
  private backendError: string | null = null;
  private times: TimeEntry[] = [];
  private index = -1;
  private playing = false;
  private lastStep = 0;
  private cloud: CloudInfo | null = null;

  constructor(
    renderer: WebGLRenderer,
    frame: LocalFrame,
    shared: SharedTerrainUniforms,
    private readonly clouds: CloudLayer,
  ) {
    for (const d of LAYER_DEFINITIONS) this.enabled.set(d.id, d.implemented && d.defaultEnabled);
    const temperature = this.defs.get('temperature')!;
    this.drape = new ScalarDrape(renderer, frame, scalarSlot(shared));
    this.drape.setPalette(temperature.palette!);
    this.drape.setOpacity(temperature.defaultOpacity);
    this.legends.set('temperature', createLegend('Temperature 2 m', temperature.palette!, temperature.units!, temperature.legendStep!));

    const windDef = this.defs.get('wind')!;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.wind = new WindLayer(renderer, frame, shared, defaultWindOptions(coarse));
    this.wind.setOpacity(windDef.defaultOpacity);
    const windLegend = createLegend('Wind 10 m', windDef.palette!, windDef.units!, windDef.legendStep!);
    this.windNote.className = 'legend-note';
    windLegend.append(this.windNote);
    this.legends.set('wind', windLegend);

    const rainDef = this.defs.get('rain')!;
    this.rain = new RainDrape(renderer, frame, rainSlot(shared));
    this.rain.setOpacity(rainDef.defaultOpacity);
    this.rainLegend = createRainLegend((mode) => this.setRainMode(mode));
    this.legends.set('rain', this.rainLegend.element);

    shared.uPixelRatio.value = renderer.getPixelRatio();
    this.cape = new ScalarDrape(renderer, frame, capeSlot(shared));
    this.cape.setOpacity(this.defs.get('convective')!.defaultOpacity);
    this.legends.set('convective', createCapeLegend());

    // 2048² markers canvas (1024² on touch devices): one texel ~ region / 2048.
    this.lightning = new LightningLayer(frame, shared, coarse ? 1024 : 2048, renderer.capabilities.getMaxAnisotropy());
    this.lightning.setOpacity(this.defs.get('lightning')!.defaultOpacity);
    this.lightningLegend = createLightningLegend();
    this.legends.set('lightning', this.lightningLegend.element);

    this.bindings = [
      bindProduct<ScalarGrid>(
        'temperature',
        '2 m temperature',
        new GridCache(fetchGrid),
        this.drape,
        (g, lon, lat) => formatTemperature(sampleGridLonLat(g, lon, lat), temperature.units!),
        (p) => formatTemperature(p.value, temperature.units!),
      ),
      bindProduct<WindGrid>(
        'wind',
        'Wind 10 m',
        new GridCache(fetchWindGrid),
        this.wind,
        (g, lon, lat) => {
          const w = sampleWindLonLat(g, lon, lat);
          return w ? formatWind(w.u, w.v) : 'No data here';
        },
        (p) => (p.u === null || p.v === null ? 'No data here' : formatWind(p.u, p.v)),
      ),
      {
        ...bindProduct<RainGrid>(
          'rain',
          'Precipitation (forecast)',
          new GridCache(fetchRainGrid),
          this.rain,
          (g, lon, lat) => {
            const v = sampleRainLonLat(g, lon, lat);
            return v ? formatRain(v, this.rain.currentMode, g.issueTime) : 'No data here';
          },
          (p) =>
            p.issueTime === null
              ? 'No data here'
              : formatRain({ rate: p.bands.rate ?? null, accum: p.bands.accum ?? null }, this.rain.currentMode, p.issueTime),
        ),
        note: () =>
          this.rain.currentMode === 'rate'
            ? 'Model forecast, not observed rain. Shown: rate (mm/h), 3-h mean ending at the valid time (f000: instantaneous analysis)'
            : 'Model forecast, not observed rain. Shown: accumulated precipitation (mm) since the run start',
      },
      {
        ...bindProduct<ScalarGrid>(
          'convective',
          'Convective potential (forecast)',
          new GridCache(fetchGrid),
          this.cape,
          (g, lon, lat) => formatCape(sampleGridLonLat(g, lon, lat)),
          (p) => formatCape(p.value),
        ),
        note: () => 'Potential, not observed storms: surface-based CAPE (J/kg) from the model forecast',
      },
    ];
    for (const b of this.bindings) b.view.setEnabled(this.isOn(b.id));
    this.clouds.setEnabled(this.isOn('clouds'));
    this.clouds.setOpacity(this.defs.get('clouds')!.defaultOpacity);

    this.panel = createLayerPanel(LAYER_DEFINITIONS, {
      onToggle: (id, on) => this.setEnabled(id, on),
      onOpacity: (id, opacity) => this.setOpacity(id, opacity),
    });
    this.panel.setAvailable('clouds', false);
    this.panel.setAvailable('lightning', false);
    for (const b of this.bindings) this.panel.setAvailable(b.id, false);
    this.timeline = createTimelineBar({
      onSelect: (i) => {
        this.setPlaying(false);
        this.select(i, performance.now());
      },
      onPlayToggle: () => this.setPlaying(!this.playing),
    });
    this.feed = new CatalogFeed(
      (c) => this.onCatalog(c),
      (err) => this.onBackendUnavailable(err),
    );
    this.feed.start();
  }

  get cloudsEnabled(): boolean {
    return this.isOn('clouds');
  }

  setCloudImage(info: CloudInfo): void {
    this.cloud = info;
    this.panel.setAvailable('clouds', true);
    this.panel.setStatus(
      'clouds',
      `${info.sample ? 'Sample image' : 'Scan'} ${formatScanTime(info.scanStart)} · ${info.product} ${info.ir}` +
        (info.sample ? ' · run npm run clouds for the latest' : ''),
    );
    this.refreshProvenance();
  }

  setCloudsMissing(): void {
    this.panel.setAvailable('clouds', false);
    this.panel.setStatus('clouds', 'No cloud data: run npm run clouds', 'warn');
    this.refreshProvenance();
  }

  /**
   * Per-frame: cross-fades, wind particles and playback. `groundY` is the
   * scene height of the terrain under the camera and `viewDistance` the fog
   * distance (bounds the wind particle region).
   */
  update(now: number, dt: number, camera: PerspectiveCamera, groundY: number, viewDistance: number): void {
    this.drape.update(now);
    this.rain.update(now);
    this.cape.update(now);
    this.lightning.update(camera, groundY, viewDistance);
    this.wind.update(now, dt, camera, groundY, viewDistance);
    if (!this.playing || this.times.length < 2 || now - this.lastStep < PLAY_STEP_MS) return;
    const next = stepIndex(this.index, this.times.length, 1);
    // Hold the current frame until the next grids have arrived, so playback never shows gaps.
    if (this.frameReady(next)) this.select(next, now);
    else this.prefetch(next);
  }

  /** Shows the values of the enabled queryable layers at a clicked terrain position. */
  async queryPoint(lon: number, lat: number, screenX: number, screenY: number): Promise<void> {
    const where = `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}`;
    const lightningLines = this.lightningReadout(lon, lat);
    const queries = this.activeBindings().flatMap((b) => {
      const product = this.product(b.id);
      const frame = product ? this.frameFor(product) : null;
      if (!product || !frame || product.issueTime === null) return [];
      const caption = `${b.label} · ${forecastLabel(frame.validTime, product.issueTime).replace('Forecast ', 'GFS ')}`;
      return [{ b, product, frame, issueTime: product.issueTime, caption }];
    });
    if (queries.length === 0) {
      if (lightningLines.length) this.readout.show(screenX, screenY, [...lightningLines, where]);
      else this.readout.hide();
      return;
    }
    const local = queries.map((q) => q.b.valueFromGrid(q.product.id, q.issueTime, q.frame.id, lon, lat));
    if (local.some((v) => v === undefined)) {
      this.readout.show(screenX, screenY, [...lightningLines, ...queries.flatMap((q) => [{ value: '…' }, q.caption]), where]);
    }
    const values = await Promise.all(
      queries.map(async (q, i) => {
        if (local[i] !== undefined) return local[i]!;
        try {
          return q.b.valueFromPoint(await fetchPoint(q.product.id, lat, lon, q.frame.id));
        } catch {
          return 'Backend unavailable';
        }
      }),
    );
    const lines: ReadoutLine[] = queries.flatMap((q, i) => [{ value: values[i]! }, q.caption]);
    this.readout.show(screenX, screenY, [...lightningLines, ...lines, where]);
  }

  /** Observed flashes near a point, from the loaded window (no forecast time involved). */
  private lightningReadout(lon: number, lat: number): ReadoutLine[] {
    const d = this.lightningData;
    if (!this.isOn('lightning') || !d || this.backendError) return [];
    const s = lightningSummary(d, lon, lat, LIGHTNING_READOUT_KM);
    return [
      { value: formatLightningReadout(s, LIGHTNING_READOUT_KM, d.windowMinutes, Date.now()) },
      `Lightning (observed) · GOES-19 GLM · last ${d.windowMinutes} min`,
    ];
  }

  /** Called periodically (data age changes over time). */
  refreshProvenance(): void {
    const now = Date.now();
    const entries: ProvenanceEntry[] = [];
    if (this.isOn('clouds') && this.cloud) {
      const scan = Date.parse(this.cloud.scanStart);
      entries.push({
        title: 'Clouds',
        kind: 'observed',
        source: CLOUD_SOURCE,
        attribution: CLOUD_ATTRIBUTION,
        time: `Scan ${formatScanTime(this.cloud.scanStart)}`,
        age: formatAge((now - scan) / 1000),
        note: this.cloud.sample ? 'Committed sample image (run npm run clouds)' : undefined,
      });
    }
    const glm = this.lightningProduct();
    if (this.isOn('lightning') && glm && this.lightningData) {
      const d = this.lightningData;
      entries.push({
        title: 'Lightning (observed)',
        kind: 'observed',
        source: glm.source,
        attribution: glm.attribution,
        time: `Last ${d.windowMinutes} min` + (d.obsTime === null ? '' : ` · latest file ${formatUtc(d.obsTime)}`),
        age: d.obsTime === null ? '—' : formatAge((now - d.obsTime) / 1000),
        note:
          d.status === 'stale'
            ? `Refresh failing, showing the flashes collected so far: ${glm.error ?? ''}`
            : 'Observed flashes (good quality), independent of the forecast timeline',
      });
    }
    for (const b of this.activeBindings()) {
      const t = this.product(b.id);
      const frame = t ? this.frameFor(t) : null;
      if (!t || !frame || t.issueTime === null) continue;
      entries.push({
        title: t.title,
        kind: t.kind,
        source: t.source,
        attribution: t.attribution,
        time: `Valid ${formatUtc(frame.validTime)} · ${forecastLabel(frame.validTime, t.issueTime)}`,
        age: formatAge((now - t.issueTime) / 1000),
        note:
          t.status === 'stale' ? `Refresh failing, showing last good run: ${t.error ?? ''}` : b.note ? b.note() : undefined,
      });
    }
    this.provenance.update(entries);
    const speedUp = this.wind.animationSpeedUp;
    const note = speedUp > 0 ? `Particles: real wind speeds, animation ×${formatSpeedUp(speedUp)}` : '';
    if (this.windNote.textContent !== note) this.windNote.textContent = note;
  }

  private isOn(id: LayerId): boolean {
    return this.enabled.get(id) ?? false;
  }

  private activeBindings(): ProductBinding[] {
    return this.bindings.filter((b) => this.isOn(b.id) && this.product(b.id) !== null);
  }

  private product(id: LayerId): LayerProduct | null {
    const pid = this.defs.get(id)?.productId;
    if (!pid || !this.catalog || this.backendError) return null;
    return this.catalog.layers.find((l) => l.id === pid) ?? null;
  }

  private lightningProduct(): LayerProduct | null {
    return this.product('lightning');
  }

  private setEnabled(id: LayerId, on: boolean): void {
    this.enabled.set(id, on);
    if (id === 'clouds') this.clouds.setEnabled(on);
    if (id === 'lightning') {
      this.lightning.setEnabled(on);
      if (on) this.pollLightning();
      else {
        window.clearTimeout(this.lightningTimer);
        this.readout.hide();
      }
      this.updateLightningUi();
    }
    const binding = this.bindings.find((b) => b.id === id);
    if (binding) {
      binding.view.setEnabled(on);
      if (on) this.feed.refresh();
      else this.readout.hide();
    }
    this.rebuildTimeline();
    this.refreshProvenance();
  }

  private setOpacity(id: LayerId, opacity: number): void {
    if (id === 'clouds') this.clouds.setOpacity(opacity);
    if (id === 'lightning') this.lightning.setOpacity(opacity);
    this.bindings.find((b) => b.id === id)?.view.setOpacity(opacity);
  }

  /** Rain legend switch: rate (mm/h) or accumulation since the run start (mm). */
  private setRainMode(mode: RainMode): void {
    this.rain.setMode(mode, performance.now());
    this.rainLegend.setMode(mode);
    this.readout.hide();
    this.refreshProvenance();
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing && this.times.length > 1;
    this.lastStep = performance.now();
    this.timeline.setPlaying(this.playing);
  }

  private onCatalog(catalog: LayerCatalog): void {
    const previous = new Map(this.bindings.map((b) => [b.id, this.product(b.id)?.issueTime ?? null]));
    this.catalog = catalog;
    this.backendError = null;
    let runChanged = false;
    for (const b of this.bindings) {
      const t = this.product(b.id);
      if (!t) {
        this.panel.setAvailable(b.id, false);
        this.panel.setStatus(b.id, 'Not provided by the weather backend', 'warn');
      } else if (b.id === 'wind' && !this.wind.supported) {
        this.panel.setAvailable(b.id, false);
        this.panel.setStatus(b.id, 'Wind particles need WebGL2 float render targets (EXT_color_buffer_float)', 'warn');
      } else {
        this.panel.setAvailable(b.id, true);
        const extra = b.id === 'wind' ? ` · ${Math.round(this.wind.particleCount / 1000)}k particles` : '';
        this.panel.setStatus(b.id, productStatus(t) + (t.status === 'ready' ? extra : ''), t.status === 'ready' ? 'normal' : 'warn');
      }
      if (previous.get(b.id) !== (t?.issueTime ?? null)) runChanged = true;
    }
    if (runChanged) this.index = -1;
    if (this.isOn('lightning') && this.lightningData === null) this.pollLightning();
    this.updateLightningUi();
    this.rebuildTimeline();
    this.refreshProvenance();
  }

  private onBackendUnavailable(err: Error): void {
    if (this.backendError === null) console.warn('Weather backend unavailable', err.message);
    this.backendError = err.message;
    this.catalog = null;
    this.setPlaying(false);
    for (const b of this.bindings) {
      b.view.clear();
      this.panel.setAvailable(b.id, false);
      this.panel.setStatus(b.id, 'Backend unavailable (start it with npm run weather)', 'warn');
    }
    this.lightningData = null;
    this.lightning.clear();
    this.updateLightningUi();
    this.rebuildTimeline();
    this.refreshProvenance();
  }

  /** Timeline = union of the valid times of the enabled forecast products. */
  private rebuildTimeline(): void {
    const active = this.activeBindings().map((b) => this.product(b.id)!);
    const selected = this.times[this.index]?.validTime;
    this.times = mergeTimes(active.map((p) => p.times));
    this.timeline.setTimes(this.times, active.find((p) => p.issueTime !== null)?.issueTime ?? null);
    this.timeline.setVisible(this.times.length > 0);
    for (const b of this.bindings) {
      const legend = this.legends.get(b.id);
      if (legend) legend.hidden = !(active.includes(this.product(b.id)!) && this.times.length > 0);
    }
    if (this.times.length === 0) {
      this.index = -1;
      this.setPlaying(false);
      return;
    }
    const i = nearestIndex(this.times, selected ?? Date.now());
    this.select(i, performance.now(), selected === undefined);
    // Background prefetch keeps playback smooth (~180 KB per scalar frame, ~350 KB per wind or rain frame).
    for (let k = 0; k < this.times.length; k++) this.prefetch(stepIndex(i, this.times.length, k));
  }

  /** Polls GET /api/lightning while the layer is on. */
  private pollLightning(): void {
    window.clearTimeout(this.lightningTimer);
    if (!this.isOn('lightning') || !this.lightningProduct()) return;
    fetchLightning(LIGHTNING_REQUEST_MINUTES).then(
      (data) => {
        this.lightningData = data;
        this.lightningError = null;
        this.lightning.setData(data);
        this.updateLightningUi();
        this.refreshProvenance();
      },
      (err: Error) => {
        this.lightningError = err.message;
        console.warn('Lightning feed failed', err.message);
        this.updateLightningUi();
      },
    );
    this.lightningTimer = window.setTimeout(() => this.pollLightning(), LIGHTNING_POLL_MS);
  }

  /** Lightning status row and legend: own "Last N min" window, never forecast times. */
  private updateLightningUi(): void {
    const legend = this.legends.get('lightning')!;
    if (this.backendError) {
      legend.hidden = true;
      this.panel.setAvailable('lightning', false);
      this.panel.setStatus('lightning', 'Backend unavailable (start it with npm run weather)', 'warn');
      return;
    }
    const glm = this.lightningProduct();
    if (!glm) {
      legend.hidden = true;
      this.panel.setAvailable('lightning', false);
      this.panel.setStatus('lightning', this.catalog ? 'Not provided by the weather backend' : 'Loading…', 'warn');
      return;
    }
    this.panel.setAvailable('lightning', true);
    const d = this.lightningData;
    legend.hidden = !this.isOn('lightning');
    this.lightningLegend.update(d);
    if (this.lightningError && !d) {
      this.panel.setStatus('lightning', `Error: ${this.lightningError}`, 'warn');
    } else if (!d) {
      this.panel.setStatus('lightning', glm.status === 'error' ? `Error: ${glm.error ?? 'unknown'}` : 'GOES-19 GLM · rolling window ending now', glm.status === 'error' ? 'warn' : 'normal');
    } else {
      const obs = d.obsTime === null ? 'no files yet' : `latest ${formatUtcClock(d.obsTime)}`;
      const count = d.count === 0 ? 'no flashes' : `${d.count.toLocaleString('en-US')} flashes`;
      const tone = d.status === 'ready' ? 'normal' : 'warn';
      this.panel.setStatus('lightning', `${d.status === 'stale' ? 'Stale · ' : ''}Last ${d.windowMinutes} min · ${count} · ${obs}`, tone);
    }
  }

  private select(index: number, now: number, instant = false): void {
    this.index = index;
    this.lastStep = now;
    this.timeline.setIndex(index);
    for (const b of this.activeBindings()) {
      const t = this.product(b.id)!;
      const frame = this.frameFor(t);
      if (!frame || t.issueTime === null) continue;
      const issue = t.issueTime;
      void b.load(t.id, issue, frame.id).then(
        (show) => {
          // Only show it if it is still the selected frame of the same run and the layer is on.
          const current = this.isOn(b.id) ? this.product(b.id) : null;
          const cf = current ? this.frameFor(current) : null;
          if (current?.issueTime === issue && cf?.id === frame.id) show(performance.now(), instant);
        },
        (err: Error) => console.warn(`${b.label} grid failed`, err.message),
      );
    }
    this.refreshProvenance();
  }

  private frameFor(product: LayerProduct): TimeEntry | null {
    const t = this.times[this.index];
    if (!t) return null;
    return product.times[nearestIndex(product.times, t.validTime)] ?? null;
  }

  private frameReady(index: number): boolean {
    const e = this.times[index];
    if (!e) return true;
    return this.activeBindings().every((b) => {
      const t = this.product(b.id)!;
      const f = t.times[nearestIndex(t.times, e.validTime)];
      return !f || t.issueTime === null || b.isLoaded(t.id, t.issueTime, f.id);
    });
  }

  private prefetch(index: number): void {
    const e = this.times[index];
    if (!e) return;
    for (const b of this.activeBindings()) {
      const t = this.product(b.id)!;
      const f = t.times[nearestIndex(t.times, e.validTime)];
      if (f && t.issueTime !== null) b.load(t.id, t.issueTime, f.id).catch(() => undefined);
    }
  }
}

function formatTemperature(value: number | null, units: string): string {
  return value === null ? 'No data here' : `${value.toFixed(1)} ${units}`;
}

function formatSpeedUp(factor: number): string {
  if (factor >= 1e6) return `${(factor / 1e6).toFixed(1)}M`;
  if (factor >= 1e4) return `${Math.round(factor / 1e3)}k`;
  if (factor >= 1e3) return `${(factor / 1e3).toFixed(1)}k`;
  return String(Math.round(factor));
}

function productStatus(p: LayerProduct): string {
  const run = p.issueTime === null ? '' : `GFS run ${formatUtc(p.issueTime)}`;
  switch (p.status) {
    case 'ready':
      return `${run} · ${p.times.length} times`;
    case 'stale':
      return `Stale: refresh failing, showing ${run}`;
    case 'error':
      return `Error: ${p.error ?? 'unknown'}`;
    default:
      return p.times.length ? `${run} · updating…` : 'Loading GFS data…';
  }
}
