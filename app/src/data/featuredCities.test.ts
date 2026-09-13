import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from './worldCatalog';
import { featuredCitiesOf } from './featuredCities';

describe('featured cities coverage', () => {
  it('provides one to five sourced cities for every effective catalog country', () => {
    expect(WORLD_CATALOG).toHaveLength(194);
    for (const country of WORLD_CATALOG) {
      const cities = featuredCitiesOf(country.countryCode);
      expect(cities.length, country.countryCode).toBeGreaterThanOrEqual(1);
      expect(cities.length, country.countryCode).toBeLessThanOrEqual(5);
      expect(cities.every((city) => city.countryCode === country.countryCode)).toBe(true);
      expect(cities.every((city) => city.source === 'city-timezones' || city.source === 'world-countries')).toBe(true);
    }
  });

  it('never exposes the excluded country', () => {
    expect(featuredCitiesOf('IL')).toEqual([]);
  });
});
