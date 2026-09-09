// Phase 13.2 (Part D) — Worker tests. Exercises handleRequest() directly
// with real Web-standard Request objects (no wrangler/Miniflare needed —
// Node's native fetch/Request/Response implement the same spec). Verifies
// request validation, CORS restriction, and — critically — that this
// Worker never calls a real provider and never returns fabricated flight
// data, only ever a safe, explicit "not implemented" contract.
import { describe, expect, it } from 'vitest';
import { handleRequest, validateFlightSearchRequest, type Env } from './index';

const ALLOWED_ORIGIN = 'https://hmooodzozo577-gif.github.io';
const env: Env = {};

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

describe('Phase 13.2 — Worker: validateFlightSearchRequest', () => {
  it('accepts a well-formed one-way request', () => {
    expect(validateFlightSearchRequest(validBody)).toEqual([]);
  });

  it('accepts a well-formed round-trip request', () => {
    expect(validateFlightSearchRequest({ ...validBody, returnDate: '2026-12-10' })).toEqual([]);
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

  it('rejects a malformed date', () => {
    expect(validateFlightSearchRequest({ ...validBody, departureDate: '12/01/2026' }).length).toBeGreaterThan(0);
    expect(validateFlightSearchRequest({ ...validBody, returnDate: 'not-a-date' }).length).toBeGreaterThan(0);
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

describe('Phase 13.2 — Worker: handleRequest', () => {
  it('returns 501 "not_implemented" for a valid request — never a fake flight offer', async () => {
    const res = await handleRequest(post(validBody), env);
    expect(res.status).toBe(501);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('not_implemented');
    // Defensive: this contract must never accidentally carry offer-shaped
    // fields (e.g. price, offers[]) that a caller could mistake for real
    // flight data.
    expect(data.offers).toBeUndefined();
    expect(data.price).toBeUndefined();
  });

  it('returns 400 with field errors for an invalid request, without calling anything further', async () => {
    const res = await handleRequest(post({ ...validBody, origin: 'nope' }), env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; fields: string[] };
    expect(data.error).toBe('invalid_request');
    expect(data.fields.length).toBeGreaterThan(0);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const req = new Request('https://worker.example/api/travel/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: '{not json',
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
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
    const res = await handleRequest(post(validBody, ALLOWED_ORIGIN), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
  });

  it('CRITICAL: never reflects an arbitrary Origin — CORS is not "*"', async () => {
    const res = await handleRequest(post(validBody, 'https://evil.example'), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('handles an OPTIONS preflight for the allowed origin', async () => {
    const req = new Request('https://worker.example/api/travel/flights', {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN },
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
  });

  it('never requires or reads any secret/API key to answer a request', async () => {
    // env is a plain empty object throughout this whole test file — every
    // request above already ran with no AMADEUS_API_KEY (or anything
    // else) set, and all of them returned a normal, well-formed response.
    const res = await handleRequest(post(validBody), {} as Env);
    expect(res.status).toBe(501);
  });
});
