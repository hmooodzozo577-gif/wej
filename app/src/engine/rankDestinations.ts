import { WORLD_CATALOG, countryInfoOf, resolvedBordersOf } from '../data/worldCatalog';
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import { approximateCountryOf, haversineKm, type Coords } from '../data/geo';
import { scoreDestination } from './scoreDestination';
import type { CatalogEntry, PurposeId } from '../data/types';
import type { Answers, RankedResult } from './types';

/** Item #7 — when the optional land-travel question was answered "yes",
 *  narrow candidates to countries sharing a direct land border with the
 *  user's current country. Geographic adjacency ONLY: this never implies
 *  open crossings, visa eligibility, or a currently drivable route (see the
 *  question's own option description). Nearest-centroid is the same
 *  synchronous approximation used elsewhere in this app for "which country
 *  is the user in" (see data/geo.ts) — ranking must stay synchronous, so it
 *  can't await the more precise boundary-polygon resolver here. If the
 *  resolved country has no land borders at all (an island nation) or can't
 *  be resolved, the filter is skipped entirely rather than ever returning
 *  zero candidates. */
function landBorderCandidates(origin: Coords): CatalogEntry[] | null {
  const current = approximateCountryOf(origin)?.entry;
  if (!current) return null;
  const borders = resolvedBordersOf(current.id);
  return borders.length ? borders : null;
}

export function rankDestinations(purposeId: PurposeId, answers: Answers, origin?: Coords | null): RankedResult[] {
  const proximityQuestion = QUESTION_BANKS[purposeId].find((question) => question.kind === 'proximity');
  const useProximity = !!(origin && proximityQuestion && Number(answers[proximityQuestion.id]) > 0);

  const wantsLandBorder = Number(answers[landBorderQuestionId(purposeId)]) === 1;
  const borderCandidates = wantsLandBorder && origin ? landBorderCandidates(origin) : null;
  const candidates = borderCandidates ?? WORLD_CATALOG;

  return candidates.map((dest) => {
    const info = useProximity ? countryInfoOf(dest.id) : undefined;
    const distanceKm = useProximity && info ? haversineKm(origin, info.latlng) : undefined;
    return { dest, ...scoreDestination(dest, purposeId, answers, distanceKm), ...(distanceKm !== undefined ? { distanceKm } : {}) };
  }).sort((a, b) =>
    b.score - a.score ||
    (useProximity ? (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) : 0) ||
    a.dest.id.localeCompare(b.dest.id),
  );
}
