// Regression test for the stale "30+" hero stat: proves the displayed
// destination count is read from WORLD_CATALOG.length at render time, not a
// hard-coded string, so it can't drift from the real catalog size again.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Home } from './Home';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';

function renderHome() {
  return render(
    <AppStateProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Home hero stat — destination count', () => {
  it('displays the real catalog size, not a hard-coded "30"', () => {
    renderHome();
    expect(screen.getByText(`${WORLD_CATALOG.length}+`)).toBeInTheDocument();
    expect(screen.queryByText('30+')).not.toBeInTheDocument();
    expect(screen.queryByText('٣٠+')).not.toBeInTheDocument();
  });

  it('offers both card and full Hero image candidates for the cinematic frame', () => {
    const { container } = renderHome();
    const image = container.querySelector<HTMLImageElement>('.hero-folio-image');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toMatch(/\/destinations\/[a-z]{2}\.webp$/);
    expect(image!.getAttribute('srcset')).toMatch(/\/destinations\/cards\/[a-z]{2}\.webp 960w, .*\/destinations\/[a-z]{2}\.webp \d+w$/);
    expect(image!.getAttribute('sizes')).toBe('(max-width: 760px) 100vw, min(88vw, 1240px)');
  });

  it('is wired to WORLD_CATALOG.length, not a separate hard-coded number', () => {
    // Sanity anchor: the base convention is 195 (193 UN members + 2
    // observers), minus whatever excludedCountries.ts currently configures
    // (a QA test entry today). If this ever fails, WORLD_CATALOG itself
    // changed size for some other reason — the Home test above should still
    // pass regardless, since it reads the same source rather than a literal.
    expect(WORLD_CATALOG.length).toBe(195 - EXCLUDED_COUNTRIES.length);
  });
});
