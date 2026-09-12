import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

function renderDestination(fromResults = false) {
  return render(
    <AppStateProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/destination/japan',
            state: fromResults ? { fromResults: true, purpose: 'tourism' } : undefined,
          },
        ]}
      >
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('optional destination planning information', () => {
  it('does not mount travel-planning sections when the traveler did not ask for them', () => {
    renderDestination();
    expect(screen.getByText('معلومات الدولة')).toBeInTheDocument();
    expect(screen.queryByText('السفر')).not.toBeInTheDocument();
    expect(screen.queryByText('الإقامة')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'عرض معلومات إضافية' })).toBeInTheDocument();
  });

  it('mounts the optional sections only after the traveler opens them', () => {
    renderDestination();
    fireEvent.click(screen.getByRole('button', { name: 'عرض معلومات إضافية' }));
    expect(screen.getByText('السفر')).toBeInTheDocument();
    expect(screen.getByText('الإقامة')).toBeInTheDocument();
  });

  it('keeps trip-planning information optional when arriving from a tourism result', () => {
    renderDestination(true);
    expect(screen.queryByText('السفر')).not.toBeInTheDocument();
    expect(screen.queryByText('الإقامة')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'عرض معلومات إضافية' })).toBeInTheDocument();
  });
});
