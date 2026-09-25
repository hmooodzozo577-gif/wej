import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { Compare } from '../routes/Compare';
import { normalizePreferences } from '../personalization/signals';
import { buildComparison, compareEntries, compareSearch, parseCompareIds } from './compareModel';

const t = I18N.en;
const byId = (id: string) => WORLD_CATALOG.find((entry) => entry.id === id)!;

describe('compare URL', () => {
  it('keeps only catalog ids, once each, three at most', () => {
    expect(parseCompareIds('?ids=japan,af')).toEqual({ ids: ['japan', 'af'], truncated: false });
    expect(parseCompareIds('?ids=japan,japan,atlantis,il,<script>,af')).toEqual({ ids: ['japan', 'af'], truncated: false });
    expect(parseCompareIds('?ids=japan,af,france,uk')).toEqual({ ids: ['japan', 'af', 'france'], truncated: true });
    expect(parseCompareIds('')).toEqual({ ids: [], truncated: false });
    expect(parseCompareIds('?answers=1&ids=japan&passport=SA')).toEqual({ ids: ['japan'], truncated: false });
  });

  it('writes ids and nothing else', () => {
    expect(compareSearch(['japan', 'af'])).toBe('?ids=japan,af');
    expect(compareSearch(['japan', 'nope', 'af', 'france', 'uk'])).toBe('?ids=japan,af,france');
    expect(compareSearch([])).toBe('');
  });
});

describe('comparison model', () => {
  const entries = compareEntries(['japan', 'af']);

  it('compares facts and general suitability, and never names a winner', () => {
    const sections = buildComparison(entries, { lang: 'en', t, preferences: null, origin: null });
    expect(sections.map((section) => section.id)).toEqual(['facts', 'suitability']);
    const text = JSON.stringify(sections).toLowerCase();
    expect(text).not.toMatch(/winner|best|combined|overall score|visa|passport|budget/);
    for (const section of sections) for (const row of section.rows) expect(row.cells).toHaveLength(2);
  });

  it('reports coverage on the same 0–100 scale the destination page uses', () => {
    const sections = buildComparison(entries, { lang: 'en', t, preferences: null, origin: null });
    const notes = sections.find((section) => section.id === 'suitability')!.rows.flatMap((row) => row.cells.map((c) => c.note ?? ''));
    for (const note of notes) {
      const pct = Number(note.match(/Data coverage (\d+)%/)?.[1]);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it('says "Not available" instead of estimating', () => {
    const sections = buildComparison(entries, { lang: 'en', t, preferences: null, origin: null });
    const cells = sections.flatMap((section) => section.rows.flatMap((row) => row.cells));
    for (const cell of cells.filter((c) => c.missing)) expect(['Not available', 'Insufficient data']).toContain(cell.text);
    const ar = buildComparison(entries, { lang: 'ar', t: I18N.ar, preferences: null, origin: null });
    expect(JSON.stringify(ar)).not.toContain('Not available');
  });

  it('adds Personal Match for every compared country with a profile, not only questionnaire results', () => {
    // Compare computes the match directly for each chosen country; no
    // ranking or top-ten list is involved (a basic country like 'af' is
    // never in the refined top ten of a results page it was not part of).
    const preferences = normalizePreferences('tourism', { 'tourism-climate': 'cold', 'tourism-cost': 1 });
    const sections = buildComparison(compareEntries(['japan', 'af', 'france']), { lang: 'en', t, preferences, origin: null });
    const personal = sections.find((section) => section.id === 'personal')!;
    expect(personal.rows[0]!.cells).toHaveLength(3);
    for (const cell of personal.rows[0]!.cells) expect(cell.text).toMatch(/^\d+%$|^Not available$/);
    expect(personal.rows[0]!.cells.some((cell) => /^\d+%$/.test(cell.text))).toBe(true);
  });

  it('shows distance only when the session has a location', () => {
    const origin = { lat: 24.7136, lng: 46.6753 };
    const sections = buildComparison(entries, { lang: 'en', t, preferences: null, origin });
    const distance = sections.find((section) => section.id === 'distance')!;
    expect(distance.rows[0]!.cells[0]!.text).toMatch(/^≈ [\d,]+ km$/);
  });
});

function renderCompare(path: string) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Compare page', () => {
  it('renders a real table with column and row headers', () => {
    renderCompare('/compare?ids=japan,af,france');
    const table = screen.getByRole('table', { name: 'مقارنة الوجهات المختارة' });
    const columns = within(table).getAllByRole('columnheader');
    expect(columns.map((column) => column.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('اليابان')]));
    expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(8);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('asks for another destination when only one is chosen', () => {
    renderCompare('/compare?ids=japan');
    expect(screen.getByRole('status')).toHaveTextContent('اختر وجهة أخرى');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows at most three and says so', () => {
    renderCompare('/compare?ids=japan,af,france,uk');
    expect(screen.getByRole('note')).toHaveTextContent('ثلاث وجهات كحد أقصى');
    // Destination columns live in <thead>; section headings in the body are
    // colgroup headers of their own.
    expect(screen.getByRole('table').querySelectorAll('thead th[scope="col"]')).toHaveLength(3);
    expect(byId('uk')).toBeTruthy();
  });

  it('handles an empty or hostile address without crashing', () => {
    renderCompare('/compare?ids=%3Cimg%20src%3Dx%3E,il');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'اذهب إلى المفضلة' })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('<img src=x');
  });
});
