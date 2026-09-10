// Phase 16 — AI API Integration, Capability A. Phase 16.5 — confirmed
// interpretations now genuinely remove their question from the
// interview (provenance:'ai_interpreted'), gated by confidence
// (low-confidence proposals start unchecked, never silently applied),
// with a persistent "already accounted for" list that can be removed
// (restoring the question). aiService itself is mocked — its real
// env-gating/fetch/validation logic is covered by ai/aiService.test.ts.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { NaturalPreferenceInput } from './NaturalPreferenceInput';
import { interpretPreferences } from '../ai/aiService';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { AppState } from '../state/types';

vi.mock('../ai/aiService', () => ({ interpretPreferences: vi.fn() }));

const mockInterpret = vi.mocked(interpretPreferences);
const questions = QUESTION_BANKS.tourism;

function renderWith(dispatchSpy?: (a: unknown) => void, presetState?: Partial<AppState>) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, ...presetState });
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
  fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
}

describe('NaturalPreferenceInput', () => {
  it('the submit button stays disabled until text is entered', () => {
    renderWith();
    const button = screen.getByRole('button', { name: /فهم تفضيلاتي/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'أبغى دولة باردة' } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('AI unavailable: shows the graceful fallback message and never dispatches', async () => {
    mockInterpret.mockResolvedValue({ status: 'unavailable', reason: 'not configured' });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('أبغى دولة باردة');
    await waitFor(() => expect(screen.getByText(/غير متاحة حاليًا/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('AI service error: shows the graceful error message, never dispatches, never crashes', async () => {
    mockInterpret.mockResolvedValue({ status: 'error', message: 'upstream failure' });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('أبغى دولة باردة');
    await waitFor(() => expect(screen.getByText(/تعذّر فهم النص/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('only sends questions NOT already answered — never asks the AI about a dimension already known', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderWith(undefined, { answers: { budget: 1 } });
    typeAndSubmit('نص عام');
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
    const sentQuestions = mockInterpret.mock.calls[0]?.[2] as Array<{ id: string }>;
    expect(sentQuestions.some((q) => q.id === 'budget')).toBe(false);
    expect(sentQuestions.some((q) => q.id === 'climate')).toBe(true);
  });

  // Phase 16.5 correction pass — real production bug: the payload sent
  // to the AI carried bare option values (e.g. [15, 50, 90] for
  // naturecity) with no label, so the model had nothing to ground a
  // numeric direction in and guessed backwards for an explicit "فيها
  // طبيعة" (nature) statement. This proves the fix at the boundary
  // where the request is actually built.
  it('BUG FIX: every option sent to the AI carries its label, not a bare value — the root cause of the real nature/city inversion', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderWith(undefined);
    typeAndSubmit('نص عام');
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
    const sentQuestions = mockInterpret.mock.calls[0]?.[2] as Array<{ id: string; options: Array<{ value: string | number; label: string }> }>;
    const naturecity = sentQuestions.find((q) => q.id === 'naturecity')!;
    expect(naturecity).toBeDefined();
    // No bare numbers — every entry is a {value, label} pair, and the
    // label is genuinely human-readable Arabic text (this test renders
    // in Arabic), not the raw number restated as a string.
    for (const opt of naturecity.options) {
      expect(typeof opt.value === 'number' || typeof opt.value === 'string').toBe(true);
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.label).not.toBe(String(opt.value));
    }
    const natureOption = naturecity.options.find((o) => o.value === 15)!;
    const cityOption = naturecity.options.find((o) => o.value === 90)!;
    expect(natureOption.label).toContain('طبيعة');
    expect(cityOption.label).toContain('المدن');
  });

  it('a high/medium-confidence proposal is shown pre-checked; applying dispatches SET_ANSWER with provenance ai_interpreted', async () => {
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

    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', true);
    expect(dispatchSpy).not.toHaveBeenCalled(); // shown, not yet applied

    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'SET_ANSWER',
      questionId: 'climate',
      value: coldValue,
      provenance: 'ai_interpreted',
      confidence: 'medium',
    });
  });

  it('CONFIDENCE RULE: a low-confidence proposal starts UNCHECKED (never silently eliminates the question)', async () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    mockInterpret.mockResolvedValue({
      status: 'ok',
      interpreted: [{ questionId: 'climate', value: climateQuestion.options[0].value, confidence: 'low' }],
      unmapped: [],
    });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('ربما بارد، مو متأكد');
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());

    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(screen.getByText(/غير مؤكد/)).toBeInTheDocument();

    // Clicking Apply without touching the checkbox applies NOTHING —
    // the uncertain guess is never silently confirmed.
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_ANSWER' }));
  });

  it('a user CAN still manually check and apply a low-confidence proposal — explicit confirmation is always allowed', async () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    const value = climateQuestion.options[0].value;
    mockInterpret.mockResolvedValue({
      status: 'ok',
      interpreted: [{ questionId: 'climate', value, confidence: 'low' }],
      unmapped: [],
    });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('ربما بارد');
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'SET_ANSWER', questionId: 'climate', value, provenance: 'ai_interpreted', confidence: 'low' });
  });

  it('nothing mappable: shows the graceful "none found" message, no crash, no dispatch', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: ['شيء غامض'] });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    typeAndSubmit('شيء غامض');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('never calls interpretPreferences more than once per submit click', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderWith();
    typeAndSubmit('نص عام');
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
  });

  it('PERSISTENT BENEFIT: an already-satisfied (ai_interpreted) dimension is shown in the "already accounted for" list', () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    const value = climateQuestion.options[0].value;
    renderWith(undefined, {
      answers: { climate: value },
      satisfaction: { climate: 'ai_interpreted' },
    });
    expect(screen.getByText(/تم أخذ هذه التفضيلات بالحسبان/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(climateQuestion.text.ar))).toBeInTheDocument();
  });

  it('a DIRECT (non-AI) answer never appears in the "already accounted for" list', () => {
    renderWith(undefined, { answers: { climate: 'cold' }, satisfaction: { climate: 'direct' } });
    expect(screen.queryByText(/تم أخذ هذه التفضيلات بالحسبان/)).toBeNull();
  });

  it('REMOVAL: clicking remove on a satisfied item dispatches REMOVE_AI_ANSWER — restoring the question', () => {
    const climateQuestion = questions.find((q) => q.id === 'climate')!;
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy, {
      answers: { climate: climateQuestion.options[0].value },
      satisfaction: { climate: 'ai_interpreted' },
    });
    fireEvent.click(screen.getByRole('button', { name: /إزالة/ }));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'REMOVE_AI_ANSWER', questionId: 'climate' });
  });
});
