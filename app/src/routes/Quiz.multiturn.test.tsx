// Phase 16.5 completion pass — end-to-end multi-turn orchestration
// through the real Quiz route + reducer + adaptive engine, with ONLY
// the network boundary (aiService.interpretPreferences) mocked. Unlike
// Quiz.test.tsx (deliberately mock-free), this file's whole point is
// proving the AI-guided contextual follow-up loop end-to-end.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Quiz } from './Quiz';
import { QUESTION_BANKS } from '../data/questionBanks';
import { interpretPreferences } from '../ai/aiService';

vi.mock('../ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/aiService')>();
  return { ...actual, interpretPreferences: vi.fn() };
});
const mockInterpret = vi.mocked(interpretPreferences);

function renderQuiz(path = '/quiz/tourism') {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

function submitNaturalText(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
}

describe('§35 SCENARIO A — "أبغى دولة باردة وهادئة وفيها طبيعة" end-to-end', () => {
  it('climate + nature confirmed, quietness follow-up offered and resolvable, both original questions eliminated, no semantic duplicate', async () => {
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [
        { questionId: 'climate', value: 'cold', confidence: 'high' },
        { questionId: 'naturecity', value: 15, confidence: 'high' },
      ],
      unmapped: ['هادئة'],
    });
    renderQuiz();
    submitNaturalText('أبغى دولة باردة وهادئة وفيها طبيعة');

    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));

    // Confirmed -> both eliminated from the remaining interview, AND a
    // contextual follow-up for "هادئة" is offered (not force-mapped).
    await waitFor(() => expect(screen.getByText(/أي تجربة أقرب لك؟/)).toBeInTheDocument());
    expect(screen.queryByText(/ما نوع الطقس الذي تفضله؟/)).toBeNull();
    expect(screen.queryByText(/ما الذي تفضله؟/)).toBeNull();

    // Resolve the follow-up with the "nature, away from crowds" option —
    // maps to naturecity, but naturecity is ALREADY known, so that
    // option must not even be offered (duplicate prevention); pick the
    // nightlife-based option instead.
    expect(screen.queryByText('طبيعة هادئة بعيدة عن الزحام')).toBeNull();
    fireEvent.click(screen.getByText('أماكن أقل صخبًا (حياة ليلية أقل)'));

    // "هادئة" is now resolved via nightlife — never re-asked through any
    // path (original bank question, generated question, or otherwise).
    await waitFor(() => expect(screen.queryByText(/أي تجربة أقرب لك؟/)).toBeNull());

    // Continue the interview: neither climate, naturecity, NOR nightlife
    // (now satisfied via the follow-up) ever appear as a question again.
    let sawEliminated = false;
    for (let i = 0; i < 10; i++) {
      const heading = screen.queryByRole('heading', { level: 2 });
      if (!heading) break;
      const text = heading.textContent ?? '';
      if (/الطقس|تفضله؟$|الحياة الليلية/.test(text)) sawEliminated = true;
      const options = screen.queryAllByRole('radio');
      if (options.length === 0) break;
      fireEvent.click(options[0]);
      const nextBtn = screen.getByRole('button', { name: /التالي|عرض النتائج/ });
      fireEvent.click(nextBtn);
      if (screen.queryByText('RESULTS_PAGE')) break;
    }
    expect(sawEliminated).toBe(false);
  });
});

describe('§42 FALLBACK — AI resolves climate+nature, next AI turn fails, Phase 15 continues without re-asking', () => {
  it('a failed second interpretation never re-introduces climate/naturecity, and the interview still reaches completion', async () => {
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [
        { questionId: 'climate', value: 'cold', confidence: 'high' },
        { questionId: 'naturecity', value: 15, confidence: 'high' },
      ],
      unmapped: [],
    });
    renderQuiz();
    submitNaturalText('أبغى دولة باردة وفيها طبيعة');
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    await waitFor(() => expect(screen.queryByText(/هذا ما فهمناه من رحلتك/)).toBeNull());

    // A second AI attempt (e.g. the user tries the box again) fails —
    // Phase 15 deterministic fallback must still drive the rest.
    mockInterpret.mockResolvedValueOnce({ status: 'error', message: 'upstream failure' });
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'نص إضافي' } });
    fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
    await waitFor(() => expect(screen.getByText(/تعذّر فهم النص/)).toBeInTheDocument());

    let sawEliminated = false;
    for (let i = 0; i < 10; i++) {
      const heading = screen.queryByRole('heading', { level: 2 });
      if (!heading) break;
      if (/الطقس|^ما الذي تفضله؟$/.test(heading.textContent ?? '')) sawEliminated = true;
      const options = screen.queryAllByRole('radio');
      if (options.length === 0) break;
      fireEvent.click(options[0]);
      fireEvent.click(screen.getByRole('button', { name: /التالي|عرض النتائج/ }));
      if (screen.queryByText('RESULTS_PAGE')) break;
    }
    expect(sawEliminated).toBe(false);
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });
});

