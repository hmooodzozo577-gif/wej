// Phase 11 Step 3 — border-country resolution (resolveBorderCountry /
// resolvedBordersOf in worldCatalog.ts).
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG, resolveBorderCountry, resolvedBordersOf } from './worldCatalog';
import { EXCLUDED_COUNTRIES } from './excludedCountries';

describe('Phase 11 Step 3 — resolveBorderCountry', () => {
  it('resolves real ISO3 codes to the correct catalog entry, for both a full destination and a basic country', () => {
    expect(resolveBorderCountry('DEU')?.id).toBe('germany'); // one of the 30
    expect(resolveBorderCountry('ITA')?.id).toBe('italy'); // one of the 30
    expect(resolveBorderCountry('AND')?.id).toBe('ad'); // a basic country (Andorra)
  });

  it('is case-insensitive on the input code', () => {
    expect(resolveBorderCountry('deu')?.id).toBe('germany');
  });

  it('returns undefined for an unknown/invalid code', () => {
    expect(resolveBorderCountry('XXX')).toBeUndefined();
    expect(resolveBorderCountry('')).toBeUndefined();
  });

  it('never resolves an excluded country\'s iso3 (Monaco, MCO, currently excluded)', () => {
    expect(EXCLUDED_COUNTRIES.some((c) => c.iso3 === 'MCO')).toBe(true); // sanity: this is what's configured
    expect(resolveBorderCountry('MCO')).toBeUndefined();
  });
});

describe('Phase 11 Step 3 — resolvedBordersOf', () => {
  it('France resolves to its real neighbors, including both a full destination and basic countries, excluding the excluded one', () => {
    const borders = resolvedBordersOf('france');
    const ids = borders.map((b) => b.id);
    expect(ids).toContain('germany'); // full destination
    expect(ids).toContain('italy'); // full destination
    expect(ids).toContain('ad'); // basic country (Andorra)
    // Monaco (excluded) must not appear even though France's raw
    // countryInfo.borders includes "MCO".
    expect(borders.some((b) => b.countryCode === 'MC')).toBe(false);
  });

  it('returns an empty array (never throws) for a country with no land borders', () => {
    expect(resolvedBordersOf('japan')).toEqual([]);
  });

  it('returns an empty array (never throws) for an unknown id', () => {
    expect(resolvedBordersOf('does-not-exist')).toEqual([]);
  });

  it('no result ever contains the queried country itself (self-link protection)', () => {
    for (const entry of WORLD_CATALOG) {
      const borders = resolvedBordersOf(entry.id);
      expect(borders.some((b) => b.id === entry.id), `${entry.id} lists itself as a border`).toBe(false);
    }
  });

  it('no result ever contains a duplicate entry', () => {
    for (const entry of WORLD_CATALOG) {
      const ids = resolvedBordersOf(entry.id).map((b) => b.id);
      expect(new Set(ids).size, `${entry.id} has duplicate border entries`).toBe(ids.length);
    }
  });

  it('no result ever contains an excluded country, for any catalog entry', () => {
    for (const entry of WORLD_CATALOG) {
      const borders = resolvedBordersOf(entry.id);
      for (const excluded of EXCLUDED_COUNTRIES) {
        expect(borders.some((b) => b.countryCode === excluded.iso2)).toBe(false);
      }
    }
  });

  it('every resolved border entry has usable localized names for both languages', () => {
    for (const b of resolvedBordersOf('france')) {
      expect(b.nameEn.length).toBeGreaterThan(0);
      expect(b.nameAr.length).toBeGreaterThan(0);
    }
  });
});
