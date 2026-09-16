// Item #12C — how a passport is allowed to affect the ranking.
//
// THE CONSTRAINT, restated because it is the whole design: the user approved
// visa data affecting suitability, but did NOT approve a new weighting
// scheme, and Phase 14 remains the deterministic final ranking authority.
// So this layer:
//
//   - changes NO Phase 14 weight, dimension or semantic
//   - changes NO destination's match score. The percentage a traveller sees
//     is exactly the Phase 14 score, before and after a passport is chosen.
//   - lives entirely OUTSIDE the engine, applied to an already-ranked list
//   - is bounded: it may only reorder destinations whose Phase 14 scores are
//     already within REORDER_WINDOW of each other. A materially better match
//     can never be pushed below a materially worse one because of a visa.
//   - is inert without a passport, and inert for any destination whose
//     requirement is 'unknown'
//
// A score-blending design (adding a visa term to the weighted total) would
// be a Phase 14 weight change and is NOT implemented here. It is written up
// as a proposal for the user to approve or reject — see PROJECT_STATE.md.
import type { RankedResult } from '../engine';
import { visaConvenienceRank, type VisaRequirement } from './types';

/** Two destinations may swap places only if their Phase 14 scores are within
 *  this many points of each other. Three points on a 0-100 match scale is
 *  inside the noise of a score built partly on median-imputed indicators —
 *  which is exactly the band where "and one of them is visa-free" is the
 *  more useful signal, and outside of which it is not. */
export const REORDER_WINDOW = 3;

export interface VisaRankingInput {
  results: RankedResult[];
  /** Keyed by destination ISO 3166-1 alpha-2. Missing entries are treated
   *  exactly like 'unknown': they change nothing. */
  requirements: Map<string, VisaRequirement>;
  /** Null when the traveller skipped the passport question. */
  passportCode: string | null;
}

/**
 * Reorders an already-ranked list so that, WITHIN a band of near-equal Phase
 * 14 scores, the more convenient entry requirement comes first.
 *
 * Implementation note: the list is partitioned into runs of results whose
 * scores are all within REORDER_WINDOW of the run's own first (highest)
 * score. Each run is sorted by visa convenience, with the Phase 14 score and
 * then the destination id as tie-breakers, so the result stays completely
 * deterministic. Nothing moves between runs.
 */
export function applyVisaRanking({ results, requirements, passportCode }: VisaRankingInput): RankedResult[] {
  if (!passportCode || !requirements.size) return results;

  const ordered: RankedResult[] = [];
  let index = 0;
  while (index < results.length) {
    const runStartScore = results[index]!.score;
    let end = index;
    while (end < results.length && runStartScore - results[end]!.score <= REORDER_WINDOW) end += 1;

    const run = results.slice(index, end);
    run.sort((a, b) => {
      const aRank = visaConvenienceRank(requirements.get(a.dest.countryCode)?.category ?? 'unknown');
      const bRank = visaConvenienceRank(requirements.get(b.dest.countryCode)?.category ?? 'unknown');
      return aRank - bRank || b.score - a.score || a.dest.id.localeCompare(b.dest.id);
    });
    ordered.push(...run);
    index = end;
  }
  return ordered;
}

/** True when the passport choice actually changed the order — used to decide
 *  whether to tell the traveller that it did, rather than claiming an effect
 *  that did not happen. */
export function visaRankingChangedOrder(before: RankedResult[], after: RankedResult[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((item, position) => item.dest.id !== after[position]!.dest.id);
}
