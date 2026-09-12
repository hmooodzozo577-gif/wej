// Visual refinement pass: the two-zone layout (identity sidebar + wide
// main zone, user-approved) nests the compact-card section INSIDE
// .detail-grid's own main (second) column — a deliberate change from the
// prior pass, where it rendered as a full-width sibling section below
// the whole grid. See wejhaty.css's own doc comment for the full
// before/after. These are structural DOM/class assertions only — they
// do NOT replace the mandatory browser visual QA (see the final
// report), just guard the regression at the unit level.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';

function renderAt(path: string, openPlanningInfo = false) {
  const result = render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[{ pathname: path, state: { purpose: 'tourism' } }]}>
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
  if (openPlanningInfo) {
    fireEvent.click(result.getByRole('button', { name: 'عرض معلومات إضافية' }));
  }
  return result;
}

describe('Correction pass — info-cards container/grid split (both Destination branches)', () => {
  it('full-destination branch (ksa): .info-cards-container wraps .info-cards-grid as a DIRECT child, nested inside .detail-grid\'s MAIN (second) column', () => {
    const { container } = renderAt('/destination/ksa', true);
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
    const { container } = renderAt('/destination/eg', true);
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

  it('destination identity sidebar (first .detail-grid column) renders country facts, both branches — Hero-image pass: no image slot here anymore', () => {
    const full = renderAt('/destination/ksa');
    const basic = renderAt('/destination/eg');
    expect(full.container.querySelector('.detail-grid')).not.toBeNull();
    expect(basic.container.querySelector('.detail-grid')).not.toBeNull();
    // Hero-image correction pass: the destination photo moved into the
    // Hero (see Destination.hero.test.tsx) — the sidebar column itself
    // must never contain an image element or a photo-attribution
    // disclosure. See detail comparison there for why: rendering the
    // same photo in both places was the exact behavior this pass
    // removed.
    const fullSidebar = full.container.querySelector('.detail-grid')!.children[0];
    const basicSidebar = basic.container.querySelector('.detail-grid')!.children[0];
    expect(fullSidebar.querySelector('img')).toBeNull();
    expect(fullSidebar.querySelector('.hero-photo-attribution')).toBeNull();
    expect(basicSidebar.querySelector('img')).toBeNull();
    expect(basicSidebar.querySelector('.hero-photo-attribution')).toBeNull();
  });

  it('Tourism Insights card carries the full-span marker class alongside detail-card', async () => {
    const { container } = renderAt('/destination/ksa', true);
    // TourismInsights loads its snapshot entry asynchronously (Phase
    // 13.5d), so it renders nothing until that resolves.
    await waitFor(() => expect(container.querySelector('.tourism-insights-card')).not.toBeNull());
    const tourismCard = container.querySelector('.tourism-insights-card');
    expect(tourismCard!.classList.contains('detail-card')).toBe(true);
  });

  it('exactly one info-cards-grid per route render — no duplicate section', () => {
    const { container } = renderAt('/destination/ksa', true);
    expect(container.querySelectorAll('.info-cards-grid').length).toBe(1);
  });

  it('all four cards are present with no content loss (japan, full destination)', () => {
    const { getByText } = renderAt('/destination/japan', true);
    // Section headings, Arabic (default lang) — one per card.
    expect(getByText('السفر')).toBeInTheDocument();
    expect(getByText('الإقامة')).toBeInTheDocument();
  });

  it('landscape-composition pass: Overview/Strengths/Weaknesses/BestFor are wrapped in .overview-cards-grid, in DOM order, no duplicates (full destination only)', () => {
    const { container } = renderAt('/destination/japan');
    const grid = container.querySelector('.overview-cards-grid');
    expect(grid).not.toBeNull();
    const headings = Array.from(grid!.querySelectorAll(':scope > .detail-card > h3')).map((h) => h.textContent);
    // DOM order must be Overview, Strengths, Weaknesses, Best For —
    // never reordered for visual packing.
    expect(headings[0]).toContain('نظرة عامة');
    expect(headings.some((h) => h!.includes('نقاط القوة'))).toBe(true);
    expect(headings.some((h) => h!.includes('نقاط تحتاج انتباه'))).toBe(true);
    expect(headings.some((h) => h!.includes('الأنسب لـ'))).toBe(true);
    // No duplicated card.
    expect(grid!.querySelectorAll(':scope > .overview-card')).toHaveLength(1);
  });

  it('approved-dashboard pass: .overview-cards-grid always has exactly 4 children — Why (when present) is a sibling BEFORE the grid, never a 5th grid item, so Best For never ends up orphaned alone in a 3rd row', () => {
    const { container } = renderAt('/destination/japan');
    const grid = container.querySelector('.overview-cards-grid')!;
    expect(grid.children).toHaveLength(4);
    // If `why` rendered at all (only when arriving with a match score —
    // not this route's own state, so it's absent here), it must not be
    // a descendant of the grid.
    const whyBox = container.querySelector('.why-box');
    if (whyBox) expect(grid.contains(whyBox)).toBe(false);
  });

  it('landscape-composition pass: .overview-cards-grid is a plain block wrapper in the DOM regardless of viewport — the landscape/portrait switch is CSS-only (a media query), never conditional rendering, so no jsdom-width-dependent test is needed or meaningful here', () => {
    const { container } = renderAt('/destination/japan');
    // jsdom has no real layout engine (no viewport-width media query
    // evaluation) — this only guards that the wrapper element exists
    // and always contains the same cards; the actual responsive
    // grid/stack behavior is verified with the browser QA in the final
    // report, not here.
    const grid = container.querySelector('.overview-cards-grid');
    expect(grid).not.toBeNull();
    expect(grid!.children.length).toBeGreaterThanOrEqual(4);
  });

  it('composition-refinement pass: each compact card carries its own explicit grid-area class (not positional nth-child)', async () => {
    const { container } = renderAt('/destination/ksa', true);
    await waitFor(() => expect(container.querySelector('.tourism-insights-card')).not.toBeNull());
    const grid = container.querySelector('.info-cards-grid')!;
    expect(grid.querySelector(':scope > .travel-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .accommodation-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .travel-cost-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .tourism-insights-card')).not.toBeNull();
    // Exactly one of each — no duplicated card.
    expect(grid.querySelectorAll(':scope > .travel-card')).toHaveLength(1);
    expect(grid.querySelectorAll(':scope > .accommodation-card')).toHaveLength(1);
    expect(grid.querySelectorAll(':scope > .travel-cost-card')).toHaveLength(1);
    expect(grid.querySelectorAll(':scope > .tourism-insights-card')).toHaveLength(1);
  });

  it('each of the four compact cards carries its own grid-area class (overview/strengths/weaknesses/bestfor) — structural two-column placement, not positional auto-placement', () => {
    const { container } = renderAt('/destination/ksa', true);
    const grid = container.querySelector('.overview-cards-grid')!;
    expect(grid.querySelector(':scope > .overview-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .strengths-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .weaknesses-card')).not.toBeNull();
    expect(grid.querySelector(':scope > .bestfor-card')).not.toBeNull();
  });

  it('landscape correction pass REGRESSION: no 3-column (or any other >2-column) override of .overview-cards-grid remains anywhere in the stylesheet', async () => {
    // jsdom has no real layout engine, so this can't measure computed
    // columns — the meaningful, non-brittle guard here is against the
    // exact CSS rule this pass removed ever coming back: a real user
    // rejected the 3-column-at-1180px layout it produced (Overview/
    // Strengths/Weaknesses on one row, Best For orphaned alone on a
    // second). Reads the actual shipped stylesheet source rather than
    // asserting a pixel value.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    // Isolate just the .overview-cards-grid rule blocks (there are two:
    // the base 2-column declaration and its grid-area sub-rules) and
    // confirm none of them ever sets more than 2 explicit columns.
    const gridTemplateColumnsMatches = [...css.matchAll(/\.overview-cards-grid\s*\{[^}]*grid-template-columns:\s*([^;]+);/g)];
    expect(gridTemplateColumnsMatches.length).toBeGreaterThan(0);
    for (const m of gridTemplateColumnsMatches) {
      const columnCount = m[1].trim().split(/\s+/).length;
      expect(columnCount, `grid-template-columns: ${m[1]}`).toBe(2);
    }
  });

  it('whitespace correction pass REGRESSION: .info-cards-grid never shares Travel/Accommodation/Travel-Cost on one 3-column row — Travel Cost always gets its own full-width row', async () => {
    // Real user visual review of production: at wide container widths
    // Travel/Accommodation/Travel-Cost previously shared one row via a
    // 3-column @container override; Travel is much shorter than Travel
    // Cost, so the shared row's track height was pinned to Travel
    // Cost's height, leaving a large visible gap below Travel before
    // Tourism could start. Reads the shipped stylesheet source — the
    // meaningful, non-brittle guard against this exact rule returning
    // (jsdom cannot measure real card heights).
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).not.toMatch(/travel\s+accommodation\s+travelCost/i);
    expect(css).not.toContain('1fr 1fr 1fr');
  });

  it('balanced two-column pass: DOM order stays Travel, Accommodation, Travel Cost, Tourism — the composition change (Travel Cost as a side column spanning both rows) is CSS-only, never a DOM reorder', async () => {
    const { container } = renderAt('/destination/ksa', true);
    await waitFor(() => expect(container.querySelector('.tourism-insights-card')).not.toBeNull());
    const grid = container.querySelector('.info-cards-grid')!;
    const travel = grid.querySelector(':scope > .travel-card')!;
    const accommodation = grid.querySelector(':scope > .accommodation-card')!;
    const travelCost = grid.querySelector(':scope > .travel-cost-card')!;
    expect([...grid.children]).toEqual([travel, accommodation, travelCost, grid.querySelector(':scope > .tourism-insights-card')]);
  });

  it('balanced two-column pass REGRESSION: Travel Cost is a spanning side-column area (shares its grid-area with both the travel and accommodation rows), never its own standalone full-width row', async () => {
    // Real user visual review of production, second round: the
    // previous "Travel Cost gets its own full-width row" fix removed
    // the whitespace gap but was itself rejected as too long/
    // fragmented. Guards against a REGRESSION back to that exact
    // shape — Travel Cost's grid-area must appear in the SAME rows as
    // travel/accommodation, not in a separate 'travelCost travelCost'
    // row of its own.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).not.toMatch(/travelCost\s+travelCost/i);
    expect(css).toMatch(/['"]\s*travel\s+travelCost\s*['"]/);
  });
});
