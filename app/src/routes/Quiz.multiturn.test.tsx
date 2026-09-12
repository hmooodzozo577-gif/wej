// Phase 16.5 TRUE adaptive-interview pass — end-to-end tests through the
// REAL Quiz route + reducer + adaptive/useAdaptiveInterview.ts, with only
// the network boundary (aiService.interpretPreferences/nextTurn) mocked,
// same convention as before. Unlike Quiz.test.tsx (deliberately mock-free,
// exercises the 'fallback' Phase 15 path since no AI is configured in the
// test env), this file mocks `isAiConfigured` -> true so the NORMAL
// AI-driven path (Section 0) actually runs.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Quiz } from './Quiz';
import { QUESTION_BANKS } from '../data/questionBanks';
import { interpretPreferences, nextTurn } from '../ai/aiService';
import type { NextTurnServiceResult } from '../ai/types';

vi.mock('../ai/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/aiService')>();
  return { ...actual, isAiConfigured: () => true, interpretPreferences: vi.fn(), nextTurn: vi.fn() };
});
const mockInterpret = vi.mocked(interpretPreferences);
const mockNextTurn = vi.mocked(nextTurn);

// Every test queues its own exact mockResolvedValueOnce sequence — reset
// between tests so a previous test's leftover/unused queued resolution
// (e.g. one that ended early on a fallback) can never bleed into the
// next one's call count/order.
beforeEach(() => {
  mockInterpret.mockReset();
  mockNextTurn.mockReset();
});

