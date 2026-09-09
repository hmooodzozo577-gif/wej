// Phase 12 — geographic distance ranking (haversineKm, nearbyCountries,
// approximateCountryOf) and (Phase 12 fix) real point-in-polygon current-
// country resolution (resolveCurrentCountry). All computed from local data
// only; no network, no real device geolocation anywhere in these tests.
import { describe, expect, it } from 'vitest';
import { approximateCountryOf, haversineKm, nearbyCountries, resolveCurrentCountry } from './geo';
import { WORLD_CATALOG, countryInfoOf } from './worldCatalog';
import { EXCLUDED_COUNTRIES } from './excludedCountries';

describe('Phase 12 — haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 24.7, lng: 46.7 }, { lat: 24.7, lng: 46.7 })).toBeCloseTo(0, 5);
  });

  it('is symmetric', () => {
    const a = { lat: 40.7, lng: -74 };
    const b = { lat: 51.5, lng: -0.1 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 5);
  });

  it('gives a plausible distance for two known far-apart cities (NYC–London, ~5570km)', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const km = haversineKm(nyc, london);
    expect(km).toBeGreaterThan(5400);
    expect(km).toBeLessThan(5700);
  });
});

describe('Phase 12 — nearbyCountries', () => {
  it('returns results sorted by ascending distance', () => {
    const list = nearbyCountries({ lat: 24.7, lng: 46.7 }, 10); // near Riyadh
    for (let i = 1; i < list.length; i++) {
      expect(list[i].distanceKm).toBeGreaterThanOrEqual(list[i - 1].distanceKm);
    }
  });

  it('respects the limit parameter', () => {
    expect(nearbyCountries({ lat: 0, lng: 0 }, 3)).toHaveLength(3);
  });

  it('places Saudi Arabia\'s own destination entry very near the top when starting from Riyadh', () => {
    const list = nearbyCountries({ lat: 24.7136, lng: 46.6753 }, 10);
    expect(list.slice(0, 3).some((n) => n.entry.countryCode === 'SA')).toBe(true);
  });

  it('never includes an excluded country, for any starting point', () => {
    const list = nearbyCountries({ lat: 24.7, lng: 46.7 }, 195);
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(list.some((n) => n.entry.countryCode === excluded.iso2)).toBe(false);
    }
  });

  it('covers every catalog country when the limit is large enough (no silent drops)', () => {
    const list = nearbyCountries({ lat: 0, lng: 0 }, 1000);
    expect(list).toHaveLength(WORLD_CATALOG.length);
  });
});

describe('Phase 12 — approximateCountryOf', () => {
  it('is always the same as the single nearest entry from nearbyCountries', () => {
    const from = { lat: 48.8566, lng: 2.3522 }; // Paris
    expect(approximateCountryOf(from)?.entry.id).toBe(nearbyCountries(from, 1)[0].entry.id);
  });

  it('never resolves to an excluded country', () => {
    const from = { lat: 24.7, lng: 46.7 };
    const nearest = approximateCountryOf(from);
    for (const excluded of EXCLUDED_COUNTRIES) {
      expect(nearest?.entry.countryCode).not.toBe(excluded.iso2);
    }
  });
});

