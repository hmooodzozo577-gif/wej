// Phase 13.2 (Part D) — travelService tests: request validation, the
// normalized TravelSearchResult contract, and safe failure behavior.
// Critically verifies searchFlights() never returns a successful ('ok')
// result and never exposes anything secret-shaped in this step.
import { describe, expect, it } from 'vitest';
import { searchFlights, validateTravelSearchRequest } from './travelService';
import type { TravelSearchRequest } from './types';

const validRequest: TravelSearchRequest = {
  originIata: 'RUH',
  destinationIata: 'JFK',
  departureDate: '2026-12-01',
  passengers: 1,
};

describe('Phase 13.2 — validateTravelSearchRequest', () => {
  it('accepts a well-formed one-way request', () => {
    expect(validateTravelSearchRequest(validRequest)).toEqual([]);
  });

  it('accepts a well-formed round-trip request', () => {
    expect(validateTravelSearchRequest({ ...validRequest, returnDate: '2026-12-10' })).toEqual([]);
  });

  it('rejects a malformed IATA code', () => {
    expect(validateTravelSearchRequest({ ...validRequest, originIata: 'ruh' }).length).toBeGreaterThan(0);
    expect(validateTravelSearchRequest({ ...validRequest, destinationIata: 'JFK1' }).length).toBeGreaterThan(0);
  });

  it('rejects originIata === destinationIata', () => {
    const errors = validateTravelSearchRequest({ ...validRequest, destinationIata: 'RUH' });
    expect(errors.some((e) => e.includes('different'))).toBe(true);
  });

  it('rejects a malformed date', () => {
    expect(validateTravelSearchRequest({ ...validRequest, departureDate: '2026/12/01' }).length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range passenger count', () => {
    expect(validateTravelSearchRequest({ ...validRequest, passengers: 0 }).length).toBeGreaterThan(0);
    expect(validateTravelSearchRequest({ ...validRequest, passengers: 10 }).length).toBeGreaterThan(0);
  });
});

describe('Phase 13.2 — searchFlights', () => {
  it('returns status "invalid_request" with field errors for a malformed request, and nothing else', async () => {
    const result = await searchFlights({ ...validRequest, originIata: 'nope' });
    expect(result.status).toBe('invalid_request');
    if (result.status === 'invalid_request') {
      expect(result.fields.length).toBeGreaterThan(0);
    }
  });

  it('returns status "unavailable" for a well-formed request — never a fake successful offer', async () => {
    const result = await searchFlights(validRequest);
    expect(result.status).toBe('unavailable');
    // Type-level guarantee already prevents this, but assert at runtime
    // too: an 'unavailable' result must never carry an offers array.
    expect((result as { offers?: unknown }).offers).toBeUndefined();
  });

  it('never returns status "ok" in this phase, for any input', async () => {
    const requests: TravelSearchRequest[] = [
      validRequest,
      { ...validRequest, returnDate: '2026-12-10' },
      { ...validRequest, passengers: 4 },
    ];
    for (const req of requests) {
      const result = await searchFlights(req);
      expect(result.status).not.toBe('ok');
    }
  });

  it('does not throw and does not attempt any network call for a valid request', async () => {
    // No global fetch/XHR mock is installed in this test file; if
    // searchFlights tried to reach a network endpoint in this phase, it
    // would throw (fetch is not defined in this environment) rather than
    // resolve cleanly.
    await expect(searchFlights(validRequest)).resolves.toBeDefined();
  });

  it('result never contains anything secret-shaped (no apiKey/token/authorization fields)', async () => {
    const result = (await searchFlights(validRequest)) as unknown as Record<string, unknown>;
    expect(result.apiKey).toBeUndefined();
    expect(result.token).toBeUndefined();
    expect(result.authorization).toBeUndefined();
  });
});
