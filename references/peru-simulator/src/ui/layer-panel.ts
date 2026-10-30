import type { LayerDefinition, LayerId } from '../domain/weather-layers';

export interface LayerPanelHandlers {
  onToggle(id: LayerId, enabled: boolean): void;
  onOpacity(id: LayerId, opacity: number): void;
}

export interface LayerPanel {
  readonly element: HTMLElement;
  /** Status line of a layer (data time, "Backend unavailable", ...). */
  setStatus(id: LayerId, text: string, tone?: 'normal' | 'warn'): void;
  /** Disables a layer's inputs while it has no data. */
  setAvailable(id: LayerId, available: boolean): void;
}

function badge(kind: LayerDefinition['kind']): HTMLElement {
  const b = document.createElement('span');
  b.className = `badge ${kind}`;
  b.textContent = kind === 'observed' ? 'Observed' : 'Forecast';
  return b;
}

/** Weather layer selector: independent toggle, opacity and status per layer. */
export function createLayerPanel(defs: readonly LayerDefinition[], handlers: LayerPanelHandlers): LayerPanel {
  const element = document.createElement('div');
  element.className = 'field layers';
  const heading = document.createElement('span');
  heading.className = 'field-label';
  heading.textContent = 'Weather layers';
  element.append(heading);

  const rows = new Map<LayerId, { toggle: HTMLInputElement; slider: HTMLInputElement | null; status: HTMLElement }>();
  const groups = new Map<LayerId, HTMLElement>();
  for (const def of defs) {
    if (def.group) {
      // Group header (Storms): no data of its own; sub-layers are listed inside it.
      const group = document.createElement('div');
      group.className = 'layer-group';
      group.dataset.layer = def.id;
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', def.title);
      const title = document.createElement('div');
      title.className = 'layer-group-title';
      title.textContent = def.title;
      group.append(title);
      element.append(group);
      groups.set(def.id, group);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.dataset.layer = def.id;
    if (!def.implemented) row.classList.add('soon');

    const header = document.createElement('label');
    header.className = 'layer-header toggle';
    const title = document.createElement('span');
    title.className = 'layer-title';
    title.textContent = def.title;
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = def.implemented && def.defaultEnabled;
    toggle.disabled = !def.implemented;
    toggle.setAttribute('aria-label', `${def.title} layer`);
    toggle.addEventListener('change', () => handlers.onToggle(def.id, toggle.checked));
    header.append(title, badge(def.kind), toggle);

    const status = document.createElement('p');
    status.className = 'hint layer-status';
    status.textContent = def.implemented ? 'Loading…' : 'Coming soon';

    let slider: HTMLInputElement | null = null;
    row.append(header);
    if (def.implemented) {
      slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.05';
      slider.value = String(def.defaultOpacity);
      slider.setAttribute('aria-label', `${def.title} opacity`);
      const s = slider;
      slider.addEventListener('input', () => handlers.onOpacity(def.id, Number(s.value)));
      row.append(slider);
    }
    row.append(status);
    (def.parent ? groups.get(def.parent) ?? element : element).append(row);
    rows.set(def.id, { toggle, slider, status });
  }

  return {
    element,
    setStatus: (id, text, tone = 'normal') => {
      const r = rows.get(id);
      if (!r) return;
      if (r.status.textContent !== text) r.status.textContent = text;
      r.status.classList.toggle('warn', tone === 'warn');
    },
    setAvailable: (id, available) => {
      const r = rows.get(id);
      if (!r) return;
      r.toggle.disabled = !available;
      if (r.slider) r.slider.disabled = !available;
    },
  };
}
