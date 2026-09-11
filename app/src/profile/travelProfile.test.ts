// Phase 16.5 completion pass — Travel Profile regression tests.
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { appReducer, initialAppState } from '../state/reducer';
import { BLOCKED_RANKING_CONCEPTS, buildTravelProfile, classifyQuestion } from './travelProfile';
import type { PurposeId } from '../data/types';

const ALL_PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];

describe('classifyQuestion — field classification derived from the real Phase 14 scoring filter', () => {
  it('every flavor-kind question across every bank is INTERVIEW_CONTEXT (scoreDestination.ts excludes flavor from scoring)', () => {
    for (const purposeId of ALL_PURPOSES) {
      for (const q of QUESTION_BANKS[purposeId]) {
        if (q.kind === 'flavor') expect(classifyQuestion(q)).toBe('INTERVIEW_CONTEXT');
      }
    }
  });

  it('every non-flavor question across every bank is RANKING_SUPPORTED', () => {
    for (const purposeId of ALL_PURPOSES) {
      for (const q of QUESTION_BANKS[purposeId]) {
        if (q.kind !== 'flavor') expect(classifyQuestion(q)).toBe('RANKING_SUPPORTED');
      }
    }
  });

  it('at least one real bank actually has a flavor question (this test is not vacuously true)', () => {
    expect(QUESTION_BANKS.work.some((q) => q.kind === 'flavor')).toBe(true);
  });
});

describe('buildTravelProfile', () => {
  it('an untouched quiz has every field unknown, none confirmed', () => {
    const state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const profile = buildTravelProfile('tourism', state);
    expect(profile.confirmedCount).toBe(0);
    expect(profile.totalCount).toBe(QUESTION_BANKS.tourism.length);
    expect(profile.fields.every((f) => f.status === 'unknown')).toBe(true);
  });

  it('a direct answer is confirmed with provenance "direct" and no confidence', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'cold' });
    const profile = buildTravelProfile('tourism', state);
    const field = profile.fields.find((f) => f.questionId === 'climate')!;
    expect(field.status).toBe('confirmed');
    expect(field.provenance).toBe('direct');
    expect(field.confidence).toBeNull();
    expect(field.value).toBe('cold');
    expect(profile.confirmedCount).toBe(1);
  });

  it('a confirmed AI interpretation carries provenance "ai_interpreted" and its reported confidence', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'ai_interpreted', confidence: 'high' });
    const profile = buildTravelProfile('tourism', state);
    const field = profile.fields.find((f) => f.questionId === 'naturecity')!;
    expect(field.status).toBe('confirmed');
    expect(field.provenance).toBe('ai_interpreted');
    expect(field.confidence).toBe('high');
    expect(field.value).toBe(15);
  });

  it('classification is stamped on every field, confirmed or not — "field" (a flavor question, work bank) is INTERVIEW_CONTEXT even before it is answered', () => {
    const state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'work' });
    const profile = buildTravelProfile('work', state);
    const fieldQuestion = profile.fields.find((f) => f.questionId === 'field')!;
    expect(fieldQuestion.classification).toBe('INTERVIEW_CONTEXT');
    expect(fieldQuestion.status).toBe('unknown');
  });

  it('removing a confirmed AI answer (REMOVE_AI_ANSWER) returns that field to unknown, with no leftover confidence', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'ai_interpreted', confidence: 'medium' });
    state = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'naturecity' });
    const profile = buildTravelProfile('tourism', state);
    const field = profile.fields.find((f) => f.questionId === 'naturecity')!;
    expect(field.status).toBe('unknown');
    expect(field.confidence).toBeNull();
    expect(field.provenance).toBeNull();
  });

  it('every purpose bank builds a complete profile with no missing/extra fields', () => {
    for (const purposeId of ALL_PURPOSES) {
      const state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: purposeId });
      const profile = buildTravelProfile(purposeId, state);
      expect(profile.fields.map((f) => f.questionId).sort()).toEqual(QUESTION_BANKS[purposeId].map((q) => q.id).sort());
    }
  });
});

describe('BLOCKED_RANKING_CONCEPTS registry — never silently dropped', () => {
  it('ROADMAP CLEANUP: cultural compatibility is explicitly CANCELLED (a user decision, not a data-availability blocker)', () => {
    const entry = BLOCKED_RANKING_CONCEPTS.find((c) => c.concept === 'culturalCompatibility')!;
    expect(entry).toBeDefined();
    expect(entry.status).toBe('CANCELLED / OUT OF SCOPE');
    expect(entry.status).not.toMatch(/BLOCKED/);
  });

  it('quietness/pace is registered as context-only, not silently forced into a fabricated ranking dimension', () => {
    const entry = BLOCKED_RANKING_CONCEPTS.find((c) => c.concept === 'quietnessPace')!;
    expect(entry).toBeDefined();
  });
});
