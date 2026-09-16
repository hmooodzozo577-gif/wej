// Item #9 — the purpose-specific question audit, enforced.
//
// The bug this exists to prevent: Education asking "do you want the sea to
// be a central part of this experience?" and "would you prefer the study
// destination to be an island?". Those are not Education questions, and the
// previous audit missed them because it only checked WORDING, not which
// dimensions each purpose asks. Both halves are checked here.
import { describe, expect, it } from 'vitest';
import { PURPOSE_DIMENSION_IDS, QUESTION_BANKS, effectiveQuestionBank } from './questionBanks';
import { RECOMMENDATION_PROFILE_BY_CODE } from './worldRecommendation';
import type { PurposeId, Question } from './types';

const PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];
const LEISURE_PURPOSES = new Set<PurposeId>(['tourism', 'wellness', 'other']);

function allText(question: Question): string {
  return [
    question.text.ar,
    question.text.en,
    ...question.options.flatMap((option) => [option.label.ar, option.label.en, option.desc?.ar ?? '', option.desc?.en ?? '']),
  ].join(' ');
}

describe('every purpose asks only dimensions that earn their place', () => {
  it('never asks a non-leisure purpose about the sea or islands', () => {
    for (const purpose of PURPOSES) {
      if (LEISURE_PURPOSES.has(purpose) || purpose === 'immigration') continue;
      const keys = QUESTION_BANKS[purpose].map((question) => question.profileKey);
      expect(keys, purpose).not.toContain('coastal');
      expect(keys, purpose).not.toContain('island');
    }
  });

  it('asks about the coast only where living or relaxing near it is the point', () => {
    // Immigration keeps the coastal preference — "would you prefer to live
    // near the coast?" is a real question about somewhere to live — but not
    // the island one, which is a leisure characteristic.
    expect(PURPOSE_DIMENSION_IDS.immigration).toContain('coastal');
    expect(PURPOSE_DIMENSION_IDS.immigration).not.toContain('island');
  });

  it('never asks a non-leisure purpose about tourism popularity', () => {
    for (const purpose of PURPOSES) {
      if (LEISURE_PURPOSES.has(purpose)) continue;
      expect(QUESTION_BANKS[purpose].map((question) => question.profileKey), purpose).not.toContain('popularity');
    }
  });

  it('asks each purpose about its own defining indicator', () => {
    const required: Record<PurposeId, string> = {
      tourism: 'popularity',
      work: 'opportunity',
      education: 'education',
      medical: 'health',
      immigration: 'income',
      investment: 'investment',
      wellness: 'health',
      other: 'growth',
    };
    for (const purpose of PURPOSES) {
      expect(QUESTION_BANKS[purpose].map((question) => question.profileKey), purpose).toContain(required[purpose]);
    }
  });

  it('keeps every purpose at eight or more scored dimensions, so nothing was merely deleted', () => {
    for (const purpose of PURPOSES) {
      expect(QUESTION_BANKS[purpose].length, purpose).toBeGreaterThanOrEqual(8);
    }
  });

  it('caps a full journey at ten questions, land-travel included', () => {
    for (const purpose of PURPOSES) {
      expect(effectiveQuestionBank(purpose, true).length, purpose).toBeLessThanOrEqual(11);
      expect(effectiveQuestionBank(purpose, false).length, purpose).toBeLessThanOrEqual(10);
    }
  });
});

describe('no dimension is asked twice, and none is unscorable', () => {
  // Before this audit, tourism's "metric" question scored profileKey
  // 'popularity', which its own popularity question already scored.
  // scoreDestination() de-dupes by profileKey and selectNextQuestion() skips
  // an already-asked dimension, so that question could never be reached OR
  // scored — a dead entry that made the bank look one question longer than
  // it was.
  it('has a unique profileKey per question within each purpose', () => {
    for (const purpose of PURPOSES) {
      const keys = QUESTION_BANKS[purpose].map((question) => question.profileKey).filter(Boolean);
      expect(new Set(keys).size, purpose).toBe(keys.length);
    }
  });

  it('has unique question ids within each purpose', () => {
    for (const purpose of PURPOSES) {
      const ids = QUESTION_BANKS[purpose].map((question) => question.id);
      expect(new Set(ids).size, purpose).toBe(ids.length);
    }
  });

  it('scores every asked dimension against a profile key that really exists in the data', () => {
    const sample = RECOMMENDATION_PROFILE_BY_CODE.get('SA')!;
    for (const purpose of PURPOSES) {
      for (const question of QUESTION_BANKS[purpose]) {
        if (!question.profileKey) {
          // Only proximity has no profile key — it is scored from real
          // distance, not from a stored profile value.
          expect(question.kind, `${purpose}/${question.id}`).toBe('proximity');
          continue;
        }
        expect(sample[question.profileKey], `${purpose}/${question.id}`).toBeDefined();
      }
    }
  });
});

