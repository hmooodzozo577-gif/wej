// Regression tests for the excludedCountries.ts mechanism, exercised here
// with its current QA test fixture (Monaco, mc/MC/MCO — see that file). To
// revert to the full 195/165 catalog, empty EXCLUDED_COUNTRIES there; these
// tests are written against the config, not a hard-coded country, so they
// stay meaningful either way.
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG, countryInfoOf } from './worldCatalog';
import { BASIC_COUNTRIES } from './basicCountries';
import { DESTINATIONS } from './destinations';
import { EXCLUDED_COUNTRIES, isExcludedIso2, isExcludedIso3 } from './excludedCountries';

describe('excludedCountries — country-exclusion mechanism', () => {
  it('has at least one configured entry for this QA test', () => {
    expect(EXCLUDED_COUNTRIES.length).toBeGreaterThan(0);
  });

  it('every configured entry is absent from WORLD_CATALOG, BASIC_COUNTRIES, and DESTINATIONS', () => {
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(WORLD_CATALOG.some((c) => c.countryCode === excluded.iso2)).toBe(false);
      expect(BASIC_COUNTRIES.some((c) => c.countryCode === excluded.iso2)).toBe(false);
      expect(DESTINATIONS.some((d) => d.countryCode === excluded.iso2)).toBe(false);
    }
  });

  it('every configured entry cannot be resolved through countryInfoOf() by any plausible id', () => {
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(countryInfoOf(excluded.iso2.toLowerCase())).toBeUndefined();
      expect(countryInfoOf(excluded.iso3.toLowerCase())).toBeUndefined();
    }
  });

  it('no remaining country\'s Country Information lists an excluded neighbor in its borders', () => {
    for (const entry of WORLD_CATALOG) {
      const info = countryInfoOf(entry.id);
      if (!info) continue;
      for (const excluded of EXCLUDED_COUNTRIES) {
        expect(
          info.borders.includes(excluded.iso3),
          `${entry.id} still lists excluded ${excluded.iso3} in borders`,
        ).toBe(false);
      }
    }
  });

  it('France (a real neighbor of the QA test country) keeps its other borders intact', () => {
    const info = countryInfoOf('france'); // one of the 30 original destinations — see destinations.json
    expect(info).toBeDefined();
    // Still has its real neighbors...
    expect(info!.borders).toEqual(expect.arrayContaining(['DEU', 'ESP', 'ITA', 'CHE', 'BEL', 'LUX', 'AND']));
    // ...but not an excluded one.
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(info!.borders).not.toContain(excluded.iso3);
    }
  });

  it('isExcludedIso2/Iso3 only match configured entries — everything else passes through unaffected', () => {
    expect(isExcludedIso2('FR')).toBe(false);
    expect(isExcludedIso2('EG')).toBe(false);
    expect(isExcludedIso3('FRA')).toBe(false);
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(isExcludedIso2(excluded.iso2)).toBe(true);
      expect(isExcludedIso3(excluded.iso3)).toBe(true);
    }
  });

  it('every remaining catalog entry is still fully valid (non-empty names, resolvable country info)', () => {
    for (const entry of WORLD_CATALOG) {
      expect(entry.nameEn.length).toBeGreaterThan(0);
      expect(entry.nameAr.length).toBeGreaterThan(0);
      expect(countryInfoOf(entry.id)).toBeDefined();
    }
  });

  it('the effective catalog size is exactly the base 195 minus the number of configured exclusions', () => {
    expect(WORLD_CATALOG).toHaveLength(195 - EXCLUDED_COUNTRIES.length);
  });
});