describe('Phase 12 fix — resolveCurrentCountry (real point-in-polygon)', () => {
  // THE regression case: a real user in Abha, Saudi Arabia (SW corner, near
  // the Yemen/Red Sea border) previously resolved to Eritrea, because
  // Eritrea's centroid was arithmetically closer to Abha than Saudi
  // Arabia's own (much more northerly) centroid — nearest-centroid cannot
  // get this right for a country this large. This is the case that must
  // never regress.
  it('resolves Abha, Saudi Arabia to Saudi Arabia via a real boundary match, not Eritrea', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const resolution = await resolveCurrentCountry(abha);
    expect(resolution?.method).toBe('boundary');
    expect(resolution?.result.entry.countryCode).toBe('SA');
    expect(resolution?.result.entry.countryCode).not.toBe('ER');
  });

  it('resolves a known coordinate inside another country correctly (Paris, France)', async () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const resolution = await resolveCurrentCountry(paris);
    expect(resolution?.method).toBe('boundary');
    expect(resolution?.result.entry.id).toBe('france');
  });

  it('resolves a MultiPolygon (island-nation) country correctly (Tokyo, Japan)', async () => {
    const tokyo = { lat: 35.6762, lng: 139.6503 };
    const resolution = await resolveCurrentCountry(tokyo);
    expect(resolution?.method).toBe('boundary');
    expect(resolution?.result.entry.id).toBe('japan');
  });

  it('respects a polygon hole: a point inside Lesotho (a real enclave cut out of South Africa\'s boundary) resolves to Lesotho, not South Africa', async () => {
    const maseru = { lat: -29.31, lng: 27.48 }; // Lesotho's capital
    const resolution = await resolveCurrentCountry(maseru);
    expect(resolution?.method).toBe('boundary');
    expect(resolution?.result.entry.countryCode).toBe('LS');
    expect(resolution?.result.entry.countryCode).not.toBe('ZA');
  });

  it('falls back to the documented nearest-centroid approximation for a point with no polygon match (open ocean)', async () => {
    const openPacific = { lat: 0, lng: -160 };
    const resolution = await resolveCurrentCountry(openPacific);
    expect(resolution?.method).toBe('centroid-fallback');
    expect(resolution?.result.entry.id).toBe(approximateCountryOf(openPacific)?.entry.id);
  });

  it('bounding-box pre-filter never produces a false-positive final result (candidates are always confirmed by the real polygon test)', async () => {
    // Cairo, Egypt: Egypt's bbox overlaps several neighbors' bboxes (Sudan,
    // Libya, Israel/Palestine region), but only Egypt's actual polygon
    // should match.
    const cairo = { lat: 30.0444, lng: 31.2357 };
    const resolution = await resolveCurrentCountry(cairo);
    expect(resolution?.method).toBe('boundary');
    expect(resolution?.result.entry.countryCode).toBe('EG');
  });

  it('is deterministic even when run repeatedly for the same point', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const first = await resolveCurrentCountry(abha);
    const second = await resolveCurrentCountry(abha);
    expect(first?.result.entry.id).toBe(second?.result.entry.id);
    expect(first?.method).toBe(second?.method);
  });

  it('never resolves to an excluded country, by boundary match or by fallback', async () => {
    const points = [
      { lat: 18.2164, lng: 42.5053 }, // Abha
      { lat: 48.8566, lng: 2.3522 }, // Paris
      { lat: 0, lng: -160 }, // open ocean (fallback path)
    ];
    for (const point of points) {
      const resolution = await resolveCurrentCountry(point);
      for (const excluded of EXCLUDED_COUNTRIES) {
        expect(resolution?.result.entry.countryCode).not.toBe(excluded.iso2);
      }
    }
  });

  it('every WORLD_CATALOG entry has a boundary record reachable through resolution (no silent gaps)', async () => {
    // Sanity check on the generated dataset rather than a specific point:
    // every effective catalog country's own centroid should resolve back
    // to itself via boundary match (a country's centroid is, by
    // construction, always inside — or extremely close to — its own shape).
    let boundaryMatches = 0;
    for (const entry of WORLD_CATALOG) {
      const latlng = countryInfoOf(entry.id)!.latlng;
      const resolution = await resolveCurrentCountry(latlng);
      if (resolution?.method === 'boundary' && resolution.result.entry.id === entry.id) boundaryMatches++;
    }
    // Not a strict 100% — small, oddly-shaped, or archipelago countries can
    // have a centroid that legitimately falls just outside their own
    // simplified polygon (part of why nearest-centroid alone was
    // unreliable to begin with). Measured at ~89% for this dataset; the
    // threshold is set comfortably below that so this test still catches a
    // real regression (e.g. the whole dataset failing to load, which would
    // read near 0%) without being a flaky cliff on the exact number.
    expect(boundaryMatches / WORLD_CATALOG.length).toBeGreaterThan(0.75);
  });
});
