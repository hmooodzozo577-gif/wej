import { describe, expect, it } from 'vitest';
import { rankDestinations } from '../rankDestinations';

describe('rankDestinations tie breaking', () => {
  it('is stable without location and always preserves score order', () => {
    const first = rankDestinations('tourism', {});
    const second = rankDestinations('tourism', {});
    expect(first.map((item) => item.dest.id)).toEqual(second.map((item) => item.dest.id));
    expect(first.map((item) => item.score)).toEqual([...first.map((item) => item.score)].sort((a, b) => b - a));
  });
});
