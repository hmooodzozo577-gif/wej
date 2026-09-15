// The 30 destinations, ported verbatim (via scripts/extract-source.mjs) from
// DESTS_RAW/DK in wejhaty.html. Data values are unchanged from the original —
// this file only adds a type, plus (Phase 10) the `recommendationReady: true`
// discriminant, set here rather than in the generated JSON so the extraction
// output stays byte-for-byte verbatim.
import destinationsJson from './generated/destinations.json';
import type { Destination } from './types';
import { isExcludedIso2 } from './excludedCountries';
import { deepLatinDigits } from './format';

type RawDestination = Omit<Destination, 'recommendationReady'>;

// Same exclusion boundary as basicCountries.ts — a no-op today (no entry in
// excludedCountries.ts matches one of the 30), kept here so the mechanism
// covers recommendation-ready destinations too without ever touching the
// verbatim-extracted values themselves.
// Item #4 — the verbatim-extracted Arabic fields carry literal
// Arabic-Indic digits (every `livingCostAr`, and "رؤية ٢٠٣٠" in one
// description). Normalized at this boundary for the same reason as the
// Arabic dictionary: the generated file stays a verbatim extraction.
export const DESTINATIONS: Destination[] = deepLatinDigits(destinationsJson as RawDestination[])
  .filter((d) => !isExcludedIso2(d.countryCode))
  .map((d) => ({
    ...d,
    recommendationReady: true as const,
  }));
