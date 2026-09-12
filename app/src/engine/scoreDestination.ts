import { CLIMATE_COMPAT, QUESTION_BANKS } from '../data/questionBanks';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import type { CatalogEntry, PurposeId, RecommendationProfile } from '../data/types';
import type { Answers, Reason, ScoreResult } from './types';

const PURPOSE_WEIGHT = 25;

function purposeFit(profile: RecommendationProfile, purposeId: PurposeId): number {
  switch (purposeId) {
    case 'tourism': return profile.popularity;
    case 'work': return profile.opportunity;
    case 'education': return profile.education;
    case 'medical': return profile.health;
    case 'immigration': return Math.round((profile.income + profile.health + profile.opportunity) / 3);
    case 'investment': return Math.round((profile.investment + profile.growth + profile.income) / 3);
    case 'wellness': return Math.round((profile.health + (100 - profile.urbanity) + profile.coastal) / 3);
    default:
      return Math.round((profile.popularity + profile.opportunity + profile.education + profile.health + profile.investment) / 5);
  }
}

export function scoreDestination(dest: CatalogEntry, purposeId: PurposeId, answers: Answers): ScoreResult {
  const profile = RECOMMENDATION_PROFILE_BY_CODE.get(dest.countryCode);
  if (!profile) return { score: 0, reasons: [] };
  let totalWeighted = 0;
  let totalWeight = 0;
  const reasons: Reason[] = [];
  const scoredDimensions = new Set<string>();

  for (const question of QUESTION_BANKS[purposeId]) {
    const answer = answers[question.id];
    const key = question.profileKey;
    if (answer === undefined || !key || scoredDimensions.has(key)) continue;
    scoredDimensions.add(key);

    const destinationValue = profile[key];
    let fit = 50;
    let effectiveWeight = question.weight;
    if (question.kind === 'target' && typeof destinationValue === 'number' && typeof answer === 'number') {
      fit = Math.max(0, 100 - (Math.abs(destinationValue - answer) / (question.scale ?? 100)) * 100);
    } else if (question.kind === 'importance' && typeof destinationValue === 'number' && typeof answer === 'number') {
      effectiveWeight *= answer / 100;
      fit = destinationValue;
    } else if (question.kind === 'category') {
      fit = destinationValue === answer ? 100 : 0;
    } else if (question.kind === 'climate') {
      fit = CLIMATE_COMPAT[String(answer)]?.[profile.climate] ?? (profile.climate === answer ? 100 : 30);
    }
    totalWeighted += fit * effectiveWeight;
    totalWeight += effectiveWeight;
    reasons.push({ id: question.id, weight: effectiveWeight, fit });
  }

  const baseline = purposeFit(profile, purposeId);
  totalWeighted += baseline * PURPOSE_WEIGHT;
  totalWeight += PURPOSE_WEIGHT;
  reasons.push({ id: '__purpose', weight: PURPOSE_WEIGHT, fit: baseline });
  reasons.sort((a, b) => b.weight * b.fit - a.weight * a.fit);
  return { score: Math.max(0, Math.min(100, Math.round(totalWeighted / totalWeight))), reasons };
}
