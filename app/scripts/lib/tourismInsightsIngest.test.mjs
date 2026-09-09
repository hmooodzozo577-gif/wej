// Phase 13.5d — pure ingestion pipeline tests. Fixtures only, no network.
import { describe, expect, it } from 'vitest';
import {
  MIN_COVERAGE_RATIO,
  buildEntries,
  buildSnapshot,
  normalizeSeriesRows,
  parseCsv,
  parseOwidCsv,
  serializeSnapshot,
  validateEntries,
} from './tourismInsightsIngest.mjs';

const VALID_CODES = ['JP', 'SA', 'FR', 'CH', 'TH', 'US'];
const ISO3_TO_ISO2 = new Map([
  ['JPN', 'JP'],
  ['SAU', 'SA'],
  ['FRA', 'FR'],
]);

function wbRow(overrides = {}) {
  return {
    country: { id: 'JP', value: 'Japan' },
    date: '2019',
    value: 31900000,
    ...overrides,
  };
}

describe('Phase 13.5d — parseCsv', () => {
  it('parses a simple CSV with a header row', () => {
    const table = parseCsv('Entity,Code,Year,Value\nJapan,JPN,2019,31900000\n');
    expect(table).toEqual([
      ['Entity', 'Code', 'Year', 'Value'],
      ['Japan', 'JPN', '2019', '31900000'],
    ]);
  });

  it('handles a double-quoted field containing a comma (e.g. "Korea, Rep.")', () => {
    const table = parseCsv('Entity,Code,Year,Value\n"Korea, Rep.",KOR,2019,17500000\n');
    expect(table[1]).toEqual(['Korea, Rep.', 'KOR', '2019', '17500000']);
  });

  it('handles an escaped double-quote inside a quoted field', () => {
    const table = parseCsv('Entity,Code,Year,Value\n"Say ""hi""",XXX,2019,1\n');
    expect(table[1][0]).toBe('Say "hi"');
  });

  it('skips blank trailing lines', () => {
    const table = parseCsv('Entity,Code,Year,Value\nJapan,JPN,2019,1\n\n');
    expect(table).toHaveLength(2);
  });
});

describe('Phase 13.5d — parseOwidCsv', () => {
  it('extracts rows for countries present in the iso3->iso2 map', () => {
    const csv = 'Entity,Code,Year,Value,World region\nJapan,JPN,2019,31900000,Asia\nFrance,FRA,2020,4000000,Europe\n';
    const rows = parseOwidCsv(csv, ISO3_TO_ISO2);
    expect(rows).toEqual([
      { country: { id: 'JP' }, date: '2019', value: 31900000 },
      { country: { id: 'FR' }, date: '2020', value: 4000000 },
    ]);
  });

  it('skips OWID aggregate/region rows whose Code has no iso3->iso2 mapping, without a hand-maintained blocklist', () => {
    const csv = 'Entity,Code,Year,Value,World region\nWorld,OWID_WRL,2019,1000000000,\nAsia,OWID_ASI,2019,500000000,\n';
    expect(parseOwidCsv(csv, ISO3_TO_ISO2)).toEqual([]);
  });

  it('skips a row with no Code at all', () => {
    const csv = 'Entity,Code,Year,Value\nSomewhere,,2019,1\n';
    expect(parseOwidCsv(csv, ISO3_TO_ISO2)).toEqual([]);
  });

  it('represents an empty value cell as null ("no observation"), not 0 or NaN', () => {
    const csv = 'Entity,Code,Year,Value\nJapan,JPN,2019,\n';
    expect(parseOwidCsv(csv, ISO3_TO_ISO2)).toEqual([{ country: { id: 'JP' }, date: '2019', value: null }]);
  });

  it('ignores extra trailing columns (e.g. the "World region" annotation column)', () => {
    const csv = 'Entity,Code,Year,Value,World region\nJapan,JPN,2019,31900000,Asia\n';
    expect(parseOwidCsv(csv, ISO3_TO_ISO2)).toEqual([{ country: { id: 'JP' }, date: '2019', value: 31900000 }]);
  });

  it('returns an empty array for an empty CSV (header only, or nothing)', () => {
    expect(parseOwidCsv('Entity,Code,Year,Value\n', ISO3_TO_ISO2)).toEqual([]);
    expect(parseOwidCsv('', ISO3_TO_ISO2)).toEqual([]);
  });
});

