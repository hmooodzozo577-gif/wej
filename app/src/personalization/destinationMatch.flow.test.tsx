// Phase 20 — "اكتشف مدى توافقها معك" on a destination page must answer
// "how well does THIS country match me": Destination X → Purpose → Quiz →
// back to X with X's Personal Match, whatever X's rank. The general flow
// (Purpose → Quiz → Results) is unchanged.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { useAppState } from '../state/hooks';
import { Destination } from '../routes/Destination';
import { PurposeSelect } from '../routes/PurposeSelect';
import { Quiz } from '../routes/Quiz';
import { Results } from '../routes/Results';
import { RootLayout } from '../components/layout/RootLayout';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { landBorderQuestionId } from '../data/questionBanks';
import { rankDestinations } from '../engine';
import { PersonalizationProvider } from './PersonalizationProvider';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from './storage';
import { createProfile } from './profile';
import { normalizePreferences } from './signals';
import { computePersonalMatch } from './personalMatch';
import { PERSONAL_COPY } from './copy';
import { destinationMatchState, readDestinationMatchIntent } from './quizIntent';
import { I18N } from '../data/i18n';
import { TRAVEL_NEED_COPY } from './travelNeeds';

function memoryStorage(profile?: string): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  if (profile) data[PERSONALIZATION_STORAGE_KEY] = profile;
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function English() {
  const { dispatch } = useAppState();
  useEffect(() => { dispatch({ type: 'SET_LANG', lang: 'en' }); }, [dispatch]);
  return null;
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

let goBack: (() => void) | null = null;
function BackButton() {
  const navigate = useNavigate();
  useEffect(() => {
    goBack = () => navigate(-1);
  }, [navigate]);
  return null;
}

function renderFlow(initial: string | { pathname: string; state?: unknown }, storage: StorageLike, lang: 'ar' | 'en' = 'ar') {
  return render(
    <AppStateProvider>
      <PersonalizationProvider storage={storage}>
        <MemoryRouter initialEntries={[initial]}>
          {lang === 'en' ? <English /> : null}
          <Where />
          <BackButton />
          <Routes>
            <Route path="/purpose" element={<PurposeSelect />} />
            <Route path="/quiz/:purpose" element={<Quiz />} />
            <Route path="/destination/:id" element={<Destination />} />
            <Route path="/results" element={<p>RESULTS_PAGE</p>} />
          </Routes>
        </MemoryRouter>
      </PersonalizationProvider>
    </AppStateProvider>,
  );
}

/** Answers the first option until the questionnaire ends (checkpoint →
 *  "show results now"), then skips the passport step. Deterministic. */
async function completeQuestionnaire(container: HTMLElement, lang: 'ar' | 'en' = 'ar') {
  for (let step = 0; step < 30; step += 1) {
    if (screen.queryByText(I18N[lang].passport.title)) break;
    const now = screen.queryByText(I18N[lang].quiz.showResultsNow);
    if (now) {
      fireEvent.click(now);
      continue;
    }
    const options = container.querySelectorAll('.q-option');
    if (!options.length) break;
    await act(async () => {
      fireEvent.click(options[0]!);
      // v1.1 — the language list is multi-select: choose, then Continue.
      if (container.querySelector('.lang-options')) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(TRAVEL_NEED_COPY[lang].continue) }));
      }
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
  }
  fireEvent.click(await screen.findByText(I18N[lang].passport.skip));
}

const byId = (id: string) => WORLD_CATALOG.find((entry) => entry.id === id)!;

