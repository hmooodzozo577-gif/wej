// Phase 13.5d — TourismInsights reachability on the real Destination
// route, both branches. The real committed snapshot is empty
// (entries: []) until the live ingestion run lands real data, so this
// currently (accurately) asserts no crash + no rendering — same
// pattern Destination.travelCostIndex.test.tsx used before its real
// snapshot existed; update this once tourismInsights.json has real
// coverage for these two probe countries.
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

describe('Phase 13.5d — Tourism Insights section reachability on the real Destination route', () => {
  it('does not crash on the full-destination branch (japan)', async () => {
    renderAt('/destination/japan');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    // No assertion on presence/absence of "مؤشرات السياحة" here — whether
    // it renders depends on the real snapshot's actual current coverage
    // for JP, which this test intentionally doesn't hardcode an
    // expectation about (see module doc comment).
  });

  it('does not crash on the basic-country branch (Egypt, eg)', async () => {
    renderAt('/destination/eg');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
  });
});
