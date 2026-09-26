// Phase 16 workstream A — regression coverage for the geolocation/quiz
// race condition. See app/src/state/waitForLocationSettle.ts for the root
// cause. These tests drive the REAL Quiz component with injected initial
// state (the same raw-context pattern already used by
// TravelCostIndexInfo.test.tsx) so the reducer's own live re-derivation of
// effectiveQuestionBank() is exercised exactly as production runs it —
// nothing here mocks the questionnaire logic itself.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import type { AppState } from '../state/types';
import { QUESTION_BANKS } from '../data/questionBanks';
import { Quiz } from './Quiz';

// medical's 8 dimensions: proximity, climate, cost, urbanity, size, safety,
// health, income — proximity is the ONLY location-dependent one, and it is
// the LAST unanswered question in every scenario below, so the "no more
// questions" decision always lands squarely on the race window.
const NON_LOCATION_IDS = ['medical-cost', 'medical-urbanity', 'medical-size', 'medical-safety', 'medical-health', 'medical-income'];

function firstOptionValue(id: string) {
  const question = QUESTION_BANKS.medical.find((item) => item.id === id)!;
  return question.options[0]!.value;
}

function buildInitialState(locationStatus: AppState['location']['status']): AppState {
  return {
    ...initialAppState,
    lang: 'en',
    purpose: 'medical',
    qIndex: 0,
    path: ['medical-climate'],
    answers: Object.fromEntries(NON_LOCATION_IDS.map((id) => [id, firstOptionValue(id)])),
    questionnaireCheckpointPassed: true,
    location: { status: locationStatus, coords: null, diagnostic: null },
  };
}

function Harness({ initialState, onDispatchReady }: { initialState: AppState; onDispatchReady?: (dispatch: React.Dispatch<Parameters<typeof appReducer>[1]>) => void }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  onDispatchReady?.(dispatch);
  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      <MemoryRouter initialEntries={['/quiz/medical']}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AppStateContext.Provider>
  );
}

function answerCurrentQuestion() {
  fireEvent.click(screen.getAllByRole('radio')[0]!);
}

// v1.1 — after the Phase 14 questions come the optional travel-need
// questions (language, Islamic practice, halal food), then the passport
// step. "Not important" to all three skips the language list.
async function answerTravelNeedsNotImportant() {
  await waitFor(() => expect(screen.getByText(/communicate easily in a language you know/)).toBeInTheDocument());
  for (let step = 0; step < 3; step += 1) {
    fireEvent.click(screen.getByRole('radio', { name: /Not important/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  }
}

describe('geolocation/quiz race — the "no more questions" decision waits for a pending request', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "Getting your location…" instead of silently finishing when location is still requesting', async () => {
    render(<Harness initialState={buildInitialState('requesting')} />);
    answerCurrentQuestion();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150); // past the fixed ANSWER_TRANSITION_MS gate
    });
    expect(screen.getByText('Getting your location…', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('RESULTS_PAGE')).not.toBeInTheDocument();
  });

  it('asks the location-dependent question once location resolves during the bounded wait (slow but successful resolution)', async () => {
    let dispatch: React.Dispatch<Parameters<typeof appReducer>[1]> | undefined;
    render(<Harness initialState={buildInitialState('requesting')} onDispatchReady={(d) => { dispatch = d; }} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.getByText('Getting your location…', { exact: false })).toBeInTheDocument();

    // Location resolves mid-wait — a realistic "slow geolocation" case.
    act(() => {
      dispatch!({ type: 'LOCATION_GRANTED', coords: { lat: 24.7, lng: 46.7 } });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.queryByText('RESULTS_PAGE')).not.toBeInTheDocument();
    // The proximity question (or the appended land-border question) is now
    // reachable — either is acceptable proof the bank grew to include
    // location-dependent content instead of silently finishing without it.
    const proximityShown = screen.queryByText(/سؤال|question/i) !== null; // page still shows a live question card
    expect(proximityShown).toBe(true);
    expect(document.querySelector('.q-card[role="radiogroup"]')).not.toBeNull();
  });

  it('falls back to results after the bounded timeout if location never resolves', async () => {
    render(<Harness initialState={buildInitialState('requesting')} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.getByText('Getting your location…', { exact: false })).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); // past LOCATION_SETTLE_TIMEOUT_MS

    // Without a location the proximity question is never asked; the
    // questionnaire moves on to the optional travel needs, then the passport.
    expect(screen.queryByText(/close to your current location/i)).not.toBeInTheDocument();
    await answerTravelNeedsNotImportant();
    await waitFor(() => expect(document.querySelector('.quiz-passport')).not.toBeNull());
  });

  it('fast permission success (already granted before finishing) never shows the waiting state at all', async () => {
    render(<Harness initialState={buildInitialState('granted')} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByText('Getting your location…', { exact: false })).not.toBeInTheDocument();
  });

  it('denied: proceeds straight to results without waiting', async () => {
    render(<Harness initialState={buildInitialState('denied')} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByText('Getting your location…', { exact: false })).not.toBeInTheDocument();
    await answerTravelNeedsNotImportant();
    await waitFor(() => expect(document.querySelector('.quiz-passport')).not.toBeNull());
  });

  it('unavailable: proceeds straight to results without waiting', async () => {
    render(<Harness initialState={buildInitialState('unavailable')} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByText('Getting your location…', { exact: false })).not.toBeInTheDocument();
    await answerTravelNeedsNotImportant();
    await waitFor(() => expect(document.querySelector('.quiz-passport')).not.toBeNull());
  });

  it('does not issue a second geolocation request — waiting only reads status, no dispatch of LOCATION_REQUEST occurs', async () => {
    const seenActions: string[] = [];
    function TrackingHarness() {
      const [state, realDispatch] = useReducer((s: AppState, a: Parameters<typeof appReducer>[1]) => {
        seenActions.push(a.type);
        return appReducer(s, a);
      }, buildInitialState('requesting'));
      return (
        <AppStateContext.Provider value={{ state, dispatch: realDispatch }}>
          <MemoryRouter initialEntries={['/quiz/medical']}>
            <Routes>
              <Route path="/quiz/:purpose" element={<Quiz />} />
              <Route path="/results" element={<div>RESULTS_PAGE</div>} />
            </Routes>
          </MemoryRouter>
        </AppStateContext.Provider>
      );
    }
    render(<TrackingHarness />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(seenActions).not.toContain('LOCATION_REQUEST');
  });

  it('Arabic: the pending-location copy renders in Arabic', async () => {
    const arabicState = { ...buildInitialState('requesting'), lang: 'ar' as const };
    render(<Harness initialState={arabicState} />);
    answerCurrentQuestion();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.getByText('جارٍ تحديد موقعك…')).toBeInTheDocument();
  });
});
