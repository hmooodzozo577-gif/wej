// Phase 13.5d — tourismInsights.ts: getTourismInsights() missing/found/
// exclusion/deterministic behavior, plus the pure analytics helpers
// (getLatestObservation, computeYoyGrowth, formatCompactNumber). The
// "found" cases mock the generated JSON module (vi.resetModules + fresh
// dynamic import per test) so these don't depend on the real snapshot's
// exact current contents.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeYoyGrowth, formatCompactNumber, getLatestObservation } from './tourismInsights';

describe('Phase 13.5d — getLatestObservation', () => {
  it('returns the observation with the numerically latest period', () => {
    expect(getLatestObservation([{ period: '2018', value: 1 }, { period: '2020', value: 2 }, { period: '2019', value: 3 }])).toEqual({
      period: '2020',
      value: 2,
    });
  });
  it('returns undefined for an empty or undefined series', () => {
    expect(getLatestObservation([])).toBeUndefined();
    expect(getLatestObservation(undefined)).toBeUndefined();
  });
  it('is deterministic', () => {
    const series = [{ period: '2019', value: 1 }, { period: '2020', value: 2 }];
    expect(getLatestObservation(series)).toEqual(getLatestObservation(series));
  });
});

describe('Phase 13.5d — computeYoyGrowth', () => {
  it('computes a positive growth percentage from two consecutive years', () => {
    const result = computeYoyGrowth([{ period: '2018', value: 100 }, { period: '2019', value: 108.4 }]);
    expect(result?.currentPeriod).toBe('2019');
    expect(result?.previousPeriod).toBe('2018');
    expect(result?.percent).toBeCloseTo(8.4, 5);
  });

  it('computes a real negative growth (e.g. the 2019->2020 pandemic collapse) — never hidden or clamped', () => {
    const result = computeYoyGrowth([{ period: '2019', value: 165478000 }, { period: '2020', value: 45037000 }]);
    expect(result?.percent).toBeLessThan(0);
    expect(result?.percent).toBeCloseTo(((45037000 - 165478000) / 165478000) * 100, 5);
  });

  it('returns undefined when fewer than 2 observations exist', () => {
    expect(computeYoyGrowth([{ period: '2019', value: 1 }])).toBeUndefined();
    expect(computeYoyGrowth([])).toBeUndefined();
    expect(computeYoyGrowth(undefined)).toBeUndefined();
  });

  it('returns undefined (never a guess) when the two latest periods are not consecutive years (a missing year in between)', () => {
    const result = computeYoyGrowth([{ period: '2017', value: 100 }, { period: '2020', value: 50 }]);
    expect(result).toBeUndefined();
  });

  it('returns undefined (division-by-zero / undefined-percentage guard) when the previous value is zero or negative', () => {
    expect(computeYoyGrowth([{ period: '2018', value: 0 }, { period: '2019', value: 10 }])).toBeUndefined();
  });

  it('never fabricates a zero result — genuinely flat values (0% growth) are distinguishable from "cannot compute" (undefined)', () => {
    const flat = computeYoyGrowth([{ period: '2018', value: 100 }, { period: '2019', value: 100 }]);
    expect(flat).toEqual({ currentPeriod: '2019', previousPeriod: '2018', percent: 0 });
    expect(flat).not.toBeUndefined();
  });

  it('is deterministic and works regardless of input order (sorts internally)', () => {
    const unordered = [{ period: '2019', value: 108.4 }, { period: '2018', value: 100 }];
    expect(computeYoyGrowth(unordered)).toEqual(computeYoyGrowth([...unordered].reverse()));
  });
});

describe('Phase 13.5d — formatCompactNumber', () => {
  it('formats billions', () => {
    expect(formatCompactNumber(12_800_000_000)).toBe('12.8B');
  });
  it('formats millions', () => {
    expect(formatCompactNumber(14_200_000)).toBe('14.2M');
  });
  it('formats thousands', () => {
    expect(formatCompactNumber(4_500)).toBe('4.5K');
  });
  it('formats small values as plain rounded numbers', () => {
    expect(formatCompactNumber(42)).toBe('42');
    expect(formatCompactNumber(0)).toBe('0');
  });
  it('formats negative values with a leading sign, never losing the magnitude', () => {
    expect(formatCompactNumber(-45_000_000)).toBe('-45.0M');
  });
  it('is deterministic', () => {
    expect(formatCompactNumber(31_900_000)).toBe(formatCompactNumber(31_900_000));
  });
});

describe('Phase 13.5d — getTourismInsights against the real committed snapshot', () => {
  it('never throws for an unknown/malformed country code', async () => {
    const { getTourismInsights } = await import('./tourismInsights');
    await expect(getTourismInsights('ZZ')).resolves.toBeUndefined();
    await expect(getTourismInsights('')).resolves.toBeUndefined();
  });

  it('never returns an entry for Israel (IL) from the real snapshot', async () => {
    const { getTourismInsights } = await import('./tourismInsights');
    expect(await getTourismInsights('IL')).toBeUndefined();
  });
});

describe('Phase 13.5d — getTourismInsights with a mocked snapshot (found case)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('./generated/tourismInsights.json');
  });

  it('resolves the matching entry by countryCode when the snapshot has coverage for it', async () => {
    vi.doMock('./generated/tourismInsights.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicators: { arrivals: 'ST.INT.ARVL', receiptsUsd: 'ST.INT.RCPT.CD' },
        entries: [{ countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] }],
      },
    }));
    const { getTourismInsights } = await import('./tourismInsights');
    expect(await getTourismInsights('JP')).toEqual({ countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] });
  });

  it('returns undefined for a country the mocked snapshot does not cover', async () => {
    vi.doMock('./generated/tourismInsights.json', () => ({
      default: { snapshotUpdatedAt: '2026-01-01T00:00:00.000Z', sourceIndicators: {}, entries: [] },
    }));
    const { getTourismInsights } = await import('./tourismInsights');
    expect(await getTourismInsights('JP')).toBeUndefined();
  });

  it('CRITICAL: never returns an entry for Israel (IL), even if a corrupted/mocked snapshot somehow contained one', async () => {
    vi.doMock('./generated/tourismInsights.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicators: {},
        entries: [{ countryCode: 'IL', arrivals: [{ period: '2019', value: 3000000 }] }],
      },
    }));
    const { getTourismInsights } = await import('./tourismInsights');
    expect(await getTourismInsights('IL')).toBeUndefined();
  });

  it('is deterministic: repeated calls for the same country return the same result', async () => {
    vi.doMock('./generated/tourismInsights.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicators: {},
        entries: [{ countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] }],
      },
    }));
    const { getTourismInsights } = await import('./tourismInsights');
    const first = await getTourismInsights('JP');
    const second = await getTourismInsights('JP');
    expect(first).toEqual(second);
  });
});
