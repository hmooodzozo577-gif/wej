import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from './reducer';
import type { PendingFollowup } from './types';

describe('appReducer', () => {
  it('defaults to Arabic', () => {
    expect(initialAppState.lang).toBe('ar');
  });

  it('START_QUIZ resets qIndex/answers/results and sets purpose', () => {
    const dirty = { ...initialAppState, qIndex: 3, answers: { a: 1 }, results: [] as never[] };
    const next = appReducer(dirty, { type: 'START_QUIZ', purpose: 'tourism' });
    expect(next).toMatchObject({ purpose: 'tourism', qIndex: 0, answers: {}, results: null });
  });

  it('Phase 15: START_QUIZ seeds an adaptively-computed single-question path (deterministic, same purpose -> same first question every time)', () => {
    const a = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const b = appReducer({ ...initialAppState, path: ['stale'] }, { type: 'START_QUIZ', purpose: 'tourism' });
    expect(a.path).toHaveLength(1);
    expect(a.path).toEqual(b.path);
  });

  it('PRESELECT_PURPOSE sets purpose only, unlike START_QUIZ it does not reset the quiz', () => {
    const dirty = { ...initialAppState, qIndex: 3, answers: { a: 1 }, results: [] as never[] };
    const next = appReducer(dirty, { type: 'PRESELECT_PURPOSE', purpose: 'work' });
    expect(next).toMatchObject({ purpose: 'work', qIndex: 3, answers: { a: 1 }, results: [] });
  });

  it('SET_ANSWER merges into answers without dropping existing ones', () => {
    let state = appReducer(initialAppState, { type: 'SET_ANSWER', questionId: 'budget', value: 2 });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'hot' });
    expect(state.answers).toEqual({ budget: 2, climate: 'hot' });
  });

  it('Phase 15: re-selecting the SAME value for a past question does not truncate the path', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const q1 = state.path[0];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 2 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const q2 = state.path[1];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q2, value: 3 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const pathBefore = state.path;
    state = appReducer(state, { type: 'PREV_QUESTION' }); // back to q2
    state = appReducer(state, { type: 'PREV_QUESTION' }); // back to q1
    // Re-select the identical value q1 already had.
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 2 });
    expect(state.path).toEqual(pathBefore);
    expect(state.answers[q2]).toBe(3); // downstream answer untouched
  });

  it('Phase 15 REGRESSION: going back and changing an earlier answer truncates the path and removes now-stale downstream answers', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const q1 = state.path[0];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 1 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const q2 = state.path[1];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q2, value: 40 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const q3 = state.path[2];
    expect(state.answers[q2]).toBe(40);
    expect(state.path).toHaveLength(3);

    // Go back to q1 and give a genuinely DIFFERENT answer.
    state = appReducer(state, { type: 'PREV_QUESTION' }); // -> q2
    state = appReducer(state, { type: 'PREV_QUESTION' }); // -> q1
    expect(state.qIndex).toBe(0);
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 4 });

    // Path truncated right after q1 — q2/q3 are no longer trusted.
    expect(state.path).toEqual([q1]);
    expect(state.qIndex).toBe(0);
    // Stale downstream answers removed — never silently kept around.
    expect(state.answers[q2]).toBeUndefined();
    expect(state.answers[q3]).toBeUndefined();
    expect(state.answers[q1]).toBe(4);
  });

  it('Phase 16.5: SET_ANSWER defaults provenance to \'direct\' when omitted (every pre-existing call site keeps working unchanged)', () => {
    const state = appReducer(initialAppState, { type: 'SET_ANSWER', questionId: 'climate', value: 'hot' });
    expect(state.satisfaction).toEqual({ climate: 'direct' });
  });

  it('Phase 16.5: SET_ANSWER records ai_interpreted provenance when given, in parallel with answers', () => {
    const state = appReducer(initialAppState, {
      type: 'SET_ANSWER',
      questionId: 'climate',
      value: 'cold',
      provenance: 'ai_interpreted',
    });
    expect(state.answers).toEqual({ climate: 'cold' });
    expect(state.satisfaction).toEqual({ climate: 'ai_interpreted' });
  });

  it('Phase 16.5 completion pass: SET_ANSWER records the model\'s reported confidence in a parallel map, never touching a direct answer\'s confidence', () => {
    let state = appReducer(initialAppState, {
      type: 'SET_ANSWER',
      questionId: 'naturecity',
      value: 15,
      provenance: 'ai_interpreted',
      confidence: 'high',
    });
    expect(state.confidence).toEqual({ naturecity: 'high' });

    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'hot' }); // direct, no confidence
    expect(state.confidence).toEqual({ naturecity: 'high' }); // unaffected
  });

  it('Phase 16.5 completion pass: removing an AI answer clears its confidence too', () => {
    let state = appReducer(initialAppState, {
      type: 'SET_ANSWER',
      questionId: 'naturecity',
      value: 15,
      provenance: 'ai_interpreted',
      confidence: 'medium',
    });
    state = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'naturecity' });
    expect(state.confidence).toEqual({});
  });

  it('Phase 16.5 QUESTION REDUCTION: an ai_interpreted answer set BEFORE the quiz reaches that question means it never enters path', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    // Satisfy two dimensions via a confirmed interpretation up front —
    // neither has been walked through the interview at all.
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' });
    // Walk the rest of the interview to completion.
    for (let i = 0; i < 10; i++) {
      const currentId = state.path[state.qIndex];
      if (state.answers[currentId] === undefined) {
        state = appReducer(state, { type: 'SET_ANSWER', questionId: currentId, value: 1 });
      }
      const before = state.path.length;
      state = appReducer(state, { type: 'NEXT_QUESTION' });
      if (state.path.length === before && state.qIndex === before - 1) break; // reached the true end
    }
    expect(state.path).not.toContain('climate');
    expect(state.path).not.toContain('naturecity');
  });

  it('Phase 16.5 RESTORE: REMOVE_AI_ANSWER un-applies a confirmed interpretation, and the dimension becomes selectable again', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    expect(state.answers.climate).toBe('cold');
    expect(state.satisfaction.climate).toBe('ai_interpreted');

    state = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'climate' });
    expect(state.answers.climate).toBeUndefined();
    expect(state.satisfaction.climate).toBeUndefined();
  });

  it('Phase 16.5 SAFETY: REMOVE_AI_ANSWER refuses to touch a DIRECT answer', () => {
    let state = appReducer(initialAppState, { type: 'SET_ANSWER', questionId: 'climate', value: 'hot' }); // provenance defaults to 'direct'
    const before = state;
    state = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'climate' });
    expect(state).toBe(before); // untouched — same reference, reducer no-op
    expect(state.answers.climate).toBe('hot');
  });

  it('Phase 16.5: editing a PAST path question with a genuinely different value still truncates satisfaction (and confidence) along with answers', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const q1 = state.path[0];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 1 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const q2 = state.path[1];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q2, value: 40, provenance: 'ai_interpreted', confidence: 'high' });
    state = appReducer(state, { type: 'PREV_QUESTION' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 4 }); // genuinely different -> truncates
    expect(state.satisfaction[q2]).toBeUndefined();
    expect(state.confidence[q2]).toBeUndefined();
  });

  it('NEXT_QUESTION is a safe no-op with no purpose selected (nothing to compute a path from)', () => {
    const state = appReducer(initialAppState, { type: 'NEXT_QUESTION' });
    expect(state).toEqual(initialAppState);
  });

  it('Phase 15: NEXT_QUESTION extends path adaptively, PREV_QUESTION decrements but never below 0, without recomputing an unchanged path', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    expect(state.path).toHaveLength(1);
    expect(state.qIndex).toBe(0);

    const firstQuestionId = state.path[0];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: firstQuestionId, value: 2 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    expect(state.qIndex).toBe(1);
    expect(state.path).toHaveLength(2);
    const pathAfterFirstNext = state.path;

    state = appReducer(state, { type: 'PREV_QUESTION' });
    expect(state.qIndex).toBe(0);
    // Path itself is untouched by pure back navigation.
    expect(state.path).toEqual(pathAfterFirstNext);

    // Forward again with NO answer change — reuses the cached path
    // entry rather than recomputing (deterministic by construction).
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    expect(state.qIndex).toBe(1);
    expect(state.path).toEqual(pathAfterFirstNext);

    state = appReducer(initialAppState, { type: 'PREV_QUESTION' });
    expect(state.qIndex).toBe(0);
  });

  it('RESTART_ALL clears purpose/answers/results/path/satisfaction/confidence but preserves lang', () => {
    const dirty = {
      ...initialAppState,
      lang: 'en' as const,
      purpose: 'work' as const,
      qIndex: 2,
      path: ['field', 'salary'],
      satisfaction: { field: 'ai_interpreted' as const },
      confidence: { field: 'high' as const },
    };
    const next = appReducer(dirty, { type: 'RESTART_ALL' });
    expect(next).toMatchObject({ lang: 'en', purpose: null, qIndex: 0, answers: {}, satisfaction: {}, confidence: {}, results: null, path: [] });
  });

  it('SET_EXPLORE_FILTER updates one field without disturbing the others', () => {
    let state = appReducer(initialAppState, { type: 'SET_EXPLORE_FILTER', key: 'q', value: 'japan' });
    state = appReducer(state, { type: 'SET_EXPLORE_FILTER', key: 'region', value: 'Asia' });
    expect(state.explore).toEqual({ q: 'japan', region: 'Asia', purpose: '', cost: '' });
  });

  it('RESET_EXPLORE_FILTERS clears all filters', () => {
    const dirty = { ...initialAppState, explore: { q: 'x', region: 'Asia', purpose: 'work', cost: '2' } };
    const next = appReducer(dirty, { type: 'RESET_EXPLORE_FILTERS' });
    expect(next.explore).toEqual({ q: '', region: '', purpose: '', cost: '' });
  });

  // Phase 12 — Location Personalization state transitions.
  it('defaults location to idle with no coords', () => {
    expect(initialAppState.location).toEqual({ status: 'idle', coords: null });
  });

  it('LOCATION_REQUEST moves to requesting and clears any prior coords', () => {
    const granted = { ...initialAppState, location: { status: 'granted' as const, coords: { lat: 1, lng: 2 } } };
    const next = appReducer(granted, { type: 'LOCATION_REQUEST' });
    expect(next.location).toEqual({ status: 'requesting', coords: null });
  });

  it('LOCATION_GRANTED stores the coords and sets status to granted', () => {
    const next = appReducer(initialAppState, { type: 'LOCATION_GRANTED', coords: { lat: 24.7, lng: 46.7 } });
    expect(next.location).toEqual({ status: 'granted', coords: { lat: 24.7, lng: 46.7 } });
  });

  it('LOCATION_FAILED sets the given failure status and clears coords', () => {
    const next = appReducer(initialAppState, { type: 'LOCATION_FAILED', status: 'denied' });
    expect(next.location).toEqual({ status: 'denied', coords: null });
  });

  it('LOCATION_RESET returns to idle from any state, including granted', () => {
    const granted = { ...initialAppState, location: { status: 'granted' as const, coords: { lat: 1, lng: 2 } } };
    const next = appReducer(granted, { type: 'LOCATION_RESET' });
    expect(next.location).toEqual({ status: 'idle', coords: null });
  });

  it('location actions never disturb unrelated state (quiz/explore untouched)', () => {
    const dirty = { ...initialAppState, purpose: 'work' as const, qIndex: 2, explore: { ...initialAppState.explore, q: 'x' } };
    const next = appReducer(dirty, { type: 'LOCATION_GRANTED', coords: { lat: 1, lng: 2 } });
    expect(next).toMatchObject({ purpose: 'work', qIndex: 2, explore: { q: 'x' } });
  });
});

