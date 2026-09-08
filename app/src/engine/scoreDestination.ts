// Ported verbatim (same math, same weights, same purpose-fit constant, same
// clamping/rounding) from scoreDestination() in wejhaty.html. Do not alter
// the formula, weights, or purpose-scoring treatment — see engine/README.md
// and the parity tests in scoreDestination.parity.test.ts.
import { QUESTION_BANKS, CLIMATE_COMPAT } from '../data/questionBanks';
import { PURPOSES } from '../data/purposes';
import type { Destination, PurposeId } from '../data/types';
import type { Answers, Reason, ScoreResult } from './types';

/** Fixed weight of the purpose-fit component in the overall score (unchanged from original). */
const PURPOSE_WEIGHT = 25;

export function scoreDestination(
  dest: Destination,
  purposeId: PurposeId,
  answers: Answers,
): ScoreResult {
  const questions = QUESTION_BANKS[purposeId].filter((q) => q.kind !== 'flavor');
  let totalWeighted = 0;
  let totalWeight = 0;
  const reasons: Reason[] = [];

  questions.forEach((q) => {
    const ans = answers[q.id];
    if (ans === undefined) return;

    let fit = 50;
    let effWeight = q.weight;

    if (q.kind === 'target') {
      const scale = q.scale || 100;
      const destVal = dest[q.destKey as keyof Destination] as number;
      const diff = Math.abs(destVal - (ans as number));
      fit = Math.max(0, 100 - (diff / scale) * 100);
    } else if (q.kind === 'importance') {
      effWeight = q.weight * ((ans as number) / 100);
      fit = dest[q.destKey as keyof Destination] as number;
    } else if (q.kind === 'category') {
      fit = dest[q.destKey as keyof Destination] === ans ? 100 : 45;
    } else if (q.kind === 'climate') {
      const matrix = CLIMATE_COMPAT[ans as string];
      const destClimate = dest[q.destKey as keyof Destination] as string;
      fit = matrix ? (matrix[destClimate as keyof typeof matrix] ?? 50) : 50;
    }

    totalWeighted += fit * effWeight;
    totalWeight += effWeight;
    reasons.push({ id: q.id, weight: effWeight, fit });
  });

  // Implicit purpose-fit component (fixed weight 25) using the destination's
  // baseline purpose score, or the 7-purpose average for "other".
  const pMeta = PURPOSES.find((p) => p.id === purposeId);
  const purposeFit =
    pMeta && pMeta.pScoreKey
      ? (dest[pMeta.pScoreKey] as number)
      : (dest.pTourism +
          dest.pWork +
          dest.pEdu +
          dest.pMed +
          dest.pImmi +
          dest.pInvest +
          dest.pWellness) /
        7;

  totalWeighted += purposeFit * PURPOSE_WEIGHT;
  totalWeight += PURPOSE_WEIGHT;
  reasons.push({ id: '__purpose', weight: PURPOSE_WEIGHT, fit: purposeFit });

  const score = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 50;
  reasons.sort((a, b) => b.weight * b.fit - a.weight * a.fit);

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
