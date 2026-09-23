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
    expect(appReducer(granted, { type: 'LOCATION_RESET' }).location).toEqual({ status: 'idle', coords: null, diagnostic: null });
  });
});

describe('Explore sort choice (Phase 18 acceptance)', () => {
  it('marks a sort as explicitly chosen only when the sort itself changes', () => {
    const filtered = appReducer(initialAppState, { type: 'SET_EXPLORE_FILTER', key: 'region', value: 'Europe' });
    expect(filtered.exploreSortChosen).toBe(false);
    const chosen = appReducer(filtered, { type: 'SET_EXPLORE_FILTER', key: 'sort', value: 'name-asc' });
    expect(chosen.exploreSortChosen).toBe(true);
    expect(chosen.explore.sort).toBe('name-asc');
  });

  it('returns to the automatic default sort without touching other filters', () => {
    let state = appReducer(initialAppState, { type: 'SET_EXPLORE_FILTER', key: 'region', value: 'Asia' });
    state = appReducer(state, { type: 'SET_EXPLORE_FILTER', key: 'sort', value: 'personal-asc' });
    state = appReducer(state, { type: 'RESET_EXPLORE_SORT' });
    expect(state.explore).toEqual({ ...initialAppState.explore, region: 'Asia', sort: 'default' });
    expect(state.exploreSortChosen).toBe(false);
  });

  it('keeps Explore filters and sort through a questionnaire restart', () => {
    let state = appReducer(initialAppState, { type: 'SET_EXPLORE_FILTER', key: 'sort', value: 'cost-asc' });
    state = appReducer(state, { type: 'RESTART_ALL' });
    expect(state.explore.sort).toBe('cost-asc');
    expect(state.exploreSortChosen).toBe(true);
  });
});
