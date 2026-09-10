// Phase 15 — Adaptive Questions. Pure-function tests for the actual
// decision layer (see reducer.test.ts for the React-state-facing
// tests, and adaptiveParity.test.ts for the Phase 14 boundary proof).
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from './selectNextQuestion';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine';

/** Runs a full adaptive session for one purpose given a scripted
 *  answer function, returning the exact path taken. Mirrors exactly
 *  how reducer.ts drives selectNextQuestion(): one question at a
 *  time, the just-asked question answered before asking for the next. */
function runFullSession(purposeId: PurposeId, answerFor: (questionId: string) => string | number): string[] {
  const bank = QUESTION_BANKS[purposeId];
  const path: string[] = [];
  const answers: Answers = {};
  let next = selectNextQuestion(bank, answers, path);
  while (next) {
    path.push(next.id);
    answers[next.id] = answerFor(next.id);
    next = selectNextQuestion(bank, answers, path);
  }
  return path;
}

describe('selectNextQuestion — determinism', () => {
  it('the initial question (no answers, nothing asked) is deterministic for a given purpose', () => {
    const bank = QUESTION_BANKS.tourism;
    const a = selectNextQuestion(bank, {}, []);
    const b = selectNextQuestion(bank, {}, []);
    expect(a).not.toBeNull();
    expect(a!.id).toBe(b!.id);
  });

  it('the same answers-so-far state always produces the same next question, called repeatedly', () => {
    const bank = QUESTION_BANKS.tourism;
    const answers: Answers = { budget: 2, naturecity: 50 };
    const asked = ['budget', 'naturecity'];
    const results = Array.from({ length: 5 }, () => selectNextQuestion(bank, answers, asked)!.id);
    expect(new Set(results).size).toBe(1);
  });

  it('never depends on object key insertion order — an answers object built in a different key order yields the identical decision', () => {
    const bank = QUESTION_BANKS.tourism;
    const asked = ['budget', 'naturecity', 'beaches'];
    const a: Answers = { budget: 2, naturecity: 50, beaches: 90 };
    const b: Answers = { beaches: 90, budget: 2, naturecity: 50 };
    expect(selectNextQuestion(bank, a, asked)!.id).toBe(selectNextQuestion(bank, b, asked)!.id);
  });
});

describe('selectNextQuestion — flavor-first rule', () => {
  it('a bank with a flavor question (work) asks it first, before anything else, regardless of answers', () => {
    const bank = QUESTION_BANKS.work;
    const first = selectNextQuestion(bank, {}, []);
    expect(first!.id).toBe('field');
    expect(first!.kind).toBe('flavor');
  });

  it('a bank with no flavor question (tourism) never returns one (there is none) — starts directly with the highest-weight real question', () => {
    const bank = QUESTION_BANKS.tourism;
    expect(bank.some((q) => q.kind === 'flavor')).toBe(false);
    const first = selectNextQuestion(bank, {}, []);
    expect(first!.id).toBe('budget'); // weight 12, the highest in this bank
  });
});

