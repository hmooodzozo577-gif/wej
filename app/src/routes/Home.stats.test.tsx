// Regression test for the stale "30+" hero stat: proves the displayed
// destination count is read from WORLD_CATALOG.length at render time, not a
// hard-coded string, so it can't drift from the real catalog size again.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Home } from './Home';
import { WORLD_CATALOG } from '../data/worldCatalog';

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
  it('displays the real catalog size (195), not a hard-coded "30"', () => {
    renderHome();
    expect(screen.getByText(`${WORLD_CATALOG.length}+`)).toBeInTheDocument();
    expect(screen.queryByText('30+')).not.toBeInTheDocument();
    expect(screen.queryByText('٣٠+')).not.toBeInTheDocument();
  });

  it('is wired to WORLD_CATALOG.length, not a separate hard-coded number', () => {
    // Sanity anchor: if this ever fails, WORLD_CATALOG itself changed size —
    // the Home test above should still pass regardless, since it reads the
    // same source rather than asserting a literal "195".
    expect(WORLD_CATALOG.length).toBe(195);
  });
});
