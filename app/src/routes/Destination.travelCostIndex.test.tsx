// Phase 13.5c — TravelCostIndexInfo reachability on the real Destination
// route, both rendering branches (full destination and basic country) —
// same regression guard pattern as Destination.accommodation.test.tsx.
// Renders nothing today (real committed snapshot is empty), which this
// asserts explicitly rather than just "doesn't crash".
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
  it('does not crash and shows no dynamic index yet (empty snapshot) on the full-destination branch (japan)', async () => {
    renderAt('/destination/japan');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    expect(screen.queryByText('مؤشر تكلفة السفر')).not.toBeInTheDocument();
  });

  it('does not crash and shows no dynamic index yet on the basic-country branch (Egypt, eg)', async () => {
    renderAt('/destination/eg');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    expect(screen.queryByText('مؤشر تكلفة السفر')).not.toBeInTheDocument();
  });
});
