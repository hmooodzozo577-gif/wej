// Originally ported verbatim from rankDestinations() in wejhaty.html.
//
// Phase 14 engine audit finding (see engine/README.md's "Phase 14
// audit" section): the original sort was `(a, b) => b.score - a.score`
// alone — no explicit tie-breaker. Array.prototype.sort is stable in
// every engine this app targets, so equal-score destinations happened
// to keep DESTINATIONS' own array order, but that's an insertion-order
// accident, not a documented guarantee — a future reorder of
// data/destinations.json (adding/removing/reordering entries for
// unrelated reasons) could silently change which equally-scored
// destination "wins" a tie, with no test able to catch it since
// nothing asserted the order was deterministic on purpose.
//
// Fix: an explicit secondary sort key — `dest.id` (this app's own
// canonical, stable, human-readable destination identifier, e.g.
// "japan" — already required unique by data/destinations.json,
// verified: 30/30 unique). Chosen specifically because it carries no
// semantic weight toward "better destination" (unlike tourism
// popularity, proximity, or any score component) — see the location/
// PLI/tourism-in-recommendation decision gates in engine/README.md for
// why none of those were used instead. Ascending, for a fixed,
// reproducible order — never randomness, never insertion order,
// never current time.
import { DESTINATIONS } from '../data/destinations';
import { scoreDestination } from './scoreDestination';
import type { PurposeId } from '../data/types';
import type { Answers, RankedResult } from './types';

export function rankDestinations(purposeId: PurposeId, answers: Answers): RankedResult[] {
  return DESTINATIONS.map((dest) => {
    const r = scoreDestination(dest, purposeId, answers);
    return { dest, score: r.score, reasons: r.reasons };
  }).sort((a, b) => b.score - a.score || a.dest.id.localeCompare(b.dest.id));
}
