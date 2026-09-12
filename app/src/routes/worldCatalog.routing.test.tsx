// Phase 10 — F. Routing: /destination/:id must keep working for the
// original 30 destinations exactly as before, and must not crash for any
// country without an editorial profile or for an unknown id.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { DESTINATIONS } from '../data/destinations';
import { BASIC_COUNTRIES } from '../data/basicCountries';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';

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

  it(
    'every one of the original 30 destinations opens without crashing',
    () => {
      for (const d of DESTINATIONS) {
        const { unmount } = renderAt(`/destination/${d.id}`);
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        unmount();
      }
    },
    // Renders and unmounts up to 30 full detail pages (now also resolving
    // borders per page since Phase 11 Step 3) in one test — comfortably
    // under the default 5s on a normal machine, but can brush against it
    // under sandboxed/loaded CI, so give it real headroom rather than
    // letting an unrelated slow run report a false failure here.
    20000,
  );

  it('a new basic-country route renders a graceful state, not a crash (e.g. Egypt)', () => {
    const { container } = renderAt('/destination/eg');
    expect(screen.getByText('مصر')).toBeInTheDocument();
    expect(container.textContent).toContain('مصر دولة تقع في أفريقيا');
    expect(container.textContent).not.toContain('لا تتوفر بيانات كافية');
    expect(container.textContent).not.toContain('لا تتوفر بعد بيانات كافية');
  });

  it(
    'every country without an editorial profile opens without crashing',
    () => {
      for (const c of BASIC_COUNTRIES) {
        const { unmount } = renderAt(`/destination/${c.id}`);
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        unmount();
      }
    },
    20000,
  );

  it('an unknown id shows a safe "not found" state, not a crash', () => {
    renderAt('/destination/does-not-exist');
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('an excluded country (see excludedCountries.ts) is not resolvable — same "not found" state as an unknown id, no special-case hack', () => {
    for (const excluded of EXCLUDED_COUNTRIES) {
      renderAt(`/destination/${excluded.iso2.toLowerCase()}`);
      expect(screen.getByText('Not found')).toBeInTheDocument();
    }
  });

  it('sanity: WORLD_CATALOG route coverage matches its own (post-exclusion) length', () => {
    expect(WORLD_CATALOG).toHaveLength(195 - EXCLUDED_COUNTRIES.length);
  });
});
