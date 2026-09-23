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
  addVerifiedCoordinateFallback,
  evaluateSummary,
  handleCityDescriptionRequest,
  haversineKm,
  normalizeCityKey,
  referenceCoordinates,
  resolveCityDescription,
  trimToSentences,
  trustedTitles,
  validateDescriptionRequest,
} from './cityDescriptions';
import cityTitles from './generated/cityTitles.json';
import cityCoordinates from './generated/cityCoordinates.json';

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

  // Acceptance fix — the generator (app/scripts/generate-featured-cities
  // .mjs) used to build this index with a DIFFERENT, diacritic-dropping
  // normalize() than this file's own normalizeCityKey, so any accented
  // city name produced a key this lookup would never compute: Zürich's
  // entry was written under "zrich" while a real request for "Zürich"
  // looks up "zurich" — a permanent miss, no Wikipedia call ever made, no
  // description ever shown, even though the city IS one of the app's
  // featured cities with real facts. The generator now imports and uses
  // this exact function (see app/scripts/lib/cityKey.mjs) so the two can
  // never drift apart again; this proves it against the real, regenerated
  // committed index, not a synthetic fixture.
  it('resolves real diacritic-bearing featured cities — regression for the generator/Worker key mismatch', () => {
    expect(referenceCoordinates('CH', 'Zürich')).not.toBeNull();
    expect(referenceCoordinates('SE', 'Malmö')).not.toBeNull();
    expect(referenceCoordinates('SE', 'Göteborg')).not.toBeNull();
    expect(referenceCoordinates('PL', 'Kraków')).not.toBeNull();
    expect(referenceCoordinates('AR', 'Córdoba')).not.toBeNull();
    expect(referenceCoordinates('CA', 'Montréal')).not.toBeNull();
    expect(referenceCoordinates('IS', 'Reykjavík')).not.toBeNull();
    expect(referenceCoordinates('CO', 'Bogota')).not.toBeNull();
  });
});

describe('normalizeCityKey — diacritic transliteration (not deletion)', () => {
  it.each([
    ['Zürich', 'zurich'],
    ['Bogotá', 'bogota'],
    ['Malmö', 'malmo'],
    ['Kraków', 'krakow'],
    ['Córdoba', 'cordoba'],
    ['Montréal', 'montreal'],
    ['Göteborg', 'goteborg'],
    ['Västerås', 'vasteras'],
    ['Reykjavík', 'reykjavik'],
    ['São Tomé', 'saotome'],
    ['Malé', 'male'],
    ['Chișinău', 'chisinau'],
    ['Asunción', 'asuncion'],
    ['Yaoundé', 'yaounde'],
    ['Brasília', 'brasilia'],
    ['San José', 'sanjose'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeCityKey(input)).toBe(expected);
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

  it('borrows coordinates only from the exact same Wikidata entity', () => {
    const arabic = summaryPayload({
      extract: 'طوكيو هي عاصمة اليابان وأكبر مدنها، وهي مركز البلاد السياسي والاقتصادي والثقافي ومن أكبر المناطق الحضرية في العالم.',
      coordinates: undefined,
      wikibase_item: 'Q1490',
    });
    const matchingEnglish = summaryPayload({ wikibase_item: 'Q1490' });
    const enriched = addVerifiedCoordinateFallback(arabic, matchingEnglish);
    expect(evaluateSummary(enriched, TOKYO).status).toBe('ok');

    const namesake = summaryPayload({ wikibase_item: 'Q999999' });
    expect(evaluateSummary(addVerifiedCoordinateFallback(arabic, namesake), TOKYO).status).toBe('wrong_place');
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

  it('keeps the narrative compact at no more than two complete sentences', () => {
    const text = 'First useful sentence. Second useful sentence. Third sentence belongs in the source article.';
    expect(trimToSentences(text)).toBe('First useful sentence. Second useful sentence.');
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

  it('returns Arabic prose when its matching English entity supplies the omitted coordinates', async () => {
    const arabicExtract = 'طوكيو هي عاصمة اليابان وأكبر مدنها، وهي مركز البلاد السياسي والاقتصادي والثقافي ومن أكبر المناطق الحضرية في العالم.';
    globalThis.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request instanceof Request ? request.url : request);
      const body = url.includes('ar.wikipedia.org')
        ? summaryPayload({ extract: arabicExtract, coordinates: undefined, wikibase_item: 'Q1490', content_urls: { desktop: { page: 'https://ar.wikipedia.org/wiki/Tokyo' } } })
        : summaryPayload({ wikibase_item: 'Q1490' });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const result = await resolveCityDescription({}, 'JP', 'Tokyo', 'ar', 'طوكيو');
    expect(result.status).toBe('ok');
    expect(result.summary).toContain('عاصمة اليابان');
    expect(result.sourceUrl).toContain('ar.wikipedia.org');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache a false wrong-place verdict when the coordinate companion is temporarily unavailable', async () => {
    globalThis.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request instanceof Request ? request.url : request);
      if (url.includes('en.wikipedia.org')) throw new Error('temporary companion failure');
      return new Response(JSON.stringify(summaryPayload({ coordinates: undefined, wikibase_item: 'Q1490' })), { status: 200 });
    }) as typeof fetch;

    const result = await resolveCityDescription({}, 'JP', 'Tokyo', 'ar', 'طوكيو');
    expect(result.status).toBe('unavailable');
    expect(result.summary).toBeNull();
  });

  it('rechecks a legacy cached Arabic wrong-place verdict after the coordinate policy fix', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ status: 'wrong_place', summary: null, source_url: null, fetched_at: '2026-09-17T00:00:00.000Z' }),
          run: async () => undefined,
          all: async () => ({ results: [] }),
        }),
        first: async () => null,
        run: async () => undefined,
        all: async () => ({ results: [] }),
      }),
    };
    globalThis.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request instanceof Request ? request.url : request);
      const body = url.includes('ar.wikipedia.org')
        ? summaryPayload({ coordinates: undefined, wikibase_item: 'Q1490' })
        : summaryPayload({ wikibase_item: 'Q1490' });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const result = await resolveCityDescription({ PRODUCT_DB: db as never }, 'JP', 'Tokyo', 'ar', 'طوكيو');
    expect(result.status).toBe('ok');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
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

