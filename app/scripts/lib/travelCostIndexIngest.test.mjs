// Phase 13.5c — pure ingestion pipeline tests. Fixtures only, no network
// — see travelCostIndexIngest.mjs's module doc comment for why fetch is
// kept out of this file entirely (generate-travel-cost-index.mjs is the
// only network-touching file in this feature). Field name/scale
// (priceLevelIndex, 100-baseline) and indicator (PA.NUS.GDP.PLI) reflect
// the live-verified replacement for the originally-assumed, now-archived
// PA.NUS.PPPC.RF — see the module's own doc comment for that evidence.
import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_THRESHOLDS,
  MIN_COVERAGE_RATIO,
  buildSnapshot,
  classifyPriceLevelIndex,
  normalizeRows,
  parseWorldBankResponse,
  serializeSnapshot,
  validateEntries,
} from './travelCostIndexIngest.mjs';

const VALID_CODES = ['JP', 'SA', 'FR', 'CH', 'TH'];

function wbRow(overrides = {}) {
  return {
    indicator: { id: 'PA.NUS.GDP.PLI', value: 'Price level index (GDP)' },
    country: { id: 'JP', value: 'Japan' },
    countryiso3code: 'JPN',
    date: '2023',
    value: 102,
    unit: '',
    obs_status: '',
    decimal: 1,
    ...overrides,
  };
}

describe('Phase 13.5c — parseWorldBankResponse', () => {
  it('extracts the rows array from the real [metadata, rows] shape', () => {
    const rows = parseWorldBankResponse([{ page: 1 }, [wbRow()]]);
    expect(rows).toHaveLength(1);
  });

  it('returns an empty array when rows is null (query matched nothing)', () => {
    expect(parseWorldBankResponse([{ page: 1 }, null])).toEqual([]);
  });

  it('throws on a body that is not a [metadata, rows] array', () => {
    expect(() => parseWorldBankResponse({ not: 'an array' })).toThrow();
    expect(() => parseWorldBankResponse([{ page: 1 }])).toThrow();
  });

  it('throws when rows is present but not an array', () => {
    expect(() => parseWorldBankResponse([{ page: 1 }, 'nope'])).toThrow();
  });

  it('throws on the World Bank API\'s own error-object shape (e.g. an archived/unknown indicator) rather than misreading it as rows', () => {
    // Real, live-observed shape for PA.NUS.PPPC.RF after it was archived:
    // [{"message":[{"id":"175","key":"Invalid format","value":"The indicator was not found..."}]}]
    const errorBody = [{ message: [{ id: '175', key: 'Invalid format', value: 'The indicator was not found. It may have been deleted or archived.' }] }];
    expect(() => parseWorldBankResponse(errorBody)).toThrow();
  });
});

describe('Phase 13.5c — normalizeRows', () => {
  it('accepts a valid record for a country in the effective catalog', () => {
    const { accepted, rejected } = normalizeRows([wbRow({ country: { id: 'JP' }, value: 132 })], VALID_CODES);
    expect(accepted).toEqual([{ countryCode: 'JP', priceLevelIndex: 132, sourcePeriod: '2023' }]);
    expect(rejected).toEqual([]);
  });

  it('rejects an invalid numeric value (null, NaN-ish, zero, negative)', () => {
    for (const value of [null, 0, -1, 'not-a-number', undefined]) {
      const { accepted, rejected } = normalizeRows([wbRow({ country: { id: 'JP' }, value })], VALID_CODES);
      expect(accepted).toEqual([]);
      expect(rejected[0].reason).toBe('invalid_numeric_value');
    }
  });

  it('rejects a row whose country code is not in the effective catalog (excluded or unknown)', () => {
    const { accepted, rejected } = normalizeRows([wbRow({ country: { id: 'IL' } })], VALID_CODES);
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toBe('not_in_effective_catalog');
  });

  it('filters out World Bank aggregate/region rows (non-ISO2 pseudo-codes), without a hand-maintained blocklist', () => {
    const aggregateRows = [
      wbRow({ country: { id: '1A', value: 'Arab World' } }),
      wbRow({ country: { id: 'OE', value: 'OECD members' } }),
      wbRow({ country: { id: 'Z4', value: 'East Asia & Pacific' } }),
    ];
    const { accepted, rejected } = normalizeRows(aggregateRows, VALID_CODES);
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(3);
    for (const r of rejected) {
      expect(['missing_or_malformed_country_code', 'not_in_effective_catalog']).toContain(r.reason);
    }
  });

  it('handles a duplicate country code deterministically: keeps the first occurrence, rejects the rest', () => {
    const rows = [
      wbRow({ country: { id: 'JP' }, value: 110 }),
      wbRow({ country: { id: 'JP' }, value: 190 }),
    ];
    const { accepted, rejected } = normalizeRows(rows, VALID_CODES);
    expect(accepted).toEqual([{ countryCode: 'JP', priceLevelIndex: 110, sourcePeriod: '2023' }]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('duplicate_country_code');
  });

  it('rejects a row with a missing/empty source period', () => {
    const { accepted, rejected } = normalizeRows([wbRow({ country: { id: 'JP' }, date: '' })], VALID_CODES);
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toBe('missing_source_period');
  });

  it('is deterministic: sorts accepted entries by countryCode regardless of input order', () => {
    const rows = [
      wbRow({ country: { id: 'TH' }, value: 50 }),
      wbRow({ country: { id: 'CH' }, value: 130 }),
      wbRow({ country: { id: 'FR' }, value: 100 }),
    ];
    const { accepted } = normalizeRows(rows, VALID_CODES);
    expect(accepted.map((e) => e.countryCode)).toEqual(['CH', 'FR', 'TH']);
  });
});

describe('Phase 13.5c — classifyPriceLevelIndex (centralized, documented thresholds)', () => {
  it('boundary just below "low" threshold classifies as low', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.low - 1)).toBe('low');
  });

  it('boundary exactly at the "low" threshold classifies as moderate (inclusive upper bound)', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.low)).toBe('moderate');
  });

  it('boundary just below "moderate" threshold classifies as moderate', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.moderate - 1)).toBe('moderate');
  });

  it('boundary exactly at the "moderate" threshold classifies as high', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.moderate)).toBe('high');
  });

  it('boundary just below "high" threshold classifies as high', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.high - 1)).toBe('high');
  });

  it('boundary exactly at and above the "high" threshold classifies as veryHigh', () => {
    expect(classifyPriceLevelIndex(CLASSIFICATION_THRESHOLDS.high)).toBe('veryHigh');
    expect(classifyPriceLevelIndex(200)).toBe('veryHigh');
  });

  it('is deterministic: repeated calls with the same value return the same tier', () => {
    const results = new Set([classifyPriceLevelIndex(100), classifyPriceLevelIndex(100), classifyPriceLevelIndex(100)]);
    expect(results.size).toBe(1);
  });
});