// RootLayout mounts Header -> ThemeSwitch, which reads matchMedia.
function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false, media: '', onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('destination match flow', () => {
  it('Japan → CTA → questionnaire → back on Japan with its own Personal Match (AR)', async () => {
    const storage = memoryStorage();
    const { container } = renderFlow('/destination/japan', storage);
    const pc = PERSONAL_COPY.ar;

    fireEvent.click(screen.getByRole('link', { name: new RegExp(pc.noProfileCta) }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/purpose'));
    fireEvent.click(container.querySelector('.purpose-card')!);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/quiz\//));

    await completeQuestionnaire(container);

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/destination/japan'));
    expect(screen.queryByText('RESULTS_PAGE')).not.toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: new RegExp(pc.whyHeading) });
    expect(heading).toHaveFocus();
    // The score shown is the unchanged methodology applied to Japan itself.
    const profile = JSON.parse(storage.data[PERSONALIZATION_STORAGE_KEY]!);
    const expected = computePersonalMatch(byId('japan'), normalizePreferences(profile.purpose, profile.answers));
    expect(expected.score).not.toBeNull();
    expect(container.querySelector('.personal-match-value b')?.textContent).toBe(`${expected.score}%`);
    // Navigation intent never reaches the saved profile.
    expect(JSON.stringify(profile)).not.toMatch(/japan|destinationMatch|quizIntent/i);
  });

  it('works in English and for a country outside the top 10 with a low match', async () => {
    // The first-option answers are deterministic: derive them once through
    // the general flow, then pick a country the ranking leaves far behind.
    const probe = memoryStorage();
    const first = renderFlow('/purpose', probe, 'en');
    fireEvent.click(first.container.querySelector('.purpose-card')!);
    await completeQuestionnaire(first.container, 'en');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/results'));
    const profile = JSON.parse(probe.data[PERSONALIZATION_STORAGE_KEY]!);
    first.unmount();

    const topTen = new Set(rankDestinations(profile.purpose, profile.answers, null).slice(0, 10).map((item) => item.dest.id));
    const prefs = normalizePreferences(profile.purpose, profile.answers);
    const outside = WORLD_CATALOG
      .filter((entry) => !topTen.has(entry.id))
      .map((entry) => ({ entry, match: computePersonalMatch(entry, prefs) }))
      .filter((item) => item.match.score !== null)
      .sort((a, b) => a.match.score! - b.match.score!)[0]!;
    expect(topTen.has(outside.entry.id)).toBe(false);

    const storage = memoryStorage();
    const { container } = renderFlow(`/destination/${outside.entry.id}`, storage, 'en');
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(PERSONAL_COPY.en.noProfileCta) }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/purpose'));
    fireEvent.click(container.querySelector('.purpose-card')!);
    await completeQuestionnaire(container, 'en');

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/destination/${outside.entry.id}`));
    expect(container.querySelector('.personal-match-value b')?.textContent).toBe(`${outside.match.score}%`);
  });

  it('keeps the intent when the traveller changes purpose mid-questionnaire', async () => {
    const storage = memoryStorage();
    const { container } = renderFlow({ pathname: '/purpose', state: destinationMatchState('france') }, storage);
    fireEvent.click(container.querySelector('.purpose-card')!);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/quiz\//));
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.quiz.changePurpose }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/purpose'));
    fireEvent.click(container.querySelectorAll('.purpose-card')[1]!);
    await completeQuestionnaire(container);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/destination/france'));
  });

  it('Back from the purpose screen returns to the originating destination', async () => {
    const { container } = renderFlow('/destination/japan', memoryStorage());
    fireEvent.click(screen.getByRole('link', { name: new RegExp(PERSONAL_COPY.ar.noProfileCta) }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/purpose'));
    act(() => goBack!());
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/destination/japan'));
    expect(container.querySelector('.personal-match-card.is-empty')).not.toBeNull();
  });

  it('with a saved profile shows the match directly, without a questionnaire link', () => {
    const answers = { 'tourism-climate': 'cold', 'tourism-cost': 3 };
    const saved = JSON.stringify(createProfile('tourism', answers, Object.keys(answers)));
    const { container } = renderFlow('/destination/japan', memoryStorage(saved));
    expect(container.querySelector('.personal-match-value')).not.toBeNull();
    expect(screen.queryByRole('link', { name: new RegExp(PERSONAL_COPY.ar.noProfileCta) })).toBeNull();
  });

  it('"Edit my preferences" on a destination returns to that destination with its updated match', async () => {
    const answers = { 'tourism-climate': 'cold', 'tourism-cost': 3 };
    const before = createProfile('tourism', answers, Object.keys(answers))!;
    const storage = memoryStorage(JSON.stringify(before));
    const { container } = renderFlow('/destination/japan', storage);
    const pc = PERSONAL_COPY.ar;

    fireEvent.click(screen.getByRole('button', { name: pc.editPrefs }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/quiz/tourism'));
    await completeQuestionnaire(container);

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/destination/japan'));
    expect(screen.queryByText('RESULTS_PAGE')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: new RegExp(pc.whyHeading) })).toHaveFocus();
    const after = JSON.parse(storage.data[PERSONALIZATION_STORAGE_KEY]!);
    expect(after.answers).not.toEqual(before.answers);
    const expected = computePersonalMatch(byId('japan'), normalizePreferences(after.purpose, after.answers));
    expect(container.querySelector('.personal-match-value b')?.textContent).toBe(`${expected.score}%`);
    expect(JSON.stringify(after)).not.toMatch(/japan|destinationMatch|quizIntent/i);
  });

  it('"Edit my preferences" on Results still ends on Results', async () => {
    const answers = { 'tourism-climate': 'cold', 'tourism-cost': 3 };
    const storage = memoryStorage(JSON.stringify(createProfile('tourism', answers, Object.keys(answers))));
    const { container } = render(
      <AppStateProvider>
        <PersonalizationProvider storage={storage}>
          <MemoryRouter initialEntries={['/results']}>
            <Where />
            <Routes>
              <Route path="/quiz/:purpose" element={<Quiz />} />
              <Route path="/results" element={<Results />} />
              <Route path="/destination/:id" element={<p>DESTINATION_PAGE</p>} />
            </Routes>
          </MemoryRouter>
        </PersonalizationProvider>
      </AppStateProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: PERSONAL_COPY.ar.editPrefs }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/quiz/tourism'));
    await completeQuestionnaire(container);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/results'));
    expect(screen.queryByText('DESTINATION_PAGE')).not.toBeInTheDocument();
  });

  it('shows the match and the failed hard constraint for a country outside a land-border preference', async () => {
    const answers = { 'tourism-climate': 'cold', [landBorderQuestionId('tourism')]: 1 };
    const saved = JSON.stringify(createProfile('tourism', answers, Object.keys(answers)));
    function Located() {
      const { dispatch } = useAppState();
      useEffect(() => { dispatch({ type: 'LOCATION_GRANTED', coords: { lat: 24.7136, lng: 46.6753 } }); }, [dispatch]);
      return null;
    }
    const { container } = render(
      <AppStateProvider>
        <PersonalizationProvider storage={memoryStorage(saved)}>
          <MemoryRouter initialEntries={[{ pathname: '/destination/japan', state: { personalMatchFocus: true } }]}>
            <Located />
            <Routes><Route path="/destination/:id" element={<Destination />} /></Routes>
          </MemoryRouter>
        </PersonalizationProvider>
      </AppStateProvider>,
    );
    expect(await screen.findByText(PERSONAL_COPY.ar.constraintFailed)).toBeInTheDocument();
    expect(container.querySelector('.personal-match-value b')?.textContent).toMatch(/^\d+%$/);
  });

  it('leaves the general flow unchanged: Purpose → Quiz → Results', async () => {
    const storage = memoryStorage();
    const { container } = renderFlow('/purpose', storage);
    fireEvent.click(container.querySelector('.purpose-card')!);
    await completeQuestionnaire(container);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/results'));
    expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument();
  });
});

describe('readDestinationMatchIntent', () => {
  it('accepts only a well-formed intent for a catalog destination', () => {
    expect(readDestinationMatchIntent(destinationMatchState('japan'))).toEqual({ kind: 'destinationMatch', destinationId: 'japan' });
    for (const state of [
      null, undefined, 'japan', {}, { quizIntent: null },
      { quizIntent: { kind: 'general', destinationId: 'japan' } },
      { quizIntent: { kind: 'destinationMatch', destinationId: 42 } },
      { quizIntent: { kind: 'destinationMatch', destinationId: 'atlantis' } },
      { quizIntent: { kind: 'destinationMatch', destinationId: 'il' } },
      { quizIntent: { kind: 'destinationMatch', destinationId: 'israel' } },
    ]) {
      expect(readDestinationMatchIntent(state), JSON.stringify(state)).toBeNull();
    }
  });
});

describe('scroll on arrival', () => {
  function Shell({ initial }: { initial: { pathname: string; state?: unknown } }) {
    return (
      <AppStateProvider>
        <PersonalizationProvider storage={memoryStorage()}>
          <MemoryRouter initialEntries={[initial]}>
            <Routes>
              <Route element={<RootLayout />}>
                <Route path="/destination/:id" element={<p>destination</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </PersonalizationProvider>
      </AppStateProvider>
    );
  }

  it('scrolls to the top on a normal page change but not when landing on the Personal Match', () => {
    stubMatchMedia();
    const spy = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
    const normal = render(<Shell initial={{ pathname: '/destination/japan' }} />);
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    normal.unmount();
    spy.mockClear();
    render(<Shell initial={{ pathname: '/destination/japan', state: { personalMatchFocus: true } }} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
