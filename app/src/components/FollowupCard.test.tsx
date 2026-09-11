// Phase 16.5 completion pass — FollowupCard: bounded hybrid (choice +
// scoped free-text) contextual clarification rendering.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { FollowupCard } from './FollowupCard';
import { interpretPreferences } from '../ai/aiService';
import type { AppState, PendingFollowup } from '../state/types';

vi.mock('../ai/aiService', () => ({ interpretPreferences: vi.fn(), MAX_AI_CALLS_PER_INTERVIEW: 3 }));
const mockInterpret = vi.mocked(interpretPreferences);

const followup: PendingFollowup = {
  templateId: 'quietness_clarify',
  prompt: { ar: 'أي تجربة أقرب لك؟', en: 'Which experience is closest?' },
  options: [
    { id: 'less_nightlife', label: { ar: 'أقل صخبًا', en: 'Quieter' }, satisfies: { nightlife: 10 } },
    { id: 'nature_quiet', label: { ar: 'طبيعة هادئة', en: 'Quiet nature' }, satisfies: { naturecity: 15 } },
  ],
  allowFreeText: true,
  candidateDimensionIds: ['nightlife', 'naturecity', 'adventure'],
  questionType: 'choice',
};

function renderWith(dispatchSpy?: (a: unknown) => void, presetState?: Partial<AppState>) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, followup, ...presetState });
    const wrapped: typeof dispatch = (action) => {
      dispatchSpy?.(action);
      dispatch(action);
    };
    return <AppStateContext.Provider value={{ state, dispatch: wrapped }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <FollowupCard purposeId="tourism" followup={followup} />
    </Providers>,
  );
}

describe('FollowupCard', () => {
  it('renders the prompt and every option label', () => {
    renderWith();
    expect(screen.getByText('أي تجربة أقرب لك؟')).toBeInTheDocument();
    expect(screen.getByText('أقل صخبًا')).toBeInTheDocument();
    expect(screen.getByText('طبيعة هادئة')).toBeInTheDocument();
  });

  it('CHOICE: resolves immediately when the traveler selects an option', () => {
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    const option = screen.getByRole('radio', { name: 'طبيعة هادئة' });
    fireEvent.click(option);
    expect(option).toHaveAttribute('aria-checked', 'true');
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: 'nature_quiet' });
    expect(screen.queryByRole('button', { name: 'التالي' })).toBeNull();
  });

  it('CHOICE: preserves the current question while the next AI turn is advancing', () => {
    function Providers({ children }: { children: ReactNode }) {
      return <AppStateContext.Provider value={{ state: { ...initialAppState, followup }, dispatch: vi.fn() }}>{children}</AppStateContext.Provider>;
    }
    render(
      <Providers>
        <FollowupCard purposeId="tourism" followup={followup} advancing />
      </Providers>,
    );
    expect(screen.getByText('أي تجربة أقرب لك؟')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('radio').every((option) => (option as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('جارٍ تحضير السؤال التالي');
    expect(document.querySelector('.ai-turn-loading')).toBeNull();
  });

  it('BUDGET: renders the original canonical numeric ranges instead of AI-authored qualitative labels', () => {
    const budgetFollowup: PendingFollowup = {
      templateId: 'ai-turn-budget',
      prompt: { ar: 'ما الميزانية المناسبة لهذه الرحلة؟', en: 'What budget fits this trip?' },
      options: [
        {
          id: 'budget-1',
          label: { ar: 'منخفضة', en: 'Low' },
          desc: { ar: 'حتى 5,000 ريال', en: 'Up to 5,000 SAR' },
          satisfies: { budget: 1 },
        },
      ],
      allowFreeText: false,
      candidateDimensionIds: ['budget'],
      questionType: 'choice',
    };
    render(
      <AppStateContext.Provider value={{ state: { ...initialAppState, followup: budgetFollowup }, dispatch: vi.fn() }}>
        <FollowupCard purposeId="tourism" followup={budgetFollowup} />
      </AppStateContext.Provider>,
    );
    expect(screen.getByText('حتى 5,000 ريال')).toBeInTheDocument();
  });

  it('SKIP dispatches DISMISS_FOLLOWUP', () => {
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    fireEvent.click(screen.getByText('تخطي'));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'DISMISS_FOLLOWUP' });
  });

  it('FREE TEXT: the escape hatch is bounded (maxLength set) and hidden until toggled', () => {
    renderWith();
    expect(screen.queryByPlaceholderText(/أماكن ما فيها ناس/)).toBeNull();
    fireEvent.click(screen.getByText(/ولا شيء من هذا/));
    const textarea = screen.getByPlaceholderText(/أماكن ما فيها ناس/) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.maxLength).toBeLessThanOrEqual(120);
  });

  it('FREE TEXT: submitting calls interpretPreferences scoped to ONLY this follow-up\'s candidate dimensions', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [{ questionId: 'nightlife', value: 10, confidence: 'high' }], unmapped: [] });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    fireEvent.click(screen.getByText(/ولا شيء من هذا/));
    fireEvent.change(screen.getByPlaceholderText(/أماكن ما فيها ناس/), { target: { value: 'أبغى مكان بدون ازدحام' } });
    fireEvent.click(screen.getByText('إرسال'));
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
    const sentQuestions = mockInterpret.mock.calls[0]?.[2] as Array<{ id: string }>;
    expect(sentQuestions.map((q) => q.id).sort()).toEqual(['adventure', 'naturecity', 'nightlife'].sort());
    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_ANSWER', questionId: 'nightlife', value: 10, provenance: 'ai_followup' }),
      ),
    );
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'DISMISS_FOLLOWUP' });
  });

  it('FREE TEXT: a low-confidence result is NOT applied (same confidence rule as the main card)', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [{ questionId: 'nightlife', value: 10, confidence: 'low' }], unmapped: [] });
    const dispatchSpy = vi.fn();
    renderWith(dispatchSpy);
    fireEvent.click(screen.getByText(/ولا شيء من هذا/));
    fireEvent.change(screen.getByPlaceholderText(/أماكن ما فيها ناس/), { target: { value: 'مش متأكد بالضبط' } });
    fireEvent.click(screen.getByText('إرسال'));
    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(1));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_ANSWER' }));
  });

  it('FREE TEXT: FALLBACK — an AI failure shows an error and does not loop or crash; user can still skip', async () => {
    mockInterpret.mockResolvedValue({ status: 'error', message: 'upstream failure' });
    renderWith();
    fireEvent.click(screen.getByText(/ولا شيء من هذا/));
    fireEvent.change(screen.getByPlaceholderText(/أماكن ما فيها ناس/), { target: { value: 'نص عام' } });
    fireEvent.click(screen.getByText('إرسال'));
    await waitFor(() => expect(screen.getByText(/تعذّر فهم النص الآن/)).toBeInTheDocument());
    expect(screen.getByText('تخطي')).toBeInTheDocument(); // still escapable
  });

  it('AI CALL BUDGET: free-text submit is disabled once the interview\'s AI call budget is exhausted', () => {
    renderWith(undefined, { aiCallsUsed: 3 });
    fireEvent.click(screen.getByText(/ولا شيء من هذا/));
    fireEvent.change(screen.getByPlaceholderText(/أماكن ما فيها ناس/), { target: { value: 'نص' } });
    expect(screen.getByText('إرسال')).toHaveProperty('disabled', true);
  });
});

