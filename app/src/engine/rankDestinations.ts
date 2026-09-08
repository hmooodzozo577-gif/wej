// Ported verbatim from rankDestinations() in wejhaty.html.
import { DESTINATIONS } from '../data/destinations';
import { scoreDestination } from './scoreDestination';
import type { PurposeId } from '../data/types';
import type { Answers, RankedResult } from './types';

export function rankDestinations(purposeId: PurposeId, answers: Answers): RankedResult[] {
  return DESTINATIONS.map((dest) => {
    const r = scoreDestination(dest, purposeId, answers);
    return { dest, score: r.score, reasons: r.reasons };
  }).sort((a, b) => b.score - a.score);
}
