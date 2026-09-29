// v1.1 RC2 — Favorites lives in the header only; the footer stays
// informational: brand, feedback, the note and the release version.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../../state/context';
import { appReducer, initialAppState } from '../../state/reducer';
import type { Lang } from '../../data/types';
import { APP_VERSION } from '../../site/site';
import { FAVORITES_COPY } from '../../favorites/copy';
import { Footer } from './Footer';
import { Header } from './Header';

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

function renderLayout(lang: Lang) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={['/']}>
        <Header />
        <Footer />
      </MemoryRouter>
    </Providers>,
  );
}

describe('Footer and header Favorites', () => {
  it.each<Lang>(['ar', 'en'])('%s: the footer has no Favorites link and still shows the version', (lang) => {
    const { container } = renderLayout(lang);
    const footer = container.querySelector('footer') as HTMLElement;
    expect(within(footer).queryByText(FAVORITES_COPY[lang].nav)).toBeNull();
    expect(footer.querySelector('a[href*="favorites"]')).toBeNull();
    expect(footer.querySelector('.footer-version')?.textContent).toContain(`v${APP_VERSION}`);
  });

  it.each<Lang>(['ar', 'en'])('%s: the header nav and the mobile menu both keep Favorites', (lang) => {
    const { container } = renderLayout(lang);
    const header = container.querySelector('header') as HTMLElement;
    expect(within(header.querySelector('.nav-links') as HTMLElement).getByText(FAVORITES_COPY[lang].nav)).toHaveClass('navlink-favorites');
    expect(within(header.querySelector('.mobile-menu') as HTMLElement).getByText(FAVORITES_COPY[lang].nav)).toBeInTheDocument();
    expect(screen.getAllByText(FAVORITES_COPY[lang].nav)).toHaveLength(2);
  });
});
