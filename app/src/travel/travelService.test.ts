// Phase 13.2 foundation + Phase 13.3 (this change) — travelService tests.
// Two groups: (1) the module's real default behavior in THIS repository
// today (no VITE_TRAVEL_WORKER_URL is set anywhere, matching the actual
// shipped build — see travelService.ts's own doc comment), verifying
// request validation and the deterministic 'unavailable' result with NO
// network call attempted; (2) the Worker-integration behavior once a
// Worker URL IS configured, exercised by stubbing
// import.meta.env.VITE_TRAVEL_WORKER_URL and re-importing the module
// fresh, with global fetch mocked — never a real network call, never a
// real credential anywhere in this file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelSearchRequest } from './types';

const validRequest: TravelSearchRequest = {
  originIata: 'RUH',
  destinationIata: 'JFK',
  departureDate: '2026-12-01',
  passengers: 1,
};

describe('Phase 13.3 — travelService (unconfigured Worker: this repo\'s real current state)', () => {
  it('accepts a well-formed one-way request', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    expect(validateTravelSearchRequest(validRequest)).toEqual([]);
  });

  it('accepts a well-formed round-trip request', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    expect(validateTravelSearchRequest({ ...validRequest, returnDate: '2026-12-10' })).toEqual([]);
  });

  it('rejects a malformed IATA code', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    expect(validateTravelSearchRequest({ ...validRequest, originIata: 'ruh' }).length).toBeGreaterThan(0);
    expect(validateTravelSearchRequest({ ...validRequest, destinationIata: 'JFK1' }).length).toBeGreaterThan(0);
  });

  it('rejects originIata === destinationIata', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    const errors = validateTravelSearchRequest({ ...validRequest, destinationIata: 'RUH' });
    expect(errors.some((e) => e.includes('different'))).toBe(true);
  });

  it('rejects a malformed date', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    expect(validateTravelSearchRequest({ ...validRequest, departureDate: '2026/12/01' }).length).toBeGreaterThan(0);
  });

  it('rejects a return date before the departure date', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    const errors = validateTravelSearchRequest({ ...validRequest, departureDate: '2026-12-10', returnDate: '2026-12-01' });
    expect(errors.some((e) => e.includes('not be before'))).toBe(true);
  });

  it('rejects an out-of-range passenger count', async () => {
    const { validateTravelSearchRequest } = await import('./travelService');
    expect(validateTravelSearchRequest({ ...validRequest, passengers: 0 }).length).toBeGreaterThan(0);
    expect(validateTravelSearchRequest({ ...validRequest, passengers: 10 }).length).toBeGreaterThan(0);
  });

  it('searchFlights returns "invalid_request" with field errors for a malformed request, and never attempts a network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { searchFlights } = await import('./travelService');
    const result = await searchFlights({ ...validRequest, originIata: 'nope' });
    expect(result.status).toBe('invalid_request');
    if (result.status === 'invalid_request') expect(result.fields.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('searchFlights returns "unavailable" for a well-formed request (no Worker URL configured) and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { searchFlights } = await import('./travelService');
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('unavailable');
    expect((result as { offers?: unknown }).offers).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('never returns status "ok" in the unconfigured state, for any well-formed input', async () => {
    const { searchFlights } = await import('./travelService');
    const requests: TravelSearchRequest[] = [validRequest, { ...validRequest, returnDate: '2026-12-10' }, { ...validRequest, passengers: 4 }];
    for (const req of requests) {
      const result = await searchFlights(req);
      expect(result.status).not.toBe('ok');
    }
  });

  it('result never contains anything secret-shaped', async () => {
    const { searchFlights } = await import('./travelService');
    const result = (await searchFlights(validRequest)) as unknown as Record<string, unknown>;
    expect(result.apiKey).toBeUndefined();
    expect(result.token).toBeUndefined();
    expect(result.authorization).toBeUndefined();
  });
});

describe('Phase 13.3 — travelService (Worker configured, fetch mocked)', () => {
  const WORKER_URL = 'https://worker.example';

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', WORKER_URL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function freshSearchFlights() {
    const mod = await import('./travelService');
    return mod.searchFlights;
  }

  const OFFER = {
    id: '1',
    segments: [
      {
        origin: { iata: 'RUH', name: 'RUH', countryCode: 'SA' },
        destination: { iata: 'JFK', name: 'JFK', countryCode: 'US' },
        departureTime: '2026-12-01T08:30:00',
        arrivalTime: '2026-12-01T14:05:00',
        airlineCode: 'SV',
        carrierName: 'SAUDIA',
        durationMinutes: 575,
      },
    ],
    price: { amount: 845.3, currency: 'USD' },
    durationMinutes: 575,
    stops: 0,
    layovers: [],
  };

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  it('calls exactly POST {WORKER_URL}/api/travel/flights with the translated request body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ offers: [OFFER] }));
    vi.stubGlobal('fetch', fetchMock);
    const searchFlights = await freshSearchFlights();

    await searchFlights({ ...validRequest, returnDate: '2026-12-10' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${WORKER_URL}/api/travel/flights`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      origin: 'RUH',
      destination: 'JFK',
      departureDate: '2026-12-01',
      returnDate: '2026-12-10',
      passengers: 1,
    });
  });

  it('returns a normalized "ok" result for a successful Worker response, enriched from the local airport catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ offers: [OFFER] })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.offers).toHaveLength(1);
      const offer = result.offers[0]!;
      // Everything the Worker sent is preserved...
      expect(offer.id).toBe(OFFER.id);
      expect(offer.price).toEqual(OFFER.price);
      expect(offer.durationMinutes).toBe(OFFER.durationMinutes);
      expect(offer.stops).toBe(OFFER.stops);
      expect(offer.segments[0]!.departureTime).toBe(OFFER.segments[0]!.departureTime);
      expect(offer.segments[0]!.airlineCode).toBe(OFFER.segments[0]!.airlineCode);
      // ...but RUH/JFK are real airports in the local catalog, so their
      // name/lat/lng are enriched beyond the Worker's iata-as-name
      // fallback (Phase 13.4b) — countryCode (Amadeus-sourced) is
      // untouched.
      expect(offer.segments[0]!.origin).toEqual({ iata: 'RUH', name: 'King Khaled International Airport', countryCode: 'SA', lat: 24.9576, lng: 46.6988 });
      expect(offer.segments[0]!.destination).toEqual({ iata: 'JFK', name: 'John F Kennedy International Airport', countryCode: 'US', lat: 40.6394, lng: -73.7793 });
    }
  });

  it('leaves an Airport unchanged when its IATA code has no local catalog match', async () => {
    const offerWithUnknownAirport = {
      ...OFFER,
      segments: [{ ...OFFER.segments[0], origin: { iata: 'ZZZ', name: 'ZZZ', countryCode: '' } }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ offers: [offerWithUnknownAirport] })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.offers[0]!.segments[0]!.origin).toEqual({ iata: 'ZZZ', name: 'ZZZ', countryCode: '' });
    }
  });

  it('returns "ok" with an empty offers array when the Worker legitimately finds nothing (not an error)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ offers: [] })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result).toEqual({ status: 'ok', offers: [] });
  });

  it('maps a Worker 400 to "invalid_request" with its field errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'invalid_request', fields: ['origin must be...'] }, 400)));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('invalid_request');
    if (result.status === 'invalid_request') expect(result.fields).toEqual(['origin must be...']);
  });

  it('maps a Worker 502 (provider_error) to a safe "error" result, never "ok"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'provider_error', message: 'The flight search provider returned an error.' }, 502)));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
    expect((result as { offers?: unknown }).offers).toBeUndefined();
  });

  it('maps a Worker 504 (provider_timeout) to a safe "error" result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'provider_timeout', message: 'timed out' }, 504)));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
  });

  it('maps a network failure (fetch throws) to a safe "error" result without exposing the raw error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).not.toContain('Failed to fetch');
  });

  it('maps a malformed (non-JSON) Worker response to a safe "error" result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
  });

  it('maps a 200 response with an unexpected shape (missing offers array) to a safe "error" result, never "ok"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ unexpected: true })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
  });

  it('maps a 200 response with a malformed offer (missing price) to a safe "error" result, never "ok"', async () => {
    const { price, ...offerWithoutPrice } = OFFER;
    void price;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ offers: [offerWithoutPrice] })));
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('error');
  });

  it('never returns "ok" for any failure scenario — no fake success', async () => {
    const failureScenarios = [
      () => jsonResponse({ error: 'provider_error' }, 502),
      () => jsonResponse({ error: 'provider_timeout' }, 504),
      () => new Response('not json', { status: 200 }),
      () => jsonResponse({ nonsense: 1 }),
    ];
    for (const scenario of failureScenarios) {
      vi.resetModules();
      vi.stubEnv('VITE_TRAVEL_WORKER_URL', WORKER_URL);
      vi.stubGlobal('fetch', vi.fn(async () => scenario()));
      const searchFlights = await freshSearchFlights();
      const result = await searchFlights(validRequest);
      expect(result.status).not.toBe('ok');
    }
  });

  it('still validates locally before ever calling fetch, even when a Worker URL is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const searchFlights = await freshSearchFlights();
    const result = await searchFlights({ ...validRequest, originIata: 'bad' });
    expect(result.status).toBe('invalid_request');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
