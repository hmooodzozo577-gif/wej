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

export function sortCatalog(
  list: CatalogEntry[],
  sort: ExploreSort,
  lang: 'ar' | 'en',
  origin?: LocationCoords | null,
  currentCountryCode?: string | null,
): CatalogEntry[] {
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
    case 'farthest': {
      // Item #7 — with no real location context these sorts cannot operate,
      // so the list is returned in its existing order rather than pretending.
      // Explore.tsx additionally never OFFERS them without coordinates, so
      // this branch is the defensive half of the same gate.
      if (!origin) return sorted;
      // BUG FIX (production report): this used to derive the excluded
      // country ITSELF via approximateCountryOf() (nearest-centroid). That
      // is the exact technique already proven unreliable for "which country
      // is the user actually in" — geo.ts's own module comment documents a
      // real prior bug where a user in Abha, Saudi Arabia resolved to
      // Eritrea, because Eritrea's centroid was arithmetically closer than
      // Saudi Arabia's own. The same failure mode reproduces here with real
      // coordinates: a traveller in Dammam, Saudi Arabia (26.4207, 50.0888)
      // resolves via nearest-centroid to Bahrain (66km away) — Saudi
      // Arabia's own centroid is not even in the nearest three — so Saudi
      // Arabia was never excluded and kept appearing in "Nearest to me",
      // which is exactly the production report this fixes.
      //
      // `sortCatalog` stays synchronous and pure (it always has been, and
      // its own test suite depends on that), so it no longer resolves the
      // current country itself at all — the caller (Explore.tsx, via
      // useResolvedCountryCode) must resolve it ONCE, asynchronously,
      // through geo.ts's resolveCurrentCountry() (real point-in-polygon,
      // falling back to nearest-centroid only when no boundary matches —
      // the same resolver LocationPersonalize.tsx and TravelInfo.tsx
      // already use for "current country"), and pass the result in here.
      //
      // `currentCountryCode` undefined/null means "not resolved yet" and
      // must NEVER be treated as "no current country to exclude" by
      // guessing — nothing is filtered until a real resolved code arrives,
      // so an uncertain resolution can never cause the WRONG country to be
      // hidden. The user's own country is excluded from BOTH distance
      // sorts once resolved: it is not a travel recommendation in either
      // direction, and leaving it in "farthest" would only bury it at the
      // bottom while still inflating the count.
      const candidates = currentCountryCode ? sorted.filter((entry) => entry.countryCode !== currentCountryCode) : sorted;
      const distanceOf = (entry: CatalogEntry) => {
        const info = countryInfoOf(entry.id);
        return info ? haversineKm(origin, info.latlng) : undefined;
      };
      return candidates.sort((a, b) => {
        const aDistance = distanceOf(a);
        const bDistance = distanceOf(b);
        // A country with no resolvable centroid has no distance at all, so it
        // sorts last in BOTH directions rather than winning "farthest" on a
        // missing value.
        const missing = missingLast(aDistance === undefined, bDistance === undefined);
        if (missing) return missing;
        const difference = (aDistance ?? 0) - (bDistance ?? 0);
        return (sort === 'nearest' ? difference : -difference) || byName(a, b);
      });
    }
    default: return sorted;
  }
}
