import { describe, expect, it } from 'vitest';
import { buildSnapshot, countryQuery, parseCountryResponse, validateEntries } from './islamicTravelIngest.mjs';

describe('Overpass queries', () => {
  it('asks for mapped places inside one country boundary only', () => {
    const query = countryQuery('SA');
    expect(query).toContain('area["ISO3166-1"="SA"]["admin_level"="2"]');
    expect(query).toContain('["amenity"="place_of_worship"]["religion"="muslim"]');
    expect(query).toContain('["diet:halal"~"^(yes|only)$"]');
    expect(query.match(/out count;/g)).toHaveLength(2);
    expect(query).toContain('.country out ids;');
    // Never a religion statistic or a population figure.
    expect(query).not.toMatch(/population|census|official_religion/i);
  });

  it('refuses anything that is not an ISO2 code', () => {
    expect(() => countryQuery('sa')).toThrow();
    expect(() => countryQuery('"];out;')).toThrow();
    expect(() => countryQuery('SAU')).toThrow();
  });
});

describe('Overpass responses', () => {
  const count = (total) => ({ type: 'count', id: 0, tags: { nodes: '0', ways: '0', relations: '0', total: String(total) } });

  const area = { type: 'area', id: 3600307584 };

  it('reads the two totals in order', () => {
    expect(parseCountryResponse({ elements: [area, count(120), count(7)] })).toEqual({ areaFound: true, mosques: 120, halalPlaces: 7 });
  });

  it('tells a missing boundary from "nothing mapped"', () => {
    expect(parseCountryResponse({ elements: [count(0), count(0)] })).toEqual({ areaFound: false });
    expect(parseCountryResponse({ elements: [area, count(0), count(0)] })).toEqual({ areaFound: true, mosques: 0, halalPlaces: 0 });
  });

  it('rejects malformed or partial answers', () => {
    for (const body of [null, {}, { remark: 'runtime error: timeout' }, { elements: [area, count(1)] }, { elements: [area, count('x'), count(1)] }, { elements: [area, count(-1), count(1)] }]) {
      expect(parseCountryResponse(body), JSON.stringify(body)).toBeNull();
    }
  });
});

describe('snapshot validation', () => {
  const expectedCodes = new Set(['SA', 'JP', 'GB']);
  const excludedCodes = new Set(['IL']);

  it('accepts a complete, clean snapshot', () => {
    const entries = [
      { countryCode: 'SA', status: 'ok', mosques: 20000, halalPlaces: 5 },
      { countryCode: 'JP', status: 'ok', mosques: 90, halalPlaces: 150 },
      { countryCode: 'GB', status: 'unavailable' },
    ];
    expect(validateEntries(entries, { expectedCodes, excludedCodes, minCoverage: 0.6 })).toEqual([]);
    expect(buildSnapshot(entries, new Date('2026-09-26T00:00:00Z')).license).toBe('ODbL-1.0');
  });

  it('refuses an excluded country, duplicates, gaps and thin coverage', () => {
    const errors = validateEntries([
      { countryCode: 'IL', status: 'ok', mosques: 1, halalPlaces: 1 },
      { countryCode: 'SA', status: 'ok', mosques: 1, halalPlaces: 1 },
      { countryCode: 'SA', status: 'ok', mosques: 1, halalPlaces: 1 },
    ], { expectedCodes, excludedCodes });
    expect(errors.join(' ')).toMatch(/excluded country present: IL/);
    expect(errors.join(' ')).toMatch(/duplicate: SA/);
    expect(errors.join(' ')).toMatch(/missing: JP/);
    expect(errors.join(' ')).toMatch(/coverage/);
  });
});
