// Phase 12 — Location Personalization: geographic distance ranking AND
// (Phase 12 fix) real point-in-polygon "current country" resolution. Both
// built entirely from local data — no external geocoding/maps API, no
// network call ever made from this module.
//
// TWO DIFFERENT PROBLEMS, TWO DIFFERENT TECHNIQUES:
//
//  - nearbyCountries(): ranking countries by straight-line distance from a
//    point to each country's approximate centroid (CountryInfo.latlng) is a
//    reasonable, honestly-approximate answer to "what's nearby" — nearer
//    centroids really are (roughly) nearer countries. Unchanged by the
//    Phase 12 fix below; still centroid-based, still labeled as such.
//  - resolveCurrentCountry(): "which country is the user actually in" is a
//    point-in-polygon problem. A single centroid per country CANNOT answer
//    it reliably — confirmed by a real bug report: a user in Abha (SW Saudi
//    Arabia, near the Yemen/Red Sea border) resolved to Eritrea, because
//    Eritrea's centroid was arithmetically closer to Abha than Saudi
//    Arabia's own (much more northerly) centroid. Fixed here using real
//    country boundary polygons — see generate-world-countries.mjs Step 10
//    for where they come from (bundled inside the already-installed
//    `world-countries` package, not previously exposed) and how they're
//    simplified. approximateCountryOf() (nearest-centroid) is kept as the
//    documented, clearly-labeled fallback for when no polygon contains the
//    point (open ocean, or a data gap) — never presented as exact.
//
// Exclusion safety: every function here is built from WORLD_CATALOG
// (already filtered by excludedCountries.ts) via countryInfoOf() (which
// itself never returns a record for an excluded id) — an excluded country
// was never a candidate in the first place, so there's no separate filter
// to remember. The boundary lookup below follows the same rule: it's keyed
// off WORLD_CATALOG entries, never off the raw (unfiltered) generated file.
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
 *  presented as authoritative. Always the same as nearbyCountries(from, 1)[0].
 *  Kept exactly as originally implemented — this is now resolveCurrentCountry()'s
 *  documented fallback, used only when no boundary polygon contains the point. */
export function approximateCountryOf(from: Coords): NearbyCountry | undefined {
  return nearbyCountries(from, 1)[0];
}

// --- Phase 12 fix: real point-in-polygon "current country" resolution ------

/** [minLng, minLat, maxLng, maxLat] — GeoJSON bbox order, matches how it's
 *  written in generate-world-countries.mjs. */
type Bbox = [number, number, number, number];

/** A ring is a closed [lng, lat] point sequence; a polygon is [outerRing,
 *  ...holeRings] (GeoJSON semantics); a country can be a MultiPolygon
 *  (island nations, exclaves), so this is an array of those. */
type Ring = [number, number][];
type Polygon = Ring[];

interface RawCountryBoundary {
  bbox: Bbox;
  polygons: Polygon[];
}

type CountryBoundaries = Record<string, RawCountryBoundary>;

function bboxContains(bbox: Bbox, lng: number, lat: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/** Standard ray-casting point-in-polygon test against a single ring. */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True if the point is inside any polygon's outer ring and NOT inside any
 *  of that polygon's holes (GeoJSON hole semantics — ring 0 is the outer
 *  boundary, every subsequent ring in the same polygon is a hole cut out
 *  of it). Checks each of a MultiPolygon's polygons independently. */
function pointInPolygons(lng: number, lat: number, polygons: Polygon[]): boolean {
  for (const [outer, ...holes] of polygons) {
    if (pointInRing(lng, lat, outer) && !holes.some((hole) => pointInRing(lng, lat, hole))) {
      return true;
    }
  }
  return false;
}

// Lazy-loaded: the boundary dataset (~730 KB) is only fetched the first
// time a caller actually needs it (i.e. a user requested their location),
// not on every page load. A single shared promise means concurrent callers
// never trigger a duplicate fetch, and a load failure (e.g. offline)
// resolves to `null` rather than rejecting, so callers can fall back
// cleanly instead of needing their own try/catch.
let boundariesPromise: Promise<CountryBoundaries | null> | null = null;

function loadCountryBoundaries(): Promise<CountryBoundaries | null> {
  if (!boundariesPromise) {
    boundariesPromise = import('./generated/countryBoundaries.json')
      .then((mod) => mod.default as unknown as CountryBoundaries)
      .catch((err: unknown) => {
        // The UI already treats a null return as "use the labeled
        // centroid-fallback" (never presented as exact) — this does not
        // change that behavior. It exists purely so a real load failure
        // (bad deploy, network issue, wrong base path) leaves a trace
        // instead of silently and indistinguishably looking like "no
        // polygon matched this point" in production.
        console.error('Failed to load country boundary data; falling back to nearest-centroid resolution.', err);
        return null;
      });
  }
  return boundariesPromise;
}

export type CountryResolutionMethod = 'boundary' | 'centroid-fallback';

export interface CountryResolution {
  result: NearbyCountry;
  /** 'boundary': a real point-in-polygon match — safe to present as the
   *  user's actual current country. 'centroid-fallback': no polygon
   *  contained the point (open ocean, or a data gap) — nearest-centroid
   *  only, MUST be presented as approximate, never as exact detection. */
  method: CountryResolutionMethod;
}

/** Real "current country" resolution: point-in-polygon against the
 *  effective catalog's boundary data, with each country's bounding box as
 *  a cheap first-pass filter (only WORLD_CATALOG entries whose bbox
 *  contains the point get the more expensive polygon test — for almost any
 *  point that's a small handful of candidates, not all ~194). Falls back to
 *  approximateCountryOf() (nearest-centroid, clearly labeled) only when no
 *  polygon matches or the boundary data failed to load.
 *
 *  Deterministic even if bundled polygons happen to overlap at a shared
 *  border: among every polygon match, the one whose own centroid is
 *  nearest to the point wins — same tie-break rule every time, not
 *  first-in-array-order.
 *
 *  Exclusion-safe by construction: only iterates WORLD_CATALOG (already
 *  exclusion-filtered) entries as candidates — an excluded country's
 *  boundary record in the raw generated file is never looked up. */
export async function resolveCurrentCountry(from: Coords): Promise<CountryResolution | undefined> {
  const boundaries = await loadCountryBoundaries();
  if (boundaries) {
    const matches: NearbyCountry[] = [];
    for (const { entry, latlng } of catalogGeo) {
      const boundary = boundaries[entry.countryCode];
      if (!boundary) continue;
      if (!bboxContains(boundary.bbox, from.lng, from.lat)) continue;
      if (pointInPolygons(from.lng, from.lat, boundary.polygons)) {
        matches.push({ entry, distanceKm: haversineKm(from, latlng) });
      }
    }
    if (matches.length > 0) {
      matches.sort((a, b) => a.distanceKm - b.distanceKm);
      return { result: matches[0], method: 'boundary' };
    }
  }
  const fallback = approximateCountryOf(from);
  return fallback ? { result: fallback, method: 'centroid-fallback' } : undefined;
}
