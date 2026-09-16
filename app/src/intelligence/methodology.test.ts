import { describe, expect, it } from 'vitest';
import { METHODOLOGIES } from './methodology';
import { SOURCES } from './sources';
import { SUITABLE_PURPOSES } from './types';

describe('purpose methodologies', () => {
  it('every suitable purpose has its own methodology', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      expect(METHODOLOGIES[purpose]).toBeTruthy();
      expect(METHODOLOGIES[purpose].purpose).toBe(purpose);
    }
  });

  it('each purpose methodology has a valid, versioned model id matching its purpose', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      expect(METHODOLOGIES[purpose].modelVersion).toBe(`${purpose}-v1`);
    }
  });

  it('each purpose factor weight set sums to exactly 100', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const total = METHODOLOGIES[purpose].factors.reduce((sum, factor) => sum + factor.weight, 0);
      expect(total).toBe(100);
    }
  });

  it('every factor references a real, catalogued source', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      for (const factor of METHODOLOGIES[purpose].factors) {
        expect(SOURCES[factor.sourceId]).toBeTruthy();
      }
    }
  });

  it('no purpose has duplicate factor keys', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const keys = METHODOLOGIES[purpose].factors.map((factor) => factor.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('each purpose has purpose-specific components — no two purposes share an identical factor set', () => {
    const signatures = SUITABLE_PURPOSES.map((purpose) =>
      METHODOLOGIES[purpose].factors.map((factor) => `${factor.key}:${factor.weight}`).sort().join('|'),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('tourism does not simply reuse education or work weights (explicit task requirement)', () => {
    const tourism = METHODOLOGIES.tourism.factors;
    const education = METHODOLOGIES.education.factors;
    const work = METHODOLOGIES.work.factors;
    expect(tourism).not.toEqual(education);
    expect(tourism).not.toEqual(work);
    expect(education).not.toEqual(work);
  });

  it('no methodology includes a visa/entry-requirement factor as a scored input', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const factorKeys = METHODOLOGIES[purpose].factors.map((factor) => factor.key.toLowerCase());
      for (const key of factorKeys) {
        expect(key).not.toMatch(/visa|entry|passport/);
      }
    }
  });

  it('no methodology includes a climate factor (documented as a preference, not an objective quality)', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      const factorKeys = METHODOLOGIES[purpose].factors.map((factor) => factor.key.toLowerCase());
      expect(factorKeys.some((key) => key.includes('climate'))).toBe(false);
    }
  });

  it('every excluded candidate has a real, non-empty reason', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      for (const exclusion of METHODOLOGIES[purpose].excluded) {
        expect(exclusion.reason.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('minCoverage is a sane fraction between 0 and 1', () => {
    for (const purpose of SUITABLE_PURPOSES) {
      expect(METHODOLOGIES[purpose].minCoverage).toBeGreaterThan(0);
      expect(METHODOLOGIES[purpose].minCoverage).toBeLessThanOrEqual(1);
    }
  });
});
