// Phase 13.2 foundation, Phase 13.3 (this change) — the ONLY module a
// component may call for flight search. Components must never import an
// Amadeus/Duffel SDK type, never parse a provider-specific response
// shape, never hold a provider URL or API key — all of that stays out of
// the frontend entirely (see ../../../SECRETS.md) and lives in the
// Worker (../../../worker), which is the only thing that ever talks to
// Amadeus.
//
// Phase 13.3: searchFlights() now calls the deployed Worker's
// POST /api/travel/flights over HTTPS and translates its response into a
// TravelSearchResult. It still NEVER calls Amadeus (or any provider)
// directly, NEVER holds a provider credential, and NEVER fabricates a
// successful result — a network failure, a malformed Worker response, or
// the Worker endpoint simply not being configured all map to a safe
// 'error'/'unavailable' result, never to invented flight data.
//
// Phase 13.4a: re-exports flightEstimate.ts's distance/duration estimate
// so this stays the one module components import from for anything
// travel-related — the estimate logic itself lives in flightEstimate.ts
// (kept separate since it's pure/synchronous and has nothing to do with
// the Worker), but nothing about searchFlights() itself changes.
import type { Airport, FlightOffer, TravelSearchRequest, TravelSearchResult, TravelSegment } from './types';

export { estimateFlight, estimateDistanceKm, estimateDurationMinutes } from './flightEstimate';

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a TravelSearchRequest's shape client-side, before ever
 *  considering a network call. Intentionally mirrors (but does not
 *  import — app/ and worker/ are separate projects with no shared
 *  package) the Worker's own validateFlightSearchRequest: both sides
 *  validate independently, since the frontend can never trust that the
 *  Worker was actually reached, and the Worker can never trust the
 *  frontend. Exported so components/tests can pre-check a request
 *  without calling searchFlights(). */
export function validateTravelSearchRequest(request: TravelSearchRequest): string[] {
  const errors: string[] = [];

  if (!IATA_RE.test(request.originIata)) {
    errors.push('originIata must be a 3-letter uppercase IATA airport code.');
  }
  if (!IATA_RE.test(request.destinationIata)) {
    errors.push('destinationIata must be a 3-letter uppercase IATA airport code.');
  }
  if (request.originIata === request.destinationIata) {
    errors.push('originIata and destinationIata must be different airports.');
  }
  if (!DATE_RE.test(request.departureDate)) {
    errors.push('departureDate must be an ISO date string (YYYY-MM-DD).');
  }
  if (request.returnDate !== undefined) {
    if (!DATE_RE.test(request.returnDate)) {
      errors.push('returnDate must be an ISO date string (YYYY-MM-DD) if provided.');
    } else if (DATE_RE.test(request.departureDate) && request.returnDate < request.departureDate) {
      errors.push('returnDate must not be before departureDate.');
    }
  }
  if (!Number.isInteger(request.passengers) || request.passengers < 1 || request.passengers > 9) {
    errors.push('passengers must be an integer between 1 and 9.');
  }

  return errors;
}

// ---- Worker endpoint configuration (centralized here, per Task I) -------
// The Worker's URL is NOT a secret (it's a public HTTPS endpoint the
// browser calls directly, same as any other API base URL) — unlike an
// Amadeus credential, it is fine for this to be a build-time `VITE_*`
// value. Reading it through `import.meta.env` (rather than hard-coding a
// URL into a component) is what "centralize the Worker endpoint
// configuration in the travel-service layer" means here: exactly one
// place in the whole frontend knows this URL, or that it isn't set yet.
//
// Deliberately undefined by default: this repository does not set
// VITE_TRAVEL_WORKER_URL (the Worker described in ../../../worker has not
// been deployed — see the Phase 13.3 final report), so
// searchFlights() below deterministically returns an 'unavailable'
// result without attempting any network call until a real deployed URL
// is configured, exactly like Phase 13.2's stub behavior. Once the Worker
// is deployed, setting VITE_TRAVEL_WORKER_URL (e.g. in a GitHub Actions
// build-time env var, or a local .env.local — never committed) is the
// only change needed to make real searches work; no code changes.
const TRAVEL_WORKER_BASE_URL: string | undefined = import.meta.env.VITE_TRAVEL_WORKER_URL;

const FLIGHTS_ENDPOINT_PATH = '/api/travel/flights';
const REQUEST_TIMEOUT_MS = 15_000;

