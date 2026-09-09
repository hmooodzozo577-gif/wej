import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from './reducer';

describe('appReducer', () => {
  it('defaults to Arabic', () => {
    expect(initialAppState.lang).toBe('ar');
  });

  it('START_QUIZ resets qIndex/answers/results and sets purpose', () => {
    const dirty = { ...initialAppState, qIndex: 3, answers: { a: 1 }, results: [] as never[] };
    const next = appReducer(dirty, { type: 'START_QUIZ', purpose: 'tourism' });
    expect(next).toMatchObject({ purpose: 'tourism', qIndex: 0, answers: {}, results: null });
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

  it('NEXT_QUESTION increments, PREV_QUESTION decrements but never below 0', () => {
    let state = appReducer(initialAppState, { type: 'NEXT_QUESTION' });
    state = appReducer(state, { type: 'NEXT_QUESTION' });
    expect(state.qIndex).toBe(2);
    state = appReducer(state, { type: 'PREV_QUESTION' });
    expect(state.qIndex).toBe(1);
    state = appReducer(initialAppState, { type: 'PREV_QUESTION' });
    expect(state.qIndex).toBe(0);
  });

  it('RESTART_ALL clears purpose/answers/results but preserves lang', () => {
    const dirty = { ...initialAppState, lang: 'en' as const, purpose: 'work' as const, qIndex: 2 };
    const next = appReducer(dirty, { type: 'RESTART_ALL' });
    expect(next).toMatchObject({ lang: 'en', purpose: null, qIndex: 0, answers: {}, results: null });
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
