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

        it(`rankDestinations matches original — ${name}`, () => {
          const ours = portedRankDestinations(purposeId, answers);
          const theirs = original.rankDestinations(purposeId, answers);
          expect(ours.map((r) => ({ id: r.dest.id, score: r.score }))).toEqual(
            theirs.map((r) => ({
              id: (r.dest as { id: string }).id,
              score: r.score,
            })),
          );
        });

        it(`buildWhyText matches original (ar + en) — ${name}`, () => {
          const ranked = portedRankDestinations(purposeId, answers);
          const top = ranked[0];
          for (const lang of ['ar', 'en'] as const) {
            const ours = portedBuildWhyText(lang, purposeId, top.reasons, top.dest);
            const theirs = original.buildWhyText(lang, purposeId, top.reasons, top.dest);
            expect(ours).toBe(theirs);
          }
        });
      }
    });
  }
});
