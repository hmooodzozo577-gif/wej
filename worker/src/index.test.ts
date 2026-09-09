// Phase 13.2 foundation + Phase 13.3 (this change) — Worker tests.
// Exercises handleRequest() directly with real Web-standard Request
// objects (no wrangler/Miniflare needed — Node's native fetch/Request/
// Response implement the same spec). The global `fetch` is stubbed via
// vi.stubGlobal() for every test that reaches Amadeus, so this suite
// never makes a real network call and never uses a real credential —
// see amadeus.test.ts for the lower-level, non-HTTP unit tests of the
// Amadeus client itself.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, validateFlightSearchRequest, type Env } from './index';
import { __resetAmadeusTokenCacheForTests } from './amadeus';

const ALLOWED_ORIGIN = 'https://hmooodzozo577-gif.github.io';
const env: Env = {
  AMADEUS_API_KEY: 'test-fixture-client-id-not-real',
  AMADEUS_API_SECRET: 'test-fixture-client-secret-not-real',
};

function post(body: unknown, origin = ALLOWED_ORIGIN): Request {
  return new Request('https://worker.example/api/travel/flights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

const validBody = {
  origin: 'RUH',
  destination: 'JFK',
  departureDate: '2026-12-01',
  passengers: 1,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokenResponse() {
  return { token_type: 'Bearer', access_token: 'fixture-access-token', expires_in: 1799 };
}

const OFFERS_RESPONSE = {
  meta: { count: 1 },
  data: [
    {
      id: '1',
      itineraries: [
        {
          duration: 'PT9H35M',
          segments: [
            {
              departure: { iataCode: 'RUH', at: '2026-12-01T08:30:00' },
              arrival: { iataCode: 'JFK', at: '2026-12-01T14:05:00' },
              carrierCode: 'SV',
              number: '37',
            },
          ],
        },
      ],
      price: { currency: 'USD', total: '845.30', base: '700.00' },
    },
  ],
  dictionaries: {
    locations: { RUH: { countryCode: 'SA' }, JFK: { countryCode: 'US' } },
    carriers: { SV: 'SAUDIA' },
  },
};

/** Stubs the global fetch with a URL-routed mock for the duration of one
 *  test, and resets the amadeus.ts token cache so tests don't leak a
 *  cached token into each other. */
function stubAmadeusFetch(byUrlSubstring: Record<string, () => Response | Promise<Response>>) {
  __resetAmadeusTokenCacheForTests();
  const fn = vi.fn(async (url: string) => {
    for (const [substr, handler] of Object.entries(byUrlSubstring)) {
      if (url.includes(substr)) return handler();
    }
    throw new Error(`Unexpected fetch to ${url} in test`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phase 13.3 — Worker: validateFlightSearchRequest', () => {
  it('accepts a well-formed one-way request', () => {
    expect(validateFlightSearchRequest(validBody)).toEqual([]);
  });

  it('accepts a well-formed round-trip request', () => {
    expect(validateFlightSearchRequest({ ...validBody, returnDate: '2026-12-10' })).toEqual([]);
  });

  it('accepts a request with passengers omitted (defaults applied later, not a validation error)', () => {
    const { passengers, ...withoutPassengers } = validBody;
    void passengers;
    expect(validateFlightSearchRequest(withoutPassengers)).toEqual([]);
  });

  it('rejects a non-object body', () => {
    expect(validateFlightSearchRequest('nope').length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest(null).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest([1, 2, 3]).length).toBeGreaterThan(0);
  });

  it('rejects a lowercase or malformed IATA code', () => {
    expect(validateFlightSearchRequest({ ...validBody, origin: 'ruh' }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, origin: 'RUHH' }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, origin: '' }).length).toBeGreaterThan(0);
  });

  it('rejects origin === destination', () => {
    const errors = validateFlightSearchRequest({ ...validBody, destination: 'RUH' });
    expect(errors.some((e) => e.includes('different'))).toBe(true);
  });

  it('rejects a malformed departure date', () => {
    expect(validateFlightSearchRequest({ ...validBody, departureDate: '12/01/2026' }).length).toBeGreaterThan(0);
  });

  it('rejects a malformed return date', () => {
    expect(validateFlightSearchRequest({ ...validBody, returnDate: 'not-a-date' }).length).toBeGreaterThan(0);
  });

  it('rejects a return date before the departure date', () => {
    const errors = validateFlightSearchRequest({ ...validBody, departureDate: '2026-12-10', returnDate: '2026-12-01' });
    expect(errors.some((e) => e.includes('not be before'))).toBe(true);
  });

  it('accepts a return date equal to the departure date (same-day round trip)', () => {
    expect(validateFlightSearchRequest({ ...validBody, departureDate: '2026-12-01', returnDate: '2026-12-01' })).toEqual([]);
  });

  it('rejects an invalid passenger count', () => {
    expect(validateFlightSearchRequest({ ...validBody, passengers: 0 }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, passengers: 1.5 }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, passengers: 10 }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, passengers: '1' }).length).toBeGreaterThan(0);
  });

  it('reports every failing field at once, not just the first', () => {
    const errors = validateFlightSearchRequest({ origin: 'x', destination: 1, departureDate: null, passengers: -1 });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Phase 13.3 — Worker: handleRequest routing, method, CORS (no Amadeus call reached)', () => {
  it('returns 400 with field errors for an invalid request, without calling Amadeus', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handleRequest(post({ ...validBody, origin: 'nope' }), env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; fields: string[] };
    expect(data.error).toBe('invalid_request');
    expect(data.fields.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed JSON body, without calling Amadeus', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = new Request('https://worker.example/api/travel/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: '{not json',
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown path', async () => {
    const req = new Request('https://worker.example/api/nope', { method: 'POST' });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(404);
  });

  it('returns 405 for a non-POST method on the known path', async () => {
    const req = new Request('https://worker.example/api/travel/flights', { method: 'GET' });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(405);
  });

  it('sets Access-Control-Allow-Origin only for the exact allowed GitHub Pages origin', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(OFFERS_RESPONSE),
    });
    const res = await handleRequest(post(validBody, ALLOWED_ORIGIN), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
  });

  it('CRITICAL: never reflects an arbitrary Origin — CORS is not "*"', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(OFFERS_RESPONSE),
    });
    const res = await handleRequest(post(validBody, 'https://evil.example'), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('handles an OPTIONS preflight for the allowed origin without touching Amadeus', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const req = new Request('https://worker.example/api/travel/flights', {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN },
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase 13.3 — Worker: handleRequest + real Amadeus flow (fetch mocked)', () => {
  beforeEach(() => {
    __resetAmadeusTokenCacheForTests();
  });

  it('returns 200 with normalized offers for a successful Amadeus search', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(OFFERS_RESPONSE),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { offers: unknown[] };
    expect(data.offers).toHaveLength(1);
  });

  it('normalizes total price/currency and stop count correctly through the full HTTP path', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(OFFERS_RESPONSE),
    });
    const res = await handleRequest(post(validBody), env);
    const data = (await res.json()) as { offers: { price: { amount: number; currency: string }; stops: number }[] };
    expect(data.offers[0]!.price).toEqual({ amount: 845.3, currency: 'USD' });
    expect(data.offers[0]!.stops).toBe(0);
  });

  it('returns 200 with an empty offers array (never an error) when Amadeus has no results', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ meta: { count: 0 }, data: [], dictionaries: {} }),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { offers: unknown[] };
    expect(data.offers).toEqual([]);
  });

  it('returns a safe 502 (never 200, never fake offers) on Amadeus authentication failure', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse({ error: 'invalid_client' }, 401),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(502);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('provider_error');
    expect(data.offers).toBeUndefined();
  });

  it('returns a safe 502 on an Amadeus 4xx for the flight-offers call', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ errors: [{ status: 400 }] }, 400),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(502);
  });

  it('returns a safe 502 on an Amadeus 5xx for the flight-offers call', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ errors: [{ status: 500 }] }, 500),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(502);
  });

  it('returns a safe 504 on an Amadeus request timeout', async () => {
    __resetAmadeusTokenCacheForTests();
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortError;
      }),
    );
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(504);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('provider_timeout');
  });

  it('returns a safe 502 on a network failure reaching Amadeus', async () => {
    __resetAmadeusTokenCacheForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND test.api.amadeus.com');
      }),
    );
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(502);
    const data = (await res.json()) as Record<string, unknown>;
    // Never the raw underlying error message.
    expect(JSON.stringify(data)).not.toContain('ENOTFOUND');
  });

  it('returns a safe 502 on a malformed (non-JSON) Amadeus response', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => new Response('not json', { status: 200 }),
    });
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(502);
  });

  it('normalizes a multi-segment (connecting) itinerary through the full HTTP path', async () => {
    stubAmadeusFetch({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () =>
        jsonResponse({
          data: [
            {
              id: '9',
              itineraries: [
                {
                  duration: 'PT12H0M',
                  segments: [
                    {
                      departure: { iataCode: 'RUH', at: '2026-12-01T08:30:00' },
                      arrival: { iataCode: 'DXB', at: '2026-12-01T11:00:00' },
                      carrierCode: 'EK',
                    },
                    {
                      departure: { iataCode: 'DXB', at: '2026-12-01T13:00:00' },
                      arrival: { iataCode: 'JFK', at: '2026-12-01T20:30:00' },
                      carrierCode: 'EK',
                    },
                  ],
                },
              ],
              price: { currency: 'USD', total: '900.00' },
            },
          ],
          dictionaries: { locations: {}, carriers: { EK: 'EMIRATES' } },
        }),
    });
    const res = await handleRequest(post(validBody), env);
    const data = (await res.json()) as {
      offers: { segments: { durationMinutes: number }[]; stops: number; layovers: { airport: { iata: string }; durationMinutes: number }[] }[];
    };
    expect(data.offers[0]!.segments).toHaveLength(2);
    expect(data.offers[0]!.stops).toBe(1);
    // Layover breakdown reaches the browser: 1 stop at DXB, 120 minutes
    // (11:00 arrival to 13:00 departure).
    expect(data.offers[0]!.layovers).toEqual([{ airport: { iata: 'DXB', name: 'DXB', countryCode: '' }, durationMinutes: 120 }]);
  });

  it('CRITICAL: no response (success or error) ever contains the API key, secret, or bearer token', async () => {
    const scenarios: [string, () => void][] = [
      [
        'success',
        () =>
          stubAmadeusFetch({
            '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
            '/v2/shopping/flight-offers': () => jsonResponse(OFFERS_RESPONSE),
          }),
      ],
      ['auth failure', () => stubAmadeusFetch({ '/v1/security/oauth2/token': () => jsonResponse({}, 401) })],
      [
        'provider failure',
        () =>
          stubAmadeusFetch({
            '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
            '/v2/shopping/flight-offers': () => jsonResponse({ errors: [] }, 500),
          }),
      ],
    ];
    for (const [, setup] of scenarios) {
      setup();
      const res = await handleRequest(post(validBody), env);
      const text = await res.text();
      expect(text).not.toContain(env.AMADEUS_API_KEY);
      expect(text).not.toContain(env.AMADEUS_API_SECRET);
      expect(text).not.toContain('fixture-access-token');
      expect(text.toLowerCase()).not.toContain('bearer');
      // Response headers too — the Authorization header the Worker sends
      // to Amadeus must never be echoed back to the browser.
      expect(res.headers.get('Authorization')).toBeNull();
    }
  });
});
