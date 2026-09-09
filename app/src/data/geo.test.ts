// Phase 12 — geographic distance ranking (haversineKm, nearbyCountries,
// approximateCountryOf). All computed from local data only; no network.
import { describe, expect, it } from 'vitest';
import { approximateCountryOf, haversineKm, nearbyCountries } from './geo';
import { WORLD_CATALOG } from './worldCatalog';
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
