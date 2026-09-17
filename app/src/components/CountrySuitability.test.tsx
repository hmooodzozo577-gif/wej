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
import { bestSuitedFor } from '../intelligence/bestSuitedFor';
import type { Lang } from '../data/types';
import * as detailClient from '../countryIntelligence/detailClient';
import enPurposeLabels from '../data/generated/i18n.en.json';

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

describe('CountrySuitability — full per-purpose list is sorted by score, not methodology order', () => {
  it('sanity-check: the raw snapshot entries are NOT already in score order for Saudi Arabia (otherwise this fix would not change anything)', () => {
    const suitability = getCountrySuitability('SA');
    const alreadyDescending = suitability.every(
      (entry, i) => i === 0 || (suitability[i - 1]!.score ?? -Infinity) >= (entry.score ?? -Infinity),
    );
    expect(alreadyDescending).toBe(false);
  });

  it('renders every row in descending score order with insufficient-data rows last (real data: Saudi Arabia)', () => {
    const { container } = renderWith(saudiArabia, 'en');
    const rows = Array.from(container.querySelectorAll('.suitability-row'));
    expect(rows.length).toBeGreaterThan(1);

    let sawInsufficient = false;
    let lastScore = Infinity;
    for (const row of rows) {
      const insufficientEl = row.querySelector('.suitability-insufficient');
      if (insufficientEl) {
        sawInsufficient = true;
        continue;
      }
      // No scored row is allowed to appear after an insufficient-data row.
      expect(sawInsufficient).toBe(false);
      const score = Number(row.querySelector('.suitability-score')!.textContent!.replace('%', ''));
      expect(score).toBeLessThanOrEqual(lastScore);
      lastScore = score;
    }
  });

  it('matches bestSuitedFor().ranked exactly, purpose-for-purpose, for the real Saudi Arabia fixture', () => {
    const suitability = getCountrySuitability('SA');
    const expectedOrder = bestSuitedFor(suitability).ranked.map((row) => row.purpose);
    const expectedLabels = expectedOrder.map((purpose) => enPurposeLabels.purposes[purpose]!.n);

    const { container } = renderWith(saudiArabia, 'en');
    const renderedPurposeLabels = Array.from(container.querySelectorAll('.suitability-purpose-label')).map((el) => el.textContent);
    expect(renderedPurposeLabels).toEqual(expectedLabels);
  });
});

