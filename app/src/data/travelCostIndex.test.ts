// Phase 13.5c — travelCostIndex.ts: classification boundaries (must stay
// in lockstep with scripts/lib/travelCostIndexIngest.mjs's own copy —
// see that file's test for the ingestion-side assertions), and
// getTravelCostIndex()'s missing/found/deterministic behavior. The
// "found" cases mock the generated JSON module itself (vi.resetModules +
// a fresh dynamic import per test — the same pattern already used for
// travelService.test.ts's env-dependent module) so these tests don't
// depend on the real committed snapshot's exact current contents.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyPriceLevelIndex, computeBaselineDifference, formatPriceLevelIndex } from './travelCostIndex';

describe('Phase 13.5c — computeBaselineDifference (traveler-facing % above/below baseline)', () => {
  it('47 -> about 53% below the baseline', () => {
    expect(computeBaselineDifference(47)).toEqual({ direction: 'below', percent: 53 });
  });
  it('120 -> about 20% above the baseline', () => {
    expect(computeBaselineDifference(120)).toEqual({ direction: 'above', percent: 20 });
  });
  it('exactly 100 -> at the baseline (0%)', () => {
    expect(computeBaselineDifference(100)).toEqual({ direction: 'at', percent: 0 });
  });
  it('a value that rounds to a 0-point difference is still "at", not "0% below"', () => {
    expect(computeBaselineDifference(100.4)).toEqual({ direction: 'at', percent: 0 });
    expect(computeBaselineDifference(99.6)).toEqual({ direction: 'at', percent: 0 });
  });
  it('rounds the magnitude for display, using the full-precision difference', () => {
    expect(computeBaselineDifference(64.8679639072763)).toEqual({ direction: 'below', percent: 35 });
  });
  it('uses the real value directly, independent of formatPriceLevelIndex()\'s own display rounding', () => {
    // 100.5's real difference from baseline is +0.5, rounding to 1% above.
    expect(computeBaselineDifference(100.5)).toEqual({ direction: 'above', percent: 1 });
  });
  it('is deterministic', () => {
    expect(computeBaselineDifference(72)).toEqual(computeBaselineDifference(72));
  });
});

// classifyPriceLevelIndex's thresholds are re-asserted here as bare
// numeric literals (not imported — travelCostIndex.ts intentionally
// doesn't export the threshold object, only the classify function) so a
// silent drift from the ingestion script's own copy would show up as a
// boundary test failure on ONE side without touching the other file.
// 100 = same general price level as the US (PA.NUS.GDP.PLI's baseline).
describe('Phase 13.5c — classifyPriceLevelIndex (frontend copy of the thresholds)', () => {
  it('boundary just below 60 -> low', () => {
    expect(classifyPriceLevelIndex(59)).toBe('low');
  });
  it('boundary at 60 -> moderate', () => {
    expect(classifyPriceLevelIndex(60)).toBe('moderate');
  });
  it('boundary just below 90 -> moderate', () => {
    expect(classifyPriceLevelIndex(89)).toBe('moderate');
  });
  it('boundary at 90 -> high', () => {
    expect(classifyPriceLevelIndex(90)).toBe('high');
  });
  it('boundary just below 115 -> high', () => {
    expect(classifyPriceLevelIndex(114)).toBe('high');
  });
  it('boundary at and above 115 -> veryHigh', () => {
    expect(classifyPriceLevelIndex(115)).toBe('veryHigh');
    expect(classifyPriceLevelIndex(300)).toBe('veryHigh');
  });
  it('is deterministic', () => {
    expect(classifyPriceLevelIndex(100)).toBe(classifyPriceLevelIndex(100));
  });
});

describe('Phase 13.5c — formatPriceLevelIndex (display-only rounding)', () => {
  it('rounds to the nearest whole number', () => {
    expect(formatPriceLevelIndex(64.8679639072763)).toBe('65');
    expect(formatPriceLevelIndex(68.2338709881342)).toBe('68');
    expect(formatPriceLevelIndex(100)).toBe('100');
  });
  it('never fabricates precision the source does not have (a whole-number string, not a decimal)', () => {
    expect(formatPriceLevelIndex(45.5)).not.toContain('.');
  });
  it('is deterministic', () => {
    expect(formatPriceLevelIndex(72.4)).toBe(formatPriceLevelIndex(72.4));
  });
  it('does not alter classification, which always uses the unrounded source value', () => {
    // 59.6 rounds for DISPLAY to 60, but its real (unrounded) classification is still 'low'.
    expect(formatPriceLevelIndex(59.6)).toBe('60');
    expect(classifyPriceLevelIndex(59.6)).toBe('low');
  });
});

describe('Phase 13.5c — getTravelCostIndex against the real committed snapshot', () => {
  it('never throws for an unknown/malformed country code', async () => {
    const { getTravelCostIndex } = await import('./travelCostIndex');
    await expect(getTravelCostIndex('ZZ')).resolves.toBeUndefined();
    await expect(getTravelCostIndex('')).resolves.toBeUndefined();
  });

  it('never returns an entry for Israel (IL) from the real snapshot', async () => {
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('IL')).toBeUndefined();
  });
});

describe('Phase 13.5c — getTravelCostIndex with a mocked snapshot (found case)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('./generated/travelCostIndex.json');
  });

  it('resolves the matching entry by countryCode when the snapshot has coverage for it', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicator: 'PA.NUS.GDP.PLI',
        entries: [
          { countryCode: 'JP', priceLevelIndex: 132, sourcePeriod: '2023' },
          { countryCode: 'TH', priceLevelIndex: 45, sourcePeriod: '2023' },
        ],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('JP')).toEqual({ countryCode: 'JP', priceLevelIndex: 132, sourcePeriod: '2023' });
    expect(await getTravelCostIndex('TH')).toEqual({ countryCode: 'TH', priceLevelIndex: 45, sourcePeriod: '2023' });
  });

  it('returns undefined for a country the mocked snapshot does not cover — never a guess', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: { snapshotUpdatedAt: '2026-01-01T00:00:00.000Z', sourceIndicator: 'PA.NUS.GDP.PLI', entries: [] },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('JP')).toBeUndefined();
  });

  it('CRITICAL: never returns an entry for Israel (IL), even if a corrupted/mocked snapshot somehow contained one', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicator: 'PA.NUS.GDP.PLI',
        // Simulates the ingestion-side and catalog-side guarantees both
        // having failed — getTravelCostIndex() itself has an
        // independent, third-layer exclusion check (isExcludedIso2)
        // that must still refuse to surface this.
        entries: [{ countryCode: 'IL', priceLevelIndex: 100, sourcePeriod: '2023' }],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('IL')).toBeUndefined();
  });

  it('is deterministic: repeated calls for the same country return the same result', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicator: 'PA.NUS.GDP.PLI',
        entries: [{ countryCode: 'JP', priceLevelIndex: 132, sourcePeriod: '2023' }],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    const first = await getTravelCostIndex('JP');
    const second = await getTravelCostIndex('JP');
    expect(first).toEqual(second);
  });
});