describe('Phase 13.5c — validateEntries', () => {
  const entries = [
    { countryCode: 'JP', priceLevelIndex: 130, sourcePeriod: '2023' },
    { countryCode: 'SA', priceLevelIndex: 60, sourcePeriod: '2023' },
    { countryCode: 'FR', priceLevelIndex: 100, sourcePeriod: '2023' },
  ];

  it('passes for well-formed entries meeting the minimum coverage ratio', () => {
    const result = validateEntries(entries, entries.length / MIN_COVERAGE_RATIO, []);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when coverage is below MIN_COVERAGE_RATIO', () => {
    const result = validateEntries(entries, entries.length * 100, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('coverage'))).toBe(true);
  });

  it('fails with zero entries', () => {
    const result = validateEntries([], 10, []);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('zero entries after normalization');
  });

  it('fails on a duplicate country code slipping into the final list', () => {
    const dup = [...entries, { countryCode: 'JP', priceLevelIndex: 150, sourcePeriod: '2023' }];
    const result = validateEntries(dup, dup.length / MIN_COVERAGE_RATIO, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('fails on an invalid numeric priceLevelIndex (NaN/Infinity/<=0)', () => {
    for (const bad of [NaN, Infinity, 0, -1]) {
      const result = validateEntries([{ countryCode: 'JP', priceLevelIndex: bad, sourcePeriod: '2023' }], 1, []);
      expect(result.ok).toBe(false);
    }
  });

  it('CRITICAL: fails if an excluded country code (Israel, IL) is present in the final entries', () => {
    const withIsrael = [...entries, { countryCode: 'IL', priceLevelIndex: 110, sourcePeriod: '2023' }];
    const result = validateEntries(withIsrael, withIsrael.length / MIN_COVERAGE_RATIO, ['IL']);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('IL'))).toBe(true);
  });
});

describe('Phase 13.5c — buildSnapshot + serializeSnapshot', () => {
  it('builds a deterministic, traceable snapshot object', () => {
    const snapshot = buildSnapshot([{ countryCode: 'JP', priceLevelIndex: 130, sourcePeriod: '2023' }], 'PA.NUS.GDP.PLI', '2026-01-01T00:00:00.000Z');
    expect(snapshot).toEqual({
      snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
      sourceIndicator: 'PA.NUS.GDP.PLI',
      entries: [{ countryCode: 'JP', priceLevelIndex: 130, sourcePeriod: '2023' }],
    });
  });

  it('serializes to valid, deterministic JSON (same input -> byte-identical output)', () => {
    const snapshot = buildSnapshot([{ countryCode: 'JP', priceLevelIndex: 130, sourcePeriod: '2023' }], 'PA.NUS.GDP.PLI', '2026-01-01T00:00:00.000Z');
    const first = serializeSnapshot(snapshot);
    const second = serializeSnapshot(snapshot);
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(snapshot);
  });
});
