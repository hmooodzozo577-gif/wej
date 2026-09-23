import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import { rankDestinations } from '../engine';
import { scoreDestination } from '../engine/scoreDestination';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';
import { normalizePreferences } from './signals';
import {
  EVIDENCE_PRIOR_WEIGHT,
  REFINEMENT_POOL_SIZE,
  computePersonalMatch,
  personalMatchesFor,
  refineRanking,
} from './personalMatch';
import { factorDetail, groupFactors, personalSummary } from './explain';
import { PERSONAL_MATCH_METHODOLOGY_VERSION } from './types';

const byCode = (code: string) => WORLD_CATALOG.find((entry) => entry.countryCode === code)!;
const PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];
const RIYADH = { lat: 24.71, lng: 46.68 };

/** Small deterministic PRNG so the sweep is reproducible. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomAnswers(purpose: PurposeId, rand: () => number, answerShare = 0.8): Answers {
  const answers: Answers = {};
  for (const question of QUESTION_BANKS[purpose]) {
    if (rand() > answerShare) continue;
    answers[question.id] = question.options[Math.floor(rand() * question.options.length)]!.value;
  }
  if (rand() < 0.2) answers[landBorderQuestionId(purpose)] = rand() < 0.5 ? 1 : 0;
  return answers;
}

describe('signal normalization', () => {
  it('turns answers into typed signals, keeping "no preference" neutral and never penalizing', () => {
    const prefs = normalizePreferences('tourism', {
      'tourism-climate': 'cold',
      'tourism-cost': 1,
      'tourism-coastal': 50,
      'tourism-island': 0,
      'tourism-safety': 100,
      'tourism-health': 25,
      'tourism-proximity': 0,
    });
    const byFactor = Object.fromEntries(prefs.signals.map((signal) => [signal.factor, signal]));
    expect(byFactor.climate?.kind).toBe('climate');
    expect(byFactor.budget?.kind).toBe('budget');
    expect(byFactor.island?.kind).toBe('avoid');
    expect(byFactor.safety).toMatchObject({ kind: 'importance', strength: 'strong', weight: 11 });
    expect(byFactor.health).toMatchObject({ kind: 'importance', strength: 'minor', weight: 2.5 });
    expect(byFactor.coast).toBeUndefined();
    expect(byFactor.proximity).toBeUndefined();
    expect(prefs.neutral).toEqual(expect.arrayContaining(['tourism-coastal', 'tourism-proximity']));
    expect(prefs.constraints).toEqual([]);
  });

  it('treats the medical "size does not matter" option as no preference', () => {
    const option = QUESTION_BANKS.medical.find((question) => question.id === 'medical-size')!.options.find((item) => item.value === 95)!;
    expect(option.label.en.toLowerCase()).toContain('does not matter');
    const prefs = normalizePreferences('medical', { 'medical-size': 95 });
    expect(prefs.signals).toEqual([]);
    expect(prefs.neutral).toEqual(['medical-size']);
  });

  it('makes ONLY the explicit land-border requirement a hard constraint', () => {
    const strongest = normalizePreferences('tourism', { 'tourism-safety': 100, [landBorderQuestionId('tourism')]: 1 });
    expect(strongest.constraints).toEqual([{ kind: 'landBorder', questionId: 'tourism-landBorder' }]);
    expect(strongest.signals.every((signal) => signal.strength !== 'strong' || signal.kind === 'importance')).toBe(true);
    expect(normalizePreferences('tourism', { 'tourism-landBorder': 0 }).constraints).toEqual([]);
  });

  it('ignores unanswered questions entirely', () => {
    expect(normalizePreferences('work', {})).toEqual({ purpose: 'work', signals: [], constraints: [], neutral: [] });
  });
});

describe('Personal Match engine', () => {
  it('is deterministic: same country, profile and methodology give the same result', () => {
    const prefs = normalizePreferences('tourism', { 'tourism-climate': 'cold', 'tourism-cost': 2, 'tourism-safety': 75 });
    const a = computePersonalMatch(byCode('NO'), prefs);
    const b = computePersonalMatch(byCode('NO'), prefs);
    expect(a).toEqual(b);
    expect(a.methodologyVersion).toBe(PERSONAL_MATCH_METHODOLOGY_VERSION);
  });

  it('stays bounded, finite and honest across 400 random profiles × every country', () => {
    const rand = prng(18);
    for (let i = 0; i < 400; i++) {
      const purpose = PURPOSES[i % PURPOSES.length]!;
      const prefs = normalizePreferences(purpose, randomAnswers(purpose, rand, rand()));
      const origin = rand() < 0.5 ? RIYADH : null;
      for (const match of personalMatchesFor(WORLD_CATALOG, prefs, { origin }).values()) {
        if (match.score === null) {
          expect(match.evaluatedCount).toBe(0);
          expect(match.confidence).toBeNull();
          continue;
        }
        expect(Number.isInteger(match.score)).toBe(true);
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(100);
        expect(match.coverage).toBeGreaterThan(0);
        expect(match.coverage).toBeLessThanOrEqual(1);
        for (const factor of match.factors) {
          if (factor.fit !== null) expect(Number.isFinite(factor.fit)).toBe(true);
        }
      }
    }
  });

  it('never reaches a fake 100% from a single matching preference', () => {
    const prefs = normalizePreferences('tourism', { 'tourism-climate': 'cold' });
    const match = computePersonalMatch(byCode('NO'), prefs);
    expect(match.factors[0]!.fit).toBe(100);
    expect(match.score).toBe(Math.round((12 * 100 + EVIDENCE_PRIOR_WEIGHT * 50) / (12 + EVIDENCE_PRIOR_WEIGHT)));
    expect(match.score).toBeLessThan(90);
    expect(match.confidence).toBe('low');
  });

  it('gives no score at all when nothing could be evaluated', () => {
    const empty = computePersonalMatch(byCode('FR'), normalizePreferences('tourism', {}));
    expect(empty).toMatchObject({ score: null, confidence: null, coverage: 0, evaluatedCount: 0 });
    const onlyLocation = computePersonalMatch(byCode('FR'), normalizePreferences('tourism', { 'tourism-proximity': 100 }), { origin: null });
    expect(onlyLocation.score).toBeNull();
    expect(onlyLocation.factors[0]).toMatchObject({ outcome: 'unavailable', reason: 'noLocation' });
  });

  it('marks imputed country data unavailable instead of scoring or penalizing it', () => {
    const imputed = [...RECOMMENDATION_PROFILE_BY_CODE.values()].find((profile) => profile.imputedKeys.includes('safety'))!;
    const observed = [...RECOMMENDATION_PROFILE_BY_CODE.values()].find((profile) => !profile.imputedKeys.includes('safety'))!;
    const prefs = normalizePreferences('tourism', { 'tourism-safety': 100, 'tourism-climate': 'temperate' });
    const withGap = computePersonalMatch(byCode(imputed.countryCode), prefs);
    const safety = withGap.factors.find((factor) => factor.factor === 'safety')!;
    expect(safety).toMatchObject({ outcome: 'unavailable', reason: 'noData', fit: null });
    expect(withGap.coverage).toBeLessThan(1);
    // The score rests on climate alone — exactly what it would be if safety had never been asked.
    const climateOnly = computePersonalMatch(byCode(imputed.countryCode), normalizePreferences('tourism', { 'tourism-climate': 'temperate' }));
    expect(withGap.score).toBe(climateOnly.score);
    expect(computePersonalMatch(byCode(observed.countryCode), prefs).coverage).toBe(1);
  });

  it('keeps budget asymmetric: cheaper stays a fit, pricier does not', () => {
    const prefs = normalizePreferences('tourism', { 'tourism-cost': 3 });
    const at = [...RECOMMENDATION_PROFILE_BY_CODE.values()].find((p) => p.costLevel === 3 && !p.imputedKeys.includes('costLevel'))!;
    const cheaper = [...RECOMMENDATION_PROFILE_BY_CODE.values()].find((p) => p.costLevel === 1 && !p.imputedKeys.includes('costLevel'))!;
    const pricier = [...RECOMMENDATION_PROFILE_BY_CODE.values()].find((p) => p.costLevel === 4 && !p.imputedKeys.includes('costLevel'))!;
    const fit = (code: string) => computePersonalMatch(byCode(code), prefs).factors[0]!;
    expect(fit(at.countryCode)).toMatchObject({ fit: 100, outcome: 'positive' });
    expect(fit(cheaper.countryCode)).toMatchObject({ fit: 88, outcome: 'positive', direction: 'below' });
    expect(fit(pricier.countryCode)).toMatchObject({ fit: 55, outcome: 'partial', direction: 'above' });
  });

  it('applies a hard constraint outside the weighted average', () => {
    const prefs = normalizePreferences('tourism', { 'tourism-climate': 'desert', 'tourism-landBorder': 1 });
    const matches = personalMatchesFor(WORLD_CATALOG, prefs, { origin: RIYADH });
    expect(matches.get(byCode('AE').id)?.eligible).toBe(true);
    const far = matches.get(byCode('IS').id)!;
    expect(far.eligible).toBe(false);
    expect(far.constraints).toEqual([{ kind: 'landBorder', status: 'fail' }]);
    // Without a location the requirement cannot be judged: nothing is excluded.
    const noLocation = computePersonalMatch(byCode('IS'), prefs, { origin: null });
    expect(noLocation).toMatchObject({ eligible: true, constraints: [{ kind: 'landBorder', status: 'unavailable' }] });
  });

  it('responds to deliberately different profiles in understandable ways (calibration)', () => {
    const top = (purpose: PurposeId, answers: Answers, origin: typeof RIYADH | null = null) => {
      const prefs = normalizePreferences(purpose, answers);
      return [...personalMatchesFor(WORLD_CATALOG, prefs, { origin }).entries()]
        .sort((a, b) => (b[1].score ?? -1) - (a[1].score ?? -1) || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([id]) => RECOMMENDATION_PROFILE_BY_CODE.get(WORLD_CATALOG.find((entry) => entry.id === id)!.countryCode)!);
    };
    const warmCheap = top('tourism', { 'tourism-climate': 'tropical', 'tourism-cost': 1, 'tourism-coastal': 100 });
    const coldRich = top('tourism', { 'tourism-climate': 'cold', 'tourism-cost': 4 });
    expect(warmCheap.every((profile) => profile.climate === 'tropical' || profile.climate === 'mediterranean')).toBe(true);
    expect(warmCheap.filter((profile) => profile.costLevel <= 1).length).toBeGreaterThanOrEqual(7);
    expect(coldRich.filter((profile) => profile.climate === 'cold' || profile.climate === 'temperate').length).toBeGreaterThanOrEqual(8);

    const nature = top('tourism', { 'tourism-urbanity': 15 });
    const city = top('tourism', { 'tourism-urbanity': 95 });
    const avgUrbanity = (list: typeof nature) => list.reduce((sum, profile) => sum + profile.urbanity, 0) / list.length;
    expect(avgUrbanity(city)).toBeGreaterThan(avgUrbanity(nature) + 40);

    const nearOnly = personalMatchesFor(WORLD_CATALOG, normalizePreferences('tourism', { 'tourism-proximity': 100 }), { origin: RIYADH });
    expect(nearOnly.get(byCode('AE').id)!.score!).toBeGreaterThan(nearOnly.get(byCode('BR').id)!.score!);
    const indifferent = personalMatchesFor(WORLD_CATALOG, normalizePreferences('tourism', { 'tourism-proximity': 0 }), { origin: RIYADH });
    expect(indifferent.get(byCode('AE').id)!.score).toBeNull();
  });

  it('refines Phase 14 order only within its top candidates and never alters Phase 14 scores', () => {
    const answers: Answers = { 'tourism-climate': 'cold', 'tourism-cost': 1, 'tourism-coastal': 100, 'tourism-safety': 75 };
    const phase14 = rankDestinations('tourism', answers);
    const before = phase14.map((result) => [result.dest.id, result.score]);
    const refined = refineRanking(phase14, normalizePreferences('tourism', answers));
    expect(refined).toHaveLength(REFINEMENT_POOL_SIZE);
    expect(new Set(refined.map((item) => item.result.dest.id))).toEqual(new Set(phase14.slice(0, REFINEMENT_POOL_SIZE).map((result) => result.dest.id)));
    expect(phase14.map((result) => [result.dest.id, result.score])).toEqual(before);
    for (const item of refined) expect(item.result.score).toBe(scoreDestination(item.result.dest, 'tourism', answers).score);
    for (let i = 1; i < refined.length; i++) {
      expect(refined[i - 1]!.personal.score! >= refined[i]!.personal.score!).toBe(true);
    }
  });
});

describe('Personal Match explanations', () => {
  const prefs = normalizePreferences('tourism', { 'tourism-climate': 'cold', 'tourism-cost': 1, 'tourism-coastal': 100, 'tourism-safety': 100 });

  it('never contradicts the score: praised factors are positive, weaker ones negative', () => {
    for (const dest of WORLD_CATALOG.slice(0, 60)) {
      const match = computePersonalMatch(dest, prefs);
      const groups = groupFactors(match);
      const summary = personalSummary(match, prefs, dest, 'en');
      const [, afterName = ''] = summary.split(dest.nameEn);
      const [praisedPart = '', weakerPart = ''] = afterName.split(';');
      for (const factor of match.factors) {
        const label = { climate: 'climate', budget: 'budget', coast: 'the sea', safety: 'safety' }[factor.factor as string];
        if (!label) continue;
        if (praisedPart.includes(label)) expect(groups.positive).toContain(factor);
        if (weakerPart.includes(label)) expect(groups.negative).toContain(factor);
      }
    }
  });

  it('writes clean Arabic and English with no leaked keys or foreign script', () => {
    const dests = WORLD_CATALOG.slice(0, 40);
    for (const dest of dests) {
      const match = computePersonalMatch(dest, prefs, { origin: RIYADH });
      const ar = [personalSummary(match, prefs, dest, 'ar'), ...match.factors.map((factor) => factorDetail(factor, 'ar'))].join(' ');
      const en = [personalSummary(match, prefs, dest, 'en'), ...match.factors.map((factor) => factorDetail(factor, 'en'))].join(' ');
      expect(ar.replace(dest.nameAr, '')).not.toMatch(/[A-Za-z]{3,}/);
      expect(en.replace(dest.nameEn, '')).not.toMatch(/[؀-ۿ]/);
      expect(ar + en).not.toMatch(/undefined|NaN|null|\bcostLevel\b|\bimportance\b/);
      expect(ar + en).not.toMatch(/[٠-٩]/);
    }
  });

  it('quotes the traveller’s own choices back', () => {
    const match = computePersonalMatch(byCode('NO'), prefs);
    expect(personalSummary(match, prefs, byCode('NO'), 'ar')).toContain('مناخًا باردًا');
    expect(personalSummary(match, prefs, byCode('NO'), 'en')).toContain('a cold climate');
  });

  it('explains an empty evaluation honestly instead of inventing a match', () => {
    const empty = normalizePreferences('tourism', { 'tourism-proximity': 100 });
    const match = computePersonalMatch(byCode('FR'), empty, { origin: null });
    expect(personalSummary(match, empty, byCode('FR'), 'en')).toContain('Not enough stated preferences');
  });
});
