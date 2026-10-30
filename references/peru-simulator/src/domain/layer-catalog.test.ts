import { describe, expect, it } from 'vitest';
import { parseCatalog } from './layer-catalog';

const layer = {
  id: 'gfs-t2m',
  title: 'Temperature (2 m)',
  kind: 'forecast',
  source: 'NOAA GFS',
  attribution: 'NOAA/NCEP',
  units: '°C',
  displayRange: [-10, 40],
  valueRange: [-2, 40],
  status: 'ready',
  error: null,
  issueTime: '2026-10-17T18:00:00Z',
  ageSeconds: 3600,
  times: [{ id: '20261017T1800Z', validTime: '2026-10-17T18:00:00Z', forecastHour: 0 }],
};

describe('parseCatalog', () => {
  it('parses layers with times as epoch ms', () => {
    const c = parseCatalog({ generatedAt: '2026-10-17T19:00:00Z', layers: [layer] });
    expect(c).not.toBeNull();
    const l = c!.layers[0]!;
    expect(l.kind).toBe('forecast');
    expect(l.issueTime).toBe(Date.UTC(2026, 9, 17, 18));
    expect(l.times[0]).toEqual({ id: '20261017T1800Z', validTime: Date.UTC(2026, 9, 17, 18), forecastHour: 0 });
    expect(l.displayRange).toEqual([-10, 40]);
  });

  it('drops invalid layers and rejects invalid documents', () => {
    expect(parseCatalog({ layers: [{ ...layer, kind: 'guess' }, layer] })!.layers).toHaveLength(1);
    expect(parseCatalog({ layers: [{ ...layer, times: [{ id: '../x', validTime: 'x' }] }] })!.layers[0]!.times).toEqual([]);
    expect(parseCatalog({})).toBeNull();
    expect(parseCatalog('nope')).toBeNull();
  });

  it('keeps layers without data (status error, no issue time)', () => {
    const l = parseCatalog({ layers: [{ ...layer, status: 'error', error: 'boom', issueTime: null, times: [] }] })!.layers[0]!;
    expect(l.status).toBe('error');
    expect(l.error).toBe('boom');
    expect(l.issueTime).toBeNull();
  });
});
