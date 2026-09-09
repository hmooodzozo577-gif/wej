// Phase 10 — the unified worldwide catalog: the 30 existing, full,
// recommendation-ready destinations plus the 165 basic countries added this
// phase (195 total before any exclusion — see
// scripts/generate-world-countries.mjs for the country-list convention).
// Nothing in the recommendation engine imports this —
// scoreDestination/rankDestinations/buildWhyText continue to import
// DESTINATIONS directly and are entirely unaffected by this file existing.
//
// DESTINATIONS and BASIC_COUNTRIES already exclude anything configured in
// excludedCountries.ts before this array is built, so WORLD_CATALOG — and
// everything that reads it (Explore, search, DestinationCard, destination
// routing, countryInfoOf below) — reflects the exclusion automatically.
import { DESTINATIONS } from './destinations';
import { BASIC_COUNTRIES } from './basicCountries';
import { countryInfoByIso2 } from './countryInfo';
import { isExcludedIso3 } from './excludedCountries';
import type { CatalogEntry, Continent, CountryInfo } from './types';

export const WORLD_CATALOG: CatalogEntry[] = [...DESTINATIONS, ...BASIC_COUNTRIES];

/** Destination.region and BasicCountry.continent are both Continent-shaped
 *  (Region is a subset of Continent) — this just picks the right field. */
export function continentOf(entry: CatalogEntry): Continent {
  return entry.recommendationReady ? entry.region : entry.continent;
}

/** Phase 11 Step 1 — looks up build-time Country Information for any catalog
 *  entry (full destination or basic country alike) by its catalog id, via
 *  its countryCode (ISO 3166-1 alpha-2). Both CatalogEntry variants carry
 *  countryCode, so one lookup covers all catalog entries.
 *
 *  Returns undefined for an excluded (or otherwise unknown) id, since it's
 *  no longer in WORLD_CATALOG. For a country that IS still in the catalog,
 *  any border reference to an excluded neighbor is scrubbed from the
 *  returned record — countryInfo.json itself (raw, generated straight from
 *  world-countries) is untouched, only this effective-data accessor filters. */
export function countryInfoOf(id: string): CountryInfo | undefined {
  const entry = WORLD_CATALOG.find((c) => c.id === id);
  if (!entry) return undefined;
  const info = countryInfoByIso2(entry.countryCode);
  if (!info) return undefined;
  if (!info.borders.some(isExcludedIso3)) return info;
  return { ...info, borders: info.borders.filter((b) => !isExcludedIso3(b)) };
}

// Phase 11 Step 3 — border-country navigation. Built once at module load
// (not per render): ISO3 -> catalog entry, but ONLY for entries already in
// the effective WORLD_CATALOG. An excluded country's iso3 is therefore
// never a key here at all — border navigation can't reintroduce it, on top
// of countryInfoOf() above already scrubbing excluded codes from the raw
// borders list.
const catalogByIso3 = new Map<string, CatalogEntry>();
for (const entry of WORLD_CATALOG) {
  const iso3 = countryInfoByIso2(entry.countryCode)?.iso3;
  if (iso3) catalogByIso3.set(iso3, entry);
}

/** Resolves a raw ISO3 border code to its catalog entry, if that country is
 *  in the effective catalog. Undefined for any code that doesn't resolve —
 *  unknown/invalid code, or an excluded country — so callers can render
 *  nothing rather than a broken link. */
export function resolveBorderCountry(iso3: string): CatalogEntry | undefined {
  return catalogByIso3.get(iso3.toUpperCase());
}

/** The navigable border list for a catalog entry: each raw ISO3 in its
 *  Country Information resolved to a real catalog entry, in original order,
 *  with unresolved codes, self-references, and duplicates dropped. Empty
 *  array (never throws) when there's no country info or no resolvable
 *  border — callers can render it directly with no null check. */
export function resolvedBordersOf(id: string): CatalogEntry[] {
  const info = countryInfoOf(id);
  if (!info) return [];
  const seen = new Set<string>();
  const result: CatalogEntry[] = [];
  for (const code of info.borders) {
    const entry = resolveBorderCountry(code);
    if (!entry || entry.id === id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}
