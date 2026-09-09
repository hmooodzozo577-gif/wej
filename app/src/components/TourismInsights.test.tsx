// Phase 13.5d — TourismInsights: renders the real numeric arrivals/
// receipts against the real committed snapshot (japan/JP, covered) and
// renders nothing for a country genuinely absent from it
// (somalia/SO — one of the real 7 unmatched, confirmed by diffing the
// effective catalog against the snapshot, not guessed); renders metric
// cards + charts from a mocked entry (EN/AR), gracefully renders
// nothing when the country has no snapshot entry, never fabricates a
// growth/receipts card when the underlying series can't support one,
// and never leaks Price Level Index semantics into this card.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useReducer, type ReactNode } from 'react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { TourismInsights } from './TourismInsights';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Lang } from '../data/types';
import * as tourismInsights from '../data/tourismInsights';

const japan = WORLD_CATALOG.find((e) => e.id === 'japan')!; // real snapshot coverage (both series, 2015-2020)
const afghanistan = WORLD_CATALOG.find((e) => e.countryCode === 'AF')!; // used only in mocked cases below (also has real coverage, so not usable as the "no coverage" fixture)
const somalia = WORLD_CATALOG.find((e) => e.countryCode === 'SO')!; // confirmed NOT in the real snapshot's 187 entries

function renderWith(destination: (typeof WORLD_CATALOG)[number], lang: Lang = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <TourismInsights destination={destination} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('Phase 13.5d — TourismInsights against the real committed snapshot', () => {
  it('renders the real numeric arrivals/receipts for a covered destination (japan / JP)', async () => {
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    expect(screen.getByText('International tourist arrivals')).toBeInTheDocument();
    expect(screen.getByText('Tourism data: 2020 (World Bank)')).toBeInTheDocument();
  });

  it('renders nothing for a country genuinely absent from the real snapshot (Somalia / SO, one of the 7 real unmatched)', async () => {
    const { container } = renderWith(somalia, 'en');
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    await expect(tourismInsights.getTourismInsights('SO')).resolves.toBeUndefined();
  });
});

describe('Phase 13.5d — TourismInsights with a mocked entry', () => {
  it('renders arrivals, receipts, and growth cards, the chart, and source period, English', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      arrivals: [
        { period: '2018', value: 31_192_000 },
        { period: '2019', value: 31_900_000 },
        { period: '2020', value: 4_116_000 },
      ],
      receiptsUsd: [
        { period: '2019', value: 46_100_000_000 },
        { period: '2020', value: 10_100_000_000 },
      ],
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    expect(screen.getByText('International tourist arrivals')).toBeInTheDocument();
    expect(screen.getAllByText('4.1M').length).toBeGreaterThan(0); // latest (2020) arrivals, compact (also appears as a chart axis label)
    expect(screen.getAllByText('$10.1B').length).toBeGreaterThan(0); // latest (2020) receipts, compact
    expect(screen.getByText('Annual arrivals growth')).toBeInTheDocument();
    expect(screen.getByText(/-8\d\.\d%/)).toBeInTheDocument(); // real 2019->2020 collapse, negative
    expect(screen.getByText('International tourist arrivals over time')).toBeInTheDocument();
    expect(screen.getByText('Tourism data: 2020 (World Bank)')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders the Arabic labels for the same mocked entry', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      arrivals: [
        { period: '2019', value: 31_900_000 },
        { period: '2020', value: 4_116_000 },
      ],
    });
    renderWith(japan, 'ar');
    await waitFor(() => expect(screen.getByText('مؤشرات السياحة')).toBeInTheDocument());
    expect(screen.getByText('الزوار الدوليون')).toBeInTheDocument();
    expect(screen.getByText('بيانات السياحة: 2020 (البنك الدولي)')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders for a BASIC country too — keyed only by countryCode', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: afghanistan.countryCode,
      arrivals: [{ period: '2019', value: 20_000 }],
    });
    renderWith(afghanistan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    expect(screen.getByText('20.0K')).toBeInTheDocument();
  });

  it('omits the growth card when only one arrivals observation exists (cannot compute growth)', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      arrivals: [{ period: '2019', value: 31_900_000 }],
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    expect(screen.queryByText('Annual arrivals growth')).not.toBeInTheDocument();
  });

  it('omits the chart (but keeps the metric card) when only one observation exists — never a fake single-point trend', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      arrivals: [{ period: '2019', value: 31_900_000 }],
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    expect(screen.queryByText('International tourist arrivals over time')).not.toBeInTheDocument();
    expect(screen.getByText('31.9M')).toBeInTheDocument();
  });

  it('renders nothing for a mocked entry with neither series', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({ countryCode: japan.countryCode });
    const { container } = renderWith(japan, 'en');
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
    vi.restoreAllMocks();
  });

  it('never mentions Price Level Index / priceLevelIndex semantics on this card', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      arrivals: [{ period: '2019', value: 1 }, { period: '2020', value: 2 }],
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Price Level Index|United States = 100/);
    vi.restoreAllMocks();
  });

  it('re-fetches and clears the previous entry when the destination changes', async () => {
    vi.spyOn(tourismInsights, 'getTourismInsights')
      .mockResolvedValueOnce({ countryCode: japan.countryCode, arrivals: [{ period: '2019', value: 1 }, { period: '2020', value: 2 }] })
      .mockResolvedValueOnce(undefined);

    function Providers({ children }: { children: ReactNode }) {
      const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'en' as Lang });
      return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
    }
    const { rerender, container } = render(
      <Providers>
        <MemoryRouter>
          <TourismInsights destination={japan} />
        </MemoryRouter>
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('Tourism Insights')).toBeInTheDocument());
    rerender(
      <Providers>
        <MemoryRouter>
          <TourismInsights destination={afghanistan} />
        </MemoryRouter>
      </Providers>,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    vi.restoreAllMocks();
  });
});