describe('Phase 16.5 completion pass — bounded contextual follow-up orchestration', () => {
  const sampleFollowup: PendingFollowup = {
    templateId: 'quietness_clarify',
    prompt: { ar: 'test ar', en: 'test en' },
    options: [
      { id: 'less_nightlife', label: { ar: 'أقل صخبًا', en: 'quieter' }, satisfies: { nightlife: 10 } },
      { id: 'nature_quiet', label: { ar: 'طبيعة هادئة', en: 'quiet nature' }, satisfies: { naturecity: 15 } },
    ],
    allowFreeText: true,
    candidateDimensionIds: ['nightlife', 'naturecity', 'adventure'],
    questionType: 'choice',
  };

  it('SET_PENDING_FOLLOWUP sets state.followup', () => {
    const next = appReducer(initialAppState, { type: 'SET_PENDING_FOLLOWUP', followup: sampleFollowup });
    expect(next.followup).toEqual(sampleFollowup);
  });

  it('SET_PENDING_FOLLOWUP refuses to overwrite an already-pending follow-up (one at a time)', () => {
    const withOne = { ...initialAppState, followup: sampleFollowup };
    const other = { ...sampleFollowup, templateId: 'cultural_novelty_clarify' };
    const next = appReducer(withOne, { type: 'SET_PENDING_FOLLOWUP', followup: other });
    expect(next.followup!.templateId).toBe('quietness_clarify'); // unchanged
    expect(next).toBe(withOne); // true no-op
  });

  it('RESOLVE_FOLLOWUP_CHOICE applies the chosen option\'s satisfies map with provenance ai_followup, clears the pending follow-up, bumps followupTurnsUsed', () => {
    const withOne = { ...initialAppState, followup: sampleFollowup };
    const next = appReducer(withOne, { type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: 'nature_quiet' });
    expect(next.answers.naturecity).toBe(15);
    expect(next.satisfaction.naturecity).toBe('ai_followup');
    expect(next.followup).toBeNull();
    expect(next.followupTurnsUsed).toBe(1);
  });

  it('RESOLVE_FOLLOWUP_CHOICE with an unknown/stale option id is a safe no-op', () => {
    const withOne = { ...initialAppState, followup: sampleFollowup };
    const next = appReducer(withOne, { type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: 'does_not_exist' });
    expect(next).toBe(withOne);
  });

  it('RESOLVE_FOLLOWUP_CHOICE with no pending follow-up is a safe no-op', () => {
    const next = appReducer(initialAppState, { type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: 'nature_quiet' });
    expect(next).toBe(initialAppState);
  });

  it('DISMISS_FOLLOWUP clears the pending follow-up WITHOUT applying anything, still bumps followupTurnsUsed', () => {
    const withOne = { ...initialAppState, followup: sampleFollowup };
    const next = appReducer(withOne, { type: 'DISMISS_FOLLOWUP' });
    expect(next.followup).toBeNull();
    expect(next.answers).toEqual({});
    expect(next.followupTurnsUsed).toBe(1);
  });

  it('INCREMENT_AI_CALLS increments the counter, nothing else', () => {
    const next = appReducer(initialAppState, { type: 'INCREMENT_AI_CALLS' });
    expect(next.aiCallsUsed).toBe(1);
    const again = appReducer(next, { type: 'INCREMENT_AI_CALLS' });
    expect(again.aiCallsUsed).toBe(2);
  });

  it('REMOVE_AI_ANSWER restores a dimension satisfied via ai_followup (not just ai_interpreted)', () => {
    const withOne = { ...initialAppState, followup: sampleFollowup };
    const state = appReducer(withOne, { type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: 'nature_quiet' });
    expect(state.satisfaction.naturecity).toBe('ai_followup');
    const restored = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'naturecity' });
    expect(restored.answers.naturecity).toBeUndefined();
    expect(restored.satisfaction.naturecity).toBeUndefined();
  });

  it('EDIT INVALIDATION: truncating an earlier direct answer also clears a stale pending follow-up', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const q1 = state.path[0];
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 1 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    state = { ...state, followup: sampleFollowup };
    state = appReducer(state, { type: 'SET_ANSWER', questionId: q1, value: 4 }); // different value, truncates
    expect(state.followup).toBeNull();
  });

  it('NATURAL PROFILE INVALIDATION: confirming interpreted preferences discards a generic pending turn and releases its dimensions', () => {
    const pending = appReducer(initialAppState, { type: 'SET_PENDING_FOLLOWUP', followup: sampleFollowup });
    const next = appReducer(pending, {
      type: 'SET_ANSWER',
      questionId: 'climate',
      value: 'cold',
      provenance: 'ai_interpreted',
      confidence: 'high',
    });
    expect(next.followup).toBeNull();
    expect(next.askedDimensionIds).toEqual([]);
    expect(next.turnCount).toBe(0);
    expect(next.answers.climate).toBe('cold');
  });

  it('START_QUIZ/SYNC_QUIZ_PURPOSE/RESTART_ALL all reset followup/followupTurnsUsed/aiCallsUsed', () => {
    const dirty = { ...initialAppState, followup: sampleFollowup, followupTurnsUsed: 2, aiCallsUsed: 3 };
    expect(appReducer(dirty, { type: 'START_QUIZ', purpose: 'tourism' })).toMatchObject({ followup: null, followupTurnsUsed: 0, aiCallsUsed: 0 });
    expect(appReducer(dirty, { type: 'SYNC_QUIZ_PURPOSE', purpose: 'tourism' })).toMatchObject({ followup: null, followupTurnsUsed: 0, aiCallsUsed: 0 });
    expect(appReducer(dirty, { type: 'RESTART_ALL' })).toMatchObject({ followup: null, followupTurnsUsed: 0, aiCallsUsed: 0 });
  });
});

