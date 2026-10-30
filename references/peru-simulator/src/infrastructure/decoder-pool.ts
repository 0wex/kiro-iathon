import type { DecodedHeightTile, DecodeRequest, DecodeResponse, ElevationFormat } from './decode-protocol';

interface PendingDecode {
  resolve: (tile: DecodedHeightTile) => void;
  reject: (error: Error) => void;
  worker: number;
}

/** Pool of decode workers; buffers are transferred, never copied. */
export class DecoderPool {
  private readonly workers: Worker[] = [];
  private readonly load: number[] = [];
  private readonly pending = new Map<number, PendingDecode>();
  private nextId = 1;

  constructor(size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1))) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<DecodeResponse>) => this.onMessage(event.data);
      this.workers.push(worker);
      this.load.push(0);
    }
  }

  decode(format: ElevationFormat, buffer: ArrayBuffer, signal?: AbortSignal): Promise<DecodedHeightTile> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const id = this.nextId++;
    const worker = this.leastBusy();
    this.load[worker]!++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, worker });
      // Workers cannot be interrupted mid-decode; an abort just discards the result.
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      const request: DecodeRequest = { id, format, buffer };
      this.workers[worker]!.postMessage(request, [buffer]);
    });
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    for (const p of this.pending.values()) p.reject(new Error('Decoder pool disposed'));
    this.pending.clear();
  }

  private leastBusy(): number {
    let best = 0;
    for (let i = 1; i < this.load.length; i++) if (this.load[i]! < this.load[best]!) best = i;
    return best;
  }

  private onMessage(response: DecodeResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    this.load[pending.worker]!--;
    if (response.ok) {
      const { heights, offset, width, height, min, max } = response;
      pending.resolve({ heights, offset, width, height, min, max });
    } else {
      pending.reject(new Error(response.error));
    }
  }
}
