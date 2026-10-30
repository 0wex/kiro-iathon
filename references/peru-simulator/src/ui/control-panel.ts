import type { Landmark } from '../domain/peru';
import type { ElevationFormat } from '../infrastructure/decode-protocol';
import type { ShadingMode } from '../rendering/terrain-material';

export type CameraMode = 'orbit' | 'fly';

export interface ControlPanelState {
  source: ElevationFormat;
  shading: ShadingMode;
  exaggeration: number;
  cameraMode: CameraMode;
}

export interface ControlPanelHandlers {
  onSourceChange(source: ElevationFormat): void;
  onShadingChange(shading: ShadingMode): void;
  onExaggerationChange(value: number): void;
  onCameraModeChange(mode: CameraMode): void;
  onJump(landmark: Landmark): void;
}

function segmented<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  initial: T,
  onChange: (value: T) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'field';
  const title = document.createElement('span');
  title.className = 'field-label';
  title.textContent = label;
  const row = document.createElement('div');
  row.className = 'segmented';
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', label);
  const buttons = options.map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === initial));
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-checked', String(other === b));
      onChange(o.value);
    });
    return b;
  });
  row.append(...buttons);
  group.append(title, row);
  return group;
}

export function createControlPanel(
  state: ControlPanelState,
  landmarks: readonly Landmark[],
  handlers: ControlPanelHandlers,
): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'panel controls';
  panel.setAttribute('aria-label', 'Controls');

  const heading = document.createElement('h1');
  heading.textContent = 'Peru 3D Terrain';

  const exaggeration = document.createElement('label');
  exaggeration.className = 'field';
  const exLabel = document.createElement('span');
  exLabel.className = 'field-label';
  const exValue = document.createElement('output');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '10';
  slider.step = '0.1';
  slider.value = String(state.exaggeration);
  const renderEx = () => {
    exLabel.textContent = 'Vertical exaggeration ';
    exValue.textContent = `${Number(slider.value).toFixed(1)}×`;
    exLabel.append(exValue);
  };
  renderEx();
  slider.addEventListener('input', () => {
    renderEx();
    handlers.onExaggerationChange(Number(slider.value));
  });
  exaggeration.append(exLabel, slider);

  const jumps = document.createElement('div');
  jumps.className = 'field';
  const jumpLabel = document.createElement('span');
  jumpLabel.className = 'field-label';
  jumpLabel.textContent = 'Go to';
  const jumpRow = document.createElement('div');
  jumpRow.className = 'chips';
  for (const lm of landmarks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lm.name;
    b.addEventListener('click', () => handlers.onJump(lm));
    jumpRow.append(b);
  }
  jumps.append(jumpLabel, jumpRow);

  const hint = document.createElement('p');
  hint.className = 'hint';
  const renderHint = (mode: CameraMode) => {
    hint.textContent =
      mode === 'orbit'
        ? 'Drag to pan · right-drag to rotate · scroll to zoom'
        : 'WASD move · Q/E down/up · Shift boost · drag to look';
  };
  renderHint(state.cameraMode);

  panel.append(
    heading,
    segmented(
      'Elevation data',
      [
        { value: 'geotiff', label: 'GeoTIFF' },
        { value: 'terrarium', label: 'Terrarium' },
      ],
      state.source,
      handlers.onSourceChange,
    ),
    segmented(
      'Shading',
      [
        { value: 'imagery', label: 'Imagery' },
        { value: 'hypsometric', label: 'Hypsometric' },
      ],
      state.shading,
      handlers.onShadingChange,
    ),
    exaggeration,
    segmented(
      'Camera',
      [
        { value: 'orbit', label: 'Orbit' },
        { value: 'fly', label: 'Fly' },
      ],
      state.cameraMode,
      (mode) => {
        renderHint(mode);
        handlers.onCameraModeChange(mode);
      },
    ),
    jumps,
    hint,
  );
  return panel;
}
