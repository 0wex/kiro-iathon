import { Matrix4, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { formatScanTime } from './domain/cloud-overlay';
import { createLocalFrame, heightScaleAt, localToLonLat, lonLatToLocal } from './domain/local-frame';
import { selectTiles } from './domain/lod';
import { intersectHeightfield } from './domain/raymarch';
import { LANDMARKS, PERU_BOUNDS, PERU_CENTER, PERU_MAX_ELEVATION, type Landmark } from './domain/peru';
import { CloudFeed, type CloudImage } from './infrastructure/cloud-source';
import type { ElevationFormat } from './infrastructure/decode-protocol';
import { DecoderPool } from './infrastructure/decoder-pool';
import { TileLayer } from './infrastructure/tile-layer';
import {
  ELEVATION_ATTRIBUTION,
  ELEVATION_SOURCES,
  IMAGERY_SOURCE,
  loadHeightTile,
  loadImageryTile,
  type ElevationSource,
} from './infrastructure/tile-sources';
import { CloudLayer } from './rendering/cloud-layer';
import { HeightSampler } from './rendering/height-sampler';
import { Sky } from './rendering/sky';
import { createSharedUniforms, type ShadingMode } from './rendering/terrain-material';
import { TerrainRenderer } from './rendering/terrain-renderer';
import { ThreeFrustum } from './rendering/three-frustum';
import { TileResourceFactory, type HeightResource, type ImageryResource } from './rendering/tile-resources';
import { createControlPanel, type CameraMode } from './ui/control-panel';
import { FlyControls } from './ui/fly-controls';
import { Hud } from './ui/hud';
import { WeatherController } from './weather-controller';

const ROOT_ZOOM = 5;
const MAX_SCREEN_SPACE_ERROR = 4;
/** Refined tiles coarsen below MAX_SCREEN_SPACE_ERROR * LOD_HYSTERESIS (prevents flicker). */
const LOD_HYSTERESIS = 0.75;
/** Children are prefetched above MAX_SCREEN_SPACE_ERROR * PREFETCH_RATIO. */
const PREFETCH_RATIO = 0.7;
/** Bound on prefetch candidates, kept well below the cache capacities. */
const MAX_PREFETCH = 32;
/**
 * Cache capacities. Half-float heights take 0.5 MB per 512 px GeoTIFF tile,
 * so 400 heights (~200 MB) stay below the former 220 Float32 tiles (~220 MB).
 */
const HEIGHT_CACHE_CAPACITY = 400;
const IMAGERY_CACHE_CAPACITY = 360;
/**
 * Working-set budget for the LOD selection: it must fit both caches with room
 * for prefetch and fade sources, otherwise eviction and re-download would loop.
 */
const LOD_TILE_BUDGET = 300;
const LOD_MIN_INTERVAL_MS = 50;
const HUD_INTERVAL_MS = 250;
const MIN_CLEARANCE_M = 30;
const TARGET_MARGIN = 150_000;
/** A pointer press counts as a click (point query) below this movement and duration. */
const CLICK_MAX_PX = 5;
const CLICK_MAX_MS = 500;

interface Tween {
  start: number;
  duration: number;
  fromTarget: Vector3;
  toTarget: Vector3;
  fromCamera: Vector3;
  toCamera: Vector3;
  lift: number;
}

/** Composition root: wires domain LOD, tile streaming, rendering and UI. */
export class TerrainApp {
  private readonly frame = createLocalFrame(PERU_CENTER.lon, PERU_CENTER.lat);
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: MapControls;
  private readonly fly: FlyControls;
  private readonly shared = createSharedUniforms();
  private readonly sky: Sky;
  private readonly terrain: TerrainRenderer;
  private readonly resources: TileResourceFactory;
  private readonly pool = new DecoderPool();
  private readonly heights: TileLayer<HeightResource>;
  private readonly imagery: TileLayer<ImageryResource>;
  private readonly sampler: HeightSampler;
  private readonly frustum = new ThreeFrustum();
  private readonly hud = new Hud();
  private readonly clouds: CloudLayer;
  private readonly cloudFeed: CloudFeed;
  private weather!: WeatherController;
  private cloudStatus = 'loading';
  private pointerDown: { x: number; y: number; t: number } | null = null;
  private readonly raycaster = new Raycaster();

  private source: ElevationSource = ELEVATION_SOURCES.geotiff;
  private shading: ShadingMode = 'imagery';
  private cameraMode: CameraMode = 'orbit';
  private dirty = true;
  private lastLod = 0;
  private refined: ReadonlySet<string> = new Set();
  private lastHud = 0;
  private lastFrame = performance.now();
  private fpsFrames = 0;
  private fpsStart = performance.now();
  private fps = 0;
  private tween: Tween | null = null;
  private readonly lastView = new Matrix4();
  private readonly localBounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(this.shared.uFogColor.value);
    container.append(this.renderer.domElement);

    this.camera = new PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 2e7);
    this.sky = new Sky(this.shared.uFogColor.value);
    this.terrain = new TerrainRenderer(this.frame, this.shared, 64);
    this.clouds = new CloudLayer(this.frame, this.shared);
    this.scene.add(this.sky.mesh, this.terrain.group, this.clouds.group);

    this.resources = new TileResourceFactory(this.renderer);
    const markDirty = () => (this.dirty = true);
    this.heights = new TileLayer<HeightResource>({
      load: async (tile, signal) => this.resources.createHeight(await loadHeightTile(this.source, this.pool, tile, signal)),
      fallback: () => this.resources.createFlatHeight(),
      capacity: HEIGHT_CACHE_CAPACITY,
      maxConcurrent: 8,
      onLoaded: markDirty,
    });
    this.imagery = new TileLayer<ImageryResource>({
      load: async (tile, signal) => this.resources.createImagery(await loadImageryTile(tile, signal)),
      fallback: () => this.resources.createMissingImagery(),
      capacity: IMAGERY_CACHE_CAPACITY,
      maxConcurrent: 6,
      onLoaded: markDirty,
    });
    this.sampler = new HeightSampler(
      (key) => this.heights.get(key),
      () => this.source.maxZoom,
    );

    const nw = lonLatToLocal(this.frame, PERU_BOUNDS.west, PERU_BOUNDS.north);
    const se = lonLatToLocal(this.frame, PERU_BOUNDS.east, PERU_BOUNDS.south);
    this.localBounds = {
      minX: nw.x - TARGET_MARGIN,
      maxX: se.x + TARGET_MARGIN,
      minZ: nw.z - TARGET_MARGIN,
      maxZ: se.z + TARGET_MARGIN,
    };

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.45;
    this.controls.minDistance = 150;
    this.controls.maxDistance = 3_000_000;
    this.controls.zoomToCursor = true;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 1_300_000, 900_000);
    this.controls.update();

    this.fly = new FlyControls(this.camera, this.renderer.domElement);
    this.buildUi();
    this.cloudFeed = new CloudFeed(
      (image) => this.onCloudImage(image),
      () => this.onCloudsMissing(),
    );
    this.cloudFeed.start();
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  private buildUi(): void {
    const panel = createControlPanel(
      { source: this.source.format, shading: this.shading, exaggeration: this.shared.uExaggeration.value, cameraMode: this.cameraMode },
      LANDMARKS,
      {
        onSourceChange: (s) => this.setSource(s),
        onShadingChange: (s) => {
          this.shading = s;
          this.shared.uShading.value = s === 'imagery' ? 0 : 1;
          this.dirty = true;
        },
        onExaggerationChange: (v) => {
          this.shared.uExaggeration.value = v;
          this.dirty = true;
        },
        onCameraModeChange: (m) => this.setCameraMode(m),
        onJump: (lm) => this.jumpTo(lm),
      },
    );
    this.weather = new WeatherController(this.renderer, this.frame, this.shared, this.clouds);
    panel.querySelector('.hint')?.before(this.weather.panel.element);
    const attribution = document.createElement('div');
    attribution.className = 'attribution';
    attribution.textContent = `${ELEVATION_ATTRIBUTION} · ${IMAGERY_SOURCE.attribution} · Clouds: NOAA GOES-19 ABI · Weather: NOAA GFS · Lightning: NOAA GOES-19 GLM`;
    // Legends and provenance stack in one bottom-right dock so they never overlap.
    const dock = document.createElement('div');
    dock.className = 'weather-dock';
    dock.append(...this.weather.legends.values(), this.weather.provenance.element);
    this.container.append(panel, this.hud.element, this.weather.timeline.element, dock, this.weather.readout.element, attribution);
  }

  private onCloudImage(image: CloudImage): void {
    this.clouds.setImage(image.bitmap, image.meta);
    this.cloudStatus = formatScanTime(image.meta.scanStart);
    const ir = image.meta.irBand === null ? 'mask only' : `mask + C${String(image.meta.irBand).padStart(2, '0')} IR`;
    this.weather.setCloudImage({ scanStart: image.meta.scanStart, product: image.meta.product, ir, sample: image.sample });
  }

  private onCloudsMissing(): void {
    this.cloudStatus = 'no data';
    this.weather.setCloudsMissing();
  }

  private setSource(format: ElevationFormat): void {
    if (format === this.source.format) return;
    this.source = ELEVATION_SOURCES[format];
    this.heights.clear();
    // Drop meshes that reference the disposed textures before the next render.
    this.updateLod(performance.now());
  }

  private setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.tween = null;
    if (mode === 'fly') {
      this.controls.enabled = false;
      this.fly.enabled = true;
      this.fly.syncFromCamera();
      return;
    }
    this.fly.enabled = false;
    const dir = this.camera.getWorldDirection(new Vector3());
    const agl = Math.max(100, this.camera.position.y - this.groundY(this.camera.position));
    const reach = dir.y < -0.05 ? Math.min(60_000, agl / -dir.y) : 5_000;
    this.controls.target.copy(this.camera.position).addScaledVector(dir, reach);
    this.controls.enabled = true;
    this.controls.update();
  }

  private jumpTo(lm: Landmark): void {
    const p = lonLatToLocal(this.frame, lm.lon, lm.lat);
    const ground = (this.sampler.sample(lm.lon, lm.lat) ?? 3000) * this.verticalScale(lm.lat);
    const toTarget = new Vector3(p.x, ground, p.z);
    const polar = 0.95;
    const toCamera = toTarget
      .clone()
      .add(new Vector3(0, Math.cos(polar) * lm.viewDistance, Math.sin(polar) * lm.viewDistance));
    const fromTarget = this.controls.target.clone();
    const travel = fromTarget.distanceTo(toTarget);
    this.tween = {
      start: performance.now(),
      duration: 1800,
      fromTarget,
      toTarget,
      fromCamera: this.camera.position.clone(),
      toCamera,
      lift: Math.min(400_000, travel * 0.35),
    };
  }

  private verticalScale(lat: number): number {
    return heightScaleAt(this.frame, lat) * this.shared.uExaggeration.value;
  }

  /** Scene height of the terrain under a local position, or 0 when unknown. */
  private groundY(p: Vector3): number {
    const ll = localToLonLat(this.frame, p.x, p.z);
    return (this.sampler.sample(ll.lon, ll.lat) ?? 0) * this.verticalScale(ll.lat);
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.pointerDown = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || e.button !== 0) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_MAX_PX || performance.now() - down.t > CLICK_MAX_MS) return;
    const hit = this.pickTerrain(e.clientX, e.clientY);
    if (!hit) {
      this.weather.readout.hide();
      return;
    }
    const ll = localToLonLat(this.frame, hit.x, hit.z);
    const rect = this.container.getBoundingClientRect();
    void this.weather.queryPoint(ll.lon, ll.lat, e.clientX - rect.left, e.clientY - rect.top);
  };

  /** Terrain position under a screen point: ray-march against the CPU height sampler. */
  private pickTerrain(clientX: number, clientY: number): Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const hit = intersectHeightfield(origin, direction, (x, z) => this.groundY(new Vector3(x, 0, z)), {
      maxDistance: 6_000_000,
      minStep: 5,
      stepFactor: 0.2,
      maxSteps: 4000,
    });
    return hit ? new Vector3(hit.x, hit.y, hit.z) : null;
  }

  private readonly onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  };

  private readonly tick = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.updateCamera(now, dt);
    this.camera.updateMatrixWorld();
    if (!this.lastView.equals(this.camera.matrixWorld)) {
      this.lastView.copy(this.camera.matrixWorld);
      this.dirty = true;
    }
    if (this.dirty && now - this.lastLod >= LOD_MIN_INTERVAL_MS) this.updateLod(now);

    const agl = this.camera.position.y - this.groundY(this.camera.position);
    const fogDistance = Math.min(6_000_000, Math.max(80_000, agl * 60 + 40_000));
    this.shared.uFogDensity.value = 1 / fogDistance;
    this.sky.follow(this.camera.position);
    this.clouds.update(this.camera.position, this.shared.uExaggeration.value);
    this.weather.update(now, dt, this.camera, this.groundY(this.camera.position), fogDistance);
    this.terrain.update(now);
    this.renderer.render(this.scene, this.camera);

    this.fpsFrames++;
    if (now - this.fpsStart >= 500) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsStart);
      this.fpsFrames = 0;
      this.fpsStart = now;
    }
    if (now - this.lastHud >= HUD_INTERVAL_MS) {
      this.lastHud = now;
      this.updateHud();
    }
  };

  private updateCamera(now: number, dt: number): void {
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
      this.camera.position.lerpVectors(this.tween.fromCamera, this.tween.toCamera, e);
      this.camera.position.y += Math.sin(Math.PI * e) * this.tween.lift;
      this.camera.lookAt(this.controls.target);
      if (t >= 1) {
        this.tween = null;
        if (this.cameraMode === 'fly') this.fly.syncFromCamera();
      }
      return;
    }

    if (this.cameraMode === 'fly') {
      const agl = this.camera.position.y - this.groundY(this.camera.position);
      this.fly.update(dt, agl);
      this.clampToBounds(this.camera.position, null);
    } else {
      this.controls.update(dt);
      // Keep the orbit pivot on the terrain surface.
      const target = this.controls.target;
      const delta = (this.groundY(target) - target.y) * Math.min(1, dt * 4);
      target.y += delta;
      this.camera.position.y += delta;
      this.clampToBounds(target, this.camera.position);
    }

    const ll = localToLonLat(this.frame, this.camera.position.x, this.camera.position.z);
    const minY = this.groundY(this.camera.position) + MIN_CLEARANCE_M * heightScaleAt(this.frame, ll.lat);
    if (this.camera.position.y < minY) this.camera.position.y = minY;
  }

  /** Clamps a point to the Peru region, moving `follower` by the same offset. */
  private clampToBounds(p: Vector3, follower: Vector3 | null): void {
    const b = this.localBounds;
    const x = Math.min(b.maxX, Math.max(b.minX, p.x));
    const z = Math.min(b.maxZ, Math.max(b.minZ, p.z));
    if (x === p.x && z === p.z) return;
    follower?.add(new Vector3(x - p.x, 0, z - p.z));
    p.x = x;
    p.z = z;
  }

  private updateLod(now: number): void {
    this.lastLod = now;
    this.dirty = false;
    this.camera.updateMatrixWorld();
    this.frustum.update(this.camera);
    const wantImagery = this.shading === 'imagery';
    const exaggeration = this.shared.uExaggeration.value;
    const maxScale = heightScaleAt(this.frame, PERU_BOUNDS.south);
    const result = selectTiles({
      cameraPosition: this.camera.position,
      frustum: this.frustum,
      viewportHeightPx: this.renderer.domElement.height,
      fovYRadians: (this.camera.fov * Math.PI) / 180,
      frame: this.frame,
      rootZoom: ROOT_ZOOM,
      maxZoom: this.source.maxZoom,
      bounds: PERU_BOUNDS,
      maxScreenSpaceError: MAX_SCREEN_SPACE_ERROR * this.renderer.getPixelRatio(),
      segments: this.terrain.segments,
      heightRange: { min: -100, max: PERU_MAX_ELEVATION * exaggeration * maxScale },
      isReady: (key) => this.heights.isReady(key) && (!wantImagery || this.imagery.isReady(key)),
      previouslyRefined: this.refined,
      hysteresis: LOD_HYSTERESIS,
      prefetchRatio: PREFETCH_RATIO,
      maxPrefetch: MAX_PREFETCH,
      maxTiles: LOD_TILE_BUDGET,
    });
    this.refined = result.refined;
    this.terrain.setDisplay(
      result.display,
      result.morph,
      { height: (k) => this.heights.get(k), imagery: (k) => (wantImagery ? this.imagery.get(k) : undefined) },
      this.camera.position,
      now,
    );
    // The whole working set stays cached, not just the displayed tiles: evicting
    // ancestors or ready children of incomplete refinements makes them needed
    // again and loops into constant re-downloads.
    this.heights.update(result.requests, result.needed);
    // Ancestors still being cross-faded from must not be evicted mid-fade.
    const imageryRetained = new Set([...result.needed, ...this.terrain.fadeSourceKeys]);
    this.imagery.update(wantImagery ? result.requests : [], imageryRetained);
  }

  private updateHud(): void {
    const p = this.camera.position;
    const ll = localToLonLat(this.frame, p.x, p.z);
    const groundMeters = this.sampler.sample(ll.lon, ll.lat);
    const sceneScale = heightScaleAt(this.frame, ll.lat);
    const aboveGround = groundMeters === null ? null : (p.y - this.groundY(p)) / sceneScale;
    const h = this.heights.stats;
    const i = this.imagery.stats;
    this.hud.update({
      fps: this.fps,
      visibleTiles: this.terrain.visibleCount,
      cachedHeights: h.cached,
      cachedImagery: i.cached,
      inFlight: h.inFlight + i.inFlight,
      queued: h.queued + i.queued,
      lat: ll.lat,
      lon: ll.lon,
      altitude: groundMeters === null || aboveGround === null ? p.y / sceneScale : groundMeters + aboveGround,
      aboveGround,
      clouds: this.weather.cloudsEnabled || !this.clouds.hasImage ? this.cloudStatus : 'off',
    });
    this.weather.refreshProvenance();
  }
}
