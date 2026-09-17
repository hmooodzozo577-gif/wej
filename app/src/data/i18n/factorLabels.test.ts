// Acceptance fix — "Why this score?" factor names must be localized (see
// CountrySuitabilityStrings.factorLabels' comment in data/types.ts and
// CountrySuitability.tsx's factorLabel() helper). This proves the EN/AR
// dictionaries actually cover every purpose:factor pair the methodology
// can ever emit, and never confuse an Arabic label with a leftover
// English one (or vice versa).
import { describe, expect, it } from 'vitest';
import { AR } from './ar';
import { EN } from './en';
import { METHODOLOGIES } from '../../intelligence/methodology';

const EXPECTED_KEYS = Object.values(METHODOLOGIES).flatMap((methodology) =>
  methodology.factors.map((factor) => `${methodology.purpose}:${factor.key}`),
);

const ARABIC_CHAR = /[؀-ۿ]/;

describe('countrySuitability.factorLabels — every real purpose:factor pair is covered', () => {
  it('the English dictionary has an entry for every purpose:factor pair intelligence/methodology.ts defines', () => {
    for (const key of EXPECTED_KEYS) {
      expect(EN.countrySuitability.factorLabels[key], `missing EN factorLabels['${key}']`).toBeDefined();
    }
  });

  it('the Arabic dictionary has an entry for every purpose:factor pair intelligence/methodology.ts defines', () => {
    for (const key of EXPECTED_KEYS) {
      expect(AR.countrySuitability.factorLabels[key], `missing AR factorLabels['${key}']`).toBeDefined();
    }
  });

  it('the two dictionaries carry exactly the same key set (no orphaned/stale entries in either)', () => {
    expect(Object.keys(EN.countrySuitability.factorLabels).sort()).toEqual(Object.keys(AR.countrySuitability.factorLabels).sort());
    expect(Object.keys(EN.countrySuitability.factorLabels).sort()).toEqual([...new Set(EXPECTED_KEYS)].sort());
  });

  it('every Arabic factor label is actually Arabic text, never a copy-pasted English string', () => {
    for (const [key, value] of Object.entries(AR.countrySuitability.factorLabels)) {
      expect(ARABIC_CHAR.test(value), `AR factorLabels['${key}'] = '${value}' contains no Arabic characters`).toBe(true);
    }
  });

  it('every English factor label carries no Arabic characters (the reverse leak check)', () => {
    for (const [key, value] of Object.entries(EN.countrySuitability.factorLabels)) {
      expect(ARABIC_CHAR.test(value), `EN factorLabels['${key}'] = '${value}' unexpectedly contains Arabic characters`).toBe(false);
    }
  });
});