describe('Phase 13.5d — normalizeSeriesRows', () => {
  it('accepts a valid observation for a country in the effective catalog', () => {
    const { byCountry, rejected } = normalizeSeriesRows([wbRow()], VALID_CODES);
    expect(byCountry.get('JP')).toEqual([{ period: '2019', value: 31900000 }]);
    expect(rejected).toEqual([]);
  });

  it('accepts multiple periods for the same country (a real historical series, not just the latest)', () => {
    const rows = [wbRow({ date: '2019', value: 100 }), wbRow({ date: '2020', value: 50 }), wbRow({ date: '2018', value: 90 })];
    const { byCountry } = normalizeSeriesRows(rows, VALID_CODES);
    expect(byCountry.get('JP')).toHaveLength(3);
  });

  it('rejects a row whose value is null ("no observation for this period") without treating it as an error spike', () => {
    const { byCountry, rejected } = normalizeSeriesRows([wbRow({ value: null })], VALID_CODES);
    expect(byCountry.size).toBe(0);
    expect(rejected[0].reason).toBe('no_observation');
  });

  it('rejects invalid numeric values (NaN-ish, negative)', () => {
    for (const value of ['not-a-number', -5]) {
      const { rejected } = normalizeSeriesRows([wbRow({ value })], VALID_CODES);
      expect(rejected[0].reason).toBe('invalid_numeric_value');
    }
  });

  it('accepts zero as a real, legitimate observation (not treated as missing)', () => {
    const { byCountry } = normalizeSeriesRows([wbRow({ value: 0 })], VALID_CODES);
    expect(byCountry.get('JP')).toEqual([{ period: '2019', value: 0 }]);
  });

  it('rejects a country code not in the effective catalog (excluded or unknown)', () => {
    const { byCountry, rejected } = normalizeSeriesRows([wbRow({ country: { id: 'IL' } })], VALID_CODES);
    expect(byCountry.size).toBe(0);
    expect(rejected[0].reason).toBe('not_in_effective_catalog');
  });

  it('filters World Bank aggregate/region rows without a hand-maintained blocklist', () => {
    const aggregateRows = [
      wbRow({ country: { id: '1A' } }),
      wbRow({ country: { id: 'Z4' } }),
      wbRow({ country: { id: 'ZH' } }),
    ];
    const { byCountry, rejected } = normalizeSeriesRows(aggregateRows, VALID_CODES);
    expect(byCountry.size).toBe(0);
    expect(rejected).toHaveLength(3);
    for (const r of rejected) expect(['missing_or_malformed_country_code', 'not_in_effective_catalog']).toContain(r.reason);
  });

  it('rejects a malformed period (missing/non-4-digit)', () => {
    for (const date of ['', 'abcd', '20', undefined]) {
      const { rejected } = normalizeSeriesRows([wbRow({ date })], VALID_CODES);
      expect(rejected[0].reason).toBe('missing_or_malformed_period');
    }
  });

  it('rejects a duplicate (country, period) pair deterministically: keeps the first, rejects the rest', () => {
    const rows = [wbRow({ date: '2019', value: 100 }), wbRow({ date: '2019', value: 999 })];
    const { byCountry, rejected } = normalizeSeriesRows(rows, VALID_CODES);
    expect(byCountry.get('JP')).toEqual([{ period: '2019', value: 100 }]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('duplicate_country_period');
  });
});

describe('Phase 13.5d — buildEntries (merging the two indicator series)', () => {
  it('merges arrivals and receipts for a country present in both, sorted by period ascending', () => {
    const arrivals = new Map([['JP', [{ period: '2020', value: 4 }, { period: '2019', value: 31 }]]]);
    const receipts = new Map([['JP', [{ period: '2019', value: 46000000000 }]]]);
    const entries = buildEntries(arrivals, receipts);
    expect(entries).toEqual([
      {
        countryCode: 'JP',
        arrivals: [{ period: '2019', value: 31 }, { period: '2020', value: 4 }],
        receiptsUsd: [{ period: '2019', value: 46000000000 }],
      },
    ]);
  });

  it('includes a country with only ONE of the two series, omitting the other key entirely (never an empty array)', () => {
    const arrivals = new Map([['SA', [{ period: '2019', value: 17 }]]]);
    const receipts = new Map();
    const entries = buildEntries(arrivals, receipts);
    expect(entries).toEqual([{ countryCode: 'SA', arrivals: [{ period: '2019', value: 17 }] }]);
    expect(entries[0]).not.toHaveProperty('receiptsUsd');
  });

  it('is deterministic: sorts final entries by countryCode', () => {
    const arrivals = new Map([
      ['TH', [{ period: '2019', value: 1 }]],
      ['CH', [{ period: '2019', value: 1 }]],
    ]);
    const entries = buildEntries(arrivals, new Map());
    expect(entries.map((e) => e.countryCode)).toEqual(['CH', 'TH']);
  });
});

describe('Phase 13.5d — validateEntries', () => {
  const goodEntries = [
    { countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] },
    { countryCode: 'FR', receiptsUsd: [{ period: '2019', value: 63000000000 }] },
  ];

  it('passes for well-formed entries meeting minimum coverage', () => {
    const result = validateEntries(goodEntries, goodEntries.length / MIN_COVERAGE_RATIO, []);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when coverage is below MIN_COVERAGE_RATIO', () => {
    const result = validateEntries(goodEntries, goodEntries.length * 100, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('coverage'))).toBe(true);
  });

  it('fails with zero entries', () => {
    const result = validateEntries([], 10, []);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('zero entries after normalization');
  });

  it('fails on an entry with neither series (should never have been built)', () => {
    const bad = [{ countryCode: 'JP' }];
    const result = validateEntries(bad, 1, []);
    expect(result.ok).toBe(false);
  });

  it('fails on a duplicate country code in the final list', () => {
    const dup = [...goodEntries, { countryCode: 'JP', arrivals: [{ period: '2020', value: 1 }] }];
    const result = validateEntries(dup, dup.length / MIN_COVERAGE_RATIO, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('fails on an invalid numeric observation value (NaN/Infinity/negative)', () => {
    for (const bad of [NaN, Infinity, -1]) {
      const result = validateEntries([{ countryCode: 'JP', arrivals: [{ period: '2019', value: bad }] }], 1, []);
      expect(result.ok).toBe(false);
    }
  });

  it('CRITICAL: fails if an excluded country code (Israel, IL) is present in the final entries', () => {
    const withIsrael = [...goodEntries, { countryCode: 'IL', arrivals: [{ period: '2019', value: 3000000 }] }];
    const result = validateEntries(withIsrael, withIsrael.length / MIN_COVERAGE_RATIO, ['IL']);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('IL'))).toBe(true);
  });
});

describe('Phase 13.5d — buildSnapshot + serializeSnapshot', () => {
  it('builds a deterministic, traceable snapshot object', () => {
    const snapshot = buildSnapshot(
      [{ countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] }],
      { arrivals: 'ST.INT.ARVL', receiptsUsd: 'ST.INT.RCPT.CD' },
      '2026-01-01T00:00:00.000Z',
    );
    expect(snapshot).toEqual({
      snapshotUpdatedAt: '2026-01-01T00:00:00.000Z',
      sourceIndicators: { arrivals: 'ST.INT.ARVL', receiptsUsd: 'ST.INT.RCPT.CD' },
      entries: [{ countryCode: 'JP', arrivals: [{ period: '2019', value: 31900000 }] }],
    });
  });

  it('serializes to valid, deterministic JSON (same input -> byte-identical output)', () => {
    const snapshot = buildSnapshot([], { arrivals: 'ST.INT.ARVL', receiptsUsd: 'ST.INT.RCPT.CD' }, '2026-01-01T00:00:00.000Z');
    const first = serializeSnapshot(snapshot);
    const second = serializeSnapshot(snapshot);
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(snapshot);
  });
});
