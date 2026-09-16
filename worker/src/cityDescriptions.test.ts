// Acceptance item #3 — the description layer must be honest before it is
// useful. These tests pin the three things that make it honest:
//   1. nothing is ever invented — a miss produces no text at all
//   2. a namesake city can never be described as this one
//   3. every description that IS returned carries its source and licence
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DESCRIPTION_LICENSE,
  DESCRIPTION_SOURCE,
  MATCH_RADIUS_KM,
  MAX_CITIES_PER_REQUEST,
  evaluateSummary,
  handleCityDescriptionRequest,
  haversineKm,
  referenceCoordinates,
  resolveCityDescription,
  trimToSentences,
  validateDescriptionRequest,
} from './cityDescriptions';

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const TOKYO: [number, number] = [35.685, 139.7514];

function summaryPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'standard',
    title: 'Tokyo',
    extract: 'Tokyo, officially the Tokyo Metropolis, is the capital and most populous city of Japan. It sits at the head of Tokyo Bay and anchors the Greater Tokyo Area, the most populous metropolitan area in the world.',
    coordinates: { lat: 35.6895, lon: 139.6917 },
    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Tokyo' } },
    ...overrides,
  };
}

describe('the coordinate index', () => {
  it('knows the cities the app actually features', () => {
    expect(referenceCoordinates('JP', 'Tokyo')).not.toBeNull();
    expect(referenceCoordinates('FR', 'Paris')).not.toBeNull();
  });

  it('does not answer for a city the app does not feature', () => {
    expect(referenceCoordinates('JP', 'Somewhere That Does Not Exist')).toBeNull();
  });

  it('matches regardless of case, spacing and accents', () => {
    expect(referenceCoordinates('JP', 'tokyo')).toEqual(referenceCoordinates('JP', 'Tokyo'));
    expect(referenceCoordinates('MY', 'Kuala  Lumpur')).toEqual(referenceCoordinates('MY', 'kualalumpur'));
  });
});

describe('accepting or rejecting an article', () => {
  it('accepts a standard article whose own coordinates match the city', () => {
    const verdict = evaluateSummary(summaryPayload(), TOKYO);
    expect(verdict.status).toBe('ok');
    expect(verdict.summary).toContain('capital');
    expect(verdict.sourceUrl).toBe('https://en.wikipedia.org/wiki/Tokyo');
  });

  it('refuses a disambiguation page rather than describing one of its options', () => {
    expect(evaluateSummary(summaryPayload({ type: 'disambiguation' }), TOKYO).status).toBe('ambiguous');
  });

  it('refuses an article about a NAMESAKE somewhere else entirely', () => {
    // Tripoli, Lebanon vs Tripoli, Libya — a real collision in this catalog.
    const lebanon: [number, number] = [34.4367, 35.8497];
    const libyaArticle = summaryPayload({ coordinates: { lat: 32.8872, lon: 13.1913 }, title: 'Tripoli' });
    expect(evaluateSummary(libyaArticle, lebanon).status).toBe('wrong_place');
    expect(haversineKm(lebanon, [32.8872, 13.1913])).toBeGreaterThan(MATCH_RADIUS_KM);
  });

  it('refuses an article with no coordinates, because nothing proves it is the right place', () => {
    expect(evaluateSummary(summaryPayload({ coordinates: undefined }), TOKYO).status).toBe('wrong_place');
  });

  it('refuses a stub that is too short to be a description', () => {
    expect(evaluateSummary(summaryPayload({ extract: 'A city.' }), TOKYO).status).toBe('too_short');
  });

  it('refuses anything that is not a summary payload at all', () => {
    expect(evaluateSummary(null, TOKYO).status).toBe('no_article');
    expect(evaluateSummary('nope', TOKYO).status).toBe('no_article');
  });
});

describe('trimming', () => {
  it('leaves a short description untouched', () => {
    expect(trimToSentences('Short and complete.')).toBe('Short and complete.');
  });

  it('cuts at a sentence boundary rather than mid-word', () => {
    const text = `${'First sentence is quite long and descriptive. '.repeat(8)}Trailing.`;
    const trimmed = trimToSentences(text, 120);
    expect(trimmed.endsWith('.')).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(121);
  });

  it('handles Arabic sentence punctuation', () => {
    const arabic = `${'هذه مدينة تاريخية كبيرة على الساحل وفيها معالم بارزة. '.repeat(6)}نهاية.`;
    const trimmed = trimToSentences(arabic, 150);
    expect(trimmed.length).toBeLessThanOrEqual(151);
  });
});

