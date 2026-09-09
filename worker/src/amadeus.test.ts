// Phase 13.3 (Part M) — amadeus.ts tests. Every Amadeus call is mocked via
// dependency-injected `fetch` — this suite never makes a real network
// call and never uses a real credential. Fixtures below are realistic
// shapes of Amadeus' OAuth2 token response and Flight Offers Search v2
// response, trimmed to the fields this module actually reads.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AmadeusAuthError,
  AmadeusMalformedResponseError,
  AmadeusProviderError,
  AmadeusTimeoutError,
  resolveAmadeusBaseUrl,
  searchAmadeusFlightOffers,
  __resetAmadeusTokenCacheForTests,
  type Env,
} from './amadeus';

const FAKE_ENV: Env = {
  // Deliberately obviously-fake, distinctive values so a test failure
  // that leaked one into an assertion output would be unmistakable as
  // test fixture data, never mistaken for (or resembling) a real key.
  AMADEUS_API_KEY: 'test-fixture-client-id-not-real',
  AMADEUS_API_SECRET: 'test-fixture-client-secret-not-real',
};

const REQUEST = {
  origin: 'RUH',
  destination: 'JFK',
  departureDate: '2026-12-01',
  passengers: 1,
};

function tokenResponse(overrides: Partial<{ access_token: string; expires_in: number }> = {}) {
  return {
    type: 'amadeusOAuth2Token',
    token_type: 'Bearer',
    access_token: 'fixture-access-token',
    expires_in: 1799,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const SINGLE_OFFER_RESPONSE = {
  meta: { count: 1 },
  data: [
    {
      type: 'flight-offer',
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
    locations: {
      RUH: { cityCode: 'RUH', countryCode: 'SA' },
      JFK: { cityCode: 'NYC', countryCode: 'US' },
    },
    carriers: { SV: 'SAUDIA' },
  },
};

const ROUND_TRIP_WITH_CONNECTION_RESPONSE = {
  meta: { count: 1 },
  data: [
    {
      type: 'flight-offer',
      id: '2',
      itineraries: [
        {
          duration: 'PT12H0M',
          segments: [
            {
              departure: { iataCode: 'RUH', at: '2026-12-01T08:30:00' },
              arrival: { iataCode: 'DXB', at: '2026-12-01T11:00:00' },
              carrierCode: 'EK',
              number: '815',
            },
            {
              departure: { iataCode: 'DXB', at: '2026-12-01T13:00:00' },
              arrival: { iataCode: 'JFK', at: '2026-12-01T20:30:00' },
              carrierCode: 'EK',
              number: '201',
            },
          ],
        },
        {
          duration: 'PT13H0M',
          segments: [
            {
              departure: { iataCode: 'JFK', at: '2026-12-10T22:00:00' },
              arrival: { iataCode: 'RUH', at: '2026-12-11T18:00:00' },
              carrierCode: 'EK',
              number: '202',
            },
          ],
        },
      ],
      price: { currency: 'USD', total: '1420.00', base: '1200.00' },
    },
  ],
  dictionaries: {
    locations: {
      RUH: { cityCode: 'RUH', countryCode: 'SA' },
      DXB: { cityCode: 'DXB', countryCode: 'AE' },
      JFK: { cityCode: 'NYC', countryCode: 'US' },
    },
    carriers: { EK: 'EMIRATES' },
  },
};

function makeFetchMock(byUrlSubstring: Record<string, () => Response | Promise<Response>>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    for (const [substr, handler] of Object.entries(byUrlSubstring)) {
      if (url.includes(substr)) return handler();
    }
    throw new Error(`Unexpected fetch to ${url} in test`);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

beforeEach(() => {
  __resetAmadeusTokenCacheForTests();
});

describe('Phase 13.3 — resolveAmadeusBaseUrl', () => {
  it('defaults to the test/sandbox host when AMADEUS_ENV is unset', () => {
    expect(resolveAmadeusBaseUrl(FAKE_ENV)).toBe('https://test.api.amadeus.com');
  });

  it('uses the test host for any value other than exactly "production"', () => {
    expect(resolveAmadeusBaseUrl({ ...FAKE_ENV, AMADEUS_ENV: 'Production' })).toBe('https://test.api.amadeus.com');
    expect(resolveAmadeusBaseUrl({ ...FAKE_ENV, AMADEUS_ENV: 'prod' })).toBe('https://test.api.amadeus.com');
    expect(resolveAmadeusBaseUrl({ ...FAKE_ENV, AMADEUS_ENV: '' })).toBe('https://test.api.amadeus.com');
  });

  it('uses the production host only when AMADEUS_ENV is exactly "production"', () => {
    expect(resolveAmadeusBaseUrl({ ...FAKE_ENV, AMADEUS_ENV: 'production' })).toBe('https://api.amadeus.com');
  });
});

describe('Phase 13.3 — searchAmadeusFlightOffers: token + auth', () => {
  it('requests a token then the flight offers, sending client_id/client_secret only in the token request body', async () => {
    const { fn, calls } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });

    const result = await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    expect(result.offers).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const [tokenCall, offersCall] = calls;
    expect(tokenCall!.url).toContain('/v1/security/oauth2/token');
    const tokenBody = String(tokenCall!.init?.body);
    expect(tokenBody).toContain('grant_type=client_credentials');
    expect(tokenBody).toContain(encodeURIComponent(FAKE_ENV.AMADEUS_API_KEY));
    expect(tokenBody).toContain(encodeURIComponent(FAKE_ENV.AMADEUS_API_SECRET));
    // The flight-offers request must carry the token as a Bearer header,
    // never the raw client secret.
    const offersHeaders = offersCall!.init?.headers as Record<string, string>;
    expect(offersHeaders.Authorization).toBe('Bearer fixture-access-token');
  });

  it('reuses a cached token across two calls instead of requesting a new one', async () => {
    const { fn, calls } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });

    await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);

    const tokenCalls = calls.filter((c) => c.url.includes('/v1/security/oauth2/token'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('requests a fresh token once the cached one has expired', async () => {
    const { fn, calls } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse({ expires_in: 0 })),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });

    await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);

    const tokenCalls = calls.filter((c) => c.url.includes('/v1/security/oauth2/token'));
    expect(tokenCalls).toHaveLength(2);
  });

  it('throws AmadeusAuthError on a non-ok token response, without leaking the credential values', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse({ error: 'invalid_client' }, 401),
    });

    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusAuthError);
    try {
      await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    } catch (err) {
      expect(String((err as Error).message)).not.toContain(FAKE_ENV.AMADEUS_API_SECRET);
      expect(String((err as Error).message)).not.toContain(FAKE_ENV.AMADEUS_API_KEY);
    }
  });

  it('throws AmadeusAuthError when the token response is missing access_token', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse({ expires_in: 1799 }),
    });
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusAuthError);
  });

  it('throws AmadeusAuthError when the token endpoint is unreachable', async () => {
    const fn = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusAuthError);
  });
});

