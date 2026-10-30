import type { WebGLRenderer } from 'three';
import type { LocalFrame } from '../domain/local-frame';
import { RAIN_INDEX_PALETTE, rainIndexGrid, type RainGrid, type RainMode } from '../domain/rain';
import { ScalarDrape } from './scalar-drape';
import type { DrapeSlot } from './terrain-material';

/**
 * Precipitation drape in its own terrain slot (independent of temperature).
 * The selected band (rate or accumulation) is mapped to threshold-index space
 * on the CPU, so one alpha palette gives even color steps on both scales.
 */
export class RainDrape {
  private readonly drape: ScalarDrape;
  private mode: RainMode = 'rate';
  private last: { key: string; grid: RainGrid } | null = null;

  constructor(renderer: WebGLRenderer, frame: LocalFrame, slot: DrapeSlot) {
    this.drape = new ScalarDrape(renderer, frame, slot);
    this.drape.setPalette(RAIN_INDEX_PALETTE);
  }

  get currentMode(): RainMode {
    return this.mode;
  }

  show(key: string, grid: RainGrid, now: number, instant = false): void {
    this.last = { key, grid };
    // Textures are cached per frame and mode, so switching back and forth does not re-upload.
    this.drape.show(`${key}|${this.mode}`, rainIndexGrid(grid, this.mode), now, instant);
  }

  /** Switches between rate and accumulation, redrawing the current frame at once. */
  setMode(mode: RainMode, now: number): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.last) this.show(this.last.key, this.last.grid, now, true);
  }

  clear(): void {
    this.last = null;
    this.drape.clear();
  }

  setEnabled(enabled: boolean): void {
    this.drape.setEnabled(enabled);
  }

  setOpacity(opacity: number): void {
    this.drape.setOpacity(opacity);
  }

  update(now: number): void {
    this.drape.update(now);
  }
}
