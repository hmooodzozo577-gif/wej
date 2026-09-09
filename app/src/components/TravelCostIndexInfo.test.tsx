// Phase 13.5c — TravelCostIndexInfo: renders the real numeric index
// (value, US=100 baseline, tier, relative sentence, source period,
// disclaimer) against the real committed snapshot for a covered country,
// gracefully renders nothing for an uncovered one, and renders the same
// deterministic copy in both languages once a dynamic entry is mocked in
// — never a fabricated price, currency amount, or booking claim.
//
// Completion-pass update: the committed snapshot now has real
// PA.NUS.GDP.PLI coverage (179/194 countries — see
// app/scripts/TRAVEL_COST_INDEX.md). Japan (JP) IS covered; the original
// version of this describe block asserted "renders nothing" for japan
// too, which was only ever true against the old empty snapshot. Kept
// here as a real, non-mocked, positive-path check; Afghanistan (AF) is
// genuinely NOT in the real snapshot's 179 entries, so its "renders
// nothing" case is still a true, current assertion (graceful omission
// for a country the source dataset simply doesn't cover), not a stale
// one.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useReducer, type ReactNode } from 'react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { TravelCostIndexInfo } from './TravelCostIndexInfo';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Lang } from '../data/types';
import * as travelCostIndex from '../data/travelCostIndex';

const japan = WORLD_CATALOG.find((e) => e.id === 'japan')!; // full destination, JP — real snapshot coverage
const afghanistan = WORLD_CATALOG.find((e) => e.countryCode === 'AF')!; // basic country, AF — NOT in the real snapshot

function renderWith(destination: (typeof WORLD_CATALOG)[number], lang: Lang = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <TravelCostIndexInfo destination={destination} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('Phase 13.5c — TravelCostIndexInfo against the real committed snapshot', () => {
  it('renders the real numeric index for a covered full destination (japan / JP)', async () => {
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    expect(screen.getByText('United States = 100')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/SAR|ر\.س/);
  });

  it('renders nothing for a country the real snapshot does not cover (afghanistan / AF)', async () => {
    const { container } = renderWith(afghanistan, 'en');
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    // Confirm this is real "no coverage", not a race: the underlying
    // service call really does resolve to undefined for AF.
    await expect(travelCostIndex.getTravelCostIndex('AF')).resolves.toBeUndefined();
  });
});

describe('Phase 13.5c — TravelCostIndexInfo: with a mocked dynamic entry', () => {
  it('renders the numeric value, baseline, tier, and relative sentence for a full destination, English', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 132,
      sourcePeriod: '2023',
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    expect(screen.getByText('132')).toBeInTheDocument(); // the actual numeric value, rounded for display
    expect(screen.getByText('United States = 100')).toBeInTheDocument();
    expect(screen.getByText('Very high')).toBeInTheDocument(); // tier badge still rendered, 132 >= 115
    expect(screen.getByText('Substantially higher than the United States')).toBeInTheDocument(); // relative sentence
    expect(screen.getByText('Source data: 2023 (World Bank)')).toBeInTheDocument();
    expect(screen.getByText(/not a currency amount, hotel price, food price, daily budget, or live booking figure/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('rounds a many-decimal source value for display without altering the underlying classification', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 64.8679639072763, // real JP-shaped value from the actual snapshot
      sourcePeriod: '2025',
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('65')).toBeInTheDocument()); // Math.round(64.868) === 65
    expect(screen.getByText('Moderate')).toBeInTheDocument(); // 64.868 (full precision, unrounded) -> moderate
  });

  it('renders for a BASIC country too — the dynamic index does not depend on costLevel/recommendationReady', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: afghanistan.countryCode,
      priceLevelIndex: 45,
      sourcePeriod: '2023',
    });
    renderWith(afghanistan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders the Arabic tier, numeric value, and disclaimer, same underlying tier as English', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 75,
      sourcePeriod: '2022',
    });
    renderWith(japan, 'ar');
    await waitFor(() => expect(screen.getByText('مؤشر تكلفة السفر')).toBeInTheDocument());
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('الولايات المتحدة = 100')).toBeInTheDocument();
    expect(screen.getByText('متوسطة')).toBeInTheDocument(); // 75 -> moderate
    expect(screen.getByText('مشابهة نسبيًا للولايات المتحدة')).toBeInTheDocument();
    expect(screen.getByText('بيانات المصدر: 2022 (البنك الدولي)')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('never renders a fabricated currency/price/availability/booking claim', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 100,
      sourcePeriod: '2023',
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/SAR|ر\.س/); // this card never claims a daily-budget/currency figure
    expect(text.toLowerCase()).not.toMatch(/book now|available tonight|rooms? left|reserve/);
    vi.restoreAllMocks();
  });

  it('re-fetches and clears the previous entry when the destination changes', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex')
      .mockResolvedValueOnce({ countryCode: japan.countryCode, priceLevelIndex: 132, sourcePeriod: '2023' })
      .mockResolvedValueOnce(undefined);

    function Providers({ children }: { children: ReactNode }) {
      const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'en' as Lang });
      return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
    }

    const { rerender, container } = render(
      <Providers>
        <MemoryRouter>
          <TravelCostIndexInfo destination={japan} />
        </MemoryRouter>
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    rerender(
      <Providers>
        <MemoryRouter>
          <TravelCostIndexInfo destination={afghanistan} />
        </MemoryRouter>
      </Providers>,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    vi.restoreAllMocks();
  });
});
