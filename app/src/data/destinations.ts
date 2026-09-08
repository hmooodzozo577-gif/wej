// The 30 destinations, ported verbatim (via scripts/extract-source.mjs) from
// DESTS_RAW/DK in wejhaty.html. Data values are unchanged from the original —
// this file only adds a type.
import destinationsJson from './generated/destinations.json';
import type { Destination } from './types';

export const DESTINATIONS: Destination[] = destinationsJson as Destination[];