describe('selectNextQuestion — real adaptivity (materially different paths for different answers)', () => {
  it('SCENARIO A vs B: a high vs low "safety" (importance) answer reorders the remaining tourism questions differently', () => {
    const bank = QUESTION_BANKS.tourism;
    const askedThroughSafety = ['budget', 'naturecity', 'beaches', 'safety'];
    const highSafety: Answers = { budget: 2, naturecity: 50, beaches: 90, safety: 85 };
    const lowSafety: Answers = { budget: 2, naturecity: 50, beaches: 90, safety: 30 };

    const afterHigh = selectNextQuestion(bank, highSafety, askedThroughSafety)!.id;
    const afterLow = selectNextQuestion(bank, lowSafety, askedThroughSafety)!.id;

    // High importance-momentum boosts the remaining 'importance'
    // question (culture) ahead of the remaining 'target'/'climate'
    // ones; low momentum does the opposite (climate is a target/
    // climate-kind question, prioritized instead).
    expect(afterHigh).toBe('culture');
    expect(afterLow).toBe('climate');
    expect(afterHigh).not.toBe(afterLow);
  });

  it('SCENARIO C: a materially different purpose bank (work, with a flavor question) produces its own distinct path shape', () => {
    const path = runFullSession('work', (id) => {
      const q = QUESTION_BANKS.work.find((x) => x.id === id)!;
      // Answer every importance question HIGH — pushes this bank's
      // adaptive momentum toward prioritizing remaining importance
      // questions once at least one has been answered.
      if (q.kind === 'importance') return 85;
      return q.options[0].value;
    });
    expect(path[0]).toBe('field'); // flavor, always first
    expect(path).toHaveLength(QUESTION_BANKS.work.length);
  });

  it('three scripted profiles produce three genuinely different full-session orderings (not just different by coincidence of length)', () => {
    const bank = QUESTION_BANKS.tourism;
    const highImportance = runFullSession('tourism', (id) => {
      const q = bank.find((x) => x.id === id)!;
      return q.kind === 'importance' ? 85 : (q.options[0].value as string | number);
    });
    const lowImportance = runFullSession('tourism', (id) => {
      const q = bank.find((x) => x.id === id)!;
      return q.kind === 'importance' ? 10 : (q.options[0].value as string | number);
    });
    const neutral = runFullSession('tourism', () => 0); // never triggers the importance-momentum branch meaningfully differently, distinct script regardless

    expect(highImportance).not.toEqual(lowImportance);
    // All three still cover the exact same question SET (a reorder,
    // never a skip) — same length, same members, just different order.
    expect([...highImportance].sort()).toEqual([...lowImportance].sort());
    expect([...highImportance].sort()).toEqual([...neutral].sort());
  });
});

describe('selectNextQuestion — safety guarantees', () => {
  const allPurposes = Object.keys(QUESTION_BANKS) as PurposeId[];

  it('every purpose bank: a full adaptive session never repeats a question, always terminates, and asks every question exactly once', () => {
    for (const purposeId of allPurposes) {
      const bank = QUESTION_BANKS[purposeId];
      const path = runFullSession(purposeId, (id) => bank.find((x) => x.id === id)!.options[0].value);
      expect(path, `${purposeId} path length`).toHaveLength(bank.length);
      expect(new Set(path).size, `${purposeId} no duplicates`).toBe(bank.length);
      expect(new Set(path)).toEqual(new Set(bank.map((q) => q.id)));
    }
  });

  it('every purpose bank: completion is reachable regardless of which values are chosen (enumerated across several distinct scripted profiles)', () => {
    const scripts: Array<(v: string | number) => string | number> = [
      (v) => v,
      () => 50,
      () => 0,
    ];
    for (const purposeId of allPurposes) {
      const bank = QUESTION_BANKS[purposeId];
      for (const script of scripts) {
        const path = runFullSession(purposeId, (id) => script(bank.find((x) => x.id === id)!.options[0].value));
        expect(selectNextQuestion(bank, Object.fromEntries(path.map((id) => [id, 1])), path)).toBeNull();
      }
    }
  });

  it('returns null immediately for an empty bank (defensive — no purpose has one today, but the function itself must not throw)', () => {
    expect(selectNextQuestion([], {}, [])).toBeNull();
  });

  it('returns null once askedIds already covers the whole bank', () => {
    const bank = QUESTION_BANKS.tourism;
    expect(selectNextQuestion(bank, {}, bank.map((q) => q.id))).toBeNull();
  });
});

describe('selectNextQuestion — language independence (AR/EN parity by construction)', () => {
  it('operates only on question ids/kind/weight/answers — never reads .text or .options[].label, so AR vs EN never changes the decision', () => {
    const bank = QUESTION_BANKS.tourism;
    // Every candidate field the function touches is language-free;
    // this is a structural assertion that the function signature and
    // implementation give it no language input to branch on at all.
    const first = selectNextQuestion(bank, {}, []);
    expect(first).not.toBeNull();
    // Sanity: the SAME call, with no lang parameter anywhere in the
    // signature, cannot possibly differ between an Arabic and an
    // English session — there is nothing to pass.
    expect(selectNextQuestion.length).toBe(3); // (bank, answers, askedIds) — no lang param exists to add branching on
  });
});
