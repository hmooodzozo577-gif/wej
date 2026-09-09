// Phase 13.2 (Part B) — Cloudflare Worker foundation for the future travel
// API backend. This step intentionally does NOT call Amadeus (or any
// other provider): POST /api/travel/flights validates the request shape
// and returns an explicit "not implemented yet" response. No API key is
// required, read, or referenced by value anywhere in this Worker in this
// step — see ../SECRETS.md for how a real Amadeus credential will be
// configured in Phase 13.3, entirely as a Cloudflare Worker secret, never
// committed to this repository.
//
// Structurally separate from app/ (the Vite/GitHub Pages frontend): this
// directory has its own package.json/tsconfig, is never imported by the
// frontend, and is not touched by .github/workflows/deploy-pages.yml
// (which only watches app/**). Nothing in this directory is deployed by
// this task — see ../README.md.
export interface Env {
  // Placeholder type for the future Amadeus credential (Phase 13.3). This
  // Worker never reads it in this step, and no value — real or
  // placeholder — is set anywhere in this repository.
  // AMADEUS_API_KEY?: string;
}

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
  passengers: number;
}

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the POST /api/travel/flights request body shape. Returns a
 *  list of field-level problems (empty array = valid). Deliberately
 *  checks only SHAPE (types, formats, basic sanity like origin !==
 *  destination) — it has no way to know whether an airport code or date
 *  is real/available, since that requires an actual provider call this
 *  step does not make. */
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
  if (b.returnDate !== undefined && (typeof b.returnDate !== 'string' || !DATE_RE.test(b.returnDate))) {
    errors.push('returnDate must be an ISO date string (YYYY-MM-DD) if provided.');
  }
  if (typeof b.passengers !== 'number' || !Number.isInteger(b.passengers) || b.passengers < 1 || b.passengers > 9) {
    errors.push('passengers must be an integer between 1 and 9.');
  }

  return errors;
}

export async function handleRequest(request: Request, _env: Env): Promise<Response> {
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

  // Phase 13.2 scope gate: no provider is called yet, and this Worker
  // never fabricates flight data. This is a real, stable contract callers
  // can already build against — a safe "not implemented" response, never
  // a fake successful offer — while actual Amadeus integration is
  // deferred to Phase 13.3 under separate explicit authorization.
  return json(
    {
      error: 'not_implemented',
      message: 'Flight search is not available yet. Provider integration is planned for a later phase.',
    },
    501,
    origin,
  );
}

export default {
  fetch: handleRequest,
};
