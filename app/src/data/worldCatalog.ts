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
