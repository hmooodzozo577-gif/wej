// Phase 13.5c — TravelCostIndexInfo: renders nothing against the real
// (currently empty) committed snapshot for both a full destination and
// a basic country, and renders the real, deterministic tier/source/
// disclaimer copy in both languages once a dynamic entry is mocked in —
// never a fabricated price, availability, or booking claim.
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

const japan = WORLD_CATALOG.find((e) => e.id === 'japan')!; // full destination
const basicCountry = WORLD_CATALOG.find((e) => !e.recommendationReady)!; // basic country

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

describe('Phase 13.5c — TravelCostIndexInfo: no snapshot data yet (real current app state)', () => {
  it('renders nothing for a full destination while the snapshot is empty', async () => {
    const { container } = renderWith(japan, 'en');
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing for a basic country while the snapshot is empty', async () => {
    const { container } = renderWith(basicCountry, 'en');
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('Phase 13.5c — TravelCostIndexInfo: with a mocked dynamic entry', () => {
  it('renders for a full destination, English', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 132,
      sourcePeriod: '2023',
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    expect(screen.getByText('Very high')).toBeInTheDocument(); // 132 >= 115
    expect(screen.getByText('Data: 2023 (World Bank)')).toBeInTheDocument();
    expect(screen.getByText(/not a hotel price, food price, or live booking figure/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders for a BASIC country too — the dynamic index does not depend on costLevel/recommendationReady', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: basicCountry.countryCode,
      priceLevelIndex: 45,
      sourcePeriod: '2023',
    });
    renderWith(basicCountry, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    expect(screen.getByText('Low')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders the Arabic tier label and disclaimer, same underlying tier as English', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 75,
      sourcePeriod: '2022',
    });
    renderWith(japan, 'ar');
    await waitFor(() => expect(screen.getByText('مؤشر تكلفة السفر')).toBeInTheDocument());
    expect(screen.getByText('متوسطة')).toBeInTheDocument(); // 75 -> moderate
    expect(screen.getByText('بيانات 2022 (البنك الدولي)')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('never renders a fabricated price/availability/booking claim', async () => {
    vi.spyOn(travelCostIndex, 'getTravelCostIndex').mockResolvedValueOnce({
      countryCode: japan.countryCode,
      priceLevelIndex: 100,
      sourcePeriod: '2023',
    });
    renderWith(japan, 'en');
    await waitFor(() => expect(screen.getByText('Travel Cost Index')).toBeInTheDocument());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
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
          <TravelCostIndexInfo destination={basicCountry} />
        </MemoryRouter>
      </Providers>,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    vi.restoreAllMocks();
  });
});
