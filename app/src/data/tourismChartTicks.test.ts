import { describe, expect, it } from 'vitest';
import { selectTickIndices } from './tourismChartTicks';

describe('selectTickIndices — deterministic tick selection', () => {
  it('returns every index when n <= maxTicks (short series)', () => {
    expect(selectTickIndices(4, 7)).toEqual([0, 1, 2, 3]);
    expect(selectTickIndices(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('reduces a long series (30 points) to at most 7 ticks, always including first and last', () => {
    const picked = selectTickIndices(30, 7);
    expect(picked.length).toBeLessThanOrEqual(7);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(29);
    // strictly increasing, no duplicates
    for (let i = 1; i < picked.length; i++) expect(picked[i]).toBeGreaterThan(picked[i - 1]!);
  });

  it('is deterministic across repeated calls', () => {
    expect(selectTickIndices(30, 7)).toEqual(selectTickIndices(30, 7));
  });

  it('handles n = 0 and n = 1', () => {
    expect(selectTickIndices(0, 7)).toEqual([]);
    expect(selectTickIndices(1, 7)).toEqual([0]);
  });

  it('respects a custom maxTicks (narrower-chart example)', () => {
    const picked = selectTickIndices(30, 4);
    expect(picked.length).toBeLessThanOrEqual(4);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(29);
  });
});
