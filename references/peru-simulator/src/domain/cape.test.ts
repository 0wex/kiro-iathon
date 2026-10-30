import { describe, expect, it } from 'vitest';
import { CAPE_CATEGORIES, CAPE_LEGEND_NOTE, CAPE_LEGEND_TITLE, capeCategory, formatCape } from './cape';

describe('convective potential (CAPE) categories', () => {
  it('uses the agreed thresholds: transparent below 250 J/kg', () => {
    expect(CAPE_CATEGORIES.map((c) => c.min)).toEqual([250, 1000, 2500]);
    expect(CAPE_CATEGORIES.map((c) => c.label)).toEqual(['Marginal', 'Moderate', 'High']);
    expect(capeCategory(0)).toBeNull();
    expect(capeCategory(249.9)).toBeNull();
    expect(capeCategory(Number.NaN)).toBeNull();
    expect(capeCategory(250)!.label).toBe('Marginal');
    expect(capeCategory(999)!.label).toBe('Marginal');
    expect(capeCategory(1000)!.label).toBe('Moderate');
    expect(capeCategory(2500)!.label).toBe('High');
    expect(capeCategory(6000)!.label).toBe('High');
  });

  it('is hatched and uses violet/magenta hues distinct from rain and lightning', () => {
    for (const c of CAPE_CATEGORIES) {
      const [r, g, b] = c.color;
      // Blue clearly above green: violet/magenta, never the yellow/white of lightning or rain greens.
      expect(b).toBeGreaterThan(g + 60);
      expect(r).toBeGreaterThan(g);
      expect(c.hatchPx).toBeGreaterThan(0);
    }
    // Stronger categories: denser hatching and more fill.
    expect(CAPE_CATEGORIES[2]!.hatchPx).toBeLessThan(CAPE_CATEGORIES[0]!.hatchPx);
    expect(CAPE_CATEGORIES[2]!.fill).toBeGreaterThan(CAPE_CATEGORIES[0]!.fill);
  });

  it('labels the legend as forecast potential', () => {
    expect(CAPE_LEGEND_TITLE).toBe('Convective potential (forecast) — GFS CAPE, J/kg');
    expect(CAPE_LEGEND_NOTE).toContain('Potential, not observed storms');
  });

  it('formats point values with the category', () => {
    expect(formatCape(1342.6)).toBe('1,343 J/kg · moderate potential (forecast)');
    expect(formatCape(120)).toBe('120 J/kg · no significant potential (forecast)');
    expect(formatCape(null)).toBe('No data here');
  });
});
