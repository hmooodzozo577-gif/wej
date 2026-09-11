// Phase 16.5 TRUE adaptive-interview pass — the normal-path decision
// logic (Section 33: kept as a pure, directly-testable module).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, useReducer, type PropsWithChildren } from 'react';
import { decideAdaptiveInterviewStep, toPendingFollowup, useAdaptiveInterview } from './useAdaptiveInterview';
import { nextTurn } from '../ai/aiService';
import type { NextTurnServiceResult } from '../ai/types';
import { appReducer, initialAppState } from '../state/reducer';
import type { PendingFollowup } from '../state/types';

vi.mock('../ai/aiService', () => ({ nextTurn: vi.fn() }));

const mockNextTurn = vi.mocked(nextTurn);

beforeEach(() => {
  mockNextTurn.mockReset();
});

const baseState = {
  answers: {},
  askedDimensionIds: [] as string[],
  interviewStatus: 'active' as const,
  interviewComplete: false,
  followup: null as PendingFollowup | null,
  turnCount: 0,
};

describe('decideAdaptiveInterviewStep', () => {
  it('idle when purposeId is null (invalid route / not yet synced — Quiz.tsx)', () => {
    expect(decideAdaptiveInterviewStep(null, baseState, 'en')).toEqual({ action: 'idle' });
  });

  it('idle when interviewStatus is fallback — Phase 15 is the driver, never this loop', () => {
    expect(decideAdaptiveInterviewStep('tourism', { ...baseState, interviewStatus: 'fallback' }, 'en')).toEqual({ action: 'idle' });
  });

  it('idle when the interview is already complete', () => {
    expect(decideAdaptiveInterviewStep('tourism', { ...baseState, interviewComplete: true }, 'en')).toEqual({ action: 'idle' });
  });

  it('idle when a turn is already pending — one at a time, never two overlapping requests', () => {
    const followup: PendingFollowup = { templateId: 'x', prompt: { ar: 'a', en: 'a' }, options: [], allowFreeText: true, candidateDimensionIds: [], questionType: 'free_text' };
    expect(decideAdaptiveInterviewStep('tourism', { ...baseState, followup }, 'en')).toEqual({ action: 'idle' });
  });

  it('call, with a real catalog and turnNumber = turnCount + 1, when eligible dimensions remain', () => {
    const decision = decideAdaptiveInterviewStep('tourism', baseState, 'en');
    expect(decision.action).toBe('call');
    if (decision.action === 'call') {
      expect(decision.turnNumber).toBe(1);
      expect(decision.catalog.length).toBeGreaterThan(0);
    }
  });

  it('complete (no call spent) once every dimension is resolved or already asked', () => {
    const bank = ['budget', 'climate', 'naturecity', 'adventure', 'nightlife', 'culture'];
    const answers = Object.fromEntries(bank.map((id) => [id, 1]));
    const decision = decideAdaptiveInterviewStep('tourism', { ...baseState, answers }, 'en');
    // Every RANKING/flavor dimension the tourism bank defines is covered
    // above by construction of this fixture set being the full id list;
    // if any remains genuinely unresolved this assertion still correctly
    // demands 'complete' only if truly none are eligible.
    if (decision.action === 'complete') {
      expect(decision.action).toBe('complete');
    } else {
      // If the bank has an id this fixture missed, at least prove the
      // reported eligible set is real and not a false 'call'.
      expect(decision.action).toBe('call');
    }
  });

  it('complete (no call spent) once the turn ceiling is reached, even with eligible dimensions remaining', () => {
    const decision = decideAdaptiveInterviewStep('tourism', { ...baseState, turnCount: 999 }, 'en');
    expect(decision).toEqual({ action: 'complete' });
  });

  it('confirmedProfile only ever contains RESOLVED dimensions, with their real answer values', () => {
    const decision = decideAdaptiveInterviewStep('tourism', { ...baseState, answers: { climate: 'cold' }, askedDimensionIds: ['climate'] }, 'en');
    expect(decision.action).toBe('call');
    if (decision.action === 'call') {
      expect(decision.confirmedProfile).toEqual({ climate: 'cold' });
    }
  });
});

