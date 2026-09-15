import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG, countryInfoOf } from '../data/worldCatalog';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import { sortCatalog } from '../data/exploreCatalog';

describe('Explore sorting', () => {
  it('sorts localized names in both directions', () => {
    const sample = WORLD_CATALOG.slice(0, 30);
    const asc = sortCatalog(sample, 'name-asc', 'en');
    const desc = sortCatalog(sample, 'name-desc', 'en');
    expect(desc.map((item) => item.id)).toEqual([...asc].reverse().map((item) => item.id));
  });

  it('sorts by sourced area and puts the nearest country first when location exists', () => {
    const byArea = sortCatalog(WORLD_CATALOG, 'area-desc', 'en');
    expect(countryInfoOf(byArea[0]!.id)!.areaKm2).toBeGreaterThanOrEqual(countryInfoOf(byArea[1]!.id)!.areaKm2);

    const origin = countryInfoOf('ksa')!.latlng;
    const nearest = sortCatalog(WORLD_CATALOG, 'nearest', 'en', origin);
    // Item #10: "nearest" excludes the user's own country — it is not a
    // travel recommendation for someone already there.
    expect(nearest.some((item) => item.id === 'ksa')).toBe(false);
    expect(nearest[0]!.id).not.toBe('ksa');
  });

  it('sorts direct price-level observations and leaves imputed entries last', () => {
    const sorted = sortCatalog(WORLD_CATALOG, 'cost-asc', 'en');
    const firstImputed = sorted.findIndex((country) => RECOMMENDATION_PROFILE_BY_CODE.get(country.countryCode)!.imputedKeys.includes('costLevel'));
    expect(firstImputed).toBeGreaterThan(0);
    expect(sorted.slice(firstImputed).every((country) => RECOMMENDATION_PROFILE_BY_CODE.get(country.countryCode)!.imputedKeys.includes('costLevel'))).toBe(true);
    const directLevels = sorted.slice(0, firstImputed).map((country) => RECOMMENDATION_PROFILE_BY_CODE.get(country.countryCode)!.costLevel);
    expect(directLevels).toEqual([...directLevels].sort((a, b) => a - b));
  });
});
