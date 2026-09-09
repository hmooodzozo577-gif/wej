// Confirms the excludedCountries.ts mechanism reaches Explore: an excluded
// country must not appear in the list, the count, or search results — not
// merely be hidden with CSS. Exercised against the current QA fixture
// (Monaco — see data/excludedCountries.ts).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Explore } from './Explore';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';

function renderExplore() {
  return render(
    <AppStateProvider>
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    </AppStateProvider>,
  );
}

// Each test here renders the full ~194-card Explore grid once; comfortably
// fast on a normal machine but can brush against Vitest's 5s default under
// a loaded/sandboxed CI, so give real headroom instead of risking a false
// failure unrelated to the actual assertions.
const FULL_GRID_TIMEOUT = 20000;

describe('Explore — excluded countries are absent from the underlying data, not just hidden', () => {
  it(
    'the result count matches the effective (post-exclusion) WORLD_CATALOG length',
    () => {
      renderExplore();
      const countEl = document.querySelector('.explore-count');
      expect(countEl?.textContent).toContain(String(WORLD_CATALOG.length));
    },
    FULL_GRID_TIMEOUT,
  );

  it(
    'no card links to an excluded country\'s destination id',
    () => {
      renderExplore();
      for (const excluded of EXCLUDED_COUNTRIES) {
        const link = document.querySelector(`a[data-open="${excluded.iso2.toLowerCase()}"]`);
        expect(link, `found a card for excluded ${excluded.iso2}`).toBeNull();
      }
    },
    FULL_GRID_TIMEOUT,
  );

  it(
    'an excluded country\'s name does not appear anywhere on the page',
    () => {
      renderExplore();
      // Monaco's English/Arabic names, used only as the assertion target
      // here — the exclusion itself is driven entirely by excludedCountries.ts.
      expect(screen.queryByText('Monaco')).not.toBeInTheDocument();
      expect(screen.queryByText('موناكو')).not.toBeInTheDocument();
    },
    FULL_GRID_TIMEOUT,
  );
});
