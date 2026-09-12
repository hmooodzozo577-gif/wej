import { WORLD_CATALOG, countryInfoOf } from '../data/worldCatalog';
import { haversineKm, type Coords } from '../data/geo';
import { scoreDestination } from './scoreDestination';
import type { PurposeId } from '../data/types';
import type { Answers, RankedResult } from './types';

export function rankDestinations(purposeId: PurposeId, answers: Answers, origin?: Coords | null): RankedResult[] {
  return WORLD_CATALOG.map((dest) => {
    const info = origin ? countryInfoOf(dest.id) : undefined;
    return { dest, ...scoreDestination(dest, purposeId, answers), ...(origin && info ? { distanceKm: haversineKm(origin, info.latlng) } : {}) };
  }).sort((a, b) =>
    b.score - a.score ||
    (origin ? (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) : 0) ||
    a.dest.id.localeCompare(b.dest.id),
  );
}
