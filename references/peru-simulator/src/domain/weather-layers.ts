import type { LayerKind } from './layer-catalog';
import { TEMPERATURE_PALETTE, WIND_PALETTE, type Palette } from './palette';

export type LayerId = 'clouds' | 'rain' | 'storms' | 'lightning' | 'convective' | 'wind' | 'temperature';

/** A user-facing layer of the selector. Backend products are referenced by id. */
export interface LayerDefinition {
  readonly id: LayerId;
  readonly title: string;
  readonly kind: LayerKind;
  /** Backend product id (GET /api/layers), or null for layers fed elsewhere (clouds). */
  readonly productId: string | null;
  /** False while the layer is not implemented yet: shown disabled as "coming soon". */
  readonly implemented: boolean;
  readonly defaultEnabled: boolean;
  readonly defaultOpacity: number;
  /** Layers drawn with a color scale carry a palette and units for the legend. */
  readonly palette?: Palette;
  readonly units?: string;
  readonly legendStep?: number;
  /** Group header without its own data (Storms): its sub-layers follow with `parent` set. */
  readonly group?: boolean;
  readonly parent?: LayerId;
}

export const LAYER_DEFINITIONS: readonly LayerDefinition[] = [
  { id: 'clouds', title: 'Clouds', kind: 'observed', productId: null, implemented: true, defaultEnabled: true, defaultOpacity: 0.9 },
  {
    id: 'rain',
    title: 'Rain',
    kind: 'forecast',
    productId: 'gfs-precip',
    implemented: true,
    defaultEnabled: false,
    defaultOpacity: 0.85,
    // Legend and palette: domain/rain.ts (threshold scale with a rate / accumulation switch).
    units: 'mm/h',
  },
  // Storms: two clearly separated sub-layers with their own toggles, opacity and badges.
  { id: 'storms', title: 'Storms', kind: 'observed', productId: null, implemented: true, defaultEnabled: false, defaultOpacity: 1, group: true },
  {
    id: 'lightning',
    title: 'Lightning (observed)',
    kind: 'observed',
    productId: 'glm-lightning',
    implemented: true,
    defaultEnabled: false,
    defaultOpacity: 0.95,
    parent: 'storms',
  },
  {
    id: 'convective',
    title: 'Convective potential (forecast)',
    kind: 'forecast',
    productId: 'gfs-cape',
    implemented: true,
    defaultEnabled: false,
    defaultOpacity: 0.8,
    units: 'J/kg',
    parent: 'storms',
  },
  {
    id: 'wind',
    title: 'Wind',
    kind: 'forecast',
    productId: 'gfs-wind10m',
    implemented: true,
    defaultEnabled: false,
    defaultOpacity: 0.85,
    palette: WIND_PALETTE,
    units: 'km/h',
    legendStep: 20,
  },
  {
    id: 'temperature',
    title: 'Temperature',
    kind: 'forecast',
    productId: 'gfs-t2m',
    implemented: true,
    defaultEnabled: false,
    defaultOpacity: 0.65,
    palette: TEMPERATURE_PALETTE,
    units: '°C',
    legendStep: 10,
  },
];