describe('Phase 13.3 — searchAmadeusFlightOffers: provider failures', () => {
  it('throws AmadeusProviderError on a non-ok flight-offers response, carrying the upstream status', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ errors: [{ status: 400, title: 'INVALID DATA' }] }, 400),
    });
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusProviderError);
    try {
      await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AmadeusProviderError);
      expect((err as InstanceType<typeof AmadeusProviderError>).upstreamStatus).toBe(400);
    }
  });

  it('throws AmadeusProviderError when the flight-offers endpoint is unreachable', async () => {
    const flakyFn = vi.fn(async (url: string) => {
      if (url.includes('/v1/security/oauth2/token')) return jsonResponse(tokenResponse());
      throw new Error('connection reset');
    }) as unknown as typeof fetch;
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, flakyFn)).rejects.toThrow(AmadeusProviderError);
  });

  it('throws AmadeusTimeoutError when a request aborts (simulated timeout)', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fn = vi.fn(async () => {
      throw abortError;
    }) as unknown as typeof fetch;
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusTimeoutError);
  });

  it('throws AmadeusMalformedResponseError on non-JSON flight-offers body', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => new Response('not json', { status: 200 }),
    });
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusMalformedResponseError);
  });

  it('throws AmadeusMalformedResponseError when "data" is missing', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ meta: { count: 0 } }),
    });
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusMalformedResponseError);
  });

  it('throws AmadeusMalformedResponseError for an offer missing required fields', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ data: [{ id: '1' }], dictionaries: {} }),
    });
    await expect(searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn)).rejects.toThrow(AmadeusMalformedResponseError);
  });
});