describe('request validation', () => {
  it('accepts a well-formed batch', () => {
    const result = validateDescriptionRequest({ lang: 'en', countryCode: 'JP', cities: [{ name: 'Tokyo' }] });
    expect(Array.isArray(result)).toBe(false);
  });

  it('rejects an oversized batch so one request cannot fan out without bound', () => {
    const cities = Array.from({ length: MAX_CITIES_PER_REQUEST + 1 }, (_, index) => ({ name: `City ${index}` }));
    expect(validateDescriptionRequest({ lang: 'en', countryCode: 'JP', cities })).toContain('cities');
  });

  it('rejects the excluded country code, like every other endpoint', () => {
    expect(validateDescriptionRequest({ lang: 'en', countryCode: 'IL', cities: [{ name: 'X' }] })).toContain('countryCode');
  });

  it('rejects an unsupported language', () => {
    expect(validateDescriptionRequest({ lang: 'fr', countryCode: 'JP', cities: [{ name: 'Tokyo' }] })).toContain('lang');
  });
});

describe('resolving a description end to end', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(summaryPayload()), { status: 200 })) as typeof fetch;
  });

  it('returns the description with its source and licence attached', async () => {
    const result = await resolveCityDescription({}, 'JP', 'Tokyo', 'en', 'Tokyo');
    expect(result.status).toBe('ok');
    expect(result.summary).toBeTruthy();
    expect(result.source).toBe(DESCRIPTION_SOURCE);
    expect(result.license).toBe(DESCRIPTION_LICENSE);
    expect(result.sourceUrl).toContain('wikipedia.org');
  });

  it('never invents anything for a city it cannot verify', async () => {
    const result = await resolveCityDescription({}, 'JP', 'Not A Featured City', 'en', 'Not A Featured City');
    expect(result.summary).toBeNull();
    expect(result.source).toBeNull();
    // And it did not even ask upstream.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns no description, and no error, when the upstream call fails', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as typeof fetch;
    const result = await resolveCityDescription({}, 'JP', 'Tokyo', 'en', 'Tokyo');
    expect(result.status).toBe('unavailable');
    expect(result.summary).toBeNull();
  });

  it('can be switched off entirely without touching the network', async () => {
    const result = await resolveCityDescription({ CITY_DESCRIPTIONS: 'off' }, 'JP', 'Tokyo', 'en', 'Tokyo');
    expect(result.status).toBe('unavailable');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('serves a fresh cache row without calling upstream', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ status: 'ok', summary: 'Cached description of the city.', source_url: 'https://en.wikipedia.org/wiki/Tokyo', fetched_at: new Date().toISOString() }),
          run: async () => undefined,
          all: async () => ({ results: [] }),
        }),
        first: async () => null,
        run: async () => undefined,
        all: async () => ({ results: [] }),
      }),
    };
    const result = await resolveCityDescription({ PRODUCT_DB: db as never }, 'JP', 'Tokyo', 'en', 'Tokyo');
    expect(result.summary).toBe('Cached description of the city.');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refetches once the cached row is stale', async () => {
    const stale = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ status: 'ok', summary: 'Very old description.', source_url: null, fetched_at: stale }),
          run: async () => undefined,
          all: async () => ({ results: [] }),
        }),
        first: async () => null,
        run: async () => undefined,
        all: async () => ({ results: [] }),
      }),
    };
    const result = await resolveCityDescription({ PRODUCT_DB: db as never }, 'JP', 'Tokyo', 'en', 'Tokyo');
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(result.summary).not.toBe('Very old description.');
  });

  it('works with no database at all', async () => {
    const result = await resolveCityDescription({}, 'FR', 'Paris', 'en', 'Paris');
    expect(['ok', 'wrong_place', 'unavailable']).toContain(result.status);
  });
});

describe('the HTTP endpoint', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('ignores every other path', async () => {
    const response = await handleCityDescriptionRequest(new Request('https://w.dev/api/other'), {}, json);
    expect(response).toBeNull();
  });

  it('rejects a GET', async () => {
    const response = await handleCityDescriptionRequest(new Request('https://w.dev/api/cities/descriptions'), {}, json);
    expect(response!.status).toBe(405);
  });

  it('answers 200 with per-city results and a single attribution block', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(summaryPayload()), { status: 200 })) as typeof fetch;
    const request = new Request('https://w.dev/api/cities/descriptions', {
      method: 'POST',
      body: JSON.stringify({ lang: 'en', countryCode: 'JP', cities: [{ name: 'Tokyo' }, { name: 'Nowhere' }] }),
    });
    const response = await handleCityDescriptionRequest(request, {}, json);
    expect(response!.status).toBe(200);
    const body = await response!.json() as { descriptions: { status: string; summary: string | null }[]; attribution: { license: string } };
    expect(body.descriptions).toHaveLength(2);
    expect(body.descriptions[0]!.status).toBe('ok');
    // The unknown city gets an honest empty answer alongside the good one.
    expect(body.descriptions[1]!.summary).toBeNull();
    expect(body.attribution.license).toBe(DESCRIPTION_LICENSE);
  });

  it('rejects malformed JSON', async () => {
    const request = new Request('https://w.dev/api/cities/descriptions', { method: 'POST', body: 'not json' });
    const response = await handleCityDescriptionRequest(request, {}, json);
    expect(response!.status).toBe(400);
  });
});
