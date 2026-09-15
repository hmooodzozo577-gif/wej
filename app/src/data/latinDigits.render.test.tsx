// Item #4 — the same "Latin digits only" rule, asserted against actually
// RENDERED Arabic screens rather than against the data behind them.
//
// This is the test that would have caught the reported bug. The data-level
// checks in latinDigits.test.ts prove the content is clean; this one proves
// nothing downstream (a component's own literal, a locale-aware formatter
// reached at render time, a count-up animation) puts a non-Latin digit back
// on screen in the language where it actually happened — Arabic.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Home } from '../routes/Home';
import { Quiz } from '../routes/Quiz';
import { Explore } from '../routes/Explore';
import { PurposeSelect } from '../routes/PurposeSelect';
import { hasNonLatinDigits } from './format';

/** Every non-Latin digit visible in the rendered tree, with enough of its
 *  surrounding text to locate it. Reads textContent (what a sighted user
 *  sees) plus aria-label/title/placeholder (what a screen-reader user
 *  hears), because a digit hidden in an accessible name is just as wrong. */
function renderedOffenders(container: HTMLElement): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    if (hasNonLatinDigits(text)) found.push(`text: ${text.trim()}`);
  }
  for (const element of container.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute(attribute);
      if (value && hasNonLatinDigits(value)) found.push(`${attribute}: ${value}`);
    }
  }
  return found;
}

function renderArabic(ui: React.ReactNode, initialEntries = ['/']) {
  // Arabic is the app's default language, so the default provider state is
  // already the language this test is about — no switching needed.
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </AppStateProvider>,
  );
}

describe('rendered Arabic screens contain no Arabic-Indic or Persian digits', () => {
  it('home (hero stats, how-it-works copy)', () => {
    const { container } = renderArabic(<Home />);
    expect(renderedOffenders(container)).toEqual([]);
  });

  it('purpose selection', () => {
    const { container } = renderArabic(<PurposeSelect />);
    expect(renderedOffenders(container)).toEqual([]);
  });

  it('explore (counts, filters, sort labels, cards)', () => {
    const { container } = renderArabic(<Explore />, ['/explore']);
    expect(renderedOffenders(container)).toEqual([]);
  });

  it('explore filter dropdowns, including their OPEN option lists', () => {
    const { container } = renderArabic(<Explore />, ['/explore']);
    for (const trigger of screen.getAllByRole('combobox')) {
      trigger.click();
    }
    expect(renderedOffenders(container)).toEqual([]);
  });

  it('the questionnaire, across every purpose and its first question', () => {
    for (const purpose of ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other']) {
      const { container, unmount } = renderArabic(
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
        </Routes>,
        [`/quiz/${purpose}`],
      );
      expect(renderedOffenders(container), `purpose: ${purpose}`).toEqual([]);
      unmount();
    }
  });

  it('the budget question specifically — its SAR ranges are the densest numbers in the app', () => {
    const { container } = renderArabic(
      <Routes>
        <Route path="/quiz/:purpose" element={<Quiz />} />
      </Routes>,
      ['/quiz/tourism'],
    );
    // Walk the questionnaire until the budget question appears, answering
    // the first option each time; every screen on the way is checked too.
    for (let step = 0; step < 10; step += 1) {
      expect(renderedOffenders(container)).toEqual([]);
      const card = container.querySelector('.q-card');
      if (card && /ميزانيتك/.test(card.textContent ?? '')) {
        expect(card.textContent).toMatch(/5,000|10,000|20,000/);
        expect(hasNonLatinDigits(card.textContent ?? '')).toBe(false);
        return;
      }
      const options = within(container).queryAllByRole('radio');
      if (!options.length) break;
      options[0]!.click();
    }
  });
});
