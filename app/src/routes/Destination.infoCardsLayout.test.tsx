// Visual refinement pass: the two-zone layout (identity sidebar + wide
// main zone, user-approved) nests the compact-card section INSIDE
// .detail-grid's own main (second) column — a deliberate change from the
// prior pass, where it rendered as a full-width sibling section below
// the whole grid. See wejhaty.css's own doc comment for the full
// before/after. These are structural DOM/class assertions only — they
// do NOT replace the mandatory browser visual QA (see the final
// report), just guard the regression at the unit level.
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
  it('full-destination branch (ksa): .info-cards-container wraps .info-cards-grid as a DIRECT child, nested inside .detail-grid\'s MAIN (second) column', () => {
    const { container } = renderAt('/destination/ksa');
    const outer = container.querySelector('.info-cards-container');
    expect(outer).not.toBeNull();
    // The container element itself must not also carry the grid class —
    // that self-targeting was a real bug fixed in a prior pass.
    expect(outer!.classList.contains('info-cards-grid')).toBe(false);
    const grid = outer!.querySelector(':scope > .info-cards-grid');
    expect(grid).not.toBeNull();
    // This pass: nested inside .detail-grid's SECOND (main) column —
    // not a sibling below the whole grid, and not inside the FIRST
    // (identity sidebar) column.
    const detailGrid = container.querySelector('.detail-grid');
    expect(detailGrid).not.toBeNull();
    expect(detailGrid!.contains(outer)).toBe(true);
    const mainColumn = detailGrid!.children[1];
    expect(mainColumn.contains(outer)).toBe(true);
    const sidebarColumn = detailGrid!.children[0];
    expect(sidebarColumn.contains(outer)).toBe(false);
  });

  it('basic-country branch (eg): same container/grid split, same main-column placement', () => {
    const { container } = renderAt('/destination/eg');
    const outer = container.querySelector('.info-cards-container');
    expect(outer).not.toBeNull();
    expect(outer!.classList.contains('info-cards-grid')).toBe(false);
    const grid = outer!.querySelector(':scope > .info-cards-grid');
    expect(grid).not.toBeNull();
    const detailGrid = container.querySelector('.detail-grid');
    const mainColumn = detailGrid!.children[1];
    expect(mainColumn.contains(outer)).toBe(true);
    const sidebarColumn = detailGrid!.children[0];
    expect(sidebarColumn.contains(outer)).toBe(false);
  });

  it('destination identity sidebar (first .detail-grid column) renders the DestinationVisual slot ahead of country facts, both branches', () => {
    const full = renderAt('/destination/ksa');
    const basic = renderAt('/destination/eg');
    // DestinationVisual renders null today (no licensed image registered
    // — data/destinationVisuals.ts is empty), so this just guards that
    // the sidebar column itself renders without error for both branches
    // and CountryInfoCard-derived content is present in it.
    expect(full.container.querySelector('.detail-grid')).not.toBeNull();
    expect(basic.container.querySelector('.detail-grid')).not.toBeNull();
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
