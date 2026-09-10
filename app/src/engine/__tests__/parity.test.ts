// Verifies the ported TypeScript engine produces IDENTICAL results to the
// live, unmodified functions in wejhaty.html — not a hand-copied reference,
// but the actual original source, loaded fresh on every run via
// loadOriginalEngine(). Covers all 8 purposes, all 30 destinations, and
// several representative answer profiles per purpose (including a partial-
// answers case, to exercise the `ans === undefined` skip branch).
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../../data/destinations';
import { QUESTION_BANKS } from '../../data/questionBanks';
import type { PurposeId, Question } from '../../data/types';
import { scoreDestination as portedScoreDestination } from '../scoreDestination';
import { rankDestinations as portedRankDestinations } from '../rankDestinations';
import { buildWhyText as portedBuildWhyText } from '../buildWhyText';
import type { Answers } from '../types';
import { loadOriginalEngine } from './loadOriginalEngine';

const PURPOSE_IDS: PurposeId[] = [
  'tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other',
];

/** Pick the nth option's value for every question (clamped to available options). */
function answersFromVariant(questions: Question[], pick: (opts: Question['options']) => number): Answers {
  const answers: Answers = {};
  for (const q of questions) {
    const idx = Math.min(pick(q.options), q.options.length - 1);
    answers[q.id] = q.options[idx].value;
  }
  return answers;
}

function buildVariants(purposeId: PurposeId): { name: string; answers: Answers }[] {
  const questions = QUESTION_BANKS[purposeId];
  return [
    { name: 'first option for every question', answers: answersFromVariant(questions, () => 0) },
    {
      name: 'last option for every question',
      answers: answersFromVariant(questions, (opts) => opts.length - 1),
    },
    {
      name: 'middle option for every question',
      answers: answersFromVariant(questions, (opts) => Math.floor(opts.length / 2)),
    },
    {
      // Partial answers: only the first question answered, everything else
      // left undefined — exercises the `ans === undefined` skip branch.
      name: 'partial answers (first question only)',
      answers: questions.length > 0 ? { [questions[0].id]: questions[0].options[0].value } : {},
    },
    {
      name: 'no answers at all',
      answers: {},
    },
  ];
}

describe('engine parity vs. wejhaty.html (original source, loaded live)', () => {
  const original = loadOriginalEngine();

  it('original engine actually loaded (sanity check on the loader itself)', () => {
    expect(typeof original.scoreDestination).toBe('function');
    expect(original.DESTINATIONS).toHaveLength(30);
  });

  for (const purposeId of PURPOSE_IDS) {
    describe(`purpose: ${purposeId}`, () => {
      const variants = buildVariants(purposeId);

      for (const { name, answers } of variants) {
        it(`scoreDestination matches original for all 30 destinations — ${name}`, () => {
          for (const dest of DESTINATIONS) {
            const ours = portedScoreDestination(dest, purposeId, answers);
            const theirs = original.scoreDestination(dest, purposeId, answers);
            expect(ours.score, `${dest.id}/${purposeId}/${name}: score`).toBe(theirs.score);
            expect(ours.reasons, `${dest.id}/${purposeId}/${name}: reasons`).toEqual(theirs.reasons);
          }
        });

        it(`rankDestinations matches original's SCORES — ${name} (Phase 14 audit: tie ORDER is now intentionally different — see rankDestinations.ts's own doc comment for why the original's insertion-order-accident tie-breaking was replaced with an explicit, documented one; the two engines' scoring must still agree exactly)`, () => {
          const ours = portedRankDestinations(purposeId, answers);
          const theirs = original.rankDestinations(purposeId, answers);
          // Same multiset of {id, score} pairs, order-independent — this is
          // what "parity" means for scoring after the Phase 14 tie-break
          // fix: identical scores for every destination, not identical
          // tie order (which the original never actually guaranteed).
          const sortById = (arr: { id: string; score: number }[]) => [...arr].sort((a, b) => a.id.localeCompare(b.id));
          expect(sortById(ours.map((r) => ({ id: r.dest.id, score: r.score })))).toEqual(
            sortById(theirs.map((r) => ({ id: (r.dest as { id: string }).id, score: r.score }))),
          );
          // Our own output must be genuinely sorted score-desc, then
          // id-asc among ties — the actual Phase 14 fix under test.
          for (let i = 1; i < ours.length; i++) {
            const prev = ours[i - 1]!;
            const curr = ours[i]!;
            expect(
              prev.score > curr.score || (prev.score === curr.score && prev.dest.id.localeCompare(curr.dest.id) <= 0),
            ).toBe(true);
          }
        });

        it(`buildWhyText matches original (ar + en) for the same destination — ${name}`, () => {
          // Deliberately NOT ranked[0] from each engine (which can now
          // legitimately differ ONLY in which same-score destination
          // sorts first — see the rankDestinations test above): picks
          // one fixed destination's reasons from OUR engine and compares
          // buildWhyText's own text-building logic against the original
          // for that same destination/reasons pair, isolating this
          // test to buildWhyText parity alone.
          const ourScored = portedScoreDestination(DESTINATIONS[0]!, purposeId, answers);
          const theirScored = original.scoreDestination(DESTINATIONS[0]!, purposeId, answers);
          for (const lang of ['ar', 'en'] as const) {
            const ours = portedBuildWhyText(lang, purposeId, ourScored.reasons, DESTINATIONS[0]!);
            const theirs = original.buildWhyText(lang, purposeId, theirScored.reasons, DESTINATIONS[0]!);
            expect(ours).toBe(theirs);
          }
        });
      }
    });
  }
});
