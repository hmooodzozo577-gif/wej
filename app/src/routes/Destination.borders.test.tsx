// Phase 11 Step 3 — the navigable Borders row on the Destination detail
// page: real chips (flag + localized name), correct hrefs, localization,
// and that an unresolved/excluded neighbor never produces a broken link.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { Destination } from './Destination';
import type { Lang } from '../data/types';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';

// Renders with a given starting language without going through the app's
// full navigation chrome — same technique as other route-level tests here,
// just with an explicit initial `lang` (AppStateProvider always starts at
// the default 'ar', which isn't enough to test the English chip labels).
function renderAt(path: string, lang: Lang) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

describe('Phase 11 Step 3 — Destination detail Borders row', () => {
  it('renders each resolved neighbor as a link with the correct destination href (Arabic)', () => {
    renderAt('/destination/france', 'ar');
    const germanyLink = screen.getByRole('link', { name: /ألمانيا/ });
    expect(germanyLink).toHaveAttribute('href', '/destination/germany');
  });

  it('switches to English localized names for the same border links', () => {
    renderAt('/destination/france', 'en');
    const germanyLink = screen.getByRole('link', { name: /Germany/ });
    expect(germanyLink).toHaveAttribute('href', '/destination/germany');
  });

  it('never renders a border link pointing at whatever is currently configured as excluded', () => {
    renderAt('/destination/france', 'en');
    for (const excluded of EXCLUDED_COUNTRIES) {
      const link = document.querySelector(`a.meta-chip[href="/destination/${excluded.iso2.toLowerCase()}"]`);
      expect(link, `found a border link to excluded ${excluded.iso2}`).toBeNull();
    }
  });

  it('a border link is keyboard-focusable and navigates on click to the target country\'s own page', () => {
    renderAt('/destination/france', 'en');
    const link = screen.getByRole('link', { name: /Germany/ });
    link.focus();
    expect(link).toHaveFocus();
    fireEvent.click(link);
    expect(screen.getByRole('heading', { level: 1, name: 'Germany' })).toBeInTheDocument();
  });

  it('a country with no land borders (Japan) shows no Borders row at all', () => {
    renderAt('/destination/japan', 'ar');
    expect(screen.queryByText('الحدود')).not.toBeInTheDocument();
  });
});
