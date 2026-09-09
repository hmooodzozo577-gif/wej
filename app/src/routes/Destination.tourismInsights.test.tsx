// Phase 13.5d — TourismInsights reachability on the real Destination
// route, both branches. The real committed snapshot now has real
// coverage for Japan (JP, full-destination branch); Egypt (EG, basic-
// country branch) is also covered by the real snapshot's 187 entries.
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
  it('renders the real tourism data on the full-destination branch (japan / JP, covered)', async () => {
    renderAt('/destination/japan');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('مؤشرات السياحة')).toBeInTheDocument());
  });

  it('renders the real tourism data on the basic-country branch (Egypt, eg, covered)', async () => {
    renderAt('/destination/eg');
    await waitFor(() => expect(screen.getByText('معلومات الدولة')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('مؤشرات السياحة')).toBeInTheDocument());
  });
});