describe('the trusted title allowlist (Security Pass 2, S2)', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(summaryPayload()), { status: 200 })) as typeof fetch;
  });

  it('lists exactly the cities the coordinate index knows, from the same generated data', () => {
    expect(Object.keys(cityTitles).sort()).toEqual(Object.keys(cityCoordinates).sort());
    for (const [key, titles] of Object.entries(cityTitles as Record<string, string[]>)) {
      expect(key.startsWith('IL|'), key).toBe(false);
      expect(titles.length, key).toBeGreaterThan(0);
      expect(titles.length, key).toBeLessThanOrEqual(2);
      // The first title is always the English name the key was built from.
      expect(`${key.slice(0, 2)}|${normalizeCityKey(titles[0]!)}`).toBe(key);
    }
  });

  it('gives a featured city its English and Arabic names, and nothing for other places', () => {
    expect(trustedTitles('JP', 'Tokyo')).toEqual(['Tokyo', 'طوكيو']);
    expect(trustedTitles('JP', 'tokyo')).toEqual(['Tokyo', 'طوكيو']);
    expect(trustedTitles('JP', 'Somewhere That Does Not Exist')).toBeNull();
    expect(trustedTitles('IL', 'Jerusalem')).toBeNull();
  });

  it('refuses a client-chosen title without calling upstream or writing the cache', async () => {
    const run = vi.fn(async () => undefined);
    const db = {
      prepare: () => ({
        bind: () => ({ first: async () => null, run, all: async () => ({ results: [] }) }),
        first: async () => null,
        run,
        all: async () => ({ results: [] }),
      }),
    };
    for (const title of ['Shibuya', 'Tokyo Tower', 'Tokyo_(disambiguation)', 'Special:Random', '../Tokyo', 'Paris']) {
      const result = await resolveCityDescription({ PRODUCT_DB: db as never }, 'JP', 'Tokyo', 'en', title);
      expect(result.status, title).toBe('no_article');
      expect(result.summary, title).toBeNull();
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('still accepts the trusted English and Arabic titles', async () => {
    expect((await resolveCityDescription({}, 'JP', 'Tokyo', 'en', 'Tokyo')).status).toBe('ok');
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request instanceof Request ? request.url : request);
      calls.push(url);
      return new Response(JSON.stringify(summaryPayload({ wikibase_item: 'Q1490' })), { status: 200 });
    }) as typeof fetch;
    // A differently spelled city name still resolves to the same city, and
    // the English coordinate companion uses the trusted name, not the input.
    const result = await resolveCityDescription({}, 'JP', 'TOKYO', 'ar', 'طوكيو');
    expect(result.status).toBe('ok');
    expect(calls.some((url) => url.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/Tokyo?'))).toBe(true);
    expect(calls.some((url) => url.includes('TOKYO'))).toBe(false);
  });

  it('answers a refused title over the HTTP route as a normal no-article result', async () => {
    const response = await handleCityDescriptionRequest(new Request('https://w.dev/api/cities/descriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'en', countryCode: 'JP', cities: [{ name: 'Tokyo', title: 'Tokyo Tower' }] }),
    }), {}, json);
    expect(response!.status).toBe(200);
    const body = await response!.json() as { descriptions: { status: string }[] };
    expect(body.descriptions[0]!.status).toBe('no_article');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
