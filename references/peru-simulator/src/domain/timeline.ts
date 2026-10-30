/** One available valid time of a layer. Times are epoch milliseconds (UTC). */
export interface TimeEntry {
  readonly id: string;
  readonly validTime: number;
  readonly forecastHour: number;
}

export function nearestIndex(times: readonly TimeEntry[], t: number): number {
  let best = -1;
  let bestDist = Infinity;
  times.forEach((e, i) => {
    const d = Math.abs(e.validTime - t);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export function stepIndex(index: number, count: number, delta: number, wrap = true): number {
  if (count <= 0) return -1;
  const next = index + delta;
  if (wrap) return ((next % count) + count) % count;
  return Math.min(count - 1, Math.max(0, next));
}

/** Union of several layers' times by valid time (first entry wins), ascending. */
export function mergeTimes(lists: readonly (readonly TimeEntry[])[]): TimeEntry[] {
  const byTime = new Map<number, TimeEntry>();
  for (const list of lists) for (const e of list) if (!byTime.has(e.validTime)) byTime.set(e.validTime, e);
  return [...byTime.values()].sort((a, b) => a.validTime - b.validTime);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function forecastLabel(validTime: number, issueTime: number): string {
  const hours = Math.round((validTime - issueTime) / 3_600_000);
  const lead = hours === 0 ? '+0h (analysis)' : `${hours > 0 ? '+' : ''}${hours}h`;
  return `Forecast ${lead} from ${formatUtc(issueTime)}`;
}

export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
