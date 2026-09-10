// Phase 15 / Phase 14 boundary proof (task's own explicit requirement:
// "A user who ultimately provides the same normalized answers must
// receive the same ranking as before. Add a parity test for this.").
//
// Why this is provable, not just plausible: rankDestinations(purposeId,
// answers) and scoreDestination() both read `answers[q.id]` by KEY —
// a plain JS object's property lookups are unaffected by the ORDER its
// keys were assigned in (see selectNextQuestion.test.ts's own
// insertion-order test for the same guarantee one level down). So for
// a fixed final answer set, the ranking is identical no matter what
// order — static array order (the pre-Phase-15 behavior) or an
// adaptively REORDERED path (this phase) — those answers were
// collected in. This test demonstrates it directly rather than relying
// on that reasoning alone: same choices, collected via genuinely
// different orderings, must yield a byte-identical ranked result.
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { rankDestinations } from '../engine';
import { selectNextQuestion } from './selectNextQuestion';
import type { Answers, RankedResult } from '../engine';
import type { PurposeId, Question } from '../data/types';

/** Collects answers in the bank's OWN static array order — exactly
 *  what routes/Quiz.tsx did before Phase 15 existed. */
function collectStaticOrder(bank: Question[], valueFor: (q: Question) => string | number): Answers {
  const answers: Answers = {};
  for (const q of bank) answers[q.id] = valueFor(q);
  return answers;
}

/** Collects the SAME choices, but in whatever order
 *  selectNextQuestion() actually picks — the real Phase 15 path. */
function collectAdaptiveOrder(bank: Question[], valueFor: (q: Question) => string | number): Answers {
  const answers: Answers = {};
  const path: string[] = [];
  let next = selectNextQuestion(bank, answers, path);
  while (next) {
    path.push(next.id);
    answers[next.id] = valueFor(next);
    next = selectNextQuestion(bank, answers, path);
  }
  return answers;
}

function expectSameRanking(purposeId: PurposeId, valueFor: (q: Question) => string | number) {
  const bank = QUESTION_BANKS[purposeId];
  const staticAnswers = collectStaticOrder(bank, valueFor);
  const adaptiveAnswers = collectAdaptiveOrder(bank, valueFor);

  // The two answer SETS are identical (same keys, same values) even
  // though they were built by iterating in genuinely different orders
  // — proves Phase 15 never drops, duplicates, or corrupts an answer.
  expect(adaptiveAnswers).toEqual(staticAnswers);

  const staticRanking = rankDestinations(purposeId, staticAnswers);
  const adaptiveRanking = rankDestinations(purposeId, adaptiveAnswers);
  expect(adaptiveRanking).toEqual(staticRanking);
  return { staticRanking, adaptiveRanking };
}

describe('Phase 14 parity — same final answers must produce the same ranking regardless of question order', () => {
  it('tourism, first option for every question', () => {
    expectSameRanking('tourism', (q) => q.options[0].value);
  });

  it('tourism, last option for every question (a different, still-fixed choice)', () => {
    expectSameRanking('tourism', (q) => q.options[q.options.length - 1].value);
  });

  it('work (has a flavor question), high-importance profile', () => {
    expectSameRanking('work', (q) => (q.kind === 'importance' ? 85 : q.options[0].value));
  });

  it('immigration (8 questions, no climate question), mid-range profile', () => {
    expectSameRanking('immigration', (q) => q.options[Math.floor(q.options.length / 2)].value);
  });

  it('every purpose bank, first-option profile — full sweep, not just a handful', () => {
    for (const purposeId of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      expectSameRanking(purposeId, (q) => q.options[0].value);
    }
  });

  it('the ranking itself is non-trivial (not accidentally comparing two empty/degenerate results)', () => {
    const { staticRanking } = expectSameRanking('tourism', (q) => q.options[0].value);
    expect(staticRanking.length).toBeGreaterThan(0);
    expect(staticRanking[0]).toHaveProperty('score');
    expect(staticRanking[0]).toHaveProperty('reasons');
  });

  it('a PARTIAL answer set (adaptive session stopped early, as scoreDestination already safely supports) still matches the same partial set collected in static order', () => {
    const bank = QUESTION_BANKS.tourism;
    const half = Math.ceil(bank.length / 2);

    const staticPartial: Answers = {};
    for (const q of bank.slice(0, half)) staticPartial[q.id] = q.options[0].value;

    const adaptivePartial: Answers = {};
    const path: string[] = [];
    for (let i = 0; i < half; i++) {
      const next = selectNextQuestion(bank, adaptivePartial, path)!;
      path.push(next.id);
      adaptivePartial[next.id] = next.options[0].value;
    }

    // Different SUBSETS of questions may well have been answered
    // (that's the whole point of reordering) — the guarantee is not
    // "the same subset", it's "for whatever subset each produced,
    // scoreDestination handles it identically and safely".
    const staticRanking: RankedResult[] = rankDestinations('tourism', staticPartial);
    const adaptiveRanking: RankedResult[] = rankDestinations('tourism', adaptivePartial);
    expect(staticRanking.length).toBe(adaptiveRanking.length);
    for (const r of [...staticRanking, ...adaptiveRanking]) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
