import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

function renderWithState(state?: Record<string, unknown>) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[{ pathname: '/destination/japan', state }]}>
        <Routes><Route path="/destination/:id" element={<Destination />} /></Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('contextual destination navigation', () => {
  it('uses the exact Explore order supplied by the originating list', () => {
    renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan', 'ksa'], index: 1 } });
    expect(screen.getByRole('link', { name: /الدولة السابقة\s*فرنسا/ })).toHaveAttribute('href', '/destination/france');
    expect(screen.getByRole('link', { name: /الدولة التالية\s*المملكة العربية السعودية/ })).toHaveAttribute('href', '/destination/ksa');
  });

  it('shows a surprise-again action instead of an artificial previous/next sequence', () => {
    renderWithState({ navigation: { source: 'surprise', ids: ['japan'], index: 0 } });
    expect(screen.getByRole('link', { name: /فاجئني بوجهة أخرى/ })).toHaveAttribute('href', '/explore');
    expect(screen.queryByText('الدولة السابقة')).not.toBeInTheDocument();
    expect(screen.queryByText('الدولة التالية')).not.toBeInTheDocument();
  });
});
