// Phase 13.5a — Accommodation section on the real Destination detail
// route. Confirms the section is actually reachable through the app (not
// just unit-testable in isolation) and is integrated consistently into
// BOTH rendering branches Destination.tsx has — a full, recommendation-
// ready destination and a basic (Phase 10) country — the same two
// branches TravelInfo (Phase 13.6) is already integrated into, so this
// guards against exactly the regression the phase warned about
// (one branch getting the section, the other silently not).
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

function renderAt(path: string) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[{ pathname: path, state: { purpose: 'tourism' } }]}>
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Phase 13.5a — Accommodation section reachability on the real Destination route', () => {
  it('renders for a full, recommendation-ready destination (japan), with the real reused cost tier', () => {
    renderAt('/destination/japan');
    fireEvent.click(screen.getByRole('button', { name: 'عرض معلومات إضافية' }));
    expect(screen.getByText('الإقامة')).toBeInTheDocument();
    expect(screen.getByText('مستوى تكلفة الإقامة التقريبي')).toBeInTheDocument();
    // japan is costLevel 3 -> Arabic costLevels[2] = 'مرتفعة' — the same
    // word is also used elsewhere on the page (e.g. visa difficulty), so
    // assert the guidance sentence (unique to this section) instead of
    // the bare tier word.
    expect(screen.getByText(/أعلى تكلفة نسبيًا/)).toBeInTheDocument();
  });

  it('renders nothing for a basic (not recommendation-ready) country (Egypt, eg) — no fabricated cost data', () => {
    renderAt('/destination/eg');
    fireEvent.click(screen.getByRole('button', { name: 'عرض معلومات إضافية' }));
    expect(screen.queryByText('الإقامة')).not.toBeInTheDocument();
  });

  it('does not regress the existing Country Information section on the full-destination branch', () => {
    renderAt('/destination/japan');
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
  });

  it('does not regress the existing Country Information section on the basic-country branch', () => {
    renderAt('/destination/eg');
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
  });

  it('never shows a fabricated price/availability/booking claim on the full-destination branch', () => {
    renderAt('/destination/japan');
    fireEvent.click(screen.getByRole('button', { name: 'عرض معلومات إضافية' }));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
    expect(text.toLowerCase()).not.toMatch(/book now|available tonight|rooms? left|reserve/);
  });
});
