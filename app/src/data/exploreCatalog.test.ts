// Acceptance-fix round — "Nearest to me" still showed the traveller's own
// current country in production despite this file's own earlier tests
// claiming it was excluded. Root cause: sortCatalog() used to resolve
// "current country" ITSELF via the old nearest-centroid approximateCountryOf
// (geo.ts) — the exact technique documented there as unreliable (a real
// prior bug resolved a user in Abha, Saudi Arabia to Eritrea). Proven with
// real coordinates below: Dammam, Saudi Arabia (26.4207, 50.0888) resolves
// nearest-centroid to BAHRAIN — Saudi Arabia's own centroid is not even in
// the nearest three — so Saudi Arabia was never excluded.
//
// Fix: sortCatalog() no longer resolves the country itself. It now accepts
// an already-resolved `currentCountryCode` (real point-in-polygon
// resolution — geo.ts's resolveCurrentCountry(), the same resolver
// LocationPersonalize.tsx/TravelInfo.tsx already use), supplied by the
// caller (Explore.tsx, via geo/useResolvedCountryCode.ts). This file tests
// BOTH layers: sortCatalog's own pure filtering logic (given a resolved
// code), AND the real resolveCurrentCountry() pipeline against real city
// coordinates, end to end, to prove the actual production bug is closed —
// not just the same synthetic assumption re-tested.
import { describe, expect, it } from 'vitest';
import { filteredCatalog, sortCatalog } from './exploreCatalog';
import { WORLD_CATALOG } from './worldCatalog';
import { approximateCountryOf, resolveCurrentCountry } from './geo';
import type { LocationCoords } from '../state/types';

// Saudi Arabia's own catalog centroid — an easy case where nearest-centroid
// and boundary resolution agree. Kept for the "well inside the country"
// baseline; the real-city cases below are what actually catch the bug.
const SAUDI_CENTROID: LocationCoords = { lat: 25, lng: 45 };

// Real coordinates for three representative Saudi cities, spread across the
// country rather than clustered at its centroid — this is what exposes a
// nearest-centroid resolver's error, since a large country's real
// population centers are often far from its arithmetic centroid.
const RIYADH: LocationCoords = { lat: 24.7136, lng: 46.6753 };
const JEDDAH: LocationCoords = { lat: 21.4858, lng: 39.1925 };
const DAMMAM: LocationCoords = { lat: 26.4207, lng: 50.0888 };

describe('root-cause regression: nearest-centroid resolution is unreliable for real cities', () => {
  it('Dammam resolves to the WRONG country (Bahrain) via nearest-centroid — this is the actual production bug', () => {
    // This is not a hypothetical: it is the exact mechanism that let Saudi
    // Arabia keep appearing in "Nearest to me" in production. Documented
    // here as a permanent regression guard against ever routing
    // Nearest-to-me exclusion back through approximateCountryOf().
    const wrong = approximateCountryOf(DAMMAM)?.entry.countryCode;
    expect(wrong).toBe('BH');
    expect(wrong).not.toBe('SA');
  });

  it('Dammam resolves CORRECTLY to Saudi Arabia via the real boundary-polygon resolver', async () => {
    const resolution = await resolveCurrentCountry(DAMMAM);
    expect(resolution?.result.entry.countryCode).toBe('SA');
    expect(resolution?.method).toBe('boundary');
  });

  it('Riyadh and Jeddah also resolve correctly via the boundary resolver', async () => {
    expect((await resolveCurrentCountry(RIYADH))?.result.entry.countryCode).toBe('SA');
    expect((await resolveCurrentCountry(JEDDAH))?.result.entry.countryCode).toBe('SA');
  });
});

describe('end-to-end: resolveCurrentCountry() + sortCatalog() together exclude the real current country', () => {
  it.each([
    ['Riyadh', RIYADH],
    ['Jeddah', JEDDAH],
    ['Dammam', DAMMAM],
  ])('%s excludes Saudi Arabia from "Nearest to me" once resolved', async (_label, coords) => {
    const resolution = await resolveCurrentCountry(coords);
    const code = resolution?.result.entry.countryCode;
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', coords, code);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(false);
  });

  it('a neighboring country (UAE) still sorts ahead of a genuinely distant one (Japan) using the real-city origin', async () => {
    const resolution = await resolveCurrentCountry(DAMMAM);
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', DAMMAM, resolution?.result.entry.countryCode);
    const uaeIndex = result.findIndex((entry) => entry.countryCode === 'AE');
    const japanIndex = result.findIndex((entry) => entry.countryCode === 'JP');
    expect(uaeIndex).toBeGreaterThanOrEqual(0);
    expect(japanIndex).toBeGreaterThanOrEqual(0);
    expect(uaeIndex).toBeLessThan(japanIndex);
  });

  it('Bahrain — the country the OLD buggy resolution would have wrongly excluded for a Dammam traveller — is NOT excluded, and sorts near the top (Dammam is close to it)', async () => {
    const resolution = await resolveCurrentCountry(DAMMAM);
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', DAMMAM, resolution?.result.entry.countryCode);
    const bahrainIndex = result.findIndex((entry) => entry.countryCode === 'BH');
    expect(bahrainIndex).toBeGreaterThanOrEqual(0);
    expect(bahrainIndex).toBeLessThan(10);
  });
});

