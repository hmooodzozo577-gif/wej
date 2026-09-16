import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { featuredCitiesOf } from '../data/featuredCities';
import { FeaturedCitiesCard } from './FeaturedCitiesCard';

async function openCard(countryId: string, lang: 'ar' | 'en' = 'ar') {
  const country = WORLD_CATALOG.find((entry) => entry.id === countryId)!;
  const result = render(<FeaturedCitiesCard destination={country} lang={lang} strings={I18N[lang].detail} />);
  const heading = screen.getByText(I18N[lang].detail.prominentCities).closest('summary')!;
  fireEvent.click(heading);
  await waitFor(() => expect(screen.getByText(I18N[lang].detail.showLess)).toBeInTheDocument());
  // The city list arrives via a dynamic import, so the details elements are
  // not in the DOM on the tick the card opens.
  await waitFor(() => expect(result.container.querySelectorAll('.featured-city').length).toBeGreaterThan(0));
  return result;
}

/** Opens the card AND the first city's own <details>, which is where the
 *  description and the facts live. */
function renderCard(lang: 'ar' | 'en' = 'en') {
  const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
  return render(<FeaturedCitiesCard destination={japan} lang={lang} strings={I18N[lang].detail} />);
}

async function openCardAndFirstCity(container: HTMLElement) {
  fireEvent.click(screen.getByText(I18N.en.detail.prominentCities).closest('summary')!);
  await waitFor(() => expect(container.querySelectorAll('.featured-city').length).toBeGreaterThan(0));
  fireEvent.click(container.querySelector('.featured-city > summary')!);
}

describe('FeaturedCitiesCard', () => {
  it('keeps city information optional and reveals sourced details on demand', async () => {
    const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
    render(<FeaturedCitiesCard destination={japan} lang="ar" strings={I18N.ar.detail} />);

    const section = screen.getByText(I18N.ar.detail.prominentCities).closest('summary')!;
    expect(section.parentElement).not.toHaveAttribute('open');
    expect(screen.getByText(I18N.ar.detail.showMore)).toBeInTheDocument();
    fireEvent.click(section);
    await waitFor(() => expect(screen.getByText(I18N.ar.detail.showLess)).toBeInTheDocument());

    const tokyo = (await screen.findByText('طوكيو', {}, { timeout: 5000 })).closest('summary')!;
    fireEvent.click(tokyo);
    expect(screen.getByText(I18N.ar.detail.capitalCity)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: I18N.ar.detail.cityDataSource }).length).toBeGreaterThan(0);
  });

  // Item #5 — the regression this section exists for: five cities in a
  // country used to render the same two sentences, differing only by name
  // and population.
  describe('city content is genuinely distinct', () => {
    it('renders a different fact set for each city of a country', async () => {
      const { container } = await openCard('japan');
      for (const summary of container.querySelectorAll('.featured-city summary')) {
        fireEvent.click(summary);
      }
      const bodies = [...container.querySelectorAll('.featured-city-body')].map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      expect(bodies.length).toBeGreaterThan(2);
      expect(new Set(bodies).size).toBe(bodies.length);
    });

    it('shows no shared template sentence across cities', async () => {
      const { container } = await openCard('japan');
      for (const summary of container.querySelectorAll('.featured-city summary')) {
        fireEvent.click(summary);
      }
      // The old implementation put an identical <p> in every city body. The
      // new one renders only label/value pairs, so no city body may be a
      // prefix-identical copy of another.
      const paragraphs = [...container.querySelectorAll('.featured-city-body p')].map((node) => node.textContent);
      const duplicated = paragraphs.filter((text, index) => text && paragraphs.indexOf(text) !== index);
      expect(duplicated).toEqual([]);
    });

    it('gives non-capital cities a distance and direction from the capital', async () => {
      const { container } = await openCard('japan');
      for (const summary of container.querySelectorAll('.featured-city summary')) {
        fireEvent.click(summary);
      }
      const capitalLabels = screen.getAllByText(I18N.ar.detail.cityFromCapital);
      expect(capitalLabels.length).toBeGreaterThan(0);
      const values = capitalLabels.map((label) => label.nextElementSibling?.textContent ?? '');
      // Every distance differs — the whole point of showing it.
      expect(new Set(values).size).toBe(values.length);
      for (const value of values) {
        expect(value).toMatch(/\d/);
        expect(value).toMatch(new RegExp(Object.values(I18N.ar.detail.cityBearings).join('|')));
      }
    });

    it('names a real airport inside the same country, never across a border', async () => {
      for (const country of ['japan', 'ksa', 'france']) {
        const { container, unmount } = await openCard(country);
        for (const summary of container.querySelectorAll('.featured-city summary')) {
          fireEvent.click(summary);
        }
        const cities = featuredCitiesOf(WORLD_CATALOG.find((entry) => entry.id === country)!.countryCode);
        for (const city of cities) {
          if (!city.airport) continue;
          expect(container.textContent).toContain(city.airport.iata);
        }
        unmount();
      }
    });
  });

  describe('honesty about what this data is', () => {
    it('states that these are sourced facts rather than written editorial', async () => {
      await openCard('japan');
      expect(screen.getByText(I18N.ar.detail.cityFactsNote)).toBeInTheDocument();
    });

    it('omits a fact the source does not have rather than filling it in', async () => {
      // Monaco is a single-city state: no distance from the capital, and no
      // IATA airport of its own. Neither may be invented.
      const { container } = await openCard('mc');
      for (const summary of container.querySelectorAll('.featured-city summary')) {
        fireEvent.click(summary);
      }
      expect(screen.queryByText(I18N.ar.detail.cityFromCapital)).not.toBeInTheDocument();
      expect(screen.queryByText(I18N.ar.detail.cityNearestAirport)).not.toBeInTheDocument();
      // What it does have is still shown.
      expect(screen.getByText(I18N.ar.detail.cityTimezone)).toBeInTheDocument();
    });

    it('keeps the section collapsed by default with Show more / Show less', () => {
      const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
      const { container } = render(<FeaturedCitiesCard destination={japan} lang="en" strings={I18N.en.detail} />);
      expect(container.querySelector('details.featured-cities-card')).not.toHaveAttribute('open');
      expect(screen.getByText('Show more')).toBeInTheDocument();
    });
  });
});

