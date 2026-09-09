// Phase 13.2 (travel API foundation, Task A6) — build-time airport
// resolution: resolves the nearest known major airport to a point, SCOPED
// to a single already-resolved country (never cross-border — same pattern
// as data/cities.ts's resolveNearestCity, which this deliberately
// mirrors). This module does not resolve country itself: `countryCode`
// must come from geo.ts's resolveCurrentCountry() (or, for a destination
// use case, from a WORLD_CATALOG entry's own countryCode) — never
// re-derived here, never guessed from the nearest airport.
//
// ACCURACY: this is nearest-known-airport matching against a compact,
// filtered dataset (see scripts/generate-airports.mjs for the exact
// source, license, and filtering criteria) — NOT a live flight-search
// lookup and NOT guaranteed to be the cheapest or most convenient airport
// to fly from. An airport result is only ever offered when a real
// qualifying airport is within MAX_AIRPORT_DISTANCE_KM of the same
// country; otherwise resolution returns undefined and callers must not
// guess, per this project's existing "never present an approximation as
// exact" rule (data/geo.ts's centroid-fallback and data/cities.ts's
// MAX_CITY_DISTANCE_KM both follow the same principle).
import { haversineKm, type Coords } from './geo';
import type { AirportLocation } from './types';

// Airports are far sparser than the "major city" list (3,179 airports vs.
// ~1,800 cities worldwide), so a bare reuse of MAX_CITY_DISTANCE_KM (150)
// would too often return undefined even for perfectly reasonable "nearest
// airport" queries. 300km was chosen empirically from the dataset itself:
// for airports sharing a country with at least one other qualifying
// airport, the distance to the NEAREST such airport is <=250km for 90% of
// them and <=347km for 95% (computed directly from generated/airports.json
// at authoring time). 300km sits between those two figures — wide enough
// to cover the large majority of real "nearest domestic airport" cases,
// while still refusing a match in genuinely airport-sparse regions rather
// than guessing.
export const MAX_AIRPORT_DISTANCE_KM = 300;

export interface AirportResolution {
  airport: AirportLocation;
  distanceKm: number;
}

// Lazy-loaded exactly like data/cities.ts's loadCities(): a single shared
// promise, dynamically imported so Vite code-splits the dataset into its
// own chunk fetched only when a caller actually needs it, and a load
// failure resolves to `null` (never throws) so callers can fall back
// cleanly instead of needing try/catch.
let airportsPromise: Promise<AirportLocation[] | null> | null = null;

function loadAirports(): Promise<AirportLocation[] | null> {
  if (!airportsPromise) {
    airportsPromise = import('./generated/airports.json')
      .then((mod) => mod.default as unknown as AirportLocation[])
      .catch((err: unknown) => {
        console.error('Failed to load airport data; travel features requiring an airport will be unavailable.', err);
        return null;
      });
  }
  return airportsPromise;
}

/** Resolves the nearest known major airport to `from`, restricted to
 *  airports whose `countryCode` matches `countryCode`. One function
 *  intentionally covers both Task A5 use cases without a second country
 *  model or a second resolver: the current-user case passes real browser
 *  coordinates plus the country already resolved by resolveCurrentCountry;
 *  the destination-country/city case passes a WORLD_CATALOG entry's own
 *  centroid (`countryInfoOf(entry.id).latlng`, already used this way by
 *  LocationPersonalize.tsx's debug panel) plus that same entry's
 *  `countryCode` — no new lookup table, just this module's existing
 *  distance scan reused with a different `from`. `countryCode` is never
 *  never inferred here — callers must supply an already-resolved country
 *  code (from geo.ts's resolveCurrentCountry() for the current-user case,
 *  or from a WORLD_CATALOG entry for a destination-country case). This is
 *  deliberate and load-bearing, identical to resolveNearestCity: without
 *  the restriction, a point near a border could return a nearer airport
 *  belonging to a DIFFERENT country than the one already confidently
 *  resolved, silently crossing a boundary this project treats as
 *  authoritative.
 *
 *  Returns undefined (never a guess) when: airport data failed to load,
 *  the country has no qualifying airport at all, or the nearest
 *  qualifying airport is farther than MAX_AIRPORT_DISTANCE_KM. Result is
 *  deterministic: the same (from, countryCode) always resolves to the
 *  same airport, since it's a pure nearest-distance scan over static,
 *  committed data. */
export async function resolveNearestAirport(from: Coords, countryCode: string): Promise<AirportResolution | undefined> {
  const airports = await loadAirports();
  if (!airports) return undefined;

  let best: AirportResolution | undefined;
  for (const airport of airports) {
    if (airport.countryCode !== countryCode) continue;
    const distanceKm = haversineKm(from, { lat: airport.lat, lng: airport.lng });
    if (!best || distanceKm < best.distanceKm) best = { airport, distanceKm };
  }

  if (!best || best.distanceKm > MAX_AIRPORT_DISTANCE_KM) return undefined;
  return best;
}

/** Phase 13.4b — plain lookup by IATA code, over the SAME lazily-loaded
 *  dataset resolveNearestAirport() already uses (loadAirports()) — no
 *  new resolution algorithm, no distance calculation, no country
 *  scoping: this just finds the one record whose `iata` matches. Used by
 *  travelService.ts to enrich a Worker-returned Airport's name/lat/lng
 *  from the local catalog when the code happens to be one of the
 *  ~3,000 major airports this project already carries data for. Case-
 *  sensitive (IATA codes are always uppercase, both here and from
 *  Amadeus) and never guesses: returns undefined for any code not in
 *  the dataset (a small regional airport, a data-load failure, etc.) —
 *  callers must fall back to whatever they already had. */
export async function findAirportByIata(iata: string): Promise<AirportLocation | undefined> {
  const airports = await loadAirports();
  if (!airports) return undefined;
  return airports.find((airport) => airport.iata === iata);
}
