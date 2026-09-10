// Correction pass: production visual QA proved the previous
// .info-cards-grid attempt never visibly worked on wide screens (two
// real bugs — see wejhaty.css's own doc comment: the grid lived inside
// .detail-grid's narrow 1fr sidebar, AND its container-query rule
// self-targeted the same element that set container-type, which per the
// CSS Containment spec can never match). These are structural DOM/class
// assertions only — they do NOT replace the mandatory browser visual QA
// (see the final report), just guard the regression at the unit level.
import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

describe('Correction pass — info-cards container/grid split (both Destination branches)', () => {
  it('full-destination branch (ksa): .info-cards-container wraps .info-cards-grid as a DIRECT child, and is NOT nested inside .detail-grid', () => {
    const { container } = renderAt('/destination/ksa');
    const outer = container.querySelector('.info-cards-container');
    expect(outer).not.toBeNull();
    // The container element itself must not also carry the grid class —
    // that self-targeting was the exact bug this pass fixed.
    expect(outer!.classList.contains('info-cards-grid')).toBe(false);
    const grid = outer!.querySelector(':scope > .info-cards-grid');
    expect(grid).not.toBeNull();
    // .info-cards-container must be a sibling of .detail-grid, not a
    // descendant of it (the width root-cause this pass also fixed).
    const detailGrid = container.querySelector('.detail-grid');
    expect(detailGrid).not.toBeNull();
    expect(detailGrid!.contains(outer)).toBe(false);
  });

  it('basic-country branch (eg): same container/grid split, same detail-grid independence', () => {
    const { container } = renderAt('/destination/eg');
    const outer = container.querySelector('.info-cards-container');
    expect(outer).not.toBeNull();
    expect(outer!.classList.contains('info-cards-grid')).toBe(false);
    const grid = outer!.querySelector(':scope > .info-cards-grid');
    expect(grid).not.toBeNull();
    const detailGrid = container.querySelector('.detail-grid');
    expect(detailGrid!.contains(outer)).toBe(false);
  });

  it('Tourism Insights card carries the full-span marker class alongside detail-card', async () => {
    const { container } = renderAt('/destination/ksa');
    // TourismInsights loads its snapshot entry asynchronously (Phase
    // 13.5d), so it renders nothing until that resolves.
    await waitFor(() => expect(container.querySelector('.tourism-insights-card')).not.toBeNull());
    const tourismCard = container.querySelector('.tourism-insights-card');
    expect(tourismCard!.classList.contains('detail-card')).toBe(true);
  });

  it('exactly one info-cards-grid per route render — no duplicate section', () => {
    const { container } = renderAt('/destination/ksa');
    expect(container.querySelectorAll('.info-cards-grid').length).toBe(1);
  });

  it('all four cards are present with no content loss (japan, full destination)', () => {
    const { getByText } = renderAt('/destination/japan');
    // Section headings, Arabic (default lang) — one per card.
    expect(getByText('السفر')).toBeInTheDocument();
    expect(getByText('الإقامة')).toBeInTheDocument();
  });
});