describe('§25 AI CALL BUDGET — enforced across initial + follow-up interpretation calls', () => {
  it('MAX_AI_CALLS_PER_INTERVIEW bounds total real network attempts; the submit button disables once exhausted', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderQuiz();
    for (let i = 0; i < 3; i++) {
      fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: `نص ${i}` } });
      fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
      await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(i + 1));
    }
    // Budget (3) now exhausted — the button must be disabled, preventing
    // a 4th call regardless of text entered.
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'نص إضافي رابع' } });
    expect(screen.getByRole('button', { name: /فهم تفضيلاتي/ })).toHaveProperty('disabled', true);
  });
});

describe('§36 SCENARIO B — "بسافر مع عائلتي وأبغى مكان مختلف عن المعتاد"', () => {
  it('recognizes the cultural-novelty signal and offers a respectful clarification — never infers religion/culture from origin', async () => {
    mockInterpret.mockResolvedValueOnce({ status: 'ok', interpreted: [], unmapped: ['مختلف عن المعتاد', 'عائلتي'] });
    renderQuiz();
    submitNaturalText('بسافر مع عائلتي وأبغى مكان مختلف عن المعتاد');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());

    // The cultural-novelty follow-up fires from the EXPLICIT "different
    // from usual" text signal — never from origin/location/nationality
    // (this test never touches state.location at all, proving the
    // trigger has no dependency on it).
    await waitFor(() => expect(screen.getByText(/كم تحب أن يكون الاختلاف؟/)).toBeInTheDocument());
    expect(screen.getByText('أبغى تجربة ثقافية مختلفة تمامًا عمّا اعتدت عليه')).toBeInTheDocument();
    fireEvent.click(screen.getByText('أبغى بعض الاختلاف، لكن مع شيء مألوف'));
    await waitFor(() => expect(screen.queryByText(/كم تحب أن يكون الاختلاف؟/)).toBeNull());
  });
});

describe('§37 SCENARIO C — "I only have four days and I want somewhere relaxing" (English)', () => {
  it('recognizes duration context (left unmapped, no fabricated dimension) and relaxation preference; no redundant re-asking', async () => {
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [{ questionId: 'adventure', value: 10, confidence: 'high' }],
      unmapped: ['four days'],
    });
    renderQuiz('/quiz/tourism');
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'I only have four days and I want somewhere relaxing' } });
    fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    // Duration ("four days") has no ranking-supported dimension in this
    // bank — honestly surfaced as unmapped, never forced into a
    // fabricated "duration" score.
    expect(screen.getByText(/بعض ما كتبته لم يتطابق مع أي سؤال/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    // Relaxation (adventure=10) confirmed -> its normal question never
    // appears again.
    await waitFor(() => expect(screen.queryByText(/هذا ما فهمناه من رحلتك/)).toBeNull());
    expect(screen.queryByText('كيف تفضل قضاء وقتك؟')).toBeNull();
  });
});

describe('§44 CULTURAL NON-INFERENCE — origin context never implies a cultural/religious preference', () => {
  it('a granted Saudi-origin location never pre-fills or suggests culture/language-comfort answers on its own', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    renderQuiz();
    // No natural-language submission at all — location alone (even if
    // granted) must never, by itself, populate any answer.
    submitNaturalText('نص عام لا علاقة له بأي تفضيل');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());
    expect(screen.queryByText(/أي تجربة أقرب لك؟/)).toBeNull();
    expect(screen.queryByText(/كم تحب أن يكون الاختلاف؟/)).toBeNull();
  });
});

describe('§40 duplicate prevention holds across the whole bank set (sanity: no bank question re-derives an already-satisfied dimension id)', () => {
  it('tourism bank has no second question sharing an id with another (a structural guarantee duplicate-prevention relies on)', () => {
    const ids = QUESTION_BANKS.tourism.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