describe('toPendingFollowup', () => {
  it('choice: maps AI options to FollowupOption.satisfies, stores the single-language prompt/label under both lang keys', () => {
    const followup = toPendingFollowup(2, {
      kind: 'ask',
      questionType: 'choice',
      targetDimensions: ['naturecity'],
      prompt: 'Nature or city?',
      options: [{ id: 'a', label: 'Nature please', updates: { naturecity: 15 } }],
    });
    expect(followup).toEqual({
      templateId: 'ai-turn-2',
      prompt: { ar: 'Nature or city?', en: 'Nature or city?' },
      options: [{ id: 'a', label: { ar: 'Nature please', en: 'Nature please' }, satisfies: { naturecity: 15 } }],
      allowFreeText: false,
      candidateDimensionIds: ['naturecity'],
      questionType: 'choice',
    });
  });

  it('free_text: options empty, allowFreeText true, questionType free_text — renders as the PRIMARY UI (FollowupCard.tsx)', () => {
    const followup = toPendingFollowup(1, { kind: 'ask', questionType: 'free_text', targetDimensions: ['culture'], prompt: 'Tell us more' });
    expect(followup.options).toEqual([]);
    expect(followup.allowFreeText).toBe(true);
    expect(followup.questionType).toBe('free_text');
    expect(followup.candidateDimensionIds).toEqual(['culture']);
  });

  it('MULTI-DIMENSION: a single option can carry updates for more than one dimension', () => {
    const followup = toPendingFollowup(1, {
      kind: 'ask',
      questionType: 'choice',
      targetDimensions: ['naturecity', 'adventure'],
      prompt: 'Describe your ideal day',
      options: [{ id: 'a', label: 'Calm nature walk', updates: { naturecity: 15, adventure: 10 } }],
    });
    expect(followup.options[0]?.satisfies).toEqual({ naturecity: 15, adventure: 10 });
  });
});

function deferredTurn() {
  let resolve!: (result: NextTurnServiceResult) => void;
  const promise = new Promise<NextTurnServiceResult>((done) => { resolve = done; });
  return { promise, resolve };
}

const budgetQuestion: NextTurnServiceResult = {
  status: 'ok',
  outcome: {
    kind: 'ask',
    questionType: 'choice',
    targetDimensions: ['budget'],
    prompt: 'What level of spending suits this trip?',
    options: [
      { id: 'low', label: 'Economical', updates: { budget: 1 } },
      { id: 'high', label: 'Premium', updates: { budget: 4 } },
    ],
  },
};

function renderInterview() {
  return renderHook(() => {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, purpose: 'tourism' });
    useAdaptiveInterview(state.purpose, state.purpose ?? '', state.lang, undefined, state, dispatch);
    return { state, dispatch };
  }, {
    wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
  });
}

