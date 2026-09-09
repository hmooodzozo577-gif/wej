// Phase 10 — the 165 UN-recognized countries not already covered by the 30
// full destinations. Ported from scripts/generate-world-countries.mjs's
// output (see that script for the exact source/convention documentation).
// No recommendation-engine data is invented for these — see BasicCountry.
import basicCountriesJson from './generated/basicCountries.json';
import type { BasicCountry } from './types';
import { isExcludedIso2 } from './excludedCountries';

// Any entry configured in excludedCountries.ts is dropped here, before it
// ever reaches WORLD_CATALOG — see that file for why this is the boundary.
export const BASIC_COUNTRIES: BasicCountry[] = (basicCountriesJson as BasicCountry[]).filter(
  (c) => !isExcludedIso2(c.countryCode),
);
