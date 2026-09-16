import { describe, expect, it } from 'vitest';
import { computePurposeSuitability, type CountryObservations } from './score';
import { METHODOLOGIES } from './methodology';
import { SUITABLE_PURPOSES } from './types';

const YEAR = '2024';

/** Builds a population where `overrides` describes just the countries that
 *  need specific values; the rest get plausible mid-range values for every
 *  factor tourism uses, so coverage/score tests aren't accidentally
 *  starved of a normalizable population. */
function tourismPopulation(overrides: Record<string, Partial<Record<string, number>>> = {}): CountryObservations[] {
  // A realistic-sized population (this module normalizes over ~190
  // countries in production) so p5/p95 winsorizing has enough points to
  // actually discriminate — 10-12 points, as used in a couple of these
  // tests below, clamp everyone to the same extreme under nearest-rank
  // percentile, which isn't representative of real usage.
  const codes = Array.from({ length: 40 }, (_, i) => `C${i.toString().padStart(2, '0')}`);
  return codes.map((code, i) => {
    // Mild deterministic spread per country rather than one identical
    // value repeated 40 times — a real 194-country population always
    // varies, and an all-identical population is a degenerate edge case
    // in its own right (covered separately in normalize.test.ts), not a
    // realistic stand-in for "everyone in the middle of the pack".
    const spread = i - 20;
    const base = {
      homicideRate: 3 + spread * 0.2,
      priceLevelIndex: 80 + spread * 1.5,
      tourismArrivals: 2_000_000 + spread * 50_000,
      lifeExpectancy: 75 + spread * 0.3,
      gdpGrowthPct: 2 + spread * 0.1,
      urbanPopulationPct: 60 + spread,
    };
    return {
      countryCode: code,
      observations: Object.fromEntries(
        Object.entries({ ...base, ...(overrides[code] ?? {}) }).map(([key, value]) => [key, value === undefined ? undefined : { value, year: YEAR }]),
      ),
    };
  });
}

