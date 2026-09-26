// v1.1 — the travel-need questions in the real questionnaire: asked after
// the Phase 14 questions, the language list as an accessible multi-select,
// answers saved only in the local profile, and NOTHING about them sent to
// analytics or put in the URL.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('../telemetry/productDataClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../telemetry/productDataClient')>()),
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { AppStateProvider } from '../state/AppStateContext';
import { PersonalizationProvider } from '../personalization/PersonalizationProvider';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from '../personalization/storage';
import { isTravelNeedQuestionId, travelNeedQuestionId } from '../personalization/travelNeeds';
import { I18N } from '../data/i18n';
import { Quiz } from './Quiz';

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

const pause = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 170)); });
const T = I18N.ar;

beforeEach(() => trackEvent.mockReset());

describe('travel needs in the questionnaire', () => {
  it('asks them after the Phase 14 questions, keeps them local, and sends nothing about them', async () => {
    const storage = memoryStorage();
    const { container } = render(
      <AppStateProvider>
        <PersonalizationProvider storage={storage}>
          <MemoryRouter initialEntries={['/quiz/medical']}>
            <Where />
            <Routes>
              <Route path="/quiz/:purpose" element={<Quiz />} />
              <Route path="/results" element={<p>RESULTS_PAGE</p>} />
            </Routes>
          </MemoryRouter>
        </PersonalizationProvider>
      </AppStateProvider>,
    );

    // Phase 14 questions: first option each time, continuing past the checkpoint.
    for (let step = 0; step < 20 && !screen.queryByText(/سهولة التواصل بلغة تعرفها/); step += 1) {
      const more = screen.queryByText(T.quiz.continueQuestions);
      if (more) {
        fireEvent.click(more);
        continue;
      }
      fireEvent.click(container.querySelectorAll('.q-option')[0]!);
      await pause();
    }
    expect(screen.getByRole('heading', { name: 'ما مدى أهمية سهولة التواصل بلغة تعرفها أثناء السفر؟' })).toBeInTheDocument();
    expect(screen.getByText(/يبقى جوابك على هذا المتصفح فقط/)).toBeInTheDocument();
    const coreEvents = trackEvent.mock.calls.filter(([name]) => name === 'quiz_answer').length;
    expect(coreEvents).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: 'مهم جدًا' }));
    await pause();

    // The language list: a group of checkboxes, Continue only with a choice.
    expect(screen.getByRole('group', { name: 'ما اللغات التي تستطيع استخدامها أثناء السفر؟' })).toBeInTheDocument();
    const cont = screen.getByRole('button', { name: /متابعة/ });
    expect(cont).toBeDisabled();
    const english = screen.getByRole('checkbox', { name: 'الإنجليزية' });
    const arabic = screen.getByRole('checkbox', { name: 'العربية' });
    fireEvent.click(english);
    fireEvent.click(arabic);
    expect(arabic).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(english);
    fireEvent.click(english);
    expect(cont).toBeEnabled();
    fireEvent.click(cont);
    await pause();

    expect(screen.getByRole('heading', { name: 'ما مدى أهمية سهولة ممارسة شعائرك الإسلامية أثناء السفر؟' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'مهم' }));
    await pause();
    expect(screen.getByRole('heading', { name: 'ما مدى أهمية سهولة العثور على طعام حلال في وجهتك؟' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'مهم جدًا' }));
    await pause();

    fireEvent.click(await screen.findByText(T.passport.skip));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/results'));

    // Saved in the local profile only, in canonical form.
    const profile = JSON.parse(storage.data[PERSONALIZATION_STORAGE_KEY]!);
    expect(profile.schemaVersion).toBe(2);
    expect(profile.answers).toMatchObject({
      [travelNeedQuestionId('medical', 'languageImportance')]: 100,
      [travelNeedQuestionId('medical', 'languages')]: 'ar,en',
      [travelNeedQuestionId('medical', 'islamicPractice')]: 60,
      [travelNeedQuestionId('medical', 'halalFood')]: 100,
    });
    const firstTravel = profile.path.findIndex(isTravelNeedQuestionId);
    expect(profile.path.slice(firstTravel).every(isTravelNeedQuestionId)).toBe(true);

    // Analytics: no event for these questions, no count that includes them,
    // nothing anywhere in any payload that mentions them.
    expect(trackEvent.mock.calls.filter(([name]) => name === 'quiz_answer')).toHaveLength(coreEvents);
    const generated = trackEvent.mock.calls.find(([name]) => name === 'quiz_results_generated')!;
    expect(generated[1].answerCount).toBe(Object.keys(profile.answers).filter((id: string) => !isTravelNeedQuestionId(id)).length);
    expect(JSON.stringify(trackEvent.mock.calls)).not.toMatch(/languageImportance|-languages|islamicPractice|halalFood|ar,en/);
    // And never in the URL.
    expect(screen.getByTestId('where').textContent).toBe('/results');
  });
});
