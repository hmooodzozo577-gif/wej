// Phase 18 acceptance — Explore's "Personal match: highest / lowest first".
// Presentation only: it orders countries by the Personal Match already
// computed for them and never changes how Personal Match is calculated.
import type { PersonalMatch } from './types';

export type PersonalSortDirection = 'desc' | 'asc';

/** Groups keep this order in BOTH directions:
 *  0 — scored and meeting the traveller's one hard requirement,
 *  1 — scored but outside it (after every eligible country, as everywhere
 *      else in Phase 18),
 *  2 — no evaluable Personal Match, so it can never float to the top of
 *      either direction. */
function group(match: PersonalMatch | undefined): number {
  if (!match || match.score === null) return 2;
  return match.eligible ? 0 : 1;
}

/** Stable and deterministic: equal scores keep the incoming (baseline)
 *  order. Sorting, never filtering — every country is returned. */
export function sortByPersonalMatch<T extends { id: string }>(
  list: readonly T[],
  matches: ReadonlyMap<string, PersonalMatch>,
  direction: PersonalSortDirection,
): T[] {
  const sign = direction === 'desc' ? -1 : 1;
  return list
    .map((item, index) => ({ item, index, match: matches.get(item.id) }))
    .sort((a, b) => {
      const byGroup = group(a.match) - group(b.match);
      if (byGroup) return byGroup;
      const aScore = a.match?.score;
      const bScore = b.match?.score;
      const byScore = aScore != null && bScore != null ? sign * (aScore - bScore) : 0;
      return byScore || a.index - b.index;
    })
    .map((entry) => entry.item);
}