describe('Phase 16.5 TRUE adaptive-interview pass — interviewStatus/interviewComplete/turnCount/askedDimensionIds', () => {
  const sampleFollowup: PendingFollowup = {
    templateId: 'quietness_clarify',
    prompt: { ar: 'test ar', en: 'test en' },
    options: [
      { id: 'less_nightlife', label: { ar: 'أقل صخبًا', en: 'quieter' }, satisfies: { nightlife: 10 } },
      { id: 'nature_quiet', label: { ar: 'طبيعة هادئة', en: 'quiet nature' }, satisfies: { naturecity: 15 } },
    ],
    allowFreeText: true,
    candidateDimensionIds: ['nightlife', 'naturecity', 'adventure'],
    questionType: 'choice',
  };

  it('initial state starts active, incomplete, zero turns, nothing asked', () => {
    expect(initialAppState).toMatchObject({ interviewStatus: 'active', interviewComplete: false, turnCount: 0, askedDimensionIds: [] });
  });

  it('SET_PENDING_FOLLOWUP records every targetDimension as asked and bumps turnCount, whether or not it is ever resolved', () => {
    const next = appReducer(initialAppState, { type: 'SET_PENDING_FOLLOWUP', followup: sampleFollowup });
    expect(next.askedDimensionIds.sort()).toEqual(['adventure', 'naturecity', 'nightlife'].sort());
    expect(next.turnCount).toBe(1);
  });

  it('SET_PENDING_FOLLOWUP never records the same dimension twice across turns', () => {
    let state = appReducer(initialAppState, { type: 'SET_PENDING_FOLLOWUP', followup: sampleFollowup });
    state = appReducer(state, { type: 'DISMISS_FOLLOWUP' });
    const other = { ...sampleFollowup, candidateDimensionIds: ['naturecity', 'culture'] };
    state = appReducer(state, { type: 'SET_PENDING_FOLLOWUP', followup: other });
    expect(state.askedDimensionIds.sort()).toEqual(['adventure', 'culture', 'naturecity', 'nightlife'].sort());
    expect(state.turnCount).toBe(2);
  });

  it('SET_INTERVIEW_FALLBACK is one-way, clears any pending follow-up, and is a true no-op once already fallback', () => {
    const withFollowup = { ...initialAppState, followup: sampleFollowup };
    const next = appReducer(withFollowup, { type: 'SET_INTERVIEW_FALLBACK' });
    expect(next.interviewStatus).toBe('fallback');
    expect(next.followup).toBeNull();
    const again = appReducer(next, { type: 'SET_INTERVIEW_FALLBACK' });
    expect(again).toBe(next);
  });

  it('SET_INTERVIEW_COMPLETE sets interviewComplete and is a true no-op once already complete', () => {
    const next = appReducer(initialAppState, { type: 'SET_INTERVIEW_COMPLETE' });
    expect(next.interviewComplete).toBe(true);
    const again = appReducer(next, { type: 'SET_INTERVIEW_COMPLETE' });
    expect(again).toBe(next);
  });

  it('EDIT INVALIDATION: REMOVE_AI_ANSWER un-asks the dimension and reopens a completed interview', () => {
    let state: typeof initialAppState = { ...initialAppState, interviewComplete: true, askedDimensionIds: ['naturecity'] };
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_followup' });
    const next = appReducer(state, { type: 'REMOVE_AI_ANSWER', questionId: 'naturecity' });
    expect(next.answers.naturecity).toBeUndefined();
    expect(next.askedDimensionIds).not.toContain('naturecity');
    expect(next.interviewComplete).toBe(false);
  });

  it('START_QUIZ/SYNC_QUIZ_PURPOSE/RESTART_ALL all reset interviewStatus/interviewComplete/turnCount/askedDimensionIds', () => {
    const dirty = { ...initialAppState, interviewStatus: 'fallback' as const, interviewComplete: true, turnCount: 5, askedDimensionIds: ['climate'] };
    const fresh = { interviewStatus: 'active', interviewComplete: false, turnCount: 0, askedDimensionIds: [] };
    expect(appReducer(dirty, { type: 'START_QUIZ', purpose: 'tourism' })).toMatchObject(fresh);
    expect(appReducer(dirty, { type: 'SYNC_QUIZ_PURPOSE', purpose: 'tourism' })).toMatchObject(fresh);
    expect(appReducer(dirty, { type: 'RESTART_ALL' })).toMatchObject(fresh);
  });
});