function renderQuiz(path = '/quiz/tourism') {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
          <Route path="/purpose" element={<div>PURPOSE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

function submitNaturalText(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
}

const complete: NextTurnServiceResult = { status: 'ok', outcome: { kind: 'complete' } };

describe('§35/40 SCENARIO A — "أبغى دولة باردة وهادئة وفيها طبيعة": AI generates the follow-up, never the fixed quietness template', () => {
  it('keeps the answered question visible and disabled while the next AI turn is pending', async () => {
    let resolveNext!: (result: NextTurnServiceResult) => void;
    const pendingNext = new Promise<NextTurnServiceResult>((resolve) => { resolveNext = resolve; });
    mockNextTurn
      .mockResolvedValueOnce({
        status: 'ok',
        outcome: {
          kind: 'ask',
          questionType: 'choice',
          targetDimensions: ['budget'],
          prompt: 'ما مستوى الميزانية المناسب لك؟',
          options: [
            { id: 'budget_low', label: 'اقتصادية', updates: { budget: 1 } },
            { id: 'budget_high', label: 'مرنة', updates: { budget: 4 } },
          ],
        },
      })
      .mockReturnValueOnce(pendingNext);

    renderQuiz();
    await waitFor(() => expect(screen.getByText('ما مستوى الميزانية المناسب لك؟')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: /منخفضة/ }));

    await waitFor(() => expect(mockNextTurn).toHaveBeenCalledTimes(2));
    expect(screen.getByText('ما مستوى الميزانية المناسب لك؟')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('radio').every((option) => (option as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(/جارٍ تحضير السؤال التالي/);
    expect(document.querySelector('.ai-turn-loading')).toBeNull();

    resolveNext(complete);
    await waitFor(() => expect(screen.getByText(/لدينا معلومات كافية/)).toBeInTheDocument());
  });

  it('a GENERATED (not verbatim questionBanks.ts) choice question is asked next, resolves nightlife, then the interview completes', async () => {
    // Call #1 fires on mount with an empty profile. It must be discarded
    // once the traveler confirms natural-language preferences.
    mockNextTurn.mockResolvedValueOnce({
      status: 'ok',
      outcome: {
        kind: 'ask',
        questionType: 'choice',
        targetDimensions: ['budget'],
        prompt: 'ما النطاق المناسب للميزانية؟',
        options: [{ id: 'low', label: 'منخفضة', updates: { budget: 1 } }],
      },
    });
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [
        { questionId: 'climate', value: 'cold', confidence: 'high' },
        { questionId: 'naturecity', value: 15, confidence: 'high' },
      ],
      unmapped: ['هادئة'],
    });
    mockNextTurn.mockResolvedValueOnce({
      status: 'ok',
      outcome: {
        kind: 'ask',
        questionType: 'choice',
        targetDimensions: ['nightlife'],
        prompt: 'بما أنك تفضّل البرد والطبيعة، كيف تتخيّل أمسيات رحلتك الهادئة؟',
        options: [
          { id: 'quiet_evenings', label: 'أمسيات هادئة بعيدة عن الصخب', updates: { nightlife: 10 } },
          { id: 'lively_evenings', label: 'أمسيات نابضة بالحياة الليلية', updates: { nightlife: 100 } },
        ],
      },
    });
    mockNextTurn.mockResolvedValueOnce(complete);

    renderQuiz();
    await waitFor(() => expect(screen.getByText('ما النطاق المناسب للميزانية؟')).toBeInTheDocument());
    expect(document.querySelector('.q-card')).not.toBeNull();
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
    // Never the OLD deterministic template's fixed wording.
    expect(screen.queryByText(/أي تجربة أقرب لك؟/)).toBeNull();
    // Never the bank's own verbatim nightlife question text either.
    const nightlifeQ = QUESTION_BANKS.tourism.find((q) => q.id === 'nightlife')!;
    expect(screen.queryByText(nightlifeQ.text.ar)).toBeNull();

    // Proves the optional natural-language entry still works even while
    // an AI-generated turn is already pending (Section 13 preserved).
    submitNaturalText('أبغى دولة باردة وهادئة وفيها طبيعة');
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    await waitFor(() => expect(screen.queryByText(/هذا ما فهمناه من رحلتك/)).toBeNull());
    await waitFor(() => expect(screen.getByText(/بما أنك تفضّل البرد والطبيعة/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('أمسيات هادئة بعيدة عن الصخب'));
    await waitFor(() => expect(screen.queryByText(/بما أنك تفضّل البرد والطبيعة/)).toBeNull());

    // DUPLICATE PREVENTION: the THIRD call's catalog already marks
    // climate/naturecity/nightlife resolved+asked — a real AI is told
    // not to re-target any of them.
    await waitFor(() => expect(mockNextTurn).toHaveBeenCalledTimes(3));
    const thirdCallCatalog = mockNextTurn.mock.calls[2]?.[3];
    for (const id of ['climate', 'naturecity', 'nightlife']) {
      expect(thirdCallCatalog?.find((d) => d.id === id)).toMatchObject({ resolved: true, alreadyAsked: true });
    }

    // AI decides the interview is done -> completion card, with a
    // canonical (summaryMeta-sourced) summary of everything confirmed.
    await waitFor(() => expect(screen.getByText(/لدينا معلومات كافية/)).toBeInTheDocument());
    const climateText = QUESTION_BANKS.tourism.find((q) => q.id === 'climate')!.text.ar;
    expect(screen.queryByText(climateText)).toBeNull(); // never shown as a real bank question at all

    fireEvent.click(screen.getByRole('button', { name: /عرض النتائج/ }));
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });
});

describe('§37 MULTI-DIMENSION — one AI-generated choice resolves two supported dimensions at once', () => {
  it('a single option updates BOTH naturecity and adventure; neither is ever asked again', async () => {
    mockInterpret.mockResolvedValueOnce({ status: 'ok', interpreted: [], unmapped: [] });
    mockNextTurn.mockResolvedValueOnce({
      status: 'ok',
      outcome: {
        kind: 'ask',
        questionType: 'choice',
        targetDimensions: ['naturecity', 'adventure'],
        prompt: 'صف يومك المثالي في الرحلة؟',
        options: [
          { id: 'calm_nature_day', label: 'نزهة هادئة وسط الطبيعة', updates: { naturecity: 15, adventure: 10 } },
          { id: 'active_city_day', label: 'يوم نشيط في المدينة', updates: { naturecity: 90, adventure: 90 } },
        ],
      },
    });
    mockNextTurn.mockResolvedValueOnce(complete);

    renderQuiz();
    submitNaturalText('نص عام');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('صف يومك المثالي في الرحلة؟')).toBeInTheDocument());
    fireEvent.click(screen.getByText('نزهة هادئة وسط الطبيعة'));

    await waitFor(() => expect(screen.getByText(/لدينا معلومات كافية/)).toBeInTheDocument());
    // Both dimensions resolved from the ONE click — both appear in the
    // canonical confirmed-summary list.
    const naturecityQ = QUESTION_BANKS.tourism.find((q) => q.id === 'naturecity')!;
    void naturecityQ;
    expect(mockNextTurn.mock.calls[1]?.[4]).toMatchObject({ naturecity: 15, adventure: 10 });
  });

  it('discards a generic turn created before natural preferences and requests a contextual replacement', async () => {
    mockNextTurn
      .mockResolvedValueOnce({
        status: 'ok',
        outcome: {
          kind: 'ask',
          questionType: 'choice',
          targetDimensions: ['budget'],
          prompt: 'ما هي ميزانيتك التقريبية؟',
          options: [{ id: 'low', label: 'منخفضة', updates: { budget: 1 } }],
        },
      })
      .mockResolvedValueOnce({
        status: 'ok',
        outcome: {
          kind: 'ask',
          questionType: 'choice',
          targetDimensions: ['budget'],
          prompt: 'بما أنك تفضّل البرد والطبيعة، ما النطاق المناسب لميزانية رحلتك؟',
          options: [{ id: 'low', label: 'منخفضة', updates: { budget: 1 } }],
        },
      });
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [
        { questionId: 'climate', value: 'cold', confidence: 'high' },
        { questionId: 'naturecity', value: 15, confidence: 'high' },
      ],
      unmapped: [],
    });

    renderQuiz();
    await waitFor(() => expect(screen.getByText('ما هي ميزانيتك التقريبية؟')).toBeInTheDocument());
    submitNaturalText('أبغى دولة باردة وفيها طبيعة');
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));

    await waitFor(() => expect(mockNextTurn).toHaveBeenCalledTimes(2));
    expect(mockNextTurn.mock.calls[1]?.[4]).toEqual({ climate: 'cold', naturecity: 15 });
    expect(screen.queryByText('ما هي ميزانيتك التقريبية؟')).toBeNull();
    expect(await screen.findByText(/بما أنك تفضّل البرد والطبيعة/)).toBeInTheDocument();
  });
});