describe('tourism wording never leaks into a non-tourism purpose', () => {
  // Words that only make sense for a leisure trip. A purpose that is not a
  // leisure purpose must not use any of them anywhere in its questions,
  // option labels, or option descriptions.
  const TOURISM_ONLY = [
    /سياح/,
    /رحلت?ك/,
    /الرحلة/,
    /إجازة/,
    /عطلة/,
    /\btourism\b/i,
    /\btourist/i,
    /\btrip\b/i,
    /\bholiday/i,
    /\bvacation/i,
    /\bsightseeing/i,
  ];

  it('uses no leisure-trip vocabulary in work, education, immigration or investment questions', () => {
    const offenders: string[] = [];
    for (const purpose of ['work', 'education', 'immigration', 'investment'] as PurposeId[]) {
      for (const question of effectiveQuestionBank(purpose, true)) {
        const body = allText(question);
        for (const pattern of TOURISM_ONLY) {
          if (pattern.test(body)) offenders.push(`${purpose}/${question.id} matched ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('allows medical to describe a medical trip, but never a holiday one', () => {
    for (const question of effectiveQuestionBank('medical', true)) {
      const body = allText(question);
      for (const pattern of [/سياح/, /إجازة/, /عطلة/, /\btourism\b/i, /\bholiday/i, /\bvacation/i, /\bsightseeing/i]) {
        expect(pattern.test(body), `${question.id} matched ${pattern}`).toBe(false);
      }
    }
  });

  it('gives each purpose its own wording for a shared dimension, rather than one reused string', () => {
    // climate, cost, urbanity and safety are asked by every purpose. If any
    // two purposes shared a question stem verbatim, that is the exact
    // "reworded tourism default" shape this audit replaced.
    for (const dimension of ['climate', 'cost', 'urbanity', 'safety']) {
      const stems = PURPOSES.map((purpose) => {
        const question = QUESTION_BANKS[purpose].find((item) => item.id === `${purpose}-${dimension}`)!;
        return question.text.en;
      });
      expect(new Set(stems).size, dimension).toBe(stems.length);
    }
  });

  it('never describes a work, education or investment destination as a place to "spend your trip"', () => {
    for (const purpose of ['work', 'education', 'investment'] as PurposeId[]) {
      const urbanity = QUESTION_BANKS[purpose].find((question) => question.profileKey === 'urbanity')!;
      expect(urbanity.text.en, purpose).not.toMatch(/trip|holiday|visit/i);
      expect(urbanity.text.ar, purpose).not.toMatch(/رحلة|زيارة/);
    }
  });
});

describe('Phase 14 compatibility is preserved', () => {
  it('introduces no new question kind', () => {
    const allowed = new Set(['proximity', 'climate', 'target', 'importance', 'category', 'landBorder']);
    for (const purpose of PURPOSES) {
      for (const question of effectiveQuestionBank(purpose, true)) {
        expect(allowed.has(question.kind), `${purpose}/${question.id}`).toBe(true);
      }
    }
  });

  it('keeps the canonical budget values and their SAR ranges', () => {
    for (const purpose of PURPOSES) {
      const cost = QUESTION_BANKS[purpose].find((question) => question.profileKey === 'costLevel')!;
      expect(cost.scale, purpose).toBe(4);
      expect(cost.options.map((option) => option.value), purpose).toEqual([1, 2, 3, 4]);
      expect(cost.options.map((option) => option.label.en), purpose).toEqual([
        'Up to 5,000 SAR',
        '5,000 – 10,000 SAR',
        '10,000 – 20,000 SAR',
        'More than 20,000 SAR',
      ]);
    }
  });

  it('keeps the canonical importance and preference option values', () => {
    for (const purpose of PURPOSES) {
      for (const question of QUESTION_BANKS[purpose]) {
        if (question.kind === 'importance') {
          expect(question.options.map((option) => option.value), `${purpose}/${question.id}`).toEqual([25, 50, 75, 100]);
        }
        if (question.profileKey === 'coastal' || question.profileKey === 'island') {
          expect(question.options.map((option) => option.value), `${purpose}/${question.id}`).toEqual([100, 0, 50]);
        }
      }
    }
  });

  it('still opens every purpose on proximity when location exists, branching to climate or cost', () => {
    for (const purpose of PURPOSES) {
      const bank = effectiveQuestionBank(purpose, true);
      expect(bank[0]!.kind, purpose).toBe('proximity');
      expect(bank[0]!.nextByValue, purpose).toEqual({
        '100': `${purpose}-climate`,
        '0': `${purpose}-cost`,
      });
    }
  });
});
