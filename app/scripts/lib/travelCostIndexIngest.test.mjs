// Phase 13.5c — pure ingestion pipeline tests. Fixtures only, no network
// — see travelCostIndexIngest.mjs's module doc comment for why fetch is
// kept out of this file entirely (generate-travel-cost-index.mjs is the
// only network-touching file in this feature).
import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_THRESHOLDS,
  MIN_COVERAGE_RATIO,
  buildSnapshot,
  classifyRatioToUS,
  normalizeRows,
  parseWorldBankResponse,
  serializeSnapshot,
  validateEntries,
} from './travelCostIndexIngest.mjs';

const VALID_CODES = ['JP', 'SA', 'FR', 'CH', 'TH'];

function wbRow(overrides = {}) {
  return {
    indicator: { id: 'PA.NUS.PPPC.RF', value: 'Price level ratio...' },
    country: { id: 'JP', value: 'Japan' },
    countryiso3code: 'JPN',
    date: '2023',
    value: 1.02,
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
});

describe('Phase 13.5c — normalizeRows', () => {
  it('accepts a valid record for a country in the effective catalog', () => {
    const { accepted, rejected } = normalizeRows([wbRow({ country: { id: 'JP' }, value: 1.32 })], VALID_CODES);
    expect(accepted).toEqual([{ countryCode: 'JP', ratioToUS: 1.32, sourcePeriod: '2023' }]);
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
      wbRow({ country: { id: 'JP' }, value: 1.1 }),
      wbRow({ country: { id: 'JP' }, value: 1.9 }),
    ];
    const { accepted, rejected } = normalizeRows(rows, VALID_CODES);
    expect(accepted).toEqual([{ countryCode: 'JP', ratioToUS: 1.1, sourcePeriod: '2023' }]);
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
      wbRow({ country: { id: 'TH' }, value: 0.5 }),
      wbRow({ country: { id: 'CH' }, value: 1.3 }),
      wbRow({ country: { id: 'FR' }, value: 1.0 }),
    ];
    const { accepted } = normalizeRows(rows, VALID_CODES);
    expect(accepted.map((e) => e.countryCode)).toEqual(['CH', 'FR', 'TH']);
  });
});

describe('Phase 13.5c — classifyRatioToUS (centralized, documented thresholds)', () => {
  it('boundary just below "low" threshold classifies as low', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.low - 0.01)).toBe('low');
  });

  it('boundary exactly at the "low" threshold classifies as moderate (inclusive upper bound)', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.low)).toBe('moderate');
  });

  it('boundary just below "moderate" threshold classifies as moderate', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.moderate - 0.01)).toBe('moderate');
  });

  it('boundary exactly at the "moderate" threshold classifies as high', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.moderate)).toBe('high');
  });

  it('boundary just below "high" threshold classifies as high', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.high - 0.01)).toBe('high');
  });

  it('boundary exactly at and above the "high" threshold classifies as veryHigh', () => {
    expect(classifyRatioToUS(CLASSIFICATION_THRESHOLDS.high)).toBe('veryHigh');
    expect(classifyRatioToUS(2.0)).toBe('veryHigh');
  });

  it('is deterministic: repeated calls with the same value return the same tier', () => {
    const results = new Set([classifyRatioToUS(1.0), classifyRatioToUS(1.0), classifyRatioToUS(1.0)]);
    expect(results.size).toBe(1);
  });
});

describe('Phase 13.5c — validateEntries', () => {
  const entries = [
    { countryCode: 'JP', ratioToUS: 1.3, sourcePeriod: '2023' },
    { countryCode: 'SA', ratioToUS: 0.6, sourcePeriod: '2023' },
    { countryCode: 'FR', ratioToUS: 1.0, sourcePeriod: '2023' },
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
    const dup = [...entries, { countryCode: 'JP', ratioToUS: 1.5, sourcePeriod: '2023' }];
    const result = validateEntries(dup, dup.length / MIN_COVERAGE_RATIO, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('fails on an invalid numeric ratioToUS (NaN/Infinity/<=0)', () => {
    for (const bad of [NaN, Infinity, 0, -1]) {
      const result = validateEntries([{ countryCode: 'JP', ratioToUS: bad, sourcePeriod: '2023' }], 1, []);
      expect(result.ok).toBe(false);
    }
  });

  it('CRITICAL: fails if an excluded country code (Israel, IL) is present in the final entries', () => {
    const withIsrael = [...entries, { countryCode: 'IL', ratioToUS: 1.1, sourcePeriod: '2023' }];
    const result = validateEntries(withIsrael, withIsrael.length / MIN_COVERAGE_RATIO, ['IL']);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('IL'))).toBe(true);
  });
});

describe('Phase 13.5c — buildSnapshot + serializeSnapshot', () => {
  it('builds a deterministic, traceable snapshot object', () => {
    const snapshot = buildSnapshot([{ countryCode: 'JP', ratioToUS: 1.3, sourcePeriod: '2023' }], 'PA.NUS.PPPC.RF', '2026-01-01T00:00:00.000Z');
    expect(snapshot).toEqual({
      snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
      sourceIndicator: 'PA.NUS.PPPC.RF',
      entries: [{ countryCode: 'JP', ratioToUS: 1.3, sourcePeriod: '2023' }],
    });
  });

  it('serializes to valid, deterministic JSON (same input -> byte-identical output)', () => {
    const snapshot = buildSnapshot([{ countryCode: 'JP', ratioToUS: 1.3, sourcePeriod: '2023' }], 'PA.NUS.PPPC.RF', '2026-01-01T00:00:00.000Z');
    const first = serializeSnapshot(snapshot);
    const second = serializeSnapshot(snapshot);
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(snapshot);
  });
});
