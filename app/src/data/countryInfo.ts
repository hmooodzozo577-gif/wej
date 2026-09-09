// Phase 11 Step 1 — build-time Country Information dataset. Ported from
// scripts/generate-world-countries.mjs's output (see that script for the
// exact source/convention documentation). Covers all 195 catalog countries,
// keyed by ISO 3166-1 alpha-2 (uppercase). No live API, no runtime network
// call — same static-data pattern as destinations.ts / basicCountries.ts.
import countryInfoJson from './generated/countryInfo.json';
import type { CountryInfo } from './types';

export const COUNTRY_INFO: Record<string, CountryInfo> = countryInfoJson as Record<string, CountryInfo>;

export function countryInfoByIso2(iso2: string): CountryInfo | undefined {
  return COUNTRY_INFO[iso2.toUpperCase()];
}
