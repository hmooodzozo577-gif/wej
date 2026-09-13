import { nameOf } from './destinationText';
import { haversineKm } from './geo';
import type { CatalogEntry } from './types';
import { RECOMMENDATION_PROFILE_BY_CODE } from './worldRecommendation';
import { WORLD_CATALOG, continentOf, countryInfoOf } from './worldCatalog';
import type { ExploreFilters, ExploreSort, LocationCoords } from '../state/types';

function searchHaystack(destination: CatalogEntry): string {
  const parts = [destination.nameEn, destination.nameAr];
  if (destination.recommendationReady) parts.push(...destination.citiesEn, ...destination.citiesAr);
  else if (destination.capitalEn) parts.push(destination.capitalEn);
  return parts.join(' ').toLowerCase();
}

export function filteredCatalog(filters: ExploreFilters): CatalogEntry[] {
  const query = filters.q.trim().toLowerCase();
  return WORLD_CATALOG.filter((destination) => {
    if (query && !searchHaystack(destination).includes(query)) return false;
    if (filters.region && continentOf(destination) !== filters.region) return false;
    if (filters.cost && String(RECOMMENDATION_PROFILE_BY_CODE.get(destination.countryCode)?.costLevel) !== filters.cost) return false;
    if (filters.purpose) {
      const profile = RECOMMENDATION_PROFILE_BY_CODE.get(destination.countryCode);
      if (!profile) return false;
      const key = filters.purpose === 'work' ? 'opportunity' : filters.purpose === 'education' ? 'education' : filters.purpose === 'medical' ? 'health' : filters.purpose === 'investment' ? 'investment' : 'popularity';
      if (profile[key] < 55) return false;
    }
    return true;
  });
}

export function sortCatalog(list: CatalogEntry[], sort: ExploreSort, lang: 'ar' | 'en', origin?: LocationCoords | null): CatalogEntry[] {
  const sorted = [...list];
  const byName = (a: CatalogEntry, b: CatalogEntry) => nameOf(a, lang).localeCompare(nameOf(b, lang), lang === 'ar' ? 'ar' : 'en');
  const missingLast = (missingA: boolean, missingB: boolean) => Number(missingA) - Number(missingB);
  switch (sort) {
    case 'name-asc': return sorted.sort(byName);
    case 'name-desc': return sorted.sort((a, b) => byName(b, a));
    case 'area-desc': return sorted.sort((a, b) => (countryInfoOf(b.id)?.areaKm2 ?? 0) - (countryInfoOf(a.id)?.areaKm2 ?? 0) || byName(a, b));
    case 'area-asc': return sorted.sort((a, b) => (countryInfoOf(a.id)?.areaKm2 ?? Number.POSITIVE_INFINITY) - (countryInfoOf(b.id)?.areaKm2 ?? Number.POSITIVE_INFINITY) || byName(a, b));
    case 'cost-asc':
    case 'cost-desc':
      return sorted.sort((a, b) => {
        const aProfile = RECOMMENDATION_PROFILE_BY_CODE.get(a.countryCode);
        const bProfile = RECOMMENDATION_PROFILE_BY_CODE.get(b.countryCode);
        const missing = missingLast(!aProfile || aProfile.imputedKeys.includes('costLevel'), !bProfile || bProfile.imputedKeys.includes('costLevel'));
        if (missing) return missing;
        const difference = (aProfile?.costLevel ?? 0) - (bProfile?.costLevel ?? 0);
        return (sort === 'cost-asc' ? difference : -difference) || byName(a, b);
      });
    case 'nearest':
      if (!origin) return sorted;
      return sorted.sort((a, b) => {
        const aInfo = countryInfoOf(a.id);
        const bInfo = countryInfoOf(b.id);
        const aDistance = aInfo ? haversineKm(origin, aInfo.latlng) : Number.POSITIVE_INFINITY;
        const bDistance = bInfo ? haversineKm(origin, bInfo.latlng) : Number.POSITIVE_INFINITY;
        return aDistance - bDistance || byName(a, b);
      });
    default: return sorted;
  }
}
