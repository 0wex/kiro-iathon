import type { LayerKind } from '../domain/layer-catalog';

export interface ProvenanceEntry {
  readonly title: string;
  readonly kind: LayerKind;
  readonly source: string;
  readonly attribution: string;
  /** E.g. "Scan 2026-10-17 23:00 UTC" or "Valid ... · Forecast +6h from ...". */
  readonly time: string;
  /** Human readable data age, or null when unknown. */
  readonly age: string | null;
  readonly note?: string;
}

/** Data provenance of the enabled layers: source, attribution, observed/forecast, UTC time, age. */
export class ProvenancePanel {
  readonly element: HTMLElement;
  private lastHtmlKey = '';

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'panel provenance';
    this.element.setAttribute('aria-label', 'Data provenance');
    this.element.hidden = true;
  }

  update(entries: readonly ProvenanceEntry[]): void {
    const key = JSON.stringify(entries);
    if (key === this.lastHtmlKey) return;
    this.lastHtmlKey = key;
    this.element.hidden = entries.length === 0;
    this.element.replaceChildren(
      ...entries.map((e) => {
        const item = document.createElement('div');
        item.className = 'prov-item';
        const head = document.createElement('div');
        head.className = 'prov-head';
        const title = document.createElement('strong');
        title.textContent = e.title;
        const badge = document.createElement('span');
        badge.className = `badge ${e.kind}`;
        badge.textContent = e.kind === 'observed' ? 'Observed' : 'Forecast';
        head.append(title, badge);
        const lines = [e.time, e.age ? `Data age ${e.age}` : null, e.source, e.attribution ? `© ${e.attribution}` : null, e.note ?? null];
        item.append(head);
        for (const text of lines) {
          if (!text) continue;
          const p = document.createElement('div');
          p.className = 'prov-line';
          p.textContent = text;
          item.append(p);
        }
        return item;
      }),
    );
  }
}
