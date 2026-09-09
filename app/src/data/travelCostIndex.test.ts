// Phase 13.5c — travelCostIndex.ts: classification boundaries (must stay
// in lockstep with scripts/lib/travelCostIndexIngest.mjs's own copy —
// see that file's test for the ingestion-side assertions), and
// getTravelCostIndex()'s missing/found/deterministic behavior. The
// "found" cases mock the generated JSON module itself (vi.resetModules +
// a fresh dynamic import per test — the same pattern already used for
// travelService.test.ts's env-dependent module) rather than depending on
// the real committed snapshot's current (empty) contents, so these
// tests remain meaningful once a real snapshot exists.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRatioToUS } from './travelCostIndex';

// classifyRatioToUS's thresholds are re-asserted here as bare numeric
// literals (not imported — travelCostIndex.ts intentionally doesn't
// export the threshold object, only the classify function) so a
// silent drift from the ingestion script's own copy would show up as a
// boundary test failure on ONE side without touching the other file.
describe('Phase 13.5c — classifyRatioToUS (frontend copy of the thresholds)', () => {
  it('boundary just below 0.6 -> low', () => {
    expect(classifyRatioToUS(0.59)).toBe('low');
  });
  it('boundary at 0.6 -> moderate', () => {
    expect(classifyRatioToUS(0.6)).toBe('moderate');
  });
  it('boundary just below 0.9 -> moderate', () => {
    expect(classifyRatioToUS(0.89)).toBe('moderate');
  });
  it('boundary at 0.9 -> high', () => {
    expect(classifyRatioToUS(0.9)).toBe('high');
  });
  it('boundary just below 1.15 -> high', () => {
    expect(classifyRatioToUS(1.14)).toBe('high');
  });
  it('boundary at and above 1.15 -> veryHigh', () => {
    expect(classifyRatioToUS(1.15)).toBe('veryHigh');
    expect(classifyRatioToUS(3)).toBe('veryHigh');
  });
  it('is deterministic', () => {
    expect(classifyRatioToUS(1.0)).toBe(classifyRatioToUS(1.0));
  });
});

describe('Phase 13.5c — getTravelCostIndex against the real committed snapshot', () => {
  it('returns undefined for any country while the snapshot has not been generated yet (entries: [])', async () => {
    const { getTravelCostIndex } = await import('./travelCostIndex');
    // JP is a real, well-covered destination — if this ever returns a
    // value, the committed snapshot has real data and this assertion
    // (deliberately) needs updating alongside it.
    expect(await getTravelCostIndex('JP')).toBeUndefined();
  });

  it('never throws for an unknown/malformed country code', async () => {
    const { getTravelCostIndex } = await import('./travelCostIndex');
    await expect(getTravelCostIndex('ZZ')).resolves.toBeUndefined();
    await expect(getTravelCostIndex('')).resolves.toBeUndefined();
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
        sourceIndicator: 'PA.NUS.PPPC.RF',
        entries: [
          { countryCode: 'JP', ratioToUS: 1.32, sourcePeriod: '2023' },
          { countryCode: 'TH', ratioToUS: 0.45, sourcePeriod: '2023' },
        ],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('JP')).toEqual({ countryCode: 'JP', ratioToUS: 1.32, sourcePeriod: '2023' });
    expect(await getTravelCostIndex('TH')).toEqual({ countryCode: 'TH', ratioToUS: 0.45, sourcePeriod: '2023' });
  });

  it('returns undefined for a country the mocked snapshot does not cover — never a guess', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: { snapshotUpdatedAt: '2026-01-01T00:00:00.000Z', sourceIndicator: 'PA.NUS.PPPC.RF', entries: [] },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('JP')).toBeUndefined();
  });

  it('CRITICAL: never returns an entry for Israel (IL), even if a corrupted/mocked snapshot somehow contained one', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicator: 'PA.NUS.PPPC.RF',
        // Simulates the ingestion-side and catalog-side guarantees both
        // having failed — getTravelCostIndex() itself has an
        // independent, third-layer exclusion check (isExcludedIso2)
        // that must still refuse to surface this.
        entries: [{ countryCode: 'IL', ratioToUS: 1.0, sourcePeriod: '2023' }],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    expect(await getTravelCostIndex('IL')).toBeUndefined();
  });

  it('is deterministic: repeated calls for the same country return the same result', async () => {
    vi.doMock('./generated/travelCostIndex.json', () => ({
      default: {
        snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
        sourceIndicator: 'PA.NUS.PPPC.RF',
        entries: [{ countryCode: 'JP', ratioToUS: 1.32, sourcePeriod: '2023' }],
      },
    }));
    const { getTravelCostIndex } = await import('./travelCostIndex');
    const first = await getTravelCostIndex('JP');
    const second = await getTravelCostIndex('JP');
    expect(first).toEqual(second);
  });
});
