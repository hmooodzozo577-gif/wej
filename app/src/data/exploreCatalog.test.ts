// Phase 16 workstream B — "Nearest to me" must exclude the traveller's
// current country. Verified against the REAL exploreCatalog.ts
// implementation (already labeled "Item #10" in that file's own comments
// — this exclusion was already built and shipped, not a bug; this file
// closes the actual gap, which was that no dedicated test exercised it).
import { describe, expect, it } from 'vitest';
import { filteredCatalog, sortCatalog } from './exploreCatalog';
import { WORLD_CATALOG } from './worldCatalog';
import type { LocationCoords } from '../state/types';

// Saudi Arabia's own catalog centroid — simulating a traveller physically
// located there. Using a real committed coordinate (countryInfo.json),
// not an invented one.
const SAUDI_ORIGIN: LocationCoords = { lat: 25, lng: 45 };

describe('sortCatalog — "nearest"/"farthest" exclude the traveller\'s current country', () => {
  it('excludes the current country from "nearest" sorting', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_ORIGIN);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(false);
  });

  it('excludes the current country from "farthest" sorting too — it is not a real farthest-away recommendation either', () => {
    const result = sortCatalog(WORLD_CATALOG, 'farthest', 'en', SAUDI_ORIGIN);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(false);
  });

  it('neighboring countries still sort correctly — a genuinely nearby country ranks ahead of a genuinely distant one', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_ORIGIN);
    const uaeIndex = result.findIndex((entry) => entry.countryCode === 'AE'); // neighboring
    const japanIndex = result.findIndex((entry) => entry.countryCode === 'JP'); // far away
    expect(uaeIndex).toBeGreaterThanOrEqual(0);
    expect(japanIndex).toBeGreaterThanOrEqual(0);
    expect(uaeIndex).toBeLessThan(japanIndex);
  });

  it('"farthest" is the exact reverse ordering of "nearest" among the same (current-country-excluded) candidates', () => {
    const nearest = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_ORIGIN);
    const farthest = sortCatalog(WORLD_CATALOG, 'farthest', 'en', SAUDI_ORIGIN);
    expect(farthest.map((entry) => entry.countryCode)).toEqual([...nearest.map((entry) => entry.countryCode)].reverse());
  });

  it('does not globally remove the country from the catalog — it is present in WORLD_CATALOG and every non-distance sort', () => {
    expect(WORLD_CATALOG.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byName = sortCatalog(WORLD_CATALOG, 'name-asc', 'en', SAUDI_ORIGIN);
    expect(byName.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byArea = sortCatalog(WORLD_CATALOG, 'area-desc', 'en', SAUDI_ORIGIN);
    expect(byArea.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byCost = sortCatalog(WORLD_CATALOG, 'cost-asc', 'en', SAUDI_ORIGIN);
    expect(byCost.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('remains fully accessible via search (filteredCatalog) regardless of the distance-sort exclusion', () => {
    const results = filteredCatalog({ q: 'Saudi', region: '', purpose: '', cost: '', sort: 'default' });
    expect(results.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('no location context: neither distance sort is applied — the list is returned unsorted rather than pretending', () => {
    const withoutOrigin = sortCatalog(WORLD_CATALOG, 'nearest', 'en', null);
    expect(withoutOrigin.map((entry) => entry.id)).toEqual(WORLD_CATALOG.map((entry) => entry.id));
    expect(withoutOrigin.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('current-country resolution being uncertain (no origin at all) never incorrectly hides a country', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', undefined);
    expect(result.length).toBe(WORLD_CATALOG.length);
  });

  it('a different current country (not Saudi Arabia) is excluded instead — the exclusion tracks the real origin, not a fixed country', () => {
    const japanOrigin: LocationCoords = { lat: 36, lng: 138 };
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', japanOrigin);
    expect(result.some((entry) => entry.countryCode === 'JP')).toBe(false);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(true); // Saudi Arabia is NOT excluded now
  });

  it('AR and EN both produce the same exclusion and the same relative ordering, differing only in the tie-break locale', () => {
    const en = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_ORIGIN);
    const ar = sortCatalog(WORLD_CATALOG, 'nearest', 'ar', SAUDI_ORIGIN);
    expect(en.some((entry) => entry.countryCode === 'SA')).toBe(false);
    expect(ar.some((entry) => entry.countryCode === 'SA')).toBe(false);
    expect(en.map((entry) => entry.countryCode)).toEqual(ar.map((entry) => entry.countryCode));
  });
});
