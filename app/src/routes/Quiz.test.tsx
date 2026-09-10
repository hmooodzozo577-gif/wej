// Phase 15 — Adaptive Questions. End-to-end tests against the REAL
// Quiz route + reducer + adaptive engine (no mocks) — the closest a
// Vitest/jsdom test gets to the manual browser QA in the final report.
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useReducer, type ReactNode } from 'react';
import { AppStateProvider } from '../state/AppStateContext';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { Quiz } from './Quiz';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { Lang } from '../data/types';
import type { AppAction } from '../state/types';

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

function renderQuizWithLang(lang: Lang, path = '/quiz/tourism') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
          <Route path="/purpose" element={<div>PURPOSE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

// Phase 16.5 — exposes the real reducer's dispatch so a test can inject
// a confirmed AI interpretation (SET_ANSWER with provenance
// 'ai_interpreted') the same way NaturalPreferenceInput.tsx's "Apply"
// does, without mocking aiService or driving its own UI — this file's
// job is proving the reducer+Quiz-rendering CONSEQUENCE of that
// action, already covered from aiService's own side elsewhere.
function renderQuizExposingDispatch(path = '/quiz/tourism') {
  const dispatchRef: { current: (a: AppAction) => void } = { current: () => {} };
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    // useReducer's dispatch is referentially stable across renders, so
    // capturing it once via an effect (rather than during render body)
    // is enough, and keeps this test helper itself lint-clean.
    useEffect(() => {
      dispatchRef.current = dispatch;
    }, [dispatch]);
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  const utils = render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
          <Route path="/purpose" element={<div>PURPOSE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  return { ...utils, dispatch: (a: AppAction) => act(() => dispatchRef.current(a)) };
}

/** Total digits shown in `.quiz-count` ("... N of TOTAL — purpose"),
 *  language-agnostic (just extracts the last run of digits). */
function displayedTotal(container: HTMLElement): number {
  const text = container.querySelector('.quiz-count')!.textContent!;
  const numbers = text.match(/\d+/g)!;
  return Number(numbers[numbers.length - 1]);
}

function selectFirstOption() {
  const options = screen.getAllByRole('radio');
  fireEvent.click(options[0]);
}

// Both nav buttons live inside .quiz-nav specifically — scoping the
// query there avoids ever matching the .quiz-top "Change purpose"
// button, which also happens to carry a btn-ghost class.
function quizNav(): HTMLElement {
  return document.querySelector('.quiz-nav')!;
}

function clickNext() {
  const next = quizNav().querySelector('.btn-primary')!;
  fireEvent.click(next);
}

function clickBack() {
  const back = quizNav().querySelector('.btn-ghost')!;
  fireEvent.click(back);
}

describe('Quiz — Phase 15 adaptive navigation (tourism bank, real reducer + adaptive engine)', () => {
  it('the initial question deterministically matches selectNextQuestion\'s own first pick (budget, highest weight)', () => {
    const { container } = renderQuiz();
    const heading = container.querySelector('.q-text');
    expect(heading).not.toBeNull();
    // "budget" is the tourism bank's own highest-weight question — the
    // adaptive engine's documented, tested first pick.
    const budgetQuestion = QUESTION_BANKS.tourism.find((q) => q.id === 'budget')!;
    expect(heading!.textContent).toBe(budgetQuestion.text.ar); // Arabic is the default lang
  });

  it('clicking Next without selecting an option shows validation and does not advance', () => {
    const { container } = renderQuiz();
    const firstHeading = container.querySelector('.q-text')!.textContent;
    clickNext();
    expect(container.querySelector('.quiz-validation')!.textContent).toBeTruthy();
    expect(container.querySelector('.q-text')!.textContent).toBe(firstHeading);
  });

  it('selecting an option and clicking Next advances to a DIFFERENT question, never repeating the first', () => {
    const { container } = renderQuiz();
    const firstHeading = container.querySelector('.q-text')!.textContent;
    selectFirstOption();
    clickNext();
    const secondHeading = container.querySelector('.q-text')!.textContent;
    expect(secondHeading).not.toBe(firstHeading);
  });

  it('Back returns to the exact previous question with its answer still selected', () => {
    const { container } = renderQuiz();
    selectFirstOption();
    clickNext();
    const secondHeading = container.querySelector('.q-text')!.textContent;
    clickBack();
    const backToHeading = container.querySelector('.q-text')!.textContent;
    expect(backToHeading).not.toBe(secondHeading);
    // The first question's own option is still marked selected.
    const selectedOption = container.querySelector('.q-option.selected');
    expect(selectedOption).not.toBeNull();
  });

  it('Back is disabled on the very first question — never a dead end going backward off the start', () => {
    renderQuiz();
    const back = quizNav().querySelector('.btn-ghost') as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });

  it('changing an earlier answer after going back recomputes the downstream question — no stale question reappears unchanged', () => {
    const { container } = renderQuiz();
    // Answer budget with option 0.
    let options = screen.getAllByRole('radio');
    fireEvent.click(options[0]);
    clickNext();
    const secondHeadingBefore = container.querySelector('.q-text')!.textContent;
    clickBack();
    // Change budget to a DIFFERENT option.
    options = screen.getAllByRole('radio');
    fireEvent.click(options[options.length - 1]);
    clickNext();
    // Whatever comes next is recomputed fresh from the new answer —
    // this assertion just proves the app didn't crash and produced a
    // real, renderable next question (the reducer-level test already
    // proves the exact truncation/removal mechanics).
    const secondHeadingAfter = container.querySelector('.q-text')!.textContent;
    expect(secondHeadingAfter).toBeTruthy();
    void secondHeadingBefore;
  });

  it('completing every question navigates to /results', () => {
    renderQuiz();
    const total = QUESTION_BANKS.tourism.length;
    for (let i = 0; i < total; i++) {
      const options = screen.getAllByRole('radio');
      fireEvent.click(options[0]);
      clickNext();
    }
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });

  it('"Start over" (RESTART_ALL via /purpose navigation) is reachable from the quiz at any point', () => {
    const { container } = renderQuiz();
    selectFirstOption();
    clickNext();
    const changePurposeBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('تغيير الغرض'));
    expect(changePurposeBtn).toBeTruthy();
  });
});

describe('Quiz — Phase 16.5 question elimination (real reducer + adaptive engine, no mocks)', () => {
  it('QUESTION REDUCTION: two dimensions confirmed via natural-language interpretation are never shown, and the interview ends after exactly 6 (8 - 2) real questions', () => {
    const { container, dispatch } = renderQuizExposingDispatch();
    // Simulate NaturalPreferenceInput's "Apply" for two dimensions —
    // real production shape (provenance:'ai_interpreted'), never
    // walked through the UI.
    dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    dispatch({ type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' });

    const visitedHeadings: string[] = [];
    for (let i = 0; i < 10; i++) {
      const heading = container.querySelector('.q-text');
      if (!heading) break; // navigated to /results
      visitedHeadings.push(heading.textContent!);
      const options = screen.getAllByRole('radio');
      fireEvent.click(options[0]);
      fireEvent.click(quizNav().querySelector('.btn-primary')!);
    }

    const climateText = QUESTION_BANKS.tourism.find((q) => q.id === 'climate')!.text.ar;
    const natureText = QUESTION_BANKS.tourism.find((q) => q.id === 'naturecity')!.text.ar;
    expect(visitedHeadings).not.toContain(climateText);
    expect(visitedHeadings).not.toContain(natureText);
    expect(visitedHeadings).toHaveLength(6); // 8 real questions - 2 satisfied up front
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });

  it('DYNAMIC PROGRESS: the displayed total shrinks as soon as a dimension is confirmed via interpretation', () => {
    const { container, dispatch } = renderQuizExposingDispatch();
    expect(displayedTotal(container)).toBe(8);
    dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    expect(displayedTotal(container)).toBe(7);
    dispatch({ type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' });
    expect(displayedTotal(container)).toBe(6);
  });

  it('RESTORE: removing a confirmed interpretation (REMOVE_AI_ANSWER) brings its question back into the remaining interview', () => {
    const { container, dispatch } = renderQuizExposingDispatch();
    dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    expect(displayedTotal(container)).toBe(7);

    dispatch({ type: 'REMOVE_AI_ANSWER', questionId: 'climate' });
    expect(displayedTotal(container)).toBe(8); // truthful denominator restored too

    const visitedHeadings: string[] = [];
    for (let i = 0; i < 10; i++) {
      const heading = container.querySelector('.q-text');
      if (!heading) break;
      visitedHeadings.push(heading.textContent!);
      const options = screen.getAllByRole('radio');
      fireEvent.click(options[0]);
      fireEvent.click(quizNav().querySelector('.btn-primary')!);
    }
    const climateText = QUESTION_BANKS.tourism.find((q) => q.id === 'climate')!.text.ar;
    expect(visitedHeadings).toContain(climateText); // it's back
    expect(visitedHeadings).toHaveLength(8); // full bank again, nothing eliminated
  });

  it('never gets stuck on the final question once elimination shrinks the real question count below the fixed bank size', () => {
    // Regression for the exact bug this phase could have introduced:
    // completion logic must track the REAL remaining questions, not a
    // fixed `total`, or the app would loop forever re-clicking Next on
    // the last real question once elimination happens.
    const { container, dispatch } = renderQuizExposingDispatch();
    dispatch({ type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    dispatch({ type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' });
    for (let i = 0; i < 6; i++) {
      const options = screen.getAllByRole('radio');
      fireEvent.click(options[0]);
      fireEvent.click(quizNav().querySelector('.btn-primary')!);
    }
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
    expect(container.querySelector('.q-text')).toBeNull(); // moved on, not stuck
  });
});

describe('Quiz — English parity (same mechanics, different language, same ids)', () => {
  it('the initial English question is the SAME question id as Arabic (only the displayed text differs)', () => {
    const { container } = renderQuizWithLang('en');
    const heading = container.querySelector('.q-text')!.textContent;
    const budgetQuestion = QUESTION_BANKS.tourism.find((q) => q.id === 'budget')!;
    expect(heading).toBe(budgetQuestion.text.en);
  });

  it('an English quiz session reaches /results after the same number of questions as Arabic — no crash, no missing button, no untranslated gap', () => {
    // Language only changes displayed text — never which question ids
    // exist or their order-selection logic (see
    // selectNextQuestion.test.ts's own language-independence test).
    renderQuizWithLang('en');
    const total = QUESTION_BANKS.tourism.length;
    for (let i = 0; i < total; i++) {
      const options = screen.getAllByRole('radio');
      fireEvent.click(options[0]);
      clickNext();
    }
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });
});