describe('FollowupCard — Phase 16.5 TRUE adaptive-interview pass — questionType: \'free_text\' (Section 10 — primary, not a secondary escape hatch)', () => {
  const freeTextFollowup: PendingFollowup = {
    templateId: 'ai-turn-1',
    prompt: { ar: 'كيف تحب أن يكون الاختلاف؟', en: 'How different would you like it?' },
    options: [],
    allowFreeText: true,
    candidateDimensionIds: ['culture'],
    questionType: 'free_text',
  };

  function renderFreeText(dispatchSpy?: (a: unknown) => void) {
    function Providers({ children }: { children: import('react').ReactNode }) {
      const [state, dispatch] = useReducer(appReducer, { ...initialAppState, followup: freeTextFollowup });
      const wrapped: typeof dispatch = (action) => {
        dispatchSpy?.(action);
        dispatch(action);
      };
      return <AppStateContext.Provider value={{ state, dispatch: wrapped }}>{children}</AppStateContext.Provider>;
    }
    return render(
      <Providers>
        <FollowupCard purposeId="tourism" followup={freeTextFollowup} />
      </Providers>,
    );
  }

  it('the free-text input is immediately visible — no toggle needed, and no toggle button rendered at all', () => {
    renderFreeText();
    expect(screen.getByPlaceholderText(/اكتب إجابتك بكلماتك/)).toBeInTheDocument();
    expect(screen.queryByText(/ولا شيء من هذا/)).toBeNull();
  });

  it('no choice options render (options is empty for a free_text turn)', () => {
    renderFreeText();
    expect(document.querySelector('.ai-followup-options')).toBeNull();
  });

  it('submitting still goes through the same scoped interpretPreferences + SET_ANSWER(ai_followup) flow as a choice-type follow-up', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [{ questionId: 'culture', value: 50, confidence: 'high' }], unmapped: [] });
    const dispatchSpy = vi.fn();
    renderFreeText(dispatchSpy);
    fireEvent.change(screen.getByPlaceholderText(/اكتب إجابتك بكلماتك/), { target: { value: 'أبغى بعض الاختلاف' } });
    fireEvent.click(screen.getByText('إرسال'));
    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_ANSWER', questionId: 'culture', value: 50, provenance: 'ai_followup' })),
    );
  });

  it('Skip still works exactly as for a choice-type follow-up', () => {
    const dispatchSpy = vi.fn();
    renderFreeText(dispatchSpy);
    fireEvent.click(screen.getByText('تخطي'));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'DISMISS_FOLLOWUP' });
  });
});
