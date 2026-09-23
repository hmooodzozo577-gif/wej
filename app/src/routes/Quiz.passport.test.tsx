// Item #12D — the passport question must be part of the questionnaire,
// BEFORE results. Its previous home was a card below the recommendations,
// where it could not affect them by construction.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { Quiz } from './Quiz';
import { I18N } from '../data/i18n';

function renderQuiz(purpose = 'tourism') {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[`/quiz/${purpose}`]}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
          <Route path="/purpose" element={<div>PURPOSE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

/** Answers the first option repeatedly until the checkpoint appears. */
async function answerUntilCheckpoint(container: HTMLElement) {
  for (let step = 0; step < 12; step += 1) {
    if (screen.queryByText(I18N.ar.quiz.showResultsNow)) return;
    const options = container.querySelectorAll('.q-option');
    if (!options.length) return;
    await act(async () => {
      fireEvent.click(options[0]!);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  }
}

describe('the passport step sits between the questionnaire and the results', () => {
  it('is reached from "show results now" instead of going straight to results', async () => {
    const { container } = renderQuiz();
    await answerUntilCheckpoint(container);
    fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));

    expect(await screen.findByText(I18N.ar.passport.title)).toBeInTheDocument();
    expect(screen.queryByText('RESULTS_PAGE')).not.toBeInTheDocument();
  });

  it('explains why it is asked, before it is asked', async () => {
    const { container } = renderQuiz();
    await answerUntilCheckpoint(container);
    fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));
    await screen.findByText(I18N.ar.passport.title);

    expect(screen.getByText(I18N.ar.passport.body)).toBeInTheDocument();
    expect(screen.getByText(I18N.ar.passport.privacyNote)).toBeInTheDocument();
  });

  // Acceptance item #5 — the user could not tell WHY the passport was being
  // asked for. Each of the five things the explanation has to convey is
  // asserted against the copy, in both languages, so a future rewrite that
  // drops one of them fails here rather than in production.
  describe('item #5 — the explanation is complete and does not overclaim', () => {
    it('shows the purpose line, the entry-information line and the partial-coverage line', async () => {
      const { container } = renderQuiz();
      await answerUntilCheckpoint(container);
      fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));
      await screen.findByText(I18N.ar.passport.title);

      expect(screen.getByText(I18N.ar.passport.purposeNote)).toBeInTheDocument();
      expect(screen.getByText(I18N.ar.passport.entryNote)).toBeInTheDocument();
      // Phase 19 P17 — coverage is partial and the step says so, with the
      // count read from the snapshot itself.
      expect(await screen.findByText(/التغطية جزئية: \d+ وجهة حاليًا/)).toBeInTheDocument();
    });

    for (const lang of ['ar', 'en'] as const) {
      it(`says it is optional, entry-requirement-scoped, not location, and number-free (${lang})`, () => {
        const p = I18N[lang].passport;
        const all = `${p.title} ${p.body} ${p.purposeNote} ${p.entryNote} ${p.privacyNote}`;

        const optional = lang === 'ar' ? ['اختياري', 'تخطي'] : ['Optional', 'skip'];
        const entry = lang === 'ar' ? ['متطلبات الدخول', 'التأشيرة'] : ['entry', 'visa'];
        const notLocation = lang === 'ar' ? ['ليست موقعك'] : ['not your location'];
        const noNumber = lang === 'ar' ? ['لا نطلب رقم جواز السفر'] : ['never ask for'];
        const issuingCountry = lang === 'ar' ? ['الدولة التي أصدرت'] : ['country that issued'];

        for (const group of [optional, entry, notLocation, noNumber, issuingCountry]) {
          expect(group.some((phrase) => all.includes(phrase)), `${lang}: ${group.join(' / ')}`).toBe(true);
        }
      });

      it(`says the passport is information only and stays on the device (${lang})`, () => {
        const p = I18N[lang].passport;
        // Phase 19 P15 — no ranking effect, stated plainly.
        const noRanking = lang === 'ar' ? 'لا يغيّر اختيارك ترتيب التوصيات' : 'does not change the order of your recommendations';
        expect(p.entryNote.includes(noRanking)).toBe(true);
        // P14 — the lookup is local; the copy must not promise less.
        const local = lang === 'ar' ? 'ولا تُرسل إلى خوادمنا' : 'never sent to our servers';
        expect(p.privacyNote.includes(local)).toBe(true);
        // Nothing may claim that the passport reorders or rescores anything.
        const overclaim = lang === 'ar' ? ['تقديم الوجهة الأسهل', 'يرفع'] : ['orders the closer', 'boosts'];
        for (const phrase of overclaim) expect(`${p.body} ${p.purposeNote} ${p.entryNote} ${p.privacyNote}`.includes(phrase)).toBe(false);
      });
    }
  });

  it('offers a real skip that goes on to the results', async () => {
    const { container } = renderQuiz();
    await answerUntilCheckpoint(container);
    fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));
    await screen.findByText(I18N.ar.passport.title);

    fireEvent.click(screen.getByText(I18N.ar.passport.skip));
    await waitFor(() => expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument());
  });

  it('lets a passport be chosen from a searchable listbox, then continues', async () => {
    const { container } = renderQuiz();
    await answerUntilCheckpoint(container);
    fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));
    await screen.findByText(I18N.ar.passport.title);

    const trigger = screen.getByRole('combobox', { name: I18N.ar.passport.label });
    fireEvent.click(trigger);
    const search = screen.getByPlaceholderText(I18N.ar.passport.searchPlaceholder);
    fireEvent.change(search, { target: { value: 'اليابان' } });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]!);

    await waitFor(() => expect(trigger).toHaveTextContent('اليابان'));
    fireEvent.click(screen.getByText(I18N.ar.passport.continueCta));
    await waitFor(() => expect(screen.getByText('RESULTS_PAGE')).toBeInTheDocument());
  });

  it('is asked for every purpose, not just tourism', async () => {
    for (const purpose of ['education', 'work', 'medical', 'investment']) {
      const { container, unmount } = renderQuiz(purpose);
      await answerUntilCheckpoint(container);
      const showResults = screen.queryByText(I18N.ar.quiz.showResultsNow);
      if (showResults) fireEvent.click(showResults);
      expect(await screen.findByText(I18N.ar.passport.title), purpose).toBeInTheDocument();
      unmount();
    }
  });

  it('never infers the passport from anything — it starts empty', async () => {
    const { container } = renderQuiz();
    await answerUntilCheckpoint(container);
    fireEvent.click(screen.getByText(I18N.ar.quiz.showResultsNow));
    await screen.findByText(I18N.ar.passport.title);

    expect(screen.getByRole('combobox', { name: I18N.ar.passport.label })).toHaveTextContent(
      I18N.ar.passport.placeholder,
    );
  });
});
