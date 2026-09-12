import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from './reducer';

describe('deterministic questionnaire reducer', () => {
  it('starts a purpose with one deterministic question and clean answers', () => {
    const state = appReducer({ ...initialAppState, answers: { stale: 1 } }, { type: 'START_QUIZ', purpose: 'tourism' });
    expect(state.purpose).toBe('tourism');
    expect(state.path).toHaveLength(1);
    expect(state.answers).toEqual({});
  });

  it('truncates a downstream branch when an earlier answer changes', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const first = state.path[0]!;
    state = appReducer(state, { type: 'SET_ANSWER', questionId: first, value: 1 });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    const second = state.path[1]!;
    state = appReducer(state, { type: 'SET_ANSWER', questionId: second, value: 50 });
    state = appReducer(state, { type: 'PREV_QUESTION' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: first, value: 4 });
    expect(state.path).toEqual([first]);
    expect(state.answers[second]).toBeUndefined();
  });

  it('continues from the checkpoint and records that it should not be shown again', () => {
    let state = appReducer(initialAppState, { type: 'START_QUIZ', purpose: 'tourism' });
    const first = state.path[0]!;
    state = appReducer(state, { type: 'SET_ANSWER', questionId: first, value: 1 });
    const continued = appReducer(state, { type: 'CONTINUE_QUESTIONS' });
    expect(continued.questionnaireCheckpointPassed).toBe(true);
    expect(continued.path.length).toBe(2);
  });

  it('keeps precise location in memory and clears it on reset', () => {
    const granted = appReducer(initialAppState, { type: 'LOCATION_GRANTED', coords: { lat: 24.7, lng: 46.7 } });
    expect(granted.location.status).toBe('granted');
    expect(appReducer(granted, { type: 'LOCATION_RESET' }).location).toEqual({ status: 'idle', coords: null });
  });
});
