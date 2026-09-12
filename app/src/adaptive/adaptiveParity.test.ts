import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { rankDestinations } from '../engine';

describe('deterministic engine stability', () => {
  it('returns the same ranking for the same answers regardless of object insertion order', () => {
    const bank = QUESTION_BANKS.tourism;
    const region = bank[0]!;
    const climate = bank.find((question) => question.profileKey === 'climate')!;
    const a = { [region.id]: 'Asia', [climate.id]: 'cold' };
    const b = { [climate.id]: 'cold', [region.id]: 'Asia' };
    expect(rankDestinations('tourism', a).map((item) => item.dest.id)).toEqual(rankDestinations('tourism', b).map((item) => item.dest.id));
  });

  it('returns all 194 effective countries and no excluded country', () => {
    const results = rankDestinations('tourism', {});
    expect(results).toHaveLength(194);
    expect(results.some((item) => item.dest.countryCode === 'IL')).toBe(false);
    expect(results.some((item) => item.dest.countryCode === 'MC')).toBe(true);
  });
});