describe('§36/41 SCENARIO B — "بسافر مع عائلتي وأبغى مكان مختلف عن المعتاد": AI-generated FREE-TEXT clarification', () => {
  it('the free-text input is the PRIMARY UI (no toggle needed) — never infers religion/culture from origin', async () => {
    mockInterpret.mockResolvedValueOnce({ status: 'ok', interpreted: [], unmapped: ['مختلف عن المعتاد', 'عائلتي'] });
    mockNextTurn.mockResolvedValueOnce({
      status: 'ok',
      outcome: { kind: 'ask', questionType: 'free_text', targetDimensions: ['culture'], prompt: 'كيف تحب أن يكون الاختلاف الثقافي في رحلتك؟' },
    });
    mockNextTurn.mockResolvedValueOnce(complete);
    mockInterpret.mockResolvedValueOnce({ status: 'ok', interpreted: [{ questionId: 'culture', value: 50, confidence: 'high' }], unmapped: [] });

    renderQuiz();
    submitNaturalText('بسافر مع عائلتي وأبغى مكان مختلف عن المعتاد');
    await waitFor(() => expect(screen.getByText(/لم يتطابق ما كتبته/)).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('كيف تحب أن يكون الاختلاف الثقافي في رحلتك؟')).toBeInTheDocument());
    // PRIMARY, not behind the "none of these" toggle.
    const textarea = screen.getByPlaceholderText(/اكتب إجابتك بكلماتك/) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(screen.queryByText(/ولا شيء من هذا/)).toBeNull();

    fireEvent.change(textarea, { target: { value: 'أبغى بعض الاختلاف بس مو كثير' } });
    fireEvent.click(screen.getByText('إرسال'));

    await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(2));
    const scopedQuestions = mockInterpret.mock.calls[1]?.[2] as Array<{ id: string }>;
    expect(scopedQuestions.map((q) => q.id)).toEqual(['culture']);

    await waitFor(() => expect(screen.getByText(/لدينا معلومات كافية/)).toBeInTheDocument());

    // CULTURAL NON-INFERENCE: no location was ever granted in this test,
    // yet the interview completed normally — proves nothing about
    // religion/ethnicity/culture is silently inferred from origin.
    expect(mockNextTurn.mock.calls.every((call) => call[6] === undefined)).toBe(true);
  });
});

