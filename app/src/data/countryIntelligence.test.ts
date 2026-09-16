// Integrity checks against the REAL committed country intelligence
// snapshot (not synthetic fixtures — those live in
// src/intelligence/score.test.ts). This is the "does the generated data
// actually look right" layer: every effective country covered, no
// excluded country present, scores in bounds, coverage report consistent
// with the summary it was built from.
import { describe, expect, it } from 'vitest';
import { COUNTRY_INTELLIGENCE_MODEL_VERSIONS, getCountrySuitability } from './countryIntelligence';
import { SUITABLE_PURPOSES } from '../intelligence/types';
import { WORLD_CATALOG } from './worldCatalog';
import { isExcludedIso2 } from './excludedCountries';

describe('the committed country intelligence snapshot', () => {
  it('covers every effective catalog country for every suitable purpose', () => {
    for (const entry of WORLD_CATALOG) {
      const suitability = getCountrySuitability(entry.countryCode);
      expect(suitability.length, `${entry.countryCode} should have one entry per purpose`).toBe(SUITABLE_PURPOSES.length);
      for (const purpose of SUITABLE_PURPOSES) {
        expect(suitability.some((s) => s.purpose === purpose), `${entry.countryCode} missing ${purpose}`).toBe(true);
      }
    }
  });

  it('never contains an excluded country (IL)', () => {
    expect(getCountrySuitability('IL')).toEqual([]);
    for (const entry of WORLD_CATALOG) expect(isExcludedIso2(entry.countryCode)).toBe(false);
  });

  it('every score is either null (insufficient data) or a finite 0..100 integer', () => {
    for (const entry of WORLD_CATALOG) {
      for (const suitability of getCountrySuitability(entry.countryCode)) {
        if (suitability.insufficientData) {
          expect(suitability.score).toBeNull();
          expect(suitability.confidence).toBeNull();
        } else {
          expect(suitability.score).not.toBeNull();
          expect(Number.isInteger(suitability.score)).toBe(true);
          expect(suitability.score as number).toBeGreaterThanOrEqual(0);
          expect(suitability.score as number).toBeLessThanOrEqual(100);
          expect(['high', 'medium', 'low']).toContain(suitability.confidence);
        }
        expect(suitability.coverage).toBeGreaterThanOrEqual(0);
        expect(suitability.coverage).toBeLessThanOrEqual(100);
      }
    }
  });

  it('records a model version for every suitable purpose, matching each entry', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      expect(COUNTRY_INTELLIGENCE_MODEL_VERSIONS[purpose]).toMatch(new RegExp(`^${purpose}-v\\d+$`));
    }
    for (const entry of WORLD_CATALOG) {
      for (const suitability of getCountrySuitability(entry.countryCode)) {
        expect(suitability.modelVersion).toBe(COUNTRY_INTELLIGENCE_MODEL_VERSIONS[suitability.purpose]);
      }
    }
  });

  it('returns an empty array for an unknown country code rather than throwing', () => {
    expect(getCountrySuitability('ZZ')).toEqual([]);
  });
});
