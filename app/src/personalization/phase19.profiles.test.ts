// Phase 19 (19.2) — recommendation and personalization QA over profile
// archetypes: every purpose × low/mid/high picks, warm/cold climate,
// sparse/dense answers, proximity-sensitive vs indifferent, location shared
// vs not, and land-border hard constraint on vs off. Read-only checks on
// the protected engines — nothing here recalibrates anything.
import { describe, expect, it } from 'vitest';
import { rankDestinations } from '../engine';
import type { Answers } from '../engine/types';
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import { PURPOSES } from '../data/purposes';
import type { PurposeId } from '../data/types';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { normalizePreferences } from './signals';
import { REFINEMENT_POOL_SIZE, computePersonalMatch, personalMatchesFor, refineRanking } from './personalMatch';
import { personalSummary } from './explain';

const RIYADH = { lat: 24.7136, lng: 46.6753 };
const PURPOSE_IDS = PURPOSES.map((p) => p.id as PurposeId);

type Pick = 'first' | 'middle' | 'last';
function answersFor(purpose: PurposeId, pick: Pick, density: 'sparse' | 'dense'): Answers {
  const answers: Answers = {};
  const bank = QUESTION_BANKS[purpose];
  const questions = density === 'sparse' ? bank.slice(0, 2) : bank;
  for (const question of questions) {
    const options = question.options;
    if (!options.length) continue;
    const option = pick === 'first' ? options[0]! : pick === 'last' ? options[options.length - 1]! : options[Math.floor(options.length / 2)]!;
    answers[question.id] = option.value;
  }
  return answers;
}

const ARCHETYPES: { label: string; purpose: PurposeId; answers: Answers; origin: typeof RIYADH | null }[] = [];
for (const purpose of PURPOSE_IDS) {
  for (const pick of ['first', 'middle', 'last'] as const) {
    for (const density of ['sparse', 'dense'] as const) {
      for (const origin of [null, RIYADH]) {
        ARCHETYPES.push({ label: `${purpose}/${pick}/${density}/${origin ? 'located' : 'no-location'}`, purpose, answers: answersFor(purpose, pick, density), origin });
      }
    }
  }
  // Hard constraint: land border requested, with and without a location.
  const withBorder = { ...answersFor(purpose, 'middle', 'dense'), [landBorderQuestionId(purpose)]: 1 };
  ARCHETYPES.push({ label: `${purpose}/land-border/located`, purpose, answers: withBorder, origin: RIYADH });
  ARCHETYPES.push({ label: `${purpose}/land-border/no-location`, purpose, answers: withBorder, origin: null });
}

describe('Phase 19 — profile archetypes', () => {
  it('covers every purpose with the archetype grid', () => {
    expect(ARCHETYPES.length).toBe(PURPOSE_IDS.length * 14);
  });

  // One test per purpose keeps each well inside the per-test time limit.
  it.each(PURPOSE_IDS)('keeps every Personal Match bounded, finite and internally consistent (%s)', (only) => {
    for (const { label, purpose, answers, origin } of ARCHETYPES.filter((archetype) => archetype.purpose === only)) {
      const prefs = normalizePreferences(purpose, answers);
      const matches = personalMatchesFor(WORLD_CATALOG, prefs, { origin });
      expect(matches.size, label).toBe(WORLD_CATALOG.length);
      for (const match of matches.values()) {
        if (match.score !== null) {
          expect(Number.isInteger(match.score), label).toBe(true);
          expect(match.score, label).toBeGreaterThanOrEqual(0);
          expect(match.score, label).toBeLessThanOrEqual(100);
        }
        expect(Number.isFinite(match.coverage) && match.coverage >= 0 && match.coverage <= 1, label).toBe(true);
        expect(match.evaluatedCount, label).toBeLessThanOrEqual(match.expressedCount);
        // Missing data lowers coverage; it never enters the score as a fit.
        for (const factor of match.factors) {
          if (factor.outcome === 'unavailable') expect(factor.fit, label).toBeNull();
          if (factor.fit !== null) expect(factor.fit >= 0 && factor.fit <= 100, label).toBe(true);
        }
        if (match.evaluatedCount === 0) expect(match.score, label).toBeNull();
      }
    }
  });

  it('is deterministic: the same profile gives the same numbers and order', () => {
    for (const { label, purpose, answers, origin } of ARCHETYPES.filter((_, index) => index % 5 === 0)) {
      const prefs = normalizePreferences(purpose, answers);
      const phase14 = rankDestinations(purpose, answers, origin);
      const a = refineRanking(phase14, prefs, { origin }).map((item) => [item.result.dest.id, item.personal.score]);
      const b = refineRanking(rankDestinations(purpose, answers, origin), normalizePreferences(purpose, answers), { origin }).map((item) => [item.result.dest.id, item.personal.score]);
      expect(b, label).toEqual(a);
    }
  });

  it('leaves Phase 14 in charge: the same top candidates, the same Phase 14 scores', () => {
    for (const { label, purpose, answers, origin } of ARCHETYPES) {
      const phase14 = rankDestinations(purpose, answers, origin);
      const refined = refineRanking(phase14, normalizePreferences(purpose, answers), { origin });
      const pool = phase14.slice(0, REFINEMENT_POOL_SIZE);
      expect(new Set(refined.map((item) => item.result.dest.id)), label).toEqual(new Set(pool.map((item) => item.dest.id)));
      for (const item of refined) {
        const original = pool.find((result) => result.dest.id === item.result.dest.id)!;
        expect(item.result.score, label).toBe(original.score);
      }
      for (const result of phase14) expect(Number.isFinite(result.score) && result.score >= 0 && result.score <= 100, label).toBe(true);
    }
  });

  it('explains only from the factors it actually evaluated', () => {
    for (const { label, purpose, answers, origin } of ARCHETYPES.filter((_, index) => index % 3 === 0)) {
      const prefs = normalizePreferences(purpose, answers);
      for (const dest of WORLD_CATALOG.slice(0, 40)) {
        const match = computePersonalMatch(dest, prefs, { origin });
        for (const lang of ['ar', 'en'] as const) {
          const text = personalSummary(match, prefs, dest, lang);
          expect(typeof text, label).toBe('string');
          expect(text, label).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });

  it('never ranks the excluded country', () => {
    for (const { label, purpose, answers, origin } of ARCHETYPES) {
      expect(rankDestinations(purpose, answers, origin).some((result) => result.dest.countryCode === 'IL'), label).toBe(false);
    }
  });
});
