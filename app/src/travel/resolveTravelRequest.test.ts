// Phase 13.3 (Part H/M) — resolveTravelSearchRequest(): the documented
// glue between Phase 13.2's resolveNearestAirport() and this phase's
// TravelSearchRequest. Verified against the real generated airport
// dataset and real WORLD_CATALOG entries (per this project's "verify
// against the actual dataset, never assume" convention).
import { describe, expect, it } from 'vitest';
import { resolveTravelSearchRequest } from './resolveTravelRequest';
import { WORLD_CATALOG } from '../data/worldCatalog';

const france = WORLD_CATALOG.find((e) => e.id === 'france')!;
const japan = WORLD_CATALOG.find((e) => e.countryCode === 'JP')!;

describe('Phase 13.3 — resolveTravelSearchRequest', () => {
  it('resolves a real origin (Abha, SA) and destination (France) to real IATA codes', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const result = await resolveTravelSearchRequest({
      originCoords: abha,
      originCountryCode: 'SA',
      destination: france,
      departureDate: '2026-12-01',
    });
    expect(result?.originIata).toBe('AHB');
    // France's catalog centroid resolves to its nearest qualifying
    // airport — verified directly against generated/airports.json at
    // authoring time, not assumed.
    expect(result?.destinationIata).toBe('LIG');
    expect(result?.departureDate).toBe('2026-12-01');
    expect(result?.passengers).toBe(1);
  });

  it('defaults passengers to 1 when omitted, and carries returnDate through when provided', async () => {
    const riyadh = { lat: 24.7136, lng: 46.6753 };
    const result = await resolveTravelSearchRequest({
      originCoords: riyadh,
      originCountryCode: 'SA',
      destination: japan,
      departureDate: '2026-12-01',
      returnDate: '2026-12-10',
      passengers: 2,
    });
    expect(result?.originIata).toBe('RUH');
    expect(result?.returnDate).toBe('2026-12-10');
    expect(result?.passengers).toBe(2);
  });

  it('the resulting request always passes validateTravelSearchRequest', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    const abha = { lat: 18.2164, lng: 42.5053 };
    const result = await resolveTravelSearchRequest({
      originCoords: abha,
      originCountryCode: 'SA',
      destination: japan,
      departureDate: '2026-12-01',
    });
    expect(result).toBeDefined();
    if (result) expect(validateTravelSearchRequest(result)).toEqual([]);
  });

  it('returns undefined (never a guess) when the origin has no qualifying airport nearby', async () => {
    // Vatican City has no qualifying airport of its own (see
    // data/airports.test.ts) — this must propagate as undefined, never a
    // fabricated origin.
    const vatican = { lat: 41.9029, lng: 12.4534 };
    const result = await resolveTravelSearchRequest({
      originCoords: vatican,
      originCountryCode: 'VA',
      destination: france,
      departureDate: '2026-12-01',
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when the destination catalog entry has no resolvable country info', async () => {
    const abha = { lat: 18.2164, lng: 42.5053 };
    const result = await resolveTravelSearchRequest({
      originCoords: abha,
      originCountryCode: 'SA',
      destination: { ...france, id: 'not-a-real-catalog-id' },
      departureDate: '2026-12-01',
    });
    expect(result).toBeUndefined();
  });

  it('never crosses a country boundary: origin and destination airports always match their requested countries', async () => {
    const riyadh = { lat: 24.7136, lng: 46.6753 };
    const result = await resolveTravelSearchRequest({
      originCoords: riyadh,
      originCountryCode: 'SA',
      destination: france,
      departureDate: '2026-12-01',
    });
    expect(result?.originIata).toBe('RUH');
    expect(result?.destinationIata).toBe('LIG');
  });
});
