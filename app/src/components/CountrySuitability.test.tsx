// Country Intelligence "Suitable for" card: the summary list renders
// against the REAL committed snapshot (no mock needed — it's a bundled,
// synchronous read); "Why this score?" is tested with the Worker fetch
// mocked, since that part is genuinely async and network-dependent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useReducer, type ReactNode } from 'react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { CountrySuitability } from './CountrySuitability';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { getCountrySuitability } from '../data/countryIntelligence';
import type { Lang } from '../data/types';
import * as detailClient from '../countryIntelligence/detailClient';

const saudiArabia = WORLD_CATALOG.find((entry) => entry.countryCode === 'SA')!;
const unknownCountry = { ...saudiArabia, countryCode: 'ZZ', id: 'zz-does-not-exist' };

function renderWith(destination: (typeof WORLD_CATALOG)[number], lang: Lang = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <CountrySuitability destination={destination} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('CountrySuitability against the real committed snapshot', () => {
  it('renders a row for every suitable purpose, with a percentage score for one known to have sufficient data', () => {
    const suitability = getCountrySuitability('SA');
    const tourism = suitability.find((entry) => entry.purpose === 'tourism')!;
    expect(tourism.insufficientData).toBe(false);
    renderWith(saudiArabia, 'en');
    expect(screen.getByText(`${tourism.score}%`)).toBeInTheDocument();
    expect(screen.getByText('Tourism & Vacation')).toBeInTheDocument();
  });

  it('renders nothing for a country the snapshot has no data for at all', () => {
    const { container } = renderWith(unknownCountry, 'en');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the Arabic purpose label and title in Arabic', () => {
    renderWith(saudiArabia, 'ar');
    expect(screen.getByText('مناسبة لـ')).toBeInTheDocument();
    expect(screen.getByText('سياحة وإجازة')).toBeInTheDocument();
  });

  it('never renders a fabricated currency/booking claim — this is a suitability estimate, not a price', () => {
    renderWith(saudiArabia, 'en');
    const text = document.body.textContent ?? '';
    expect(text.toLowerCase()).not.toMatch(/book now|price:|\$\d/);
  });

  it('the intro line discloses this is a general estimate, not personalized to the viewer', () => {
    renderWith(saudiArabia, 'en');
    expect(screen.getByText(/not personalized to you/)).toBeInTheDocument();
  });
});

describe('CountrySuitability — "Why this score?" lazy detail fetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not fetch detail until the traveller opens "Why this score?"', async () => {
    const spy = vi.spyOn(detailClient, 'lookupSuitabilityDetail');
    renderWith(saudiArabia, 'en');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches and renders components, strengths, and sources once opened', async () => {
    vi.spyOn(detailClient, 'lookupSuitabilityDetail').mockResolvedValueOnce({
      countryCode: 'SA',
      purpose: 'tourism',
      modelVersion: 'tourism-v1',
      score: 85,
      insufficientData: false,
      coverage: 100,
      confidence: 'high',
      updatedAt: '2026-01-01T00:00:00.000Z',
      components: [
        { factor: 'safety', label: 'Safety', rawValue: 1, normalizedValue: 95, contribution: 19, weight: 20, dataYear: '2024', sourceId: 'homicideRate', status: 'observed' },
        { factor: 'affordability', label: 'Affordability', rawValue: 50, normalizedValue: 20, contribution: 4, weight: 20, dataYear: '2024', sourceId: 'priceLevelIndex', status: 'observed' },
      ],
      sources: {
        homicideRate: { id: 'homicideRate', name: 'World Bank — Intentional homicides', provider: 'World Bank', tier: 'official-international', indicatorId: 'VC.IHR.PSRC.P5', url: 'https://data.worldbank.org/indicator/VC.IHR.PSRC.P5', license: 'CC BY-4.0' },
        priceLevelIndex: { id: 'priceLevelIndex', name: 'World Bank — Price level index', provider: 'World Bank', tier: 'official-international', indicatorId: 'PA.NUS.GDP.PLI', url: 'https://data.worldbank.org/indicator/PA.NUS.GDP.PLI', license: 'CC BY-4.0' },
      },
    });
    renderWith(saudiArabia, 'en');

    const summaries = screen.getAllByText('Why this score?');
    fireEvent.click(summaries[0]!);

    await waitFor(() => expect(screen.getByText('Methodology: tourism-v1')).toBeInTheDocument());
    expect(screen.getAllByText('Safety').length).toBeGreaterThan(0);
    expect(screen.getByText('Main strengths')).toBeInTheDocument();
    expect(screen.getByText('World Bank — Intentional homicides')).toBeInTheDocument();
  });

  it('shows an honest "not available" message rather than hanging or fabricating detail on fetch failure', async () => {
    vi.spyOn(detailClient, 'lookupSuitabilityDetail').mockResolvedValueOnce(null);
    renderWith(saudiArabia, 'en');
    const summaries = screen.getAllByText('Why this score?');
    fireEvent.click(summaries[0]!);
    await waitFor(() => expect(screen.getByText('Details are not available right now.')).toBeInTheDocument());
  });
});
