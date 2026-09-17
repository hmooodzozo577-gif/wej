// "Best suited for" — Country -> Best Purposes (task workstream C).
//
// Deliberately NOT a second scoring system: this is a pure, deterministic
// INTERPRETATION built entirely on top of the existing Purpose Suitability
// Scores (score.ts) — it reads CountryIntelligenceSummary values and
// groups/ranks them, never computes a new number of its own.
//
// TIE/GROUPING RULE (documented, deterministic, tested in
// bestSuitedFor.test.ts):
//   1. A purpose is ELIGIBLE for "best suited for" status only when it has
//      a real score (not insufficientData) AND confidence is 'high' or
//      'medium'. A purpose with insufficient data or 'low' confidence
//      never becomes "best" purely from a numeric artifact — task's own
//      explicit rule — though it still appears in the full ranked list.
//   2. Among eligible purposes, find the top score.
//   3. GROUP every eligible purpose within GROUPING_MARGIN_POINTS of the
//      top score into the "top group" — this is what prevents a
//      meaningless 90-vs-89-vs-88 spread from being presented as if 90
//      were categorically better than 89.
//   4. If the top group has exactly one member, present it as a single
//      "Best suited for X". If it has more than one, present it as a
//      grouped "Strong for X, Y, and Z" — the UI layer (not this module)
//      picks the exact phrasing, but `topGroup.length` is what it
//      branches on.
//   5. If NO purpose is eligible at all (every purpose has insufficient
//      data or only low confidence), this returns `eligible: false` — the
//      UI must show an honest insufficient-data state, never force a
//      winner.
import type { CountryIntelligenceSummary, SuitablePurposeId } from './types';

/** Purposes within this many points of the top eligible score join the
 *  same top group, rather than being presented as categorically worse.
 *  Chosen as a deliberately conservative band: two purposes 5 points
 *  apart on this 0-100 scale are well within the normal noise of
 *  winsorized-percentile normalization (score.ts) to call "meaningfully
 *  different" on their own. */
export const GROUPING_MARGIN_POINTS = 5;

export interface RankedSuitability {
  purpose: SuitablePurposeId;
  score: number | null;
  confidence: CountryIntelligenceSummary['confidence'];
  insufficientData: boolean;
  eligible: boolean;
  inTopGroup: boolean;
}

export interface BestSuitedForResult {
  /** False when no purpose has enough data/confidence to name a "best"
   *  purpose at all — the honest state, never a forced winner. */
  eligible: boolean;
  /** The tied/grouped top purpose(s), in descending score order. `null`
   *  when `eligible` is false. */
  topGroup: SuitablePurposeId[] | null;
  /** The top eligible score, or `null` when `eligible` is false. */
  topScore: number | null;
  /** The lowest confidence level present in the top group — showing the
   *  group's own confidence should never overstate its weakest member. */
  topConfidence: CountryIntelligenceSummary['confidence'];
  /** Every scored purpose, descending by score (insufficient-data entries
   *  last), each flagged with whether it was eligible and whether it
   *  landed in the top group — everything the UI needs to render "ranked
   *  beneath" without recomputing anything. */
  ranked: RankedSuitability[];
}

const CONFIDENCE_RANK: Record<NonNullable<CountryIntelligenceSummary['confidence']>, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function weakestConfidence(
  levels: CountryIntelligenceSummary['confidence'][],
): CountryIntelligenceSummary['confidence'] {
  const real = levels.filter((level): level is NonNullable<typeof level> => level !== null);
  if (real.length === 0) return null;
  return real.reduce((weakest, level) => (CONFIDENCE_RANK[level] < CONFIDENCE_RANK[weakest] ? level : weakest));
}

/** Builds the deterministic "Best suited for" interpretation for one
 *  country from its already-computed purpose suitability summaries.
 *  `summaries` should contain one entry per purpose that has been scored
 *  for this country (any subset/order is fine — this sorts and groups
 *  from scratch). */
export function bestSuitedFor(summaries: CountryIntelligenceSummary[]): BestSuitedForResult {
  const isEligible = (summary: CountryIntelligenceSummary) =>
    !summary.insufficientData && summary.score !== null && (summary.confidence === 'high' || summary.confidence === 'medium');

  const sorted = [...summaries].sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  const eligibleSorted = sorted.filter(isEligible);

  if (eligibleSorted.length === 0) {
    return {
      eligible: false,
      topGroup: null,
      topScore: null,
      topConfidence: null,
      ranked: sorted.map((summary) => ({
        purpose: summary.purpose,
        score: summary.score,
        confidence: summary.confidence,
        insufficientData: summary.insufficientData,
        eligible: false,
        inTopGroup: false,
      })),
    };
  }

  const topScore = eligibleSorted[0]!.score!;
  const topGroupSet = new Set(
    eligibleSorted.filter((summary) => summary.score !== null && summary.score >= topScore - GROUPING_MARGIN_POINTS).map((summary) => summary.purpose),
  );

  return {
    eligible: true,
    topGroup: eligibleSorted.filter((summary) => topGroupSet.has(summary.purpose)).map((summary) => summary.purpose),
    topScore,
    topConfidence: weakestConfidence(eligibleSorted.filter((summary) => topGroupSet.has(summary.purpose)).map((summary) => summary.confidence)),
    ranked: sorted.map((summary) => ({
      purpose: summary.purpose,
      score: summary.score,
      confidence: summary.confidence,
      insufficientData: summary.insufficientData,
      eligible: isEligible(summary),
      inTopGroup: topGroupSet.has(summary.purpose),
    })),
  };
}
