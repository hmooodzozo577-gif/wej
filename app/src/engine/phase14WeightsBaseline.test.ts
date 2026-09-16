// Phase 14 regression guard (task 3.8/3.25) — proves the Country
// Intelligence work in this round changed NO Phase 14 weight, dimension,
// or per-purpose question configuration. This is the exact per-question
// {id, weight, kind, profileKey, scale} shape QUESTION_BANKS produces,
// captured to app/src/engine/phase14WeightsBaseline.json BEFORE any of
// this round's changes were made and re-verified deep-equal here.
//
// Deliberately does not import DIMENSIONS or PURPOSE_DIMENSIONS directly
// — questionBanks.ts intentionally does not export them. QUESTION_BANKS
// is the real, fully-built, publicly exported surface the engine actually
// scores from, and it transitively encodes every dimension's weight/kind/
// profileKey/scale — so a change to either private table would show up
// here as a diff, without this test needing to reach into module-private
// state.
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import baseline from './phase14WeightsBaseline.json';
import type { PurposeId } from '../data/types';

function shapeOf(purpose: PurposeId) {
  return QUESTION_BANKS[purpose].map((question) => ({
    id: question.id,
    weight: question.weight,
    kind: question.kind,
    profileKey: question.profileKey ?? null,
    scale: question.scale ?? null,
  }));
}

describe('Phase 14 weights/dimensions are unchanged by this round\'s Country Intelligence work', () => {
  for (const purpose of Object.keys(baseline) as PurposeId[]) {
    it(`${purpose}: every question's id/weight/kind/profileKey/scale matches the pre-existing baseline exactly`, () => {
      expect(shapeOf(purpose)).toEqual((baseline as Record<string, unknown>)[purpose]);
    });
  }

  it('the baseline itself covers every purpose QUESTION_BANKS actually has — no purpose silently excluded from this guard', () => {
    expect(Object.keys(baseline).sort()).toEqual(Object.keys(QUESTION_BANKS).sort());
  });
});
