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
//
// To disable the exclusion entirely, empty this array (or remove an
// individual entry). No other file needs to change.
export interface ExcludedCountry {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string;
  /** ISO 3166-1 alpha-3, uppercase — used to scrub stale border references
   *  in other countries' Country Information once this one is excluded. */
  iso3: string;
  /** Why this entry is here — required so an exclusion is never silent/unexplained. */
  reason: string;
}

export const EXCLUDED_COUNTRIES: ExcludedCountry[] = [
  // QA test fixture (temporary): proves the exclusion mechanism works
  // end-to-end — catalog, Explore, search, routing, recommendation
  // eligibility, country info, and border-reference cleanup. Remove this
  // entry (or empty the array) to restore Israel and go back to 195/165.
  { iso2: 'IL', iso3: 'ISR', reason: 'QA test: verify country-exclusion mechanism end-to-end (temporary)' },
];

const excludedIso2 = new Set(EXCLUDED_COUNTRIES.map((c) => c.iso2.toUpperCase()));
const excludedIso3 = new Set(EXCLUDED_COUNTRIES.map((c) => c.iso3.toUpperCase()));

export function isExcludedIso2(iso2: string): boolean {
  return excludedIso2.has(iso2.toUpperCase());
}

export function isExcludedIso3(iso3: string): boolean {
  return excludedIso3.has(iso3.toUpperCase());
}