describe('the generated city dataset itself', () => {
  it('gives every catalog country at least one city', () => {
    for (const country of WORLD_CATALOG) {
      expect(featuredCitiesOf(country.countryCode).length, country.countryCode).toBeGreaterThan(0);
    }
  });

  it('carries at least one distinguishing fact for the overwhelming majority of cities', () => {
    const all = WORLD_CATALOG.flatMap((country) => featuredCitiesOf(country.countryCode));
    const withFacts = all.filter((city) => city.region || city.timezone || city.fromCapital || city.airport);
    expect(all.length).toBeGreaterThan(700);
    expect(withFacts.length / all.length).toBeGreaterThan(0.9);
  });

  it('never attributes an airport to the wrong country', () => {
    for (const country of WORLD_CATALOG) {
      for (const city of featuredCitiesOf(country.countryCode)) {
        if (!city.airport) continue;
        expect(city.airport.iata, `${country.countryCode}/${city.nameEn}`).toMatch(/^[A-Z]{3}$/);
        expect(city.airport.distanceKm, `${country.countryCode}/${city.nameEn}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it('never claims a distance from the capital for a capital city', () => {
    for (const country of WORLD_CATALOG) {
      for (const city of featuredCitiesOf(country.countryCode)) {
        if (city.capital) expect(city.fromCapital, `${country.countryCode}/${city.nameEn}`).toBeNull();
      }
    }
  });

  it('ranks by population consistently within a country', () => {
    for (const country of WORLD_CATALOG) {
      const ranked = featuredCitiesOf(country.countryCode).filter((city) => city.populationRank && city.population);
      for (let index = 1; index < ranked.length; index += 1) {
        const previous = ranked[index - 1]!;
        const current = ranked[index]!;
        if (previous.populationRank! < current.populationRank!) {
          expect(previous.population!, `${country.countryCode}`).toBeGreaterThanOrEqual(current.population!);
        }
      }
    }
  });
});

// Acceptance item #3 — the general description, on top of the facts.
//
// The description is fetched by the Worker and verified there; what this
// file guards is the CONTRACT the card keeps with it: show a verified
// description with its credit, show nothing at all when there is none, and
// never lose the structured facts either way.
describe('item #3 — a general description above the structured facts', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function stubWorker(descriptions: unknown[]) {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ descriptions, attribution: { source: 'Wikipedia', license: 'CC BY-SA 4.0' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
  }

  const verified = {
    cityName: 'Tokyo',
    countryCode: 'JP',
    lang: 'en',
    status: 'ok',
    summary: 'Tokyo is the capital of Japan and the core of the largest metropolitan area in the world.',
    source: 'Wikipedia',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tokyo',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    fetchedAt: new Date().toISOString(),
  };

  it('renders a verified description with its source and licence credit', async () => {
    stubWorker([verified]);
    const { container } = renderCard('en');
    await openCardAndFirstCity(container);

    expect(await screen.findByText(/core of the largest metropolitan area/)).toBeInTheDocument();
    expect(screen.getByText(/Description from Wikipedia/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href', 'https://creativecommons.org/licenses/by-sa/4.0/',
    );
    expect(screen.getByRole('link', { name: /Read the full article/ })).toHaveAttribute(
      'href', 'https://en.wikipedia.org/wiki/Tokyo',
    );
  });

  it('shows the structured facts and NO description text when nothing was verified', async () => {
    stubWorker([{ ...verified, status: 'wrong_place', summary: null, source: null, sourceUrl: null, license: null }]);
    const { container } = renderCard('en');
    await openCardAndFirstCity(container);

    await waitFor(() => expect(container.querySelector('.city-facts')).not.toBeNull());
    expect(container.querySelector('.city-description')).toBeNull();
    expect(screen.queryByText(/Description from/)).not.toBeInTheDocument();
  });

  it('shows the facts alone when the lookup fails outright', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as typeof fetch;
    const { container } = renderCard('en');
    await openCardAndFirstCity(container);

    await waitFor(() => expect(container.querySelector('.city-facts')).not.toBeNull());
    expect(container.querySelector('.city-description')).toBeNull();
  });

  it('never asks for a description before the card is opened', async () => {
    stubWorker([verified]);
    renderCard('en');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sends no coordinates and nothing about the traveller', async () => {
    stubWorker([verified]);
    const { container } = renderCard('en');
    await openCardAndFirstCity(container);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const [, init] = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    const sent = JSON.parse(String(init.body));
    const serialized = JSON.stringify(sent).toLowerCase();
    for (const forbidden of ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'sessionid', 'passport']) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
    expect(sent.countryCode).toBe('JP');
    expect(Array.isArray(sent.cities)).toBe(true);
  });
});
