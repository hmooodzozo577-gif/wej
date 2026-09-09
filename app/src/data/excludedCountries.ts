// Development/QA country-exclusion mechanism. Lets the application drop
// selected countries from its EFFECTIVE catalog (WORLD_CATALOG, Explore,
// search, destination routing, country info, border references) without
// touching the upstream `world-countries` package or any generated JSON
// file — those stay exactly as generated. Applied at the two data-source
// wrapper modules (destinations.ts, basicCountries.ts) that turn generated
// JSON into the app's typed arrays, so every consumer downstream of
// WORLD_CATALOG (Explore, DestinationCard, Destination routing,
// countryInfoOf, recommendation eligibility) is automatically consistent —
// no scattered per-component checks, no duplicated filtering logic.
import excludedCountriesData from './excludedCountriesData.json';

// To disable the exclusion entirely, empty excludedCountriesData.json (or
// remove an individual entry there). No other file needs to change.
//
// Phase 13.5c completion: the list itself now lives in the sibling
// excludedCountriesData.json, a plain JSON file with no TS-specific
// syntax, so scripts/generate-travel-cost-index.mjs (plain Node ESM,
// no TS loader) can import the EXACT SAME file this module does,
// instead of maintaining its own hardcoded mirror of it. This module
// remains the only place the app's own exclusion checks
// (isExcludedIso2/isExcludedIso3) are defined and exported from.
export interface ExcludedCountry {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string;
  /** ISO 3166-1 alpha-3, uppercase — used to scrub stale border references
   *  in other countries' Country Information once this one is excluded. */
  iso3: string;
  /** Why this entry is here — required so an exclusion is never silent/unexplained. */
  reason: string;
}

export const EXCLUDED_COUNTRIES: ExcludedCountry[] = excludedCountriesData;

const excludedIso2 = new Set(EXCLUDED_COUNTRIES.map((c) => c.iso2.toUpperCase()));
const excludedIso3 = new Set(EXCLUDED_COUNTRIES.map((c) => c.iso3.toUpperCase()));

export function isExcludedIso2(iso2: string): boolean {
  return excludedIso2.has(iso2.toUpperCase());
}

export function isExcludedIso3(iso3: string): boolean {
  return excludedIso3.has(iso3.toUpperCase());
}