describe('computePurposeSuitability', () => {
  it('produces a score for every purpose using that population', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const countries = tourismPopulation();
      const results = computePurposeSuitability(purpose, countries, '2026-01-01');
      expect(results.size).toBe(countries.length);
    }
  });

  it('score stays within 0..100 inclusive, and is never NaN or Infinity, across all purposes', () => {
    const countries = tourismPopulation({
      C00: { homicideRate: 0, priceLevelIndex: 0, tourismArrivals: 0, lifeExpectancy: 0, gdpGrowthPct: -50, urbanPopulationPct: 0 },
      C01: { homicideRate: 1e9, priceLevelIndex: 1e9, tourismArrivals: 1e9, lifeExpectancy: 1e9, gdpGrowthPct: 1e9, urbanPopulationPct: 1e9 },
    });
    for (const purpose of SUITABLE_PURPOSES) {
      const results = computePurposeSuitability(purpose, countries, '2026-01-01');
      for (const result of results.values()) {
        if (result.score !== null) {
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          expect(Number.isFinite(result.score)).toBe(true);
        }
        expect(Number.isFinite(result.coverage)).toBe(true);
        expect(result.coverage).toBeGreaterThanOrEqual(0);
        expect(result.coverage).toBeLessThanOrEqual(100);
      }
    }
  });

  it('reports insufficient data (score: null) when a country is missing too many factors, never a fabricated number', () => {
    const countries = tourismPopulation({
      // Only 1 of tourism's 6 factors observed for ZZ — well under the 60% threshold.
      ZZ: {},
    });
    countries.push({
      countryCode: 'ZZ',
      observations: { homicideRate: { value: 2, year: YEAR } },
    });
    const results = computePurposeSuitability('tourism', countries, '2026-01-01');
    const zz = results.get('ZZ')!;
    expect(zz.insufficientData).toBe(true);
    expect(zz.score).toBeNull();
    expect(zz.confidence).toBeNull();
    // Partial component data is still preserved for transparency (task 3.11).
    expect(zz.components.length).toBe(METHODOLOGIES.tourism.factors.length);
    expect(zz.components.some((c) => c.status === 'observed')).toBe(true);
  });

  it('does not artificially fill missing values — a missing factor is recorded as status "missing" with null normalized value', () => {
    const countries = tourismPopulation({ C00: { tourismArrivals: undefined } });
    const results = computePurposeSuitability('tourism', countries, '2026-01-01');
    const aa = results.get('C00')!;
    const touristDraw = aa.components.find((c) => c.factor === 'touristDraw')!;
    expect(touristDraw.status).toBe('missing');
    expect(touristDraw.normalizedValue).toBeNull();
    expect(touristDraw.rawValue).toBeNull();
    expect(touristDraw.contribution).toBeNull();
  });

  it('a country with full data scores strictly higher on a purpose than a materially worse one, all else equal', () => {
    const countries = tourismPopulation({
      GOOD: { homicideRate: 0.5, priceLevelIndex: 40, tourismArrivals: 50_000_000, lifeExpectancy: 85, gdpGrowthPct: 6, urbanPopulationPct: 90 },
      BAD: { homicideRate: 40, priceLevelIndex: 200, tourismArrivals: 1000, lifeExpectancy: 55, gdpGrowthPct: -5, urbanPopulationPct: 10 },
    });
    countries.push(
      { countryCode: 'GOOD', observations: { homicideRate: { value: 0.5, year: YEAR }, priceLevelIndex: { value: 40, year: YEAR }, tourismArrivals: { value: 50_000_000, year: YEAR }, lifeExpectancy: { value: 85, year: YEAR }, gdpGrowthPct: { value: 6, year: YEAR }, urbanPopulationPct: { value: 90, year: YEAR } } },
      { countryCode: 'BAD', observations: { homicideRate: { value: 40, year: YEAR }, priceLevelIndex: { value: 200, year: YEAR }, tourismArrivals: { value: 1000, year: YEAR }, lifeExpectancy: { value: 55, year: YEAR }, gdpGrowthPct: { value: -5, year: YEAR }, urbanPopulationPct: { value: 10, year: YEAR } } },
    );
    const results = computePurposeSuitability('tourism', countries, '2026-01-01');
    expect(results.get('GOOD')!.score!).toBeGreaterThan(results.get('BAD')!.score!);
  });

  it('model version is recorded on every result and matches the methodology', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const results = computePurposeSuitability(purpose, tourismPopulation(), '2026-01-01');
      for (const result of results.values()) expect(result.modelVersion).toBe(METHODOLOGIES[purpose].modelVersion);
    }
  });

  it('confidence is only ever set alongside a real score, and coverage/confidence disclose the data gap rather than hiding it', () => {
    // 4 of 6 tourism factors observed = 67% coverage, above the 60% threshold, so a score IS computed —
    // but confidence must reflect the partial coverage rather than claim full certainty.
    const countries = tourismPopulation({ C00: { urbanPopulationPct: undefined, gdpGrowthPct: undefined } });
    const results = computePurposeSuitability('tourism', countries, '2026-01-01');
    const aa = results.get('C00')!;
    expect(aa.score).not.toBeNull();
    expect(aa.coverage).toBeLessThan(100);
    expect(aa.confidence).not.toBeNull();
  });

  it('sources lists only the sources actually used (observed), not the full methodology catalog', () => {
    const countries = tourismPopulation({ C00: { tourismArrivals: undefined } });
    const results = computePurposeSuitability('tourism', countries, '2026-01-01');
    const aa = results.get('C00')!;
    expect(aa.sources).not.toContain('tourismArrivals');
    expect(aa.sources.length).toBeLessThan(METHODOLOGIES.tourism.factors.length);
  });

  it('is deterministic — the same input always produces the same output', () => {
    const countries = tourismPopulation();
    const first = computePurposeSuitability('tourism', countries, '2026-01-01');
    const second = computePurposeSuitability('tourism', countries, '2026-01-01');
    for (const code of first.keys()) {
      expect(second.get(code)!.score).toBe(first.get(code)!.score);
      expect(second.get(code)!.coverage).toBe(first.get(code)!.coverage);
    }
  });

  it('handles an empty population without throwing', () => {
    expect(() => computePurposeSuitability('tourism', [], '2026-01-01')).not.toThrow();
    expect(computePurposeSuitability('tourism', [], '2026-01-01').size).toBe(0);
  });
});
