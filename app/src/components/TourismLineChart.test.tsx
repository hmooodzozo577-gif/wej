// Correction pass: production visual QA found the X-axis unreadable for
// long series (a label under every point, e.g. 1995-2024 = 30 overlapping
// labels). Tick-selection logic itself (selectTickIndices) is unit-tested
// in ../data/tourismChartTicks.test.ts; this file covers the rendered SVG
// (data completeness vs. label count, accessibility, RTL).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TourismLineChart } from './TourismLineChart';
import type { TourismObservation } from '../data/types';

function series(startYear: number, endYear: number): TourismObservation[] {
  const out: TourismObservation[] = [];
  for (let y = startYear; y <= endYear; y++) out.push({ period: String(y), value: 100 + (y - startYear) });
  return out;
}

describe('TourismLineChart — data completeness vs. label reduction', () => {
  it('plots ALL 30 points/circles for a 1995-2024 series, but renders far fewer than 30 text labels', () => {
    const s = series(1995, 2024);
    const { container } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(30);
    // Y-axis min/max labels + tick labels; tick labels must be far fewer than 30.
    const tickTexts = container.querySelectorAll('svg > text');
    expect(tickTexts.length).toBeLessThan(30);
    expect(tickTexts.length).toBeGreaterThanOrEqual(2); // at least min/max value labels
  });

  it('the hidden accessible table still contains all 30 real observations, unreduced', () => {
    const s = series(1995, 2024);
    const { getAllByRole } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    const rows = getAllByRole('row');
    // header row + 30 data rows
    expect(rows.length).toBe(31);
  });

  it('shows the first (1995) and latest (2024) period labels for a long series', () => {
    const s = series(1995, 2024);
    const { container } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    const texts = Array.from(container.querySelectorAll('svg > text')).map((t) => t.textContent);
    expect(texts).toContain('1995');
    expect(texts).toContain('2024');
  });

  it('short series (3 points) still shows a label for every point', () => {
    const s = series(2020, 2022);
    const { container } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    const yearTexts = Array.from(container.querySelectorAll('svg > text')).map((t) => t.textContent);
    expect(yearTexts).toContain('2020');
    expect(yearTexts).toContain('2021');
    expect(yearTexts).toContain('2022');
  });

  it('a series with a real gap (missing year) still plots only real observations, no invented point', () => {
    const s: TourismObservation[] = [
      { period: '2018', value: 10 },
      { period: '2019', value: 12 },
      // 2020 missing on purpose (real gap, e.g. no reported data that year)
      { period: '2021', value: 15 },
    ];
    const { container } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    expect(container.querySelectorAll('circle').length).toBe(3);
    const rows = document.querySelectorAll('table tbody tr');
    expect(rows.length).toBe(3);
  });

  it('renders nothing for fewer than 2 points', () => {
    const { container } = render(<TourismLineChart series={[{ period: '2024', value: 5 }]} formatValue={(v) => String(v)} ariaLabel="Arrivals" />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps role="img" and a descriptive aria-label regardless of tick reduction', () => {
    const s = series(1995, 2024);
    const { container } = render(<TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="International tourist arrivals, 1995-2024" />);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe('International tourist arrivals, 1995-2024');
  });

  it('is pinned dir="ltr" regardless of ambient RTL', () => {
    const s = series(1995, 2024);
    const { container } = render(
      <div dir="rtl">
        <TourismLineChart series={s} formatValue={(v) => String(v)} ariaLabel="السياحة" />
      </div>,
    );
    const wrap = container.querySelector('div[dir="ltr"]');
    expect(wrap).not.toBeNull();
  });
});
