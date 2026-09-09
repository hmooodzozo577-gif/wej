// Phase 12 (issue 2 fix) — city-level location personalization: resolves
// the nearest known "major" city to a point, SCOPED to a single already-
// resolved country (never cross-border — see resolveNearestCity's doc
// comment). Deliberately a separate module from geo.ts: the boundary
// resolver in that file (fixed in d349230, hardened in fce385e) is not
// touched by this feature at all — this only reuses its exported, pure
// haversineKm/Coords utilities.
//
// ACCURACY: this is nearest-known-city matching against a compact,
// population-filtered dataset (see generate-world-countries.mjs Step 11
// for the exact threshold and source) — NOT reverse geocoding and NOT
// street-level. A city result is only ever offered when a real known city
// is within MAX_CITY_DISTANCE_KM; otherwise resolution returns undefined
// and callers must fall back to country-only display, per the project's
// existing "never present an approximation as exact" rule (data/geo.ts's
// centroid-fallback follows the same principle).
import { haversineKm, type Coords } from './geo';
import type { CityLocation } from './types';

// Beyond this, "nearest known city" stops meaningfully describing where
// someone is — a handful of catalog countries have no 200k+ population
// city at all (small islands/microstates; see the generation script), and
// even within a large country the nearest qualifying city can be far from
// a rural point. 150km is roughly "still recognizably near this city" for
// a country-level personalization feature; past that, showing a city name
// would misrepresent the location more than showing just the country.
export const MAX_CITY_DISTANCE_KM = 150;

export interface CityResolution {
  city: CityLocation;
  distanceKm: number;
}

// Lazy-loaded exactly like data/geo.ts's boundary dataset: only fetched
// once a caller actually needs it, deduplicated via a single shared
// promise, and a load failure resolves to `null` (never throws) so
// callers fall back to country-only cleanly instead of needing try/catch.
let citiesPromise: Promise<CityLocation[] | null> | null = null;

function loadCities(): Promise<CityLocation[] | null> {
  if (!citiesPromise) {
    citiesPromise = import('./generated/cities.json')
      .then((mod) => mod.default as unknown as CityLocation[])
      .catch((err: unknown) => {
        console.error('Failed to load city data; falling back to country-only location display.', err);
        return null;
      });
  }
  return citiesPromise;
}

/** Resolves the nearest known major city to `from`, restricted to cities
 *  whose `countryCode` matches `countryCode` — the already-resolved
 *  current country (from resolveCurrentCountry() in geo.ts). This is
 *  deliberate and load-bearing: without the restriction, a point near a
 *  border could return a nearer city belonging to a DIFFERENT country
 *  than the one already confidently resolved, contradicting it in the UI.
 *  Uses the real browser coordinates passed in, never a country centroid.
 *
 *  Returns undefined (safe country-only fallback) when: city data failed
 *  to load, the country has no qualifying city at all, or the nearest
 *  qualifying city is farther than MAX_CITY_DISTANCE_KM. */
export async function resolveNearestCity(from: Coords, countryCode: string): Promise<CityResolution | undefined> {
  const cities = await loadCities();
  if (!cities) return undefined;

  let best: CityResolution | undefined;
  for (const city of cities) {
    if (city.countryCode !== countryCode) continue;
    const distanceKm = haversineKm(from, { lat: city.lat, lng: city.lng });
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }

  if (!best || best.distanceKm > MAX_CITY_DISTANCE_KM) return undefined;
  return best;
}
