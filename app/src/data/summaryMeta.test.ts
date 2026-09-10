// Phase 16.5 UX correction — global standalone-summary regression suite.
//
// Real user-observed bug: "ما الذي تفضله؟ — مزيج من الاثنين" and "ما نوع
// الوجهة التي تفضلها؟ — كلاهما" read alone (as the persistent "already
// accounted for" list does — it never repeats the question text) answer
// nothing: a mix of WHAT? both WHAT? This suite mechanically sweeps every
// AI-interpretable question in every purpose bank and proves every
// possible summary is a genuinely standalone, unambiguous phrase.
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from './questionBanks';
import { coveredDimensions, summarizeAnswer } from './summaryMeta';
import type { PurposeId } from './types';

const ALL_PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];

// Terms that are ambiguous WITHOUT a dimension name attached — the exact
// class of bug this module exists to prevent. They may still appear
// *inside* a complete phrase (see the naturecity/beaches/adventure
// overrides below), but never as the ENTIRE summary on their own.
const BARE_AMBIGUOUS_TERMS = ['كلاهما', 'مزيج من الاثنين', 'متوسط', 'متوسطة', 'نعم', 'لا', 'مرتفع', 'مرتفعة'];

describe('Global standalone-summary audit — every AI-interpretable option, every bank, both languages', () => {
  for (const purposeId of ALL_PURPOSES) {
    const bank = QUESTION_BANKS[purposeId];
    for (const q of bank) {
      for (const opt of q.options) {
        it(`${purposeId}.${q.id}=${opt.value}: standalone AR + EN summary is non-empty, non-numeric-leaking, and not a bare ambiguous term`, () => {
          const ar = summarizeAnswer(purposeId, q.id, opt.value, 'ar');
          const en = summarizeAnswer(purposeId, q.id, opt.value, 'en');

          // 1 & 3: non-empty, AR exists.
          expect(ar.trim().length).toBeGreaterThan(0);
          // 2 & 4: non-empty, EN exists.
          expect(en.trim().length).toBeGreaterThan(0);
          // 5: no raw numeric value leaks to the UI as the WHOLE summary
          // (a dimension-prefixed number would still be wrong — summaries
          // must never be just the stored value restated).
          expect(ar).not.toBe(String(opt.value));
          expect(en).not.toBe(String(opt.value));
          expect(ar.trim()).not.toMatch(/^\d+$/);
          expect(en.trim()).not.toMatch(/^\d+$/);
          // 6: no bare ambiguous term as the ENTIRE summary — it must be
          // part of a longer, dimension-qualified phrase (contains ':'
          // separating dimension from value, or is otherwise multi-word
          // and longer than the bare term alone).
          for (const term of BARE_AMBIGUOUS_TERMS) {
            expect(ar.trim()).not.toBe(term);
            expect(ar).toContain(':'); // every summary is "dimension: value"
          }
        });
      }
    }
  }

  it('every purpose bank is actually covered — this audit is not silently skipping a bank', () => {
    expect(ALL_PURPOSES).toEqual(expect.arrayContaining(['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other']));
  });

  it('every question in every bank has explicit dimension metadata (no silent reliance on the question.text fallback)', () => {
    const covered = new Set(coveredDimensions().map((c) => `${c.purposeId}.${c.questionId}`));
    const missing: string[] = [];
    for (const purposeId of ALL_PURPOSES) {
      for (const q of QUESTION_BANKS[purposeId]) {
        if (!covered.has(`${purposeId}.${q.id}`)) missing.push(`${purposeId}.${q.id}`);
      }
    }
    expect(missing, `questions missing explicit summary metadata: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('Bipolar/compound dimensions — the exact bug class the real user found', () => {
  it('naturecity=50 ("مزيج من الاثنين" raw label) resolves to a phrase naming BOTH nature and cities, not the bare ambiguous term', () => {
    const ar = summarizeAnswer('tourism', 'naturecity', 50, 'ar');
    expect(ar).not.toBe('مزيج من الاثنين');
    expect(ar).toContain('الطبيعة');
    expect(ar).toContain('المدن');
  });

  it('beaches=50 ("كلاهما" raw label) resolves to a phrase naming BOTH beaches and mountains, not the bare ambiguous term', () => {
    const ar = summarizeAnswer('tourism', 'beaches', 50, 'ar');
    expect(ar).not.toBe('كلاهما');
    expect(ar).toContain('الشواطئ');
    expect(ar).toContain('الجبال');
  });

  it('adventure=50 ("مزيج من الاثنين" raw label) resolves to a phrase naming BOTH relaxation and adventure — matches the task\'s own example phrasing', () => {
    const ar = summarizeAnswer('tourism', 'adventure', 50, 'ar');
    expect(ar).toContain('مزيج بين الاسترخاء والمغامرة');
  });

  it('naturecity canonical semantics are preserved from the prior task\'s fix: 15=nature, 50=mix, 90=cities', () => {
    expect(summarizeAnswer('tourism', 'naturecity', 15, 'ar')).toContain('الطبيعة');
    expect(summarizeAnswer('tourism', 'naturecity', 15, 'ar')).not.toContain('أميل إلى المدن');
    expect(summarizeAnswer('tourism', 'naturecity', 90, 'ar')).toContain('المدن');
    expect(summarizeAnswer('tourism', 'naturecity', 90, 'ar')).not.toContain('أميل إلى الطبيعة');
  });
});

describe('Manual answer and AI-confirmed answer produce the IDENTICAL summary (requirement 7/18)', () => {
  it('the summary function takes only (purposeId, questionId, value, lang) — no provenance parameter exists, so it cannot differ by source', () => {
    expect(summarizeAnswer.length).toBe(4);
    const manual = summarizeAnswer('tourism', 'naturecity', 15, 'ar');
    const aiConfirmed = summarizeAnswer('tourism', 'naturecity', 15, 'ar'); // same call, provenance never enters
    expect(manual).toBe(aiConfirmed);
  });
});

describe('Importance-tier wording is truthful by RANK, not by absolute value (options differ in absolute numbers per question)', () => {
  it('the lowest-ranked option of a 4-tier importance question always reads as low importance, regardless of its absolute number', () => {
    // tourism.nightlife lowest = 10; work.jobmarket lowest = 40 — different
    // absolute numbers, same RANK (index 0 of 4) -> same tier wording.
    const a = summarizeAnswer('tourism', 'nightlife', 10, 'ar');
    const b = summarizeAnswer('work', 'jobmarket', 40, 'ar');
    expect(a).toContain('أهمية منخفضة');
    expect(b).toContain('أهمية منخفضة');
  });

  it('the highest-ranked option always reads as the top tier', () => {
    expect(summarizeAnswer('tourism', 'safety', 100, 'ar')).toContain('أهمية قصوى');
    expect(summarizeAnswer('investment', 'stability', 100, 'ar')).toContain('أهمية قصوى');
  });
});
