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

  // Acceptance fix — "Best suited for" must be visible WITHOUT opening
  // "Additional information", and must appear ABOVE it in document order,
  // since it is primary decision-support information and "Additional
  // information" is secondary detail.
  it('shows "Best suited for" without opening Additional information, positioned above the toggle', () => {
    renderDestination();
    const bestSuitedForCard = document.querySelector('.best-suited-for-card');
    expect(bestSuitedForCard).toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: 'عرض معلومات إضافية' });
    // DOCUMENT_POSITION_FOLLOWING means the toggle comes AFTER (below) the
    // best-suited-for card in the DOM, i.e. the card is above it.
    // eslint-disable-next-line no-bitwise
    expect(bestSuitedForCard!.compareDocumentPosition(toggleButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Best suited for" is not duplicated once Additional information is opened', () => {
    renderDestination();
    fireEvent.click(screen.getByRole('button', { name: 'عرض معلومات إضافية' }));
    expect(document.querySelectorAll('.best-suited-for-card').length).toBe(1);
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
