// Phase 12 — Location Personalization: geographic distance ranking, built
// entirely from local data (WORLD_CATALOG + CountryInfo.latlng) — no
// external geocoding/maps API, no network call.
//
// ACCURACY: `latlng` is ONE approximate centroid per country (from
// world-countries), not a boundary/polygon. That makes two different
// things this module offers very different in reliability:
//
//  - nearbyCountries(): ranking countries by straight-line distance from a
//    point is a reasonable, honestly-approximate use of a centroid — nearer
//    centroids really are (roughly) nearer countries. Safe to present as
//    "nearby", clearly not as "distance to travel".
//  - approximateCountryOf(): "which country is the user actually in" is a
//    point-in-polygon problem, and a single centroid per country CANNOT
//    answer it reliably — nearest-centroid can be meaningfully wrong for a
//    large country or anyone near a border (see its own doc comment).
//    What's missing for real detection: an actual country boundary/polygon
//    dataset (e.g. GeoJSON/TopoJSON country borders) to run a proper
//    point-in-polygon test against — not available locally, and adding one
//    is out of scope for this phase (no external API, no invented
//    accuracy). This function is deliberately still labeled "approximate"
//    everywhere it's used, in code and in the UI.
//
// Exclusion safety: both functions are built from WORLD_CATALOG (already
// filtered by excludedCountries.ts) via countryInfoOf() (which itself never
// returns a record for an excluded id) — an excluded country was never a
// candidate in the first place, so there's no separate filter to remember.
import { WORLD_CATALOG, countryInfoOf } from './worldCatalog';
import type { CatalogEntry } from './types';

// Kept local to the data layer (not imported from state/types.ts) so this
// module has no dependency on the state layer — same shape as
// state/types.ts's LocationCoords, structurally interchangeable with it.
export interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in kilometers (Haversine formula). */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface NearbyCountry {
  entry: CatalogEntry;
  /** Straight-line (great-circle) distance to the country's approximate
   *  centroid, in kilometers — NOT a real travel distance or duration. */
  distanceKm: number;
}

/** Every catalog entry with a resolvable centroid, computed once at module
 *  load (not per call/render) — reused by both functions below. */
const catalogGeo: { entry: CatalogEntry; latlng: Coords }[] = WORLD_CATALOG.flatMap((entry) => {
  const info = countryInfoOf(entry.id);
  return info ? [{ entry, latlng: info.latlng }] : [];
});

/** Catalog countries ranked by straight-line distance from `from`, nearest
 *  first. Distance is an honest geographic approximation (see module doc)
 *  — present it as "nearby", never as real travel time/duration. */
export function nearbyCountries(from: Coords, limit = 6): NearbyCountry[] {
  return catalogGeo
    .map(({ entry, latlng }) => ({ entry, distanceKm: haversineKm(from, latlng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** APPROXIMATE nearest-centroid "current country" — see the accuracy
 *  caveat in this module's top comment before using this for anything
 *  presented as authoritative. Always the same as nearbyCountries(from, 1)[0]. */
export function approximateCountryOf(from: Coords): NearbyCountry | undefined {
  return nearbyCountries(from, 1)[0];
}
