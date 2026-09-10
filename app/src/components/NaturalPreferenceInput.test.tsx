// Phase 16 — AI API Integration, Capability A. Tests the optional
// free-text box's own behavior end-to-end against the real reducer:
// submit -> proposed answers -> review/select -> Apply dispatches
// SET_ANSWER (never auto-applies), plus the fallback UX for every
// aiService result status. aiService itself (its real env-gating,
// fetch/validation logic) is already fully covered by
// ai/aiService.test.ts — here it's mocked so each test can drive an
// exact InterpretPreferencesResult without touching the network or
// import.meta.env timing.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { NaturalPreferenceInput } from './NaturalPreferenceInput';
import { interpretPreferences } from '../ai/aiService';
import { QUESTION_BANKS } from '../data/questionBanks';

vi.mock('../ai/aiService', () => ({ interpretPreferences: vi.fn() }));

const mockInterpret = vi.mocked(interpretPreferences);
const questions = QUESTION_BANKS.tourism;

function renderWith(dispatchSpy?: (a: unknown) => void) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    const wrappedDispatch: typeof dispatch = (action) => {
      dispatchSpy?.(action);
      dispatch(action);
    };
    return <AppStateContext.Provider value={{ state, dispatch: wrappedDispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <NaturalPreferenceInput questions={questions} />
    </Providers>,
  );
}

function typeAndSubmit(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /اقترح إجابات/ }));
}

describe('NaturalPreferenceInput', () => {
  it('the submit button stays disabled until text is entered', () => {
    renderWith();
    const button = screen.getByRole('button', { name: /اقترح إجابات/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'أبغى دولة باردة' } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('AI unavailable: shows the graceful fallback message and never dispatches SET_ANSWER', async () => {
    mockInterpret.mockResolvedValue({ status: 'unavailable', reason: 'not configured' });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('أبغى دولة باردة');
    await waitFor(() => expect(screen.getByText(/غير متاحة حاليًا/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('AI service error: shows the graceful error message, never dispatches SET_ANSWER, never crashes', async () => {
    mockInterpret.mockResolvedValue({ status: 'error', message: 'upstream failure' });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('أبغى دولة باردة');
    await waitFor(() => expect(screen.getByText(/تعذّر تحليل النص/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('a valid interpretation is shown as a reviewable proposal, and only Apply dispatches SET_ANSWER (with the exact interpreted value)', async () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    const coldValue = climateQuestion.options[0].value;
    mockInterpret.mockResolvedValue({
      status: 'ok',
      interpreted: [{ questionId: 'climate', value: coldValue, confidence: 'medium' }],
      unmapped: [],
    });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('أبغى دولة باردة');

    await waitFor(() => expect(screen.getByText(/إجابات مقترحة/)).toBeInTheDocument());
    // Proposal shown but NOT yet applied.
    expect(dispatchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /تطبيق المحدد/ }));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'SET_ANSWER', questionId: 'climate', value: coldValue });
  });

  it('unchecking a proposal before Apply excludes it from what gets dispatched', async () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    mockInterpret.mockResolvedValue({
      status: 'ok',
      interpreted: [{ questionId: 'climate', value: climateQuestion.options[0].value, confidence: 'low' }],
      unmapped: [],
    });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('شيء ما');
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox')); // uncheck the only proposal
    fireEvent.click(screen.getByRole('button', { name: /تطبيق المحدد/ }));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_ANSWER' }));
  });

  it('nothing mappable: shows the graceful "none found" message, no crash, no dispatch', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: ['شيء غامض'] });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('شيء غامض');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('never calls interpretPreferences more than once per submit click (no duplicate-call regression)', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderWith();
    typeAndSubmit('نص عام');
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
  });
});
