// Phase 11 Step 1 — build-time Country Information dataset.
import { describe, expect, it } from 'vitest';
import { COUNTRY_INFO } from './countryInfo';
import { WORLD_CATALOG, countryInfoOf } from './worldCatalog';

describe('Phase 11 Step 1 — Country Information dataset', () => {
  it('has exactly 195 records (one per catalog country)', () => {
    expect(Object.keys(COUNTRY_INFO)).toHaveLength(195);
  });

  it('every WORLD_CATALOG entry resolves to a Country Information record via its id', () => {
    for (const entry of WORLD_CATALOG) {
      const info = countryInfoOf(entry.id);
      expect(info, `missing country info for ${entry.id}`).toBeDefined();
      expect(info!.iso2).toBe(entry.countryCode.toUpperCase());
    }
  });

  it('no duplicate iso2 keys — each record key matches its own iso2 field', () => {
    for (const [key, info] of Object.entries(COUNTRY_INFO)) {
      expect(info.iso2).toBe(key);
    }
    expect(new Set(Object.keys(COUNTRY_INFO)).size).toBe(195);
  });

  it('every record has a valid positive area', () => {
    for (const info of Object.values(COUNTRY_INFO)) {
      expect(info.areaKm2, `${info.iso2} area`).toBeGreaterThan(0);
    }
  });

  it('every currency entry has a valid structure (non-empty code and name; optional string symbol)', () => {
    for (const info of Object.values(COUNTRY_INFO)) {
      for (const c of info.currencies) {
        expect(c.code.length, `${info.iso2} currency code`).toBeGreaterThan(0);
        expect(c.name.length, `${info.iso2} currency name`).toBeGreaterThan(0);
        if (c.symbol !== undefined) expect(typeof c.symbol).toBe('string');
      }
    }
  });

  it('every border code is a valid ISO 3166-1 alpha-3 code', () => {
    const iso3Pattern = /^[A-Z]{3}$/;
    for (const info of Object.values(COUNTRY_INFO)) {
      for (const b of info.borders) {
        expect(b, `${info.iso2} border code "${b}"`).toMatch(iso3Pattern);
      }
    }
  });

  it('every record has a non-empty "+"-prefixed calling code and at least one language', () => {
    for (const info of Object.values(COUNTRY_INFO)) {
      expect(info.callingCode.startsWith('+'), `${info.iso2} calling code`).toBe(true);
      expect(info.languagesEn.length, `${info.iso2} languages`).toBeGreaterThan(0);
    }
  });

  it('a documented data gap stays an empty array, not a fabricated value (Micronesia has no reported currency)', () => {
    expect(COUNTRY_INFO.FM.currencies).toEqual([]);
  });

  it('an island nation correctly has zero land borders (Japan)', () => {
    expect(COUNTRY_INFO.JP.borders).toEqual([]);
  });
});
