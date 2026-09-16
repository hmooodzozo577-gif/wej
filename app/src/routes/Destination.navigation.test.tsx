import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

function renderWithState(state?: Record<string, unknown>, id = 'japan') {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[{ pathname: `/destination/${id}`, state }]}>
        <Routes><Route path="/destination/:id" element={<Destination />} /></Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('contextual destination navigation', () => {
  it('uses the exact Explore order supplied by the originating list', () => {
    renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan', 'ksa'], index: 1 } });
    expect(screen.getByRole('link', { name: /الدولة السابقة: فرنسا/ })).toHaveAttribute('href', '/destination/france');
    expect(screen.getByRole('link', { name: /الدولة التالية: المملكة العربية السعودية/ })).toHaveAttribute('href', '/destination/ksa');
  });

  it('uses the exact recommendation order supplied by Results', () => {
    renderWithState({ navigation: { source: 'results', ids: ['ksa', 'japan', 'france'], index: 1 } });
    expect(screen.getByRole('link', { name: /الدولة السابقة: المملكة العربية السعودية/ })).toHaveAttribute('href', '/destination/ksa');
    expect(screen.getByRole('link', { name: /الدولة التالية: فرنسا/ })).toHaveAttribute('href', '/destination/france');
  });

  it('shows a surprise-again action instead of an artificial previous/next sequence', () => {
    renderWithState({ navigation: { source: 'surprise', ids: ['japan'], index: 0 } });
    expect(screen.getByRole('link', { name: /فاجئني بوجهة أخرى/ })).toHaveAttribute('href', '/explore');
    expect(screen.queryByText('الدولة السابقة')).not.toBeInTheDocument();
    expect(screen.queryByText('الدولة التالية')).not.toBeInTheDocument();
  });

  it('omits the edge control that has no sibling, at either end of the list', () => {
    const { unmount } = renderWithState({ navigation: { source: 'explore', ids: ['japan', 'ksa'], index: 0 } });
    expect(screen.queryByRole('link', { name: /الدولة السابقة/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /الدولة التالية: المملكة العربية السعودية/ })).toBeInTheDocument();
    unmount();

    renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan'], index: 1 } });
    expect(screen.getByRole('link', { name: /الدولة السابقة: فرنسا/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /الدولة التالية/ })).not.toBeInTheDocument();
  });

  it('falls back to a direct-link order when no navigation context was supplied', () => {
    renderWithState(undefined);
    // A direct visit still gets siblings — from the localized alphabetical
    // fallback list — so the hero controls are never dead on a shared link.
    const previous = screen.queryByRole('link', { name: /الدولة السابقة/ });
    const next = screen.queryByRole('link', { name: /الدولة التالية/ });
    expect(previous ?? next).toBeTruthy();
  });

  // Item #3: the controls must be INSIDE the hero image, not in a pair of
  // full-width cards below it. The user's marked-up screenshot is explicit
  // about this, so it is asserted structurally rather than left to review.
  describe('item #3 — the controls live inside the hero image', () => {
    it('renders each control as a child of .detail-hero, not of a below-hero pager', () => {
      const { container } = renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan', 'ksa'], index: 1 } });
      const hero = container.querySelector('.detail-hero');
      expect(hero).not.toBeNull();
      const controls = hero!.querySelectorAll('.hero-nav');
      expect(controls).toHaveLength(2);
      expect(container.querySelectorAll('.destination-pager-link.previous')).toHaveLength(0);
      expect(container.querySelectorAll('.destination-pager-link.next')).toHaveLength(0);
    });

    it('puts one control at the inline start and the other at the inline end', () => {
      const { container } = renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan', 'ksa'], index: 1 } });
      expect(container.querySelector('.detail-hero .hero-nav-previous')).not.toBeNull();
      expect(container.querySelector('.detail-hero .hero-nav-next')).not.toBeNull();
    });

    it('carries the destination name in both the accessible name and the tooltip', () => {
      renderWithState({ navigation: { source: 'explore', ids: ['france', 'japan', 'ksa'], index: 1 } });
      const previous = screen.getByRole('link', { name: /الدولة السابقة: فرنسا/ });
      // There is no visible inline label (it could not fit this hero without
      // covering the country title — see .hero-nav in wejhaty.css), so the
      // name has to reach a mouse user through the tooltip and everyone else
      // through the accessible name.
      expect(previous).toHaveAttribute('title', expect.stringContaining('فرنسا'));
      expect(previous.querySelector('.hero-nav-name')).toBeNull();
      expect(previous.textContent).toBe('');
    });
  });
});
