// Phase 2 verification: the migrated data must match the original source in
// shape and count. This does not re-check every field value (the extraction
// script pulls them verbatim from wejhaty.html itself, so a value mismatch
// is not possible without the extraction failing outright) — it verifies
// the counts and structural invariants called out in the migration spec.
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations';
import { FLAG_SVG_RAW } from './flags';
import { PURPOSES } from './purposes';
import { QUESTION_BANKS } from './questionBanks';
import { I18N } from './i18n';
import type { PurposeId } from './types';

const PURPOSE_IDS: PurposeId[] = [
  'tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other',
];

describe('data integrity', () => {
  it('has exactly 30 destinations', () => {
    expect(DESTINATIONS).toHaveLength(30);
  });

  it('every destination has a unique id', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('has at least the 30 original embedded flags (Phase 10 adds more, see worldCatalog.test.ts)', () => {
    expect(Object.keys(FLAG_SVG_RAW).length).toBeGreaterThanOrEqual(30);
  });

  it('every destination has a matching embedded flag', () => {
    for (const d of DESTINATIONS) {
      const code = d.countryCode.toLowerCase();
      expect(FLAG_SVG_RAW[code], `missing flag for ${d.id} (${code})`).toBeTruthy();
      expect(FLAG_SVG_RAW[code]).toContain('<svg');
    }
  });

  // "No orphaned flags among the ORIGINAL 30" — Phase 10 intentionally adds
  // 165 more flags for countries that aren't (yet) full Destinations; that
  // full-catalog check lives in worldCatalog.test.ts, not here.

  it('has exactly 8 purposes', () => {
    expect(PURPOSES).toHaveLength(8);
    expect(PURPOSES.map((p) => p.id).sort()).toEqual([...PURPOSE_IDS].sort());
  });

  it('has a question bank for every purpose, none empty', () => {
    expect(Object.keys(QUESTION_BANKS).sort()).toEqual([...PURPOSE_IDS].sort());
    for (const id of PURPOSE_IDS) {
      expect(QUESTION_BANKS[id].length).toBeGreaterThan(0);
    }
  });

  it('shows approximate numeric ranges directly on generic budget options', () => {
    const genericBudgetPurposes: PurposeId[] = ['tourism', 'medical', 'immigration', 'wellness', 'other'];
    for (const purpose of genericBudgetPurposes) {
      const budget = QUESTION_BANKS[purpose].find((question) => question.id === 'budget');
      expect(budget, `missing budget question for ${purpose}`).toBeDefined();
      for (const option of budget!.options) {
        expect(option.label.ar).toMatch(/\d/);
        expect(option.label.en).toMatch(/\d/);
        expect(option.desc).toBeUndefined();
      }
    }
  });

  it('has both Arabic and English dictionaries with matching top-level shape', () => {
    expect(Object.keys(I18N)).toEqual(['ar', 'en']);
    expect(Object.keys(I18N.ar).sort()).toEqual(Object.keys(I18N.en).sort());
  });

  it('Arabic is RTL and English is LTR', () => {
    expect(I18N.ar.dir).toBe('rtl');
    expect(I18N.en.dir).toBe('ltr');
  });

  it('every destination has both Arabic and English name/description', () => {
    for (const d of DESTINATIONS) {
      expect(d.nameAr.length).toBeGreaterThan(0);
      expect(d.nameEn.length).toBeGreaterThan(0);
      expect(d.descAr.length).toBeGreaterThan(0);
      expect(d.descEn.length).toBeGreaterThan(0);
    }
  });
});
