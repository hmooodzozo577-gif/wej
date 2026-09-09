// Phase 13.5c — TravelCostIndexInfo reachability on the real Destination
// route, both rendering branches (full destination and basic country) —
// same regression guard pattern as Destination.accommodation.test.tsx.
//
// Completion-pass update: the committed snapshot now has real World Bank
// PA.NUS.GDP.PLI coverage (see app/scripts/TRAVEL_COST_INDEX.md), and both
// probe countries below (Japan/JP, Egypt/EG) are covered by it. The
// original version of this test asserted the widget renders NOTHING,
// which was correct only while the snapshot shipped with `entries: []`.
// Asserting non-rendering now would be actively wrong (and was, in
// practice, racy: it only passed for whichever destination's lookup
// happened to still be in flight when the assertion ran, since
// getTravelCostIndex() caches one shared snapshot-load promise across
// tests). This now asserts the real, positive behavior instead: the
// dynamic index reaches the real Destination route end-to-end, on both
// the full-destination and basic-country rendering branches, without
// ever showing a fabricated price/availability/booking claim.
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

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

describe('Phase 13.5c — Travel Cost Index section reachability on the real Destination route', () => {
  it('renders the real dynamic index on the full-destination branch (japan / JP, covered by the real snapshot)', async () => {
    renderAt('/destination/japan');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('مؤشر تكلفة السفر')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
  });

  it('renders the real dynamic index on the basic-country branch (Egypt / EG, covered by the real snapshot)', async () => {
    renderAt('/destination/eg');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('مؤشر تكلفة السفر')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
  });
});
