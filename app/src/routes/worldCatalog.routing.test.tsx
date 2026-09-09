// Phase 10 — F. Routing: /destination/:id must keep working for the
// original 30 destinations exactly as before, and must not crash for any
// of the 165 new basic countries or for an unknown id.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { DESTINATIONS } from '../data/destinations';
import { BASIC_COUNTRIES } from '../data/basicCountries';

function renderAt(path: string) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Phase 10 — F. destination routing', () => {
  it('existing destination route still renders (e.g. japan)', () => {
    renderAt('/destination/japan');
    // Matched on the heading specifically: Phase 11's Country Information
    // card also shows "اليابان" as Japan's official name (identical to its
    // common name here), so the plain text is no longer unique on the page.
    expect(screen.getByRole('heading', { level: 1, name: 'اليابان' })).toBeInTheDocument();
  });

  it('every one of the original 30 destinations opens without crashing', () => {
    for (const d of DESTINATIONS) {
      const { unmount } = renderAt(`/destination/${d.id}`);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });

  it('a new basic-country route renders a graceful state, not a crash (e.g. Egypt)', () => {
    renderAt('/destination/eg');
    expect(screen.getByText('مصر')).toBeInTheDocument();
  });

  it('every one of the 165 basic countries opens without crashing', () => {
    for (const c of BASIC_COUNTRIES) {
      const { unmount } = renderAt(`/destination/${c.id}`);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });

  it('an unknown id shows a safe "not found" state, not a crash', () => {
    renderAt('/destination/does-not-exist');
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('sanity: WORLD_CATALOG route coverage matches its own length', () => {
    expect(WORLD_CATALOG).toHaveLength(195);
  });
});