describe('Phase 13.3 — searchAmadeusFlightOffers: success + normalization', () => {
  it('returns an empty offers array (not an error) when Amadeus finds no flights', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse({ meta: { count: 0 }, data: [], dictionaries: {} }),
    });
    const result = await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    expect(result.offers).toEqual([]);
  });

  it('normalizes a single-segment offer with correct price, segment, and airport shape', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });
    const result = await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    expect(result.offers).toHaveLength(1);
    const offer = result.offers[0]!;
    expect(offer.id).toBe('1');
    expect(offer.price).toEqual({ amount: 845.3, currency: 'USD' });
    expect(offer.stops).toBe(0);
    expect(offer.durationMinutes).toBe(9 * 60 + 35);
    expect(offer.segments).toHaveLength(1);
    expect(offer.segments[0]).toMatchObject({
      origin: { iata: 'RUH', countryCode: 'SA' },
      destination: { iata: 'JFK', countryCode: 'US' },
      departureTime: '2026-12-01T08:30:00',
      arrivalTime: '2026-12-01T14:05:00',
      airlineCode: 'SV',
      carrierName: 'SAUDIA',
    });
  });

  it('normalizes a round trip with a connecting outbound leg: segment order + stop count', async () => {
    const { fn } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(ROUND_TRIP_WITH_CONNECTION_RESPONSE),
    });
    const result = await searchAmadeusFlightOffers(FAKE_ENV, REQUEST, fn);
    const offer = result.offers[0]!;
    // 3 total segments (2 outbound + 1 return), 2 itineraries -> 1 stop.
    expect(offer.stops).toBe(1);
    expect(offer.segments).toHaveLength(3);
    expect(offer.segments.map((s) => `${s.origin.iata}-${s.destination.iata}`)).toEqual(['RUH-DXB', 'DXB-JFK', 'JFK-RUH']);
    expect(offer.durationMinutes).toBe(12 * 60 + 13 * 60);
    expect(offer.price).toEqual({ amount: 1420, currency: 'USD' });
  });

  it('sends passengers as "adults" and includes "max", and only includes returnDate when provided', async () => {
    const { fn, calls } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });
    await searchAmadeusFlightOffers(FAKE_ENV, { ...REQUEST, passengers: 3 }, fn);
    const offersUrl = calls.find((c) => c.url.includes('/v2/shopping/flight-offers'))!.url;
    expect(offersUrl).toContain('adults=3');
    expect(offersUrl).toContain('max=10');
    expect(offersUrl).toContain('originLocationCode=RUH');
    expect(offersUrl).toContain('destinationLocationCode=JFK');
    expect(offersUrl).not.toContain('returnDate');

    __resetAmadeusTokenCacheForTests();
    const { fn: fn2, calls: calls2 } = makeFetchMock({
      '/v1/security/oauth2/token': () => jsonResponse(tokenResponse()),
      '/v2/shopping/flight-offers': () => jsonResponse(SINGLE_OFFER_RESPONSE),
    });
    await searchAmadeusFlightOffers(FAKE_ENV, { ...REQUEST, returnDate: '2026-12-10' }, fn2);
    const offersUrl2 = calls2.find((c) => c.url.includes('/v2/shopping/flight-offers'))!.url;
    expect(offersUrl2).toContain('returnDate=2026-12-10');
  });
});
