// Phase 13.2 foundation, Phase 13.3 (this change) — real Amadeus for
// Developers Flight Offers Search integration, entirely server-side. This
// is still the ONLY file that turns an HTTP request into a response;
// all actual provider communication lives in ./amadeus.ts (kept separate
// so it can be unit-tested with a mocked fetch, and so this file's job
// stays limited to HTTP concerns: CORS, method/path routing, request
// validation, and mapping amadeus.ts's typed results/errors to a safe
// client-facing JSON contract).
//
// No API key is ever read outside ./amadeus.ts, logged, or included in
// any response this file returns — see ../SECRETS.md for how
// AMADEUS_API_KEY/AMADEUS_API_SECRET are configured as Worker secrets.
//
// Structurally separate from app/ (the Vite/GitHub Pages frontend): this
// directory has its own package.json/tsconfig, is never imported by the
// frontend, and is not touched by .github/workflows/deploy-pages.yml
// (which only watches app/**).
import {
  AmadeusAuthError,
  AmadeusMalformedResponseError,
  AmadeusProviderError,
  AmadeusTimeoutError,
  searchAmadeusFlightOffers,
  type Env as AmadeusEnv,
} from './amadeus';

export type Env = AmadeusEnv;

// Restricted to the exact GitHub Pages origin this app is deployed to —
// deliberately never '*'. A request from any other Origin gets no
// Access-Control-Allow-Origin header in the response, so the browser
// blocks that response from being read cross-origin (the standard,
// correct way to scope CORS to a single origin).
const ALLOWED_ORIGIN = 'https://hmooodzozo577-gif.github.io';

function corsHeaders(origin: string | null): HeadersInit {
  if (origin !== ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

export interface FlightSearchRequestBody {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  /** Optional in the wire contract (defaults to 1 — see
   *  validateFlightSearchRequest) even though the frontend's own
   *  TravelSearchRequest type always supplies it; this keeps the Worker's
   *  own contract tolerant of a caller that omits it. */
  passengers?: number;
}

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PASSENGERS = 1;

/** Validates the POST /api/travel/flights request body shape. Returns a
 *  list of field-level problems (empty array = valid). Deliberately
 *  checks only SHAPE (types, formats, basic sanity like origin !==
 *  destination, returnDate >= departureDate) — it has no way to know
 *  whether an airport code or date is real/available/has actual flights,
 *  since that requires the actual Amadeus call this function runs
 *  before. Nothing here ever contacts Amadeus. */
export function validateFlightSearchRequest(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const b = body as Record<string, unknown>;

  if (typeof b.origin !== 'string' || !IATA_RE.test(b.origin)) {
    errors.push('origin must be a 3-letter uppercase IATA airport code.');
  }
  if (typeof b.destination !== 'string' || !IATA_RE.test(b.destination)) {
    errors.push('destination must be a 3-letter uppercase IATA airport code.');
  }
  if (typeof b.origin === 'string' && typeof b.destination === 'string' && b.origin === b.destination) {
    errors.push('origin and destination must be different airports.');
  }
  if (typeof b.departureDate !== 'string' || !DATE_RE.test(b.departureDate)) {
    errors.push('departureDate must be an ISO date string (YYYY-MM-DD).');
  }
  if (b.returnDate !== undefined) {
    if (typeof b.returnDate !== 'string' || !DATE_RE.test(b.returnDate)) {
      errors.push('returnDate must be an ISO date string (YYYY-MM-DD) if provided.');
    } else if (
      typeof b.departureDate === 'string' &&
      DATE_RE.test(b.departureDate) &&
      b.returnDate < b.departureDate
    ) {
      // Safe to compare as plain strings: both are validated YYYY-MM-DD
      // (zero-padded ISO dates sort lexicographically the same as
      // chronologically), so no Date parsing/timezone ambiguity.
      errors.push('returnDate must not be before departureDate.');
    }
  }
  if (b.passengers !== undefined) {
    if (typeof b.passengers !== 'number' || !Number.isInteger(b.passengers) || b.passengers < 1 || b.passengers > 9) {
      errors.push('passengers must be an integer between 1 and 9 if provided.');
    }
  }

  return errors;
}

function normalizeRequest(body: FlightSearchRequestBody) {
  return {
    origin: body.origin,
    destination: body.destination,
    departureDate: body.departureDate,
    returnDate: body.returnDate,
    passengers: body.passengers ?? DEFAULT_PASSENGERS,
  };
}

// Deliberately a 2-argument (request, env) signature, matching the real
// Cloudflare Workers `fetch(request, env, ctx)` handler contract closely
// enough that `export default { fetch: handleRequest }` below works
// unmodified as the real entry point (JS allows a function to ignore the
// `ctx` argument the runtime passes). Tests that need to mock the
// Amadeus HTTP calls this function eventually makes do so via
// `vi.stubGlobal('fetch', ...)` — see index.test.ts — rather than a
// parameter here, specifically so this signature never has to diverge
// from what Cloudflare actually calls in production.
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname !== '/api/travel/flights') {
    return json({ error: 'not_found', message: 'Unknown endpoint.' }, 404, origin);
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Request body must be valid JSON.' }, 400, origin);
  }

  const fieldErrors = validateFlightSearchRequest(body);
  if (fieldErrors.length > 0) {
    return json({ error: 'invalid_request', message: 'Request failed validation.', fields: fieldErrors }, 400, origin);
  }

  const normalized = normalizeRequest(body as FlightSearchRequestBody);

  try {
    const result = await searchAmadeusFlightOffers(env, normalized);
    // Success — real, normalized offers (possibly an empty array when
    // Amadeus genuinely has no matching flights; that is a valid search
    // outcome, never treated as an error, and never padded with
    // fabricated offers to look non-empty).
    return json({ offers: result.offers }, 200, origin);
  } catch (err) {
    return json(...mapAmadeusErrorToResponseArgs(err), origin);
  }
}

/** Maps a thrown error from ./amadeus.ts to a safe (status, body) pair.
 *  Every branch here returns a short, generic, non-provider-internal
 *  message: never the upstream response body, never a stack trace, and
 *  — since these errors are constructed in amadeus.ts without ever
 *  interpolating a credential or token value — never a secret. An
 *  unrecognized error type still falls through to a generic 500 rather
 *  than rethrowing (which would let the Workers runtime's own default
 *  error page, and whatever detail it includes, reach the browser). */
function mapAmadeusErrorToResponseArgs(err: unknown): [body: unknown, status: number] {
  if (err instanceof AmadeusTimeoutError) {
    return [{ error: 'provider_timeout', message: 'The flight search provider took too long to respond.' }, 504];
  }
  if (err instanceof AmadeusAuthError) {
    // A misconfigured/rejected credential is an operational problem on
    // this Worker's side, never the browser's fault — surfaced as an
    // upstream/gateway failure, not a 401 (which would incorrectly imply
    // the BROWSER needs to authenticate).
    return [{ error: 'provider_error', message: 'The flight search provider is temporarily unavailable.' }, 502];
  }
  if (err instanceof AmadeusProviderError) {
    return [{ error: 'provider_error', message: 'The flight search provider returned an error.' }, 502];
  }
  if (err instanceof AmadeusMalformedResponseError) {
    return [{ error: 'provider_error', message: 'The flight search provider returned an unexpected response.' }, 502];
  }
  return [{ error: 'internal_error', message: 'An unexpected error occurred.' }, 500];
}

export default {
  fetch: handleRequest,
};