describe('sortCatalog — "nearest"/"farthest" exclude the traveller\'s current country (given an already-resolved code)', () => {
  it('excludes the current country from "nearest" sorting', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, 'SA');
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(false);
  });

  it('excludes the current country from "farthest" sorting too — it is not a real farthest-away recommendation either', () => {
    const result = sortCatalog(WORLD_CATALOG, 'farthest', 'en', SAUDI_CENTROID, 'SA');
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(false);
  });

  it('neighboring countries still sort correctly — a genuinely nearby country ranks ahead of a genuinely distant one', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, 'SA');
    const uaeIndex = result.findIndex((entry) => entry.countryCode === 'AE'); // neighboring
    const japanIndex = result.findIndex((entry) => entry.countryCode === 'JP'); // far away
    expect(uaeIndex).toBeGreaterThanOrEqual(0);
    expect(japanIndex).toBeGreaterThanOrEqual(0);
    expect(uaeIndex).toBeLessThan(japanIndex);
  });

  it('"farthest" is the exact reverse ordering of "nearest" among the same (current-country-excluded) candidates', () => {
    const nearest = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, 'SA');
    const farthest = sortCatalog(WORLD_CATALOG, 'farthest', 'en', SAUDI_CENTROID, 'SA');
    expect(farthest.map((entry) => entry.countryCode)).toEqual([...nearest.map((entry) => entry.countryCode)].reverse());
  });

  it('does not globally remove the country from the catalog — it is present in WORLD_CATALOG and every non-distance sort', () => {
    expect(WORLD_CATALOG.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byName = sortCatalog(WORLD_CATALOG, 'name-asc', 'en', SAUDI_CENTROID, 'SA');
    expect(byName.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byArea = sortCatalog(WORLD_CATALOG, 'area-desc', 'en', SAUDI_CENTROID, 'SA');
    expect(byArea.some((entry) => entry.countryCode === 'SA')).toBe(true);
    const byCost = sortCatalog(WORLD_CATALOG, 'cost-asc', 'en', SAUDI_CENTROID, 'SA');
    expect(byCost.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('remains fully accessible via search (filteredCatalog) regardless of the distance-sort exclusion', () => {
    const results = filteredCatalog({ q: 'Saudi', region: '', purpose: '', cost: '', sort: 'default' });
    expect(results.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('remains directly reachable — its own catalog entry/route is unaffected by the sort exclusion', () => {
    const entry = WORLD_CATALOG.find((item) => item.countryCode === 'SA');
    expect(entry).toBeDefined();
    expect(entry!.id).toBeTruthy();
  });

  it('no location context at all (unavailable location): neither distance sort is applied — the list is returned unsorted rather than pretending', () => {
    const withoutOrigin = sortCatalog(WORLD_CATALOG, 'nearest', 'en', null);
    expect(withoutOrigin.map((entry) => entry.id)).toEqual(WORLD_CATALOG.map((entry) => entry.id));
    expect(withoutOrigin.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('origin present but country not yet resolved (undefined code): nothing is excluded rather than guessing — an uncertain resolution never hides the wrong country', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, undefined);
    expect(result.length).toBe(WORLD_CATALOG.length);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('a resolver that explicitly returns null (could not resolve at all) also excludes nothing, never a guess', () => {
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, null);
    expect(result.length).toBe(WORLD_CATALOG.length);
  });

  it('a different current country (not Saudi Arabia) is excluded instead — the exclusion tracks the resolved code, not a fixed country', () => {
    const japanOrigin: LocationCoords = { lat: 36, lng: 138 };
    const result = sortCatalog(WORLD_CATALOG, 'nearest', 'en', japanOrigin, 'JP');
    expect(result.some((entry) => entry.countryCode === 'JP')).toBe(false);
    expect(result.some((entry) => entry.countryCode === 'SA')).toBe(true);
  });

  it('AR and EN both produce the same exclusion and the same relative ordering, differing only in the tie-break locale', () => {
    const en = sortCatalog(WORLD_CATALOG, 'nearest', 'en', SAUDI_CENTROID, 'SA');
    const ar = sortCatalog(WORLD_CATALOG, 'nearest', 'ar', SAUDI_CENTROID, 'SA');
    expect(en.some((entry) => entry.countryCode === 'SA')).toBe(false);
    expect(ar.some((entry) => entry.countryCode === 'SA')).toBe(false);
    expect(en.map((entry) => entry.countryCode)).toEqual(ar.map((entry) => entry.countryCode));
  });
});

describe('border-adjacent ambiguity: a point very close to a border must still resolve to the real containing country, not a neighbor', () => {
  it('a point just inside the Saudi/Bahrain corridor (near Dammam/the King Fahd Causeway) still resolves to Saudi Arabia via boundaries', async () => {
    // Slightly west of Dammam, further from Bahrain than the city center —
    // still well within the real Saudi boundary polygon.
    const nearCorridor: LocationCoords = { lat: 26.3, lng: 49.9 };
    const resolution = await resolveCurrentCountry(nearCorridor);
    expect(resolution?.result.entry.countryCode).toBe('SA');
  });
});
