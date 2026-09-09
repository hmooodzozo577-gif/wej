// The 30 destinations, ported verbatim (via scripts/extract-source.mjs) from
// DESTS_RAW/DK in wejhaty.html. Data values are unchanged from the original —
// this file only adds a type, plus (Phase 10) the `recommendationReady: true`
// discriminant, set here rather than in the generated JSON so the extraction
// output stays byte-for-byte verbatim.
import destinationsJson from './generated/destinations.json';
import type { Destination } from './types';

type RawDestination = Omit<Destination, 'recommendationReady'>;

export const DESTINATIONS: Destination[] = (destinationsJson as RawDestination[]).map((d) => ({
  ...d,
  recommendationReady: true as const,
}));