interface WorkerRequestBody {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
}

function toWorkerRequestBody(request: TravelSearchRequest): WorkerRequestBody {
  return {
    origin: request.originIata,
    destination: request.destinationIata,
    departureDate: request.departureDate,
    returnDate: request.returnDate,
    passengers: request.passengers,
  };
}

function isAirportShaped(value: unknown): value is Airport {
  const a = value as Partial<Airport> | null;
  return !!a && typeof a.iata === 'string' && typeof a.name === 'string' && typeof a.countryCode === 'string';
}

function isSegmentShaped(value: unknown): value is TravelSegment {
  const s = value as Partial<TravelSegment> | null;
  return (
    !!s &&
    isAirportShaped(s.origin) &&
    isAirportShaped(s.destination) &&
    typeof s.departureTime === 'string' &&
    typeof s.arrivalTime === 'string' &&
    typeof s.airlineCode === 'string'
  );
}

function isOfferShaped(value: unknown): value is FlightOffer {
  const o = value as Partial<FlightOffer> | null;
  return (
    !!o &&
    typeof o.id === 'string' &&
    Array.isArray(o.segments) &&
    o.segments.every(isSegmentShaped) &&
    !!o.price &&
    typeof o.price.amount === 'number' &&
    typeof o.price.currency === 'string' &&
    typeof o.durationMinutes === 'number' &&
    typeof o.stops === 'number'
  );
}

/** Defensive shape check on the Worker's success response — never trusts
 *  `res.json()` blindly. A response that parses as JSON but doesn't match
 *  the expected `{ offers: FlightOffer[] }` shape (a bug in the Worker, a
 *  proxy/CDN returning something unexpected, etc.) is treated the same as
 *  any other unavailable-provider case: a safe 'error' result, never
 *  passed through to React half-validated. */
function isValidOffersResponse(body: unknown): body is { offers: FlightOffer[] } {
  const b = body as { offers?: unknown } | null;
  return !!b && Array.isArray(b.offers) && b.offers.every(isOfferShaped);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Searches for flight offers matching `request`. Never calls Amadeus (or
 *  any provider) directly — it only ever talks to this project's own
 *  Worker, and only after validating the request shape itself. Every
 *  failure mode (invalid request, Worker not configured, network
 *  failure, timeout, non-2xx Worker response, malformed Worker response)
 *  maps to a safe, typed result — there is no code path in this function
 *  that can produce `{ status: 'ok', offers: [...] }` without a real,
 *  shape-validated response from the Worker. */
export async function searchFlights(request: TravelSearchRequest): Promise<TravelSearchResult> {
  const fields = validateTravelSearchRequest(request);
  if (fields.length > 0) {
    return { status: 'invalid_request', fields };
  }

  if (!TRAVEL_WORKER_BASE_URL) {
    return {
      status: 'unavailable',
      reason: 'Flight search is not available yet. The travel backend has not been deployed/configured.',
    };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${TRAVEL_WORKER_BASE_URL}${FLIGHTS_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toWorkerRequestBody(request)),
    });
  } catch {
    // Network failure or timeout (AbortController fires the same
    // AbortError path fetch throws for a real network error) — never
    // expose the underlying error message, which could contain a raw
    // URL/host detail.
    return { status: 'error', message: 'Could not reach the flight search service. Please try again later.' };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { status: 'error', message: 'Received an unreadable response from the flight search service.' };
  }

  if (res.status === 400) {
    const b = body as { fields?: unknown };
    const workerFields = Array.isArray(b.fields) ? b.fields.filter((f): f is string => typeof f === 'string') : [];
    return { status: 'invalid_request', fields: workerFields.length > 0 ? workerFields : ['Request was rejected by the flight search service.'] };
  }

  if (!res.ok) {
    // Covers the Worker's own safe error contracts (502 provider_error,
    // 504 provider_timeout, 500 internal_error, etc.) uniformly — the
    // Worker has already reduced whatever Amadeus/network failure
    // occurred to a generic message; this just carries it through
    // without exposing any more detail than that.
    const b = body as { message?: unknown };
    return {
      status: 'error',
      message: typeof b.message === 'string' ? b.message : 'The flight search service returned an error.',
    };
  }

  if (!isValidOffersResponse(body)) {
    return { status: 'error', message: 'Received an unexpected response from the flight search service.' };
  }

  return { status: 'ok', offers: body.offers };
}
