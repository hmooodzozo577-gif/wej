import { WORLD_CATALOG, countryInfoOf } from '../data/worldCatalog';
import { QUESTION_BANKS } from '../data/questionBanks';
import { haversineKm, type Coords } from '../data/geo';
import { scoreDestination } from './scoreDestination';
import type { PurposeId } from '../data/types';
import type { Answers, RankedResult } from './types';

export function rankDestinations(purposeId: PurposeId, answers: Answers, origin?: Coords | null): RankedResult[] {
  const proximityQuestion = QUESTION_BANKS[purposeId].find((question) => question.kind === 'proximity');
  const useProximity = !!(origin && proximityQuestion && Number(answers[proximityQuestion.id]) > 0);
  return WORLD_CATALOG.map((dest) => {
    const info = useProximity ? countryInfoOf(dest.id) : undefined;
    const distanceKm = useProximity && info ? haversineKm(origin, info.latlng) : undefined;
    return { dest, ...scoreDestination(dest, purposeId, answers, distanceKm), ...(distanceKm !== undefined ? { distanceKm } : {}) };
  }).sort((a, b) =>
    b.score - a.score ||
    (useProximity ? (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) : 0) ||
    a.dest.id.localeCompare(b.dest.id),
  );
}
