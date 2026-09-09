// Phase 10 — the unified worldwide catalog: the 30 existing, full,
// recommendation-ready destinations plus the 165 basic countries added this
// phase. 195 total (see scripts/generate-world-countries.mjs for the
// country-list convention). Nothing in the recommendation engine imports
// this — scoreDestination/rankDestinations/buildWhyText continue to import
// DESTINATIONS directly and are entirely unaffected by this file existing.
import { DESTINATIONS } from './destinations';
import { BASIC_COUNTRIES } from './basicCountries';
import type { CatalogEntry, Continent } from './types';

export const WORLD_CATALOG: CatalogEntry[] = [...DESTINATIONS, ...BASIC_COUNTRIES];

/** Destination.region and BasicCountry.continent are both Continent-shaped
 *  (Region is a subset of Continent) — this just picks the right field. */
export function continentOf(entry: CatalogEntry): Continent {
  return entry.recommendationReady ? entry.region : entry.continent;
}
