// "قصة الاسم" — the footer's story-of-the-name dialog: a quiet trigger next
// to the release version, and a modal that follows the feedback dialog's
// conventions (labelled, Escape closes, focus moves in, stays in and goes
// back to the trigger).
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import type { Lang } from '../data/types';
import { APP_VERSION } from '../site/site';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';

// Header -> ThemeSwitch reads matchMedia.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const VERSE = '﴿وَلَمّا تَوَجَّهَ تِلقاءَ مَديَنَ قالَ عَسى رَبّي أَن يَهدِيَني سَواءَ السَّبيلِ﴾';
const REFERENCE = '[القصص: ٢٢]';

function renderLayout(lang: Lang) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={['/']}>
        <Header />
        <main><button type="button">page content</button></main>
        <Footer />
      </MemoryRouter>
    </Providers>,
  );
}

function footer(container: HTMLElement): HTMLElement {
  return container.querySelector('footer') as HTMLElement;
}

describe('the brand in the header and footer', () => {
  it.each<[Lang, string, string]>([
    ['ar', 'تِلقاء', 'تِلقاء — الصفحة الرئيسية'],
    ['en', 'TILQAA', 'TILQAA — Home'],
  ])('%s: shows the new name and keeps it in the home button\'s accessible name', (lang, brand, label) => {
    const { container } = renderLayout(lang);
    const header = container.querySelector('header') as HTMLElement;
    const home = within(header).getByRole('button', { name: label });
    expect(home).toHaveClass('brand');
    expect(home.querySelector('.brand-name')?.textContent).toBe(brand);
    expect(footer(container).querySelector('.brand-name')?.textContent).toBe(brand);
    expect(footer(container).querySelector('.footer-version')?.textContent).toBe(`${brand} v${APP_VERSION}`);
  });
});

describe('قصة الاسم', () => {
  it.each<[Lang, string]>([['ar', 'قصة الاسم'], ['en', 'The story of the name']])(
    '%s: the footer offers the story as a secondary button beside the version',
    (lang, label) => {
      const { container } = renderLayout(lang);
      const trigger = within(footer(container)).getByRole('button', { name: label });
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).not.toHaveClass('btn-primary');
      expect(trigger.closest('.footer-meta')?.querySelector('.footer-version')).not.toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('opens a labelled modal dialog with the approved Arabic story', () => {
    const { container } = renderLayout('ar');
    fireEvent.click(within(footer(container)).getByRole('button', { name: 'قصة الاسم' }));
    const dialog = screen.getByRole('dialog', { name: 'تِلقاء — لكل وجهة حكاية' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { level: 2, name: 'تِلقاء — لكل وجهة حكاية' })).toBeInTheDocument();
    // The approved story, in order, with the verse and its reference between
    // the introduction and the explanation.
    const sequence = [...dialog.querySelectorAll('.name-story-body > p, .name-story-body > figure blockquote, .name-story-body > figure cite')]
      .map((node) => node.textContent);
    expect(sequence).toEqual([
      'لم يكن اختيار اسم تِلقاء مجرد اختيار لاسم مميز، بل كان اختيارًا لمعنى يحمل في طيّاته روح الرحلة والتوجّه والاكتشاف.',
      'قال الله تعالى:',
      VERSE,
      REFERENCE,
      'تأتي كلمة «تِلقاء» في هذه الآية بمعنى نحو مدين أو باتجاهها، في مشهد يصوّر بداية رحلة نحو وجهة جديدة، مع الأمل في الوصول إلى الطريق الصحيح.',
      'ومن هذا المعنى استُلهم اسم تِلقاء؛ ليكون رفيقك في اكتشاف العالم، والتعرّف على وجهات جديدة، والعثور على المكان الذي يستحق أن يكون رحلتك القادمة.',
      'تِلقاء — العالم في اتجاهك.',
    ]);
    expect(dialog.querySelector('.name-story-tagline')?.textContent).toBe('تِلقاء — العالم في اتجاهك.');
  });

  it.each<Lang>(['ar', 'en'])('%s: quotes the verse and its reference exactly, as real Arabic text', (lang) => {
    const { container } = renderLayout(lang);
    fireEvent.click(footer(container).querySelector('.name-story-trigger') as HTMLElement);
    const dialog = screen.getByRole('dialog');
    const verse = dialog.querySelector('blockquote') as HTMLElement;
    expect(verse.textContent).toBe(VERSE);
    expect(verse).toHaveAttribute('lang', 'ar');
    expect(verse).toHaveAttribute('dir', 'rtl');
    const reference = dialog.querySelector('figcaption cite') as HTMLElement;
    expect(reference.textContent).toBe(REFERENCE);
    expect(reference).toHaveAttribute('lang', 'ar');
    expect(dialog.querySelector('img, svg[role="img"]')).toBeNull();
  });

  it('gives English readers the story in English and the verse in its original Arabic, without an invented translation', () => {
    const { container } = renderLayout('en');
    fireEvent.click(within(footer(container)).getByRole('button', { name: 'The story of the name' }));
    const dialog = screen.getByRole('dialog', { name: 'TILQAA — Every Destination Has a Story' });
    expect(dialog.textContent).toContain('Al-Qasas 28:22');
    expect(dialog.textContent).toContain('The verse is quoted in its original Arabic.');
    expect(dialog.querySelector('.name-story-tagline')?.textContent).toBe('TILQAA — The World Within Your Reach.');
    expect(dialog.textContent).not.toMatch(/when he (turned|directed)|my Lord will guide/i);
  });

  it('moves focus into the dialog, keeps Tab inside it and closes on Escape with focus back on the trigger', () => {
    const { container } = renderLayout('ar');
    const trigger = within(footer(container)).getByRole('button', { name: 'قصة الاسم' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Focus starts on the dialog itself; Shift+Tab wraps to its last control.
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    const close = within(dialog).getByRole('button', { name: 'إغلاق' });
    expect(close).toHaveFocus();
    // On the only control, the browser's own Tab move is cancelled both ways,
    // so focus cannot leave for the page behind.
    expect(fireEvent.keyDown(window, { key: 'Tab' })).toBe(false);
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(close).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes from its close button and from the backdrop, never from a click inside the dialog', () => {
    const { container } = renderLayout('en');
    const trigger = within(footer(container)).getByRole('button', { name: 'The story of the name' });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    // The backdrop's mousedown is cancelled: otherwise the browser moves
    // focus to <body> after the dialog has already handed it back.
    expect(fireEvent.mouseDown(backdrop)).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
