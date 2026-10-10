// "قصة الاسم" — the footer's story-of-the-name dialog: a quiet trigger next
// to the release version, and a modal that follows the feedback dialog's
// conventions (labelled, Escape closes, focus moves in, stays in and goes
// back to the trigger).
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import type { Lang } from '../data/types';
import { APP_VERSION } from '../site/site';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

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

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderLayout(lang: Lang, path = '/') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Header />
        <main><button type="button">page content</button></main>
        <Footer />
        <LocationProbe />
      </MemoryRouter>
    </Providers>,
  );
}

function footer(container: HTMLElement): HTMLElement {
  return container.querySelector('footer') as HTMLElement;
}

describe('the brand in the header and footer', () => {
  it.each<[Lang, string]>([
    ['ar', 'تِلقاء — الصفحة الرئيسية'],
    ['en', 'TILQAA — Home'],
  ])('%s: the header shows the approved logo cuts inside an accessible home button', (lang, label) => {
    const { container } = renderLayout(lang, '/explore');
    const header = container.querySelector('header') as HTMLElement;
    const home = within(header).getByRole('button', { name: label });
    expect(home).toHaveClass('brand');
    // Desktop, narrow-header and very-narrow cuts; CSS shows one at a time.
    expect([...home.querySelectorAll('svg')].map((svg) => svg.dataset.variant)).toEqual(['horizontal', 'compact', 'symbolSmall']);
    for (const svg of home.querySelectorAll('svg')) expect(svg).toHaveAttribute('aria-hidden', 'true');
    // The logo is the visible name now; it is never retyped as text.
    expect(home.querySelector('.brand-name')).toBeNull();
    expect(home.textContent).toBe('');
    fireEvent.click(home);
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it.each<Lang>(['ar', 'en'])('%s: the footer shows the horizontal logo as a named image, and the version', (lang) => {
    const { container } = renderLayout(lang);
    const logo = footer(container).querySelector('.footer-brand svg') as SVGElement;
    expect(logo.dataset.variant).toBe('horizontal');
    expect(logo).toHaveAttribute('role', 'img');
    expect(logo).toHaveAttribute('aria-label', 'تِلقاء — TILQAA');
    const brand = lang === 'ar' ? 'تِلقاء' : 'TILQAA';
    expect(footer(container).querySelector('.footer-version')?.textContent).toBe(`${brand} v${APP_VERSION}`);
  });
});

describe('where the story lives', () => {
  it.each<Lang>(['ar', 'en'])('%s: only the footer offers it, and it never opens by itself', (lang) => {
    const { container } = renderLayout(lang);
    expect(container.querySelectorAll('.name-story-trigger')).toHaveLength(1);
    expect(footer(container).querySelector('.name-story-trigger')).not.toBeNull();
    expect(container.querySelector('header .name-story-trigger')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    // None of the story is on the page until the reader asks for it.
    expect(document.body.textContent).not.toContain(VERSE);
    expect(document.body.textContent).not.toMatch(/إبرة تشير إلى وجهتك|A needle pointing to your destination/);
  });

  it('is mounted by the footer and nowhere else in the app', () => {
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
    const mounts = files.filter((file) => /<NameStoryDialog\b/.test(readFileSync(resolve(SRC, file), 'utf8')));
    expect(mounts.map((file) => file.replaceAll('\\', '/'))).toEqual(['components/layout/Footer.tsx']);
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
    // The approved story, in order: the name (with the verse and its
    // reference between the introduction and the explanation), the symbol,
    // then the promise.
    const sequence = [...dialog.querySelectorAll('.name-story-body h3, .name-story-body p, .name-story-body blockquote, .name-story-body cite')]
      .map((node) => node.textContent);
    expect(sequence).toEqual([
      'معنى الاسم',
      'لم يكن اختيار اسم تِلقاء مجرد اختيار لاسم مميز، بل كان اختيارًا لمعنى يحمل في طيّاته روح الرحلة والتوجّه والاكتشاف.',
      'قال الله تعالى:',
      VERSE,
      REFERENCE,
      'تأتي كلمة «تِلقاء» في هذه الآية بمعنى نحو مدين أو باتجاهها، في مشهد يصوّر بداية رحلة نحو وجهة جديدة، مع الأمل في الوصول إلى الطريق الصحيح.',
      'ومن هذا المعنى استُلهم اسم تِلقاء؛ ليكون رفيقك في اكتشاف العالم، والتعرّف على وجهات جديدة، والعثور على المكان الذي يستحق أن يكون رحلتك القادمة.',
      'إبرة تشير إلى وجهتك',
      'في شعار تِلقاء رُسمت نقطتا التاء على هيئة إبرة اتجاه، تستحضر البوصلة ومعرفة الطريق. ويميّز نصفها الزعفراني جهة الوجهة ويُبرزها، فيما يربط الحرف العربي المرسوم خصيصًا للشعار الرمزَ باسم تِلقاء مباشرة. ومعًا يعبّر الاسم والرمز عن الاتجاه والاكتشاف والسفر.',
      'تِلقاء — العالم في اتجاهك.',
      'TILQAA — The World Within Your Reach.',
    ]);
    expect(dialog.querySelector('.name-story-tagline')?.textContent).toBe('تِلقاء — العالم في اتجاهك.');
    expect(dialog.querySelector('.name-story-tagline-alt')).toHaveAttribute('lang', 'en');
    expect(dialog.querySelector('.name-story-tagline-alt')).toHaveAttribute('dir', 'ltr');
    // The symbol is shown with the approved artwork and described in words.
    const symbol = dialog.querySelector('.name-story-symbol svg') as SVGElement;
    expect(symbol.dataset.variant).toBe('symbol');
    expect(symbol).toHaveAttribute('role', 'img');
    expect(symbol).toHaveAttribute('aria-label', 'رمز تِلقاء: حرف التاء ونقطتاه إبرة اتجاه');
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['معنى الاسم', 'إبرة تشير إلى وجهتك']);
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
    // The verse is text, never a picture of text.
    expect(dialog.querySelector('.name-story-verse img, .name-story-verse svg, .name-story-verse canvas')).toBeNull();
  });

  it('gives English readers the story in English and the verse in its original Arabic, without an invented translation', () => {
    const { container } = renderLayout('en');
    fireEvent.click(within(footer(container)).getByRole('button', { name: 'The story of the name' }));
    const dialog = screen.getByRole('dialog', { name: 'TILQAA — Every Destination Has a Story' });
    expect(dialog.textContent).toContain('Al-Qasas 28:22');
    expect(dialog.textContent).toContain('The verse is quoted in its original Arabic.');
    expect(dialog.querySelector('.name-story-tagline')?.textContent).toBe('TILQAA — The World Within Your Reach.');
    expect(dialog.querySelector('.name-story-tagline-alt')?.textContent).toBe('تِلقاء — العالم في اتجاهك.');
    expect(dialog.querySelector('.name-story-tagline-alt')).toHaveAttribute('lang', 'ar');
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['The meaning of the name', 'A needle pointing to your destination']);
    expect(dialog.textContent).toContain('In the TILQAA mark, the two dots of the Arabic letter ta are drawn as a direction needle, recalling a compass and the idea of finding your way. Its saffron half marks out the direction of the destination, while the custom-drawn Arabic letter ties the symbol directly to the name. Together, the name and the symbol speak of direction, discovery and travel.');
    expect(dialog.querySelector('.name-story-symbol svg')).toHaveAttribute('aria-label', 'The TILQAA symbol: the letter ta with its dots drawn as a direction needle');
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