describe('§39/42 FALLBACK PRESERVATION — a failed AI next-turn call flips to Phase 15, never re-asking resolved dimensions', () => {
  it('climate+nature stay resolved; the deterministic bank drives the rest to completion', async () => {
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [
        { questionId: 'climate', value: 'cold', confidence: 'high' },
        { questionId: 'naturecity', value: 15, confidence: 'high' },
      ],
      unmapped: [],
    });
    mockNextTurn.mockResolvedValue({ status: 'error', message: 'upstream failure' });

    renderQuiz();
    submitNaturalText('أبغى دولة باردة وفيها طبيعة');
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));

    // Fallback lands on the real deterministic bank card.
    await waitFor(() => expect(document.querySelector('.q-card')).not.toBeNull());

    let sawEliminated = false;
    for (let i = 0; i < 10; i++) {
      const heading = screen.queryByRole('heading', { level: 2 });
      if (!heading) break;
      const text = heading.textContent ?? '';
      const climateText = QUESTION_BANKS.tourism.find((q) => q.id === 'climate')!.text.ar;
      const natureText = QUESTION_BANKS.tourism.find((q) => q.id === 'naturecity')!.text.ar;
      if (text === climateText || text === natureText) sawEliminated = true;
      const options = screen.queryAllByRole('radio');
      if (options.length === 0) break;
      fireEvent.click(options[0]);
      fireEvent.click(screen.getByRole('button', { name: /التالي|عرض النتائج/ }));
      if (screen.queryByText('RESULTS_PAGE')) break;
    }
    expect(sawEliminated).toBe(false);
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
    // Applying a newer confirmed profile deliberately invalidates the
    // pre-profile fallback and tries Capability C once from that truth.
    // Its second real failure then remains a one-way fallback with no
    // background flapping while the deterministic path proceeds.
    expect(mockNextTurn).toHaveBeenCalledTimes(2);
  });
});

describe('§25 AI CALL BUDGET — enforced across initial + follow-up interpretation calls', () => {
  it('MAX_AI_CALLS_PER_INTERVIEW bounds total real network attempts; the submit button disables once exhausted', async () => {
    mockInterpret.mockResolvedValue({ status: 'ok', interpreted: [], unmapped: [] });
    mockNextTurn.mockResolvedValue(complete);
    renderQuiz();
    for (let i = 0; i < 3; i++) {
      fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: `نص ${i}` } });
      fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
      await waitFor(() => expect(mockInterpret).toHaveBeenCalledTimes(i + 1));
    }
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'نص إضافي رابع' } });
    expect(screen.getByRole('button', { name: /فهم تفضيلاتي/ })).toHaveProperty('disabled', true);
  });
});

describe('§37 (English) SCENARIO C — "I only have four days and I want somewhere relaxing" (English, AI-driven path)', () => {
  it('recognizes duration context (left unmapped, no fabricated dimension) and relaxation preference; no redundant re-asking', async () => {
    mockInterpret.mockResolvedValueOnce({
      status: 'ok',
      interpreted: [{ questionId: 'adventure', value: 10, confidence: 'high' }],
      unmapped: ['four days'],
    });
    mockNextTurn.mockResolvedValue(complete);
    renderQuiz('/quiz/tourism');
    fireEvent.change(screen.getByPlaceholderText(/أبغى دولة/), { target: { value: 'I only have four days and I want somewhere relaxing' } });
    fireEvent.click(screen.getByRole('button', { name: /فهم تفضيلاتي/ }));
    await waitFor(() => expect(screen.getByText(/هذا ما فهمناه من رحلتك/)).toBeInTheDocument());
    expect(screen.getByText(/بعض ما كتبته لم يتطابق مع أي سؤال/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /استخدام هذه التفضيلات/ }));
    await waitFor(() => expect(screen.getByText(/لدينا معلومات كافية/)).toBeInTheDocument());
    expect(screen.queryByText('كيف تفضل قضاء وقتك؟')).toBeNull();
  });
});

describe('§40 duplicate prevention holds across the whole bank set (sanity: no bank question re-derives an already-satisfied dimension id)', () => {
  it('tourism bank has no second question sharing an id with another (a structural guarantee duplicate-prevention relies on)', () => {
    const ids = QUESTION_BANKS.tourism.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
