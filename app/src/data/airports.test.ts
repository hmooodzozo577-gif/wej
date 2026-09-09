// Phase 13.2 (Task A6/D) — resolveNearestAirport(): country-scoped
// nearest-airport matching against the compact, filtered dataset (see
// scripts/generate-airports.mjs). All local data, no network, no real
// provider call. Distances below were computed directly against the
// generated dataset before writing these assertions (per the task's own
// "do not assume the nearest airport without verifying the actual
// dataset" instruction) rather than assumed from general knowledge.
import { describe, expect, it } from 'vitest';
import { resolveNearestAirport, findAirportByIata, MAX_AIRPORT_DISTANCE_KM } from './airports';

describe('Phase 13.2 — resolveNearestAirport', () => {
  it('resolves Abha coordinates to Abha International Airport (AHB), scoped to Saudi Arabia', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const result = await resolveNearestAirport(abha, 'SA');
    expect(result?.airport.iata).toBe('AHB');
    expect(result?.airport.countryCode).toBe('SA');
    expect(result?.distanceKm).toBeLessThan(MAX_AIRPORT_DISTANCE_KM);
  });

  it('resolves Riyadh coordinates to King Khaled International Airport (RUH)', async () => {
    const riyadh = { lat: 24.7136, lng: 46.6753 };
    const result = await resolveNearestAirport(riyadh, 'SA');
    expect(result?.airport.iata).toBe('RUH');
  });

  it('resolves Jeddah coordinates to King Abdulaziz International Airport (JED)', async () => {
    const jeddah = { lat: 21.4858, lng: 39.1925 };
    const result = await resolveNearestAirport(jeddah, 'SA');
    expect(result?.airport.iata).toBe('JED');
  });

  it('resolves Paris coordinates to Paris-Orly (ORY), scoped to France', async () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const result = await resolveNearestAirport(paris, 'FR');
    expect(result?.airport.iata).toBe('ORY');
    expect(result?.airport.countryCode).toBe('FR');
  });

  it('resolves Tokyo coordinates to Haneda (HND), scoped to Japan', async () => {
    const tokyo = { lat: 35.6762, lng: 139.6503 };
    const result = await resolveNearestAirport(tokyo, 'JP');
    expect(result?.airport.iata).toBe('HND');
    expect(result?.airport.countryCode).toBe('JP');
  });

  it('airport and country relationship is always consistent: the resolved airport always belongs to the requested country', async () => {
    const points: [{ lat: number; lng: number }, string][] = [
      [{ lat: 18.2164, lng: 42.5053 }, 'SA'],
      [{ lat: 48.8566, lng: 2.3522 }, 'FR'],
      [{ lat: 35.6762, lng: 139.6503 }, 'JP'],
    ];
    for (const [coords, iso2] of points) {
      const result = await resolveNearestAirport(coords, iso2);
      expect(result?.airport.countryCode).toBe(iso2);
    }
  });

  it('returns undefined (safe fallback, not a bogus airport) for an open-ocean point far from any known airport', async () => {
    // Verified against the real dataset: scoped to the US, the nearest
    // airport to this mid-Pacific point is Kona (KOA, Hawaii) at ~2,237km
    // — far beyond MAX_AIRPORT_DISTANCE_KM, so this must resolve to
    // undefined rather than offering a nonsensical "nearest" airport.
    const openOcean = { lat: 0, lng: -160 };
    const result = await resolveNearestAirport(openOcean, 'US');
    expect(result).toBeUndefined();
  });

  it('CRITICAL: never returns an airport from a different (nearer) country than requested — verified with a point where the globally nearest airport is NOT in the requested country', async () => {
    // At this point (northern Yemen, near the Saudi border), Najran
    // Domestic Airport (EAM, Saudi Arabia) is the closer airport overall
    // (~74km) — but scoping to Yemen must still return a real Yemeni
    // airport (Sana'a International, SAH, ~208km) rather than silently
    // crossing into Saudi territory just because it's nearer.
    const nearSaudiBorder = { lat: 17.3, lng: 43.8 };
    const yemenScoped = await resolveNearestAirport(nearSaudiBorder, 'YE');
    expect(yemenScoped?.airport.iata).toBe('SAH');
    expect(yemenScoped?.airport.countryCode).toBe('YE');

    const saudiScoped = await resolveNearestAirport(nearSaudiBorder, 'SA');
    expect(saudiScoped?.airport.iata).toBe('EAM');
    expect(saudiScoped?.airport.countryCode).toBe('SA');
  });

  it('is not hardcoded to one airport — resolves distinct airports for distinct coordinates', async () => {
    const abha = await resolveNearestAirport({ lat: 18.2164, lng: 42.5053 }, 'SA');
    const riyadh = await resolveNearestAirport({ lat: 24.7136, lng: 46.6753 }, 'SA');
    expect(abha?.airport.iata).not.toBe(riyadh?.airport.iata);
  });

  it('uses the actual coordinates passed in, not a country centroid', async () => {
    const abha = await resolveNearestAirport({ lat: 18.2164, lng: 42.5053 }, 'SA');
    const riyadh = await resolveNearestAirport({ lat: 24.7136, lng: 46.6753 }, 'SA');
    expect(abha?.airport.iata).toBe('AHB');
    expect(riyadh?.airport.iata).toBe('RUH');
  });

  it('respects the documented maximum distance threshold', async () => {
    // A remote point scoped to a large country far from any qualifying
    // airport must not silently produce a "nearest" match beyond the
    // documented threshold.
    const remoteSiberia = { lat: 70.0, lng: 100.0 };
    const result = await resolveNearestAirport(remoteSiberia, 'RU');
    if (result) expect(result.distanceKm).toBeLessThanOrEqual(MAX_AIRPORT_DISTANCE_KM);
  });

  it('is deterministic: repeated calls with the same input return the same result', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const first = await resolveNearestAirport(abha, 'SA');
    const second = await resolveNearestAirport(abha, 'SA');
    expect(first?.airport.iata).toBe(second?.airport.iata);
    expect(first?.distanceKm).toBe(second?.distanceKm);
  });

  it('returns undefined for a country with no qualifying airport at all, rather than crossing into a neighbor', async () => {
    // Vatican City (VA) is far too small to have its own qualifying
    // large/medium scheduled-service airport in the dataset — travelers
    // fly into Rome (Italy) instead, but this resolver must never
    // silently substitute a neighboring country's airport.
    const vatican = { lat: 41.9029, lng: 12.4534 };
    const result = await resolveNearestAirport(vatican, 'VA');
    expect(result).toBeUndefined();
  });
});

describe('Phase 13.4b — findAirportByIata', () => {
  it('finds a real major airport by its exact IATA code', async () => {
    const result = await findAirportByIata('RUH');
    expect(result?.name).toBe('King Khaled International Airport');
    expect(result?.countryCode).toBe('SA');
  });

  it('finds airports across different countries by code alone (no country scoping — this is a plain lookup)', async () => {
    expect((await findAirportByIata('JFK'))?.countryCode).toBe('US');
    expect((await findAirportByIata('ORY'))?.countryCode).toBe('FR');
    expect((await findAirportByIata('HND'))?.countryCode).toBe('JP');
  });

  it('returns undefined for a code not in the compact dataset, rather than guessing', async () => {
    const result = await findAirportByIata('ZZZ');
    expect(result).toBeUndefined();
  });

  it('is case-sensitive: a lowercase code does not match (IATA codes are always uppercase)', async () => {
    const result = await findAirportByIata('ruh');
    expect(result).toBeUndefined();
  });

  it('is deterministic: repeated calls return the same result', async () => {
    const first = await findAirportByIata('RUH');
    const second = await findAirportByIata('RUH');
    expect(first).toEqual(second);
  });
});
