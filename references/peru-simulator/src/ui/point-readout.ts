/** A readout line: plain strings are captions, `{ value }` lines are emphasized values. */
export type ReadoutLine = string | { readonly value: string };

/** Small popup at a clicked terrain position showing queried layer values. */
export class PointReadout {
  readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'panel point-readout';
    this.element.setAttribute('role', 'status');
    this.element.hidden = true;
  }

  show(x: number, y: number, lines: readonly ReadoutLine[]): void {
    this.element.replaceChildren(
      ...lines.map((line) => {
        const d = document.createElement('div');
        d.className = typeof line === 'string' ? 'readout-line' : 'readout-value';
        d.textContent = typeof line === 'string' ? line : line.value;
        return d;
      }),
    );
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