// Acceptance fix — a prior round misread "move the suitability card above
// Additional information" as "add a NEW standalone Best-suited-for summary
// card". That new card (CountryBestSuitedFor / "الأنسب لـ") is deleted, not
// hidden: exactly one suitability section must exist, and it is the
// original "Suitable for" / "مناسب لـ" card with the full per-purpose list.
describe('CountrySuitability — no separate "Best suited for" summary card exists', () => {
  it('does not render an "الأنسب لـ" / "Best suited for" summary heading', () => {
    renderWith(saudiArabia, 'en');
    expect(screen.queryByText('Best suited for')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Strong for /)).not.toBeInTheDocument();
  });

  it('AR: does not render "الأنسب لـ" or its grouped "قوية في" phrasing', () => {
    renderWith(saudiArabia, 'ar');
    expect(screen.queryByText('الأنسب لـ')).not.toBeInTheDocument();
    expect(screen.queryByText(/^قوية في /)).not.toBeInTheDocument();
  });

  it('renders exactly one suitability card/section for a country', () => {
    const { container } = renderWith(saudiArabia, 'en');
    expect(container.querySelectorAll('.detail-card').length).toBe(1);
    expect(container.querySelectorAll('.best-suited-for-card').length).toBe(0);
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

// Acceptance fix — "Why this score?" previously always showed factor names
// ("Safety", "Affordability", …) in English even when the app language was
// Arabic, because they came straight from the Worker's English-only
// component.label with no lang parameter at all. Fixed with a deterministic
// EN/AR factorLabels dictionary (data/i18n/en.ts, ar.ts — see
// factorLabels.test.ts for full-coverage verification); this proves the
// actual rendered surface, mocking only the network fetch, exactly like
// the English-mode tests above.
describe('CountrySuitability — "Why this score?" is fully localized in Arabic, and never leaks Arabic into English', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockTourismDetail() {
    return vi.spyOn(detailClient, 'lookupSuitabilityDetail').mockResolvedValueOnce({
      countryCode: 'SA',
      purpose: 'tourism',
      modelVersion: 'tourism-v1',
      score: 85,
      insufficientData: false,
      coverage: 100,
      confidence: 'high',
      updatedAt: '2026-01-01T00:00:00.000Z',
      components: [
        { factor: 'safety', label: 'Safety', rawValue: 1, normalizedValue: 95, contribution: 19, weight: 20, dataYear: '2024', sourceId: 'homicideRate', status: 'observed' as const },
        { factor: 'affordability', label: 'Affordability', rawValue: 50, normalizedValue: 20, contribution: 4, weight: 20, dataYear: '2024', sourceId: 'priceLevelIndex', status: 'observed' as const },
        { factor: 'touristDraw', label: 'Established tourist draw', rawValue: null, normalizedValue: null, contribution: null, weight: 25, dataYear: null, sourceId: 'tourismArrivals', status: 'missing' as const },
      ],
      sources: {
        homicideRate: { id: 'homicideRate', name: 'World Bank — Intentional homicides', provider: 'World Bank', tier: 'official-international', indicatorId: 'VC.IHR.PSRC.P5', url: 'https://data.worldbank.org/indicator/VC.IHR.PSRC.P5', license: 'CC BY-4.0' },
      },
    });
  }

  function openTourismDetail() {
    const tourismRow = screen.getByText('سياحة وإجازة').closest('li.suitability-row')!;
    fireEvent.click(tourismRow.querySelector('summary')!);
  }

  it('renders factor names, the missing-data label, and section headings in Arabic — the raw English component.label never leaks through', async () => {
    mockTourismDetail();
    renderWith(saudiArabia, 'ar');
    openTourismDetail();

    await waitFor(() => expect(screen.getByText('المنهجية: tourism-v1')).toBeInTheDocument());

    // Factor names come from the deterministic AR dictionary, not the
    // Worker's English component.label. "Safety"/"Affordability" appear
    // twice each (once in "Main strengths"/limitations, once in the full
    // component list), so getAllByText is correct here.
    expect(screen.getAllByText('الأمان').length).toBeGreaterThan(0);
    expect(screen.getAllByText('القدرة على تحمل التكلفة').length).toBeGreaterThan(0);
    expect(screen.getByText('الجاذبية السياحية الراسخة')).toBeInTheDocument();
    expect(screen.queryByText('Safety')).not.toBeInTheDocument();
    expect(screen.queryByText('Affordability')).not.toBeInTheDocument();
    expect(screen.queryByText('Established tourist draw')).not.toBeInTheDocument();

    // Other explanatory UI (missing-data label, strengths heading, sources
    // heading) is already-localized chrome — re-verified here in place:
    expect(screen.getByText('لا تتوفر بيانات')).toBeInTheDocument();
    expect(screen.getByText('أبرز نقاط القوة')).toBeInTheDocument();
    expect(screen.getByText(/^المصادر/)).toBeInTheDocument();

    // Allowed to stay English per the task's own rule: an official source's
    // own name/title with no approved Arabic title.
    expect(screen.getByText('World Bank — Intentional homicides')).toBeInTheDocument();
  });

  it('the reverse: the same data rendered in English never leaks an Arabic UI label', async () => {
    mockTourismDetail();
    renderWith(saudiArabia, 'en');
    fireEvent.click(screen.getAllByText('Why this score?')[0]!);
    await waitFor(() => expect(screen.getByText('Methodology: tourism-v1')).toBeInTheDocument());

    expect(document.body.textContent ?? '').not.toMatch(/[؀-ۿ]/);
  });
});
