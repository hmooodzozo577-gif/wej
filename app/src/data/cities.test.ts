// Phase 12 (issue 2) — resolveNearestCity(): country-scoped nearest-city
// matching against the compact, population-filtered dataset. All local
// data, no network, no real device geolocation.
import { describe, expect, it } from 'vitest';
import { resolveNearestCity, MAX_CITY_DISTANCE_KM } from './cities';

describe('Phase 12 — resolveNearestCity', () => {
  it('resolves Abha coordinates to Abha, scoped to Saudi Arabia (SA)', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const result = await resolveNearestCity(abha, 'SA');
    expect(result?.city.nameEn).toBe('Abha');
    expect(result?.city.countryCode).toBe('SA');
    expect(result?.distanceKm).toBeLessThan(MAX_CITY_DISTANCE_KM);
  });

  it('resolves Riyadh coordinates to Riyadh, scoped to Saudi Arabia', async () => {
    const riyadh = { lat: 24.7136, lng: 46.6753 };
    const result = await resolveNearestCity(riyadh, 'SA');
    expect(result?.city.nameEn).toBe('Riyadh');
  });

  it('resolves Jeddah coordinates to Jeddah, scoped to Saudi Arabia', async () => {
    const jeddah = { lat: 21.4858, lng: 39.1925 };
    const result = await resolveNearestCity(jeddah, 'SA');
    expect(result?.city.nameEn).toBe('Jeddah');
  });

  it('resolves Paris coordinates to Paris, scoped to France', async () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const result = await resolveNearestCity(paris, 'FR');
    expect(result?.city.nameEn).toBe('Paris');
    expect(result?.city.countryCode).toBe('FR');
  });

  it('resolves Tokyo coordinates to Tokyo, scoped to Japan', async () => {
    const tokyo = { lat: 35.6762, lng: 139.6503 };
    const result = await resolveNearestCity(tokyo, 'JP');
    expect(result?.city.nameEn).toBe('Tokyo');
    expect(result?.city.countryCode).toBe('JP');
  });

  it('city and country relationship is always consistent: the resolved city always belongs to the requested country', async () => {
    const points: [{ lat: number; lng: number }, string][] = [
      [{ lat: 18.2164, lng: 42.5053 }, 'SA'],
      [{ lat: 48.8566, lng: 2.3522 }, 'FR'],
      [{ lat: 35.6762, lng: 139.6503 }, 'JP'],
    ];
    for (const [coords, iso2] of points) {
      const result = await resolveNearestCity(coords, iso2);
      expect(result?.city.countryCode).toBe(iso2);
    }
  });

  it('has a real, non-fabricated Arabic name for the explicitly curated cities', async () => {
    const abha = await resolveNearestCity({ lat: 18.2164, lng: 42.5053 }, 'SA');
    expect(abha?.city.nameAr).toBe('أبها');
    const paris = await resolveNearestCity({ lat: 48.8566, lng: 2.3522 }, 'FR');
    expect(paris?.city.nameAr).toBe('باريس');
    const tokyo = await resolveNearestCity({ lat: 35.6762, lng: 139.6503 }, 'JP');
    expect(tokyo?.city.nameAr).toBe('طوكيو');
  });

  it('English localization: nameEn is always populated', async () => {
    const result = await resolveNearestCity({ lat: 18.2164, lng: 42.5053 }, 'SA');
    expect(result?.city.nameEn.length).toBeGreaterThan(0);
  });

  it('returns undefined (safe fallback, not a bogus city) for an open-ocean point far from any known city', async () => {
    const openOcean = { lat: 0, lng: -160 };
    // No country is at this point either, but even scoping to an arbitrary
    // real country, nothing in that country is remotely close to here.
    const result = await resolveNearestCity(openOcean, 'US');
    expect(result).toBeUndefined();
  });

  it('CRITICAL: never returns a city from a different country than requested, even if it is geographically nearer (edge case: border-adjacent point)', async () => {
    // A point just inside Saudi Arabia's border, plausibly nearer to a
    // Yemeni city than to some far-flung Saudi one — must never resolve to
    // a Yemeni city when explicitly scoped to Saudi Arabia.
    const nearYemenBorder = { lat: 17.0, lng: 43.5 };
    const result = await resolveNearestCity(nearYemenBorder, 'SA');
    if (result) expect(result.city.countryCode).toBe('SA');
  });

  it('is not hardcoded to Abha — resolves distinct cities for distinct coordinates', async () => {
    const abha = await resolveNearestCity({ lat: 18.2164, lng: 42.5053 }, 'SA');
    const riyadh = await resolveNearestCity({ lat: 24.7136, lng: 46.6753 }, 'SA');
    expect(abha?.city.nameEn).not.toBe(riyadh?.city.nameEn);
  });

  it('uses the actual coordinates passed in, not a country centroid (Abha and Riyadh are both "in Saudi Arabia" but resolve to different cities)', async () => {
    const abha = await resolveNearestCity({ lat: 18.2164, lng: 42.5053 }, 'SA');
    const riyadh = await resolveNearestCity({ lat: 24.7136, lng: 46.6753 }, 'SA');
    expect(abha?.city.nameEn).toBe('Abha');
    expect(riyadh?.city.nameEn).toBe('Riyadh');
  });

  it('respects the documented maximum distance threshold — a real but very distant city in the same huge country is not returned as "nearby"', async () => {
    // A remote point scoped to a country with excellent city coverage
    // (Russia) but far from any of them — still must not silently produce
    // a "nearest" match beyond the documented threshold.
    const remoteSiberia = { lat: 70.0, lng: 100.0 };
    const result = await resolveNearestCity(remoteSiberia, 'RU');
    if (result) expect(result.distanceKm).toBeLessThanOrEqual(MAX_CITY_DISTANCE_KM);
  });
});
