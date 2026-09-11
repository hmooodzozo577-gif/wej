// Phase 16.5 TRUE adaptive-interview pass — the AI Dimension Catalog
// builder (Section 8).
import { describe, expect, it } from 'vitest';
import { buildDimensionCatalog, computeMaxInterviewTurns } from './buildDimensionCatalog';
import { QUESTION_BANKS } from '../data/questionBanks';
import { classifyQuestion } from '../profile/travelProfile';

describe('buildDimensionCatalog', () => {
  it('lists every dimension in the bank — resolved and unresolved alike (never just the unresolved ones)', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: { climate: 'cold' }, askedDimensionIds: [] }, 'en');
    expect(catalog.length).toBe(QUESTION_BANKS.tourism.length);
    expect(catalog.map((d) => d.id)).toEqual(QUESTION_BANKS.tourism.map((q) => q.id));
  });

  it('marks a dimension resolved once it has any answer, and alreadyAsked follows from resolved automatically', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: { climate: 'cold' }, askedDimensionIds: [] }, 'en');
    const climate = catalog.find((d) => d.id === 'climate')!;
    expect(climate.resolved).toBe(true);
    expect(climate.alreadyAsked).toBe(true);
  });

  it('marks a dimension alreadyAsked from askedDimensionIds even when still unresolved', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: ['naturecity'] }, 'en');
    const nature = catalog.find((d) => d.id === 'naturecity')!;
    expect(nature.resolved).toBe(false);
    expect(nature.alreadyAsked).toBe(true);
  });

  it('an unresolved, never-asked dimension is neither resolved nor alreadyAsked', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en');
    const nature = catalog.find((d) => d.id === 'naturecity')!;
    expect(nature.resolved).toBe(false);
    expect(nature.alreadyAsked).toBe(false);
  });

  it('rankingSupported matches profile/travelProfile.ts\'s own classifyQuestion — never a second, drifting classification', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en');
    for (const d of catalog) {
      const q = QUESTION_BANKS.tourism.find((qq) => qq.id === d.id)!;
      expect(d.rankingSupported).toBe(classifyQuestion(q) === 'RANKING_SUPPORTED');
    }
  });

  it('every option carries a value+label pair — never a bare value (same production-bug fix as ai/mapQuestionsForAi.ts)', () => {
    const catalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'ar');
    const nature = catalog.find((d) => d.id === 'naturecity')!;
    expect(nature.options.every((o) => typeof o.label === 'string' && o.label.length > 0)).toBe(true);
  });

  it('includes localized bank wording so the Worker can reject copied questions', () => {
    const ar = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'ar');
    const en = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en');
    const source = QUESTION_BANKS.tourism.find((question) => question.id === 'budget')!;
    expect(ar.find((dimension) => dimension.id === 'budget')?.question).toBe(source.text.ar);
    expect(en.find((dimension) => dimension.id === 'budget')?.question).toBe(source.text.en);
  });

  it('language switches option labels (Arabic vs English) without changing ids/values/resolved state', () => {
    const ar = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'ar');
    const en = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en');
    expect(ar.map((d) => d.id)).toEqual(en.map((d) => d.id));
    const arNature = ar.find((d) => d.id === 'naturecity')!;
    const enNature = en.find((d) => d.id === 'naturecity')!;
    expect(arNature.options.map((o) => o.value)).toEqual(enNature.options.map((o) => o.value));
    expect(arNature.options[0]?.label).not.toBe(enNature.options[0]?.label);
  });
});

describe('computeMaxInterviewTurns — Section 22 product-appropriate ceiling', () => {
  it('scales with the number of ranking-supported dimensions, never a fixed constant regardless of bank size', () => {
    const smallCatalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en').slice(0, 2);
    const fullCatalog = buildDimensionCatalog('tourism', { answers: {}, askedDimensionIds: [] }, 'en');
    expect(computeMaxInterviewTurns(fullCatalog)).toBeGreaterThanOrEqual(computeMaxInterviewTurns(smallCatalog));
  });

  it('is always a positive integer, and never exceeds the absolute safety ceiling', () => {
    for (const purposeId of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      const catalog = buildDimensionCatalog(purposeId, { answers: {}, askedDimensionIds: [] }, 'en');
      const max = computeMaxInterviewTurns(catalog);
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(12);
    }
  });

  it('replaces the old artificial MAX_FOLLOWUP_TURNS=2 cap: every real purpose bank gets MORE than 2 turns of headroom', () => {
    for (const purposeId of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      const catalog = buildDimensionCatalog(purposeId, { answers: {}, askedDimensionIds: [] }, 'en');
      expect(computeMaxInterviewTurns(catalog)).toBeGreaterThan(2);
    }
  });
});
