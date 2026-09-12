import {
  AmadeusAuthError,
  AmadeusMalformedResponseError,
  AmadeusProviderError,
  AmadeusTimeoutError,
  searchAmadeusFlightOffers,
  type Env as AmadeusEnv,
} from './amadeus';

export type Env = AmadeusEnv;

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
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export interface FlightSearchRequestBody {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
}

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFlightSearchRequest(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const value = body as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof value.origin !== 'string' || !IATA_RE.test(value.origin)) {
    errors.push('origin must be a 3-letter uppercase IATA airport code.');
  }
  if (typeof value.destination !== 'string' || !IATA_RE.test(value.destination)) {
    errors.push('destination must be a 3-letter uppercase IATA airport code.');
  }
  if (typeof value.origin === 'string' && value.origin === value.destination) {
    errors.push('origin and destination must be different airports.');
  }
  if (typeof value.departureDate !== 'string' || !DATE_RE.test(value.departureDate)) {
    errors.push('departureDate must be an ISO date string (YYYY-MM-DD).');
  }
  if (value.returnDate !== undefined) {
    if (typeof value.returnDate !== 'string' || !DATE_RE.test(value.returnDate)) {
      errors.push('returnDate must be an ISO date string (YYYY-MM-DD) if provided.');
    } else if (typeof value.departureDate === 'string' && DATE_RE.test(value.departureDate) && value.returnDate < value.departureDate) {
      errors.push('returnDate must not be before departureDate.');
    }
  }
  if (
    value.passengers !== undefined &&
    (typeof value.passengers !== 'number' || !Number.isInteger(value.passengers) || value.passengers < 1 || value.passengers > 9)
  ) {
    errors.push('passengers must be an integer between 1 and 9 if provided.');
  }
  return errors;
}

function mapAmadeusError(err: unknown): [unknown, number] {
  if (err instanceof AmadeusTimeoutError) {
    return [{ error: 'provider_timeout', message: 'The flight search provider took too long to respond.' }, 504];
  }
  if (err instanceof AmadeusAuthError || err instanceof AmadeusProviderError || err instanceof AmadeusMalformedResponseError) {
    return [{ error: 'provider_error', message: 'The flight search provider is temporarily unavailable.' }, 502];
  }
  return [{ error: 'internal_error', message: 'An unexpected error occurred.' }, 500];
}

async function handleFlights(request: Request, env: Env, origin: string | null): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Request body must be valid JSON.' }, 400, origin);
  }
  const fields = validateFlightSearchRequest(body);
  if (fields.length > 0) {
    return json({ error: 'invalid_request', message: 'Request failed validation.', fields }, 400, origin);
  }
  const value = body as FlightSearchRequestBody;
  try {
    const result = await searchAmadeusFlightOffers(env, {
      origin: value.origin,
      destination: value.destination,
      departureDate: value.departureDate,
      returnDate: value.returnDate,
      passengers: value.passengers ?? 1,
    });
    return json({ offers: result.offers }, 200, origin);
  } catch (err) {
    const [responseBody, status] = mapAmadeusError(err);
    return json(responseBody, status, origin);
  }
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (url.pathname !== '/api/travel/flights') {
    return json({ error: 'not_found', message: 'Unknown endpoint.' }, 404, origin);
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405, origin);
  }
  return handleFlights(request, env, origin);
}

export default { fetch: handleRequest };