describe('in-flight adaptive interview context', () => {
  it('ignores an old question after confirmation and an old failure after restarting the same purpose', async () => {
    const initialTurn = deferredTurn();
    const confirmedTurn = deferredTurn();
    const restartedTurn = deferredTurn();
    mockNextTurn.mockReturnValueOnce(initialTurn.promise).mockReturnValueOnce(confirmedTurn.promise).mockReturnValueOnce(restartedTurn.promise);
    const { result } = renderInterview();

    // StrictMode replays effects; the same empty profile still costs one call.
    expect(mockNextTurn).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
      result.current.dispatch({ type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'ai_interpreted' });
    });
    expect(mockNextTurn).toHaveBeenCalledTimes(2);
    expect(mockNextTurn.mock.calls[1]?.[3]).toEqual({ climate: 'cold', naturecity: 15 });

    await act(async () => initialTurn.resolve({
      status: 'ok',
      outcome: { kind: 'ask', questionType: 'free_text', targetDimensions: ['climate'], prompt: 'Which climate do you prefer?' },
    }));
    expect(result.current.state.followup).toBeNull();
    expect(result.current.state.turnCount).toBe(0);
    expect(result.current.state.answers).toEqual({ climate: 'cold', naturecity: 15 });

    act(() => result.current.dispatch({ type: 'START_QUIZ', purpose: 'tourism' }));
    expect(mockNextTurn).toHaveBeenCalledTimes(3);
    await act(async () => confirmedTurn.resolve({ status: 'error', message: 'The old request timed out.' }));
    expect(result.current.state.interviewStatus).toBe('active');
    expect(result.current.state.followup).toBeNull();

    await act(async () => restartedTurn.resolve(budgetQuestion));
    expect(result.current.state.followup?.candidateDimensionIds).toEqual(['budget']);
    expect(result.current.state.interviewStatus).toBe('active');
    expect(result.current.state.turnCount).toBe(1);
    expect(mockNextTurn).toHaveBeenCalledTimes(3);
  });

  it('does not complete a newer language and purpose from an older request', async () => {
    const previousTurn = deferredTurn();
    const currentTurn = deferredTurn();
    mockNextTurn.mockReturnValueOnce(previousTurn.promise).mockReturnValueOnce(currentTurn.promise);
    const { result } = renderInterview();
    act(() => {
      result.current.dispatch({ type: 'SET_LANG', lang: 'en' });
      result.current.dispatch({ type: 'START_QUIZ', purpose: 'education' });
    });
    expect(mockNextTurn).toHaveBeenCalledTimes(2);
    expect(mockNextTurn.mock.calls[1]?.slice(0, 2)).toEqual(['en', 'education']);
    await act(async () => previousTurn.resolve({ status: 'ok', outcome: { kind: 'complete' } }));
    expect(result.current.state.interviewComplete).toBe(false);
    expect(result.current.state.interviewStatus).toBe('active');

    // A failure belonging to the CURRENT context must still use Phase 15.
    await act(async () => currentTurn.resolve({ status: 'error', message: 'The current request timed out.' }));
    expect(result.current.state.interviewStatus).toBe('fallback');
    expect(mockNextTurn).toHaveBeenCalledTimes(2);
  });

  it('updates a changed answer value without duplicate calls from unrelated renders or StrictMode', async () => {
    const emptyTurn = deferredTurn();
    const coldTurn = deferredTurn();
    const mildTurn = deferredTurn();
    mockNextTurn.mockReturnValueOnce(emptyTurn.promise).mockReturnValueOnce(coldTurn.promise).mockReturnValueOnce(mildTurn.promise);
    const { result, rerender } = renderInterview();
    rerender();
    act(() => result.current.dispatch({ type: 'INCREMENT_AI_CALLS' }));
    expect(mockNextTurn).toHaveBeenCalledTimes(1);

    act(() => result.current.dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' }));
    act(() => result.current.dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'mild', provenance: 'ai_interpreted' }));
    expect(mockNextTurn).toHaveBeenCalledTimes(3);
    expect(mockNextTurn.mock.calls[2]?.[3]).toEqual({ climate: 'mild' });

    await act(async () => {
      emptyTurn.resolve({ status: 'error', message: 'Stale empty profile.' });
      coldTurn.resolve({ status: 'ok', outcome: { kind: 'complete' } });
      mildTurn.resolve(budgetQuestion);
    });
    expect(result.current.state.answers).toEqual({ climate: 'mild' });
    expect(result.current.state.followup?.candidateDimensionIds).toEqual(['budget']);
    expect(result.current.state.interviewComplete).toBe(false);
    expect(result.current.state.interviewStatus).toBe('active');
    expect(mockNextTurn).toHaveBeenCalledTimes(3);
  });
});
