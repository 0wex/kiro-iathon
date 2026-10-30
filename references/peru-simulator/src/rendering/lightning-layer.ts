import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, Vector3, type PerspectiveCamera } from 'three';
import {
  clusterFlashes,
  clusterMode,
  formatFlashCount,
  LIGHTNING_PULSE_S,
  lightningAgeStyle,
  pulsePhase,
  type LightningData,
} from '../domain/lightning';
import type { LocalFrame } from '../domain/local-frame';
import { lonLatToMercator } from '../domain/tile-math';
import type { MercatorBounds } from '../domain/types';
import { mercatorRectLocal, mercatorToGridUv, type LocalRect } from '../domain/weather-grid';
import { chooseTrailRect, footprintUv, type MutableUvRect, type UvRect } from '../domain/wind-particles';
import type { SharedTerrainUniforms } from './terrain-material';

/** Redraw period while flashes of the last two minutes pulse, and otherwise (aging only). */
const PULSE_REDRAW_MS = 200;
const AGE_REDRAW_MS = 10_000;
const FOOTPRINT_STEPS = 5;
/** Markers are redrawn from scratch, so the region may follow zoom-ins closely (sharper texels). */
const REGION_SHRINK = 0.6;

const css = (rgb: readonly number[], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(3)})`;

/**
 * Observed lightning draped on the terrain: markers are drawn with Canvas 2D
 * into a grid-space texture covering the view footprint (like the wind
 * trails), so they lie exactly on the rendered surface for every LOD and
 * camera without height lookups. Regional views show grid-binned clusters
 * with counts; close views show every flash. Markers are colored by real
 * flash age; flashes of the last two minutes pulse.
 */
export class LightningLayer {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly rays = Array.from({ length: FOOTPRINT_STEPS * FOOTPRINT_STEPS }, () => new Vector3());
  private readonly footprint: MutableUvRect = { u0: 0, v0: 0, du: 1, dv: 1 };
  private data: LightningData | null = null;
  private bounds: MercatorBounds | null = null;
  private gridRect: LocalRect | null = null;
  private rect: UvRect | null = null;
  private enabled = false;
  private opacity = 0.9;
  private dirty = true;
  private lastDraw = 0;
  private hasPulse = false;
  /** Ground width seen at the screen center (mercator m): marker sizes and clustering follow it. */
  private view = 1;
  private drawnView = 1;

  constructor(
    private readonly frame: LocalFrame,
    private readonly shared: SharedTerrainUniforms,
    size: number,
    anisotropy = 1,
  ) {
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.flipY = false; // Canvas row 0 is the north edge (t = 0).
    this.texture.premultiplyAlpha = true;
    this.texture.colorSpace = NoColorSpace;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = true;
    // Oblique views would otherwise pick blurry mip levels.
    this.texture.anisotropy = anisotropy;
  }

  get flashCount(): number {
    return this.data?.count ?? 0;
  }

  setData(data: LightningData): void {
    this.data = data;
    const sw = lonLatToMercator(data.bounds.west, data.bounds.south);
    const ne = lonLatToMercator(data.bounds.east, data.bounds.north);
    const b = { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };
    const same = this.bounds && ['minX', 'minY', 'maxX', 'maxY'].every((k) => this.bounds![k as keyof MercatorBounds] === b[k as keyof MercatorBounds]);
    if (!same) {
      this.bounds = b;
      this.gridRect = mercatorRectLocal(this.frame, b);
      this.rect = null;
    }
    this.dirty = true;
    this.apply();
  }

  clear(): void {
    this.data = null;
    this.apply();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.dirty = true;
    this.apply();
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.apply();
  }

  /** Per-frame: follows the view footprint and redraws when the region, data or ages change. */
  update(camera: PerspectiveCamera, groundY: number, viewDistance: number): void {
    if (!this.active) return;
    const before = this.rect;
    this.updateRegion(camera, groundY, viewDistance);
    const now = Date.now();
    const period = this.hasPulse ? PULSE_REDRAW_MS : AGE_REDRAW_MS;
    // Zooming inside the region (hysteresis) rescales markers once the view changed by > 15%.
    const zoomed = Math.abs(this.view - this.drawnView) > 0.15 * this.drawnView;
    if (this.dirty || this.rect !== before || zoomed || now - this.lastDraw >= period) this.draw(now);
  }

  dispose(): void {
    this.texture.dispose();
  }

  private get active(): boolean {
    return this.enabled && this.data !== null && this.opacity > 0;
  }

  private apply(): void {
    const on = this.active;
    this.shared.uLightningOpacity.value = on ? this.opacity : 0;
    this.shared.uLightning.value = on ? this.texture : null;
  }

  private updateRegion(camera: PerspectiveCamera, groundY: number, viewDistance: number): void {
    const n = FOOTPRINT_STEPS - 1;
    for (let j = 0, k = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++, k++) {
        this.rays[k]!.set((i / n) * 2 - 1, (j / n) * 2 - 1, 0.5).unproject(camera).sub(camera.position);
      }
    }
    const b = this.bounds!;
    const aspect = (b.maxX - b.minX) / (b.maxY - b.minY);
    footprintUv(camera.position, this.rays, groundY, viewDistance, this.gridRect!, this.footprint);
    this.rect = chooseTrailRect(this.rect, this.footprint, aspect, REGION_SHRINK);
    // Ground width across the screen at the view center (from the height above ground), in mercator m.
    const above = Math.max(1, camera.position.y - groundY);
    const across = 2 * above * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    this.view = across / this.frame.scale;
    const g = this.gridRect!;
    const r = this.rect;
    this.shared.uLightningRect.value.set(
      g.minX + r.u0 * (g.maxX - g.minX),
      g.minZ + r.v0 * (g.maxZ - g.minZ),
      r.du * (g.maxX - g.minX),
      r.dv * (g.maxZ - g.minZ),
    );
  }

  private draw(now: number): void {
    this.dirty = false;
    this.lastDraw = now;
    const { ctx, canvas } = this;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    const data = this.data!;
    const b = this.bounds!;
    const r = this.rect!;
    const regionMeters = r.du * (b.maxX - b.minX);
    const view = this.view;
    this.drawnView = view;
    const px = (mx: number, my: number) => {
      const uv = mercatorToGridUv(b, mx, my);
      return { x: ((uv.u - r.u0) / r.du) * size, y: ((uv.v - r.v0) / r.dv) * size };
    };
    const windowS = data.windowMinutes * 60;
    // Canvas pixels per marker unit, about constant on screen: one unit ~ 1/1024 of the view width.
    const unit = Math.min(2, Math.max(0.15, (size / 1024) * (view / regionMeters)));
    this.hasPulse = false;
    const { mode, cellMeters } = clusterMode(view);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'clusters') {
      const cells = clusterFlashes(data, cellMeters);
      // Smallest first, so large clusters and their labels stay on top.
      for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i]!;
        const p = px(c.x, c.y);
        const age = (now - c.latest) / 1000;
        const style = lightningAgeStyle(age, windowS);
        if (style.alpha <= 0) continue;
        const radius = Math.max(3, Math.min(18, 4.5 + 2.8 * Math.sqrt(c.count)) * unit);
        this.pulse(p.x, p.y, radius, age, now);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = css(style.rgb, 0.35 * style.alpha + 0.15);
        ctx.fill();
        ctx.lineWidth = 1.6 * unit;
        ctx.strokeStyle = css(style.rgb, Math.max(0.5, style.alpha));
        ctx.stroke();
        if (c.count > 1) {
          ctx.font = `600 ${Math.round(Math.max(11, Math.min(16, radius / unit + 3)) * unit)}px system-ui, sans-serif`;
          const label = formatFlashCount(c.count);
          ctx.lineWidth = 3 * unit;
          ctx.strokeStyle = 'rgba(20, 16, 10, 0.85)';
          ctx.strokeText(label, p.x, p.y);
          ctx.fillStyle = 'rgba(255, 255, 240, 1)';
          ctx.fillText(label, p.x, p.y);
        }
      }
    } else {
      // Oldest first, so recent flashes are drawn on top.
      for (let i = 0; i < data.count; i++) {
        const m = lonLatToMercator(data.lon[i]!, data.lat[i]!);
        const p = px(m.x, m.y);
        if (p.x < -20 || p.y < -20 || p.x > size + 20 || p.y > size + 20) continue;
        const age = (now - data.time[i]!) / 1000;
        const style = lightningAgeStyle(age, windowS);
        if (style.alpha <= 0) continue;
        // At least ~2.5 texels, so single flashes never dissolve in coarse (oblique, wide) regions.
        const radius = Math.max(2.5, 3.2 * unit);
        this.pulse(p.x, p.y, radius * 1.6, age, now);
        // Soft glow + bright core + a small cross, readable on imagery and hypsometric shading.
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = css(style.rgb, 0.25 * style.alpha);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = css(style.rgb, style.alpha);
        ctx.fill();
        ctx.lineWidth = 1.2 * unit;
        ctx.strokeStyle = css(style.rgb, style.alpha);
        ctx.beginPath();
        ctx.moveTo(p.x - radius * 2.4, p.y);
        ctx.lineTo(p.x + radius * 2.4, p.y);
        ctx.moveTo(p.x, p.y - radius * 2.4);
        ctx.lineTo(p.x, p.y + radius * 2.4);
        ctx.stroke();
      }
    }
    this.texture.needsUpdate = true;
  }

  /** Expanding ring for markers younger than LIGHTNING_PULSE_S (real flash ages). */
  private pulse(x: number, y: number, radius: number, ageS: number, now: number): void {
    if (ageS >= LIGHTNING_PULSE_S) return;
    this.hasPulse = true;
    const phase = pulsePhase(ageS, now);
    if (phase <= 0.01) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius * (1.4 + 1.2 * (1 - phase)), 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, radius / 4);
    ctx.strokeStyle = `rgba(255, 255, 235, ${(0.85 * phase).toFixed(3)})`;
    ctx.stroke();
  }
}
