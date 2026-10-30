import { describe, expect, it } from 'vitest';
import { formatAge, formatUtc, forecastLabel, mergeTimes, nearestIndex, stepIndex, type TimeEntry } from './timeline';

const H = 3600_000;
const issue = Date.UTC(2026, 9, 17, 18);
const times: TimeEntry[] = [0, 3, 6, 9].map((h) => ({ id: `t${h}`, validTime: issue + h * H, forecastHour: h }));

describe('timeline', () => {
  it('finds the frame nearest to a time', () => {
    expect(nearestIndex(times, issue - 10 * H)).toBe(0);
    expect(nearestIndex(times, issue + 4 * H)).toBe(1);
    expect(nearestIndex(times, issue + 5 * H)).toBe(2);
    expect(nearestIndex(times, issue + 99 * H)).toBe(3);
    expect(nearestIndex([], issue)).toBe(-1);
  });

  it('steps with wrap-around for playback', () => {
    expect(stepIndex(0, 4, 1)).toBe(1);
    expect(stepIndex(3, 4, 1)).toBe(0);
    expect(stepIndex(0, 4, -1)).toBe(3);
    expect(stepIndex(3, 4, 1, false)).toBe(3);
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });

  it('merges time lists from several layers by valid time', () => {
    const other: TimeEntry[] = [
      { id: 'x3', validTime: issue + 3 * H, forecastHour: 3 },
      { id: 'x12', validTime: issue + 12 * H, forecastHour: 12 },
    ];
    expect(mergeTimes([times, other]).map((t) => t.validTime)).toEqual([0, 3, 6, 9, 12].map((h) => issue + h * H));
  });

  it('formats UTC times, forecast offsets and data age', () => {
    expect(formatUtc(issue)).toBe('2026-10-17 18:00 UTC');
    expect(forecastLabel(issue + 6 * H, issue)).toBe('Forecast +6h from 2026-10-17 18:00 UTC');
    expect(forecastLabel(issue, issue)).toBe('Forecast +0h (analysis) from 2026-10-17 18:00 UTC');
    expect(formatAge(42)).toBe('42 s');
    expect(formatAge(5 * 60)).toBe('5 min');
    expect(formatAge(5 * 3600 + 43 * 60)).toBe('5 h 43 min');
    expect(formatAge(2 * 86400 + 3600)).toBe('2 d 1 h');
  });
});
