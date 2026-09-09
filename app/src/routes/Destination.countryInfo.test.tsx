// Phase 11 Step 1 — the Country Information section on the Destination
// Detail page. Must render for both catalog entry types (a full destination
// and a basic country) and must never crash or emit an empty row when a
// field is missing (no reported currency, no land border).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Phase 11 Step 1 — Destination detail Country Information section', () => {
  it('renders for a full, recommendation-ready destination (japan)', () => {
    renderAt('/destination/japan');
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
    expect(screen.getByText('رمز الاتصال')).toBeInTheDocument();
    expect(screen.getByText('+81')).toBeInTheDocument();
  });

  it('renders for a basic (not recommendation-ready) country (Egypt, eg)', () => {
    renderAt('/destination/eg');
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
    expect(screen.getByText('رمز الاتصال')).toBeInTheDocument();
  });

  it('omits the currency row without crashing when a country has no reported currency (Micronesia, fm)', () => {
    renderAt('/destination/fm');
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
    expect(screen.queryByText('العملة')).not.toBeInTheDocument();
  });

  it('omits the borders row without crashing for an island nation with no land border (japan)', () => {
    renderAt('/destination/japan');
    expect(screen.queryByText('الدول المجاورة')).not.toBeInTheDocument();
  });

  it('shows the borders row for a country that does have land borders (Egypt, eg)', () => {
    renderAt('/destination/eg');
    expect(screen.getByText('الدول المجاورة')).toBeInTheDocument();
  });
});
