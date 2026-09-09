// Phase 13.3 — Amadeus for Developers integration. This module is the ONLY
// place in this Worker (and the only place in the whole repository) that
// talks to Amadeus. It never receives the raw browser request and never
// returns anything to the browser directly — index.ts calls it, gets back
// already-normalized data or a typed error, and is responsible for
// mapping that into an HTTP response.
//
// SECRETS: `env.AMADEUS_API_KEY`/`env.AMADEUS_API_SECRET` are read here
// only, passed straight into the OAuth2 client-credentials token request
// body, and never logged, never included in any thrown error's message,
// and never returned to a caller. See ../../SECRETS.md.
//
// ENVIRONMENT: defaults to Amadeus' TEST (sandbox) API host unless
// `env.AMADEUS_ENV` is set to exactly 'production' — an unset, empty, or
// misspelled value always falls back to test, never silently upgrades to
// production (Phase 13.3 Part D).
export interface Env {
  AMADEUS_API_KEY: string;
  AMADEUS_API_SECRET: string;
  /** Non-secret configuration — deliberately a separate field from the two
   *  secrets above. 'production' opts into the live API; anything else
   *  (including unset) uses the test/sandbox API. */
  AMADEUS_ENV?: string;
}

const AMADEUS_BASE_URLS = {
  test: 'https://test.api.amadeus.com',
  production: 'https://api.amadeus.com',
} as const;

export function resolveAmadeusBaseUrl(env: Env): string {
  return env.AMADEUS_ENV === 'production' ? AMADEUS_BASE_URLS.production : AMADEUS_BASE_URLS.test;
}

// ---- Typed, safe-to-log-free errors -------------------------------------
// Each carries only a short, generic, non-provider-internal message —
// index.ts maps these to a safe client-facing error body. None of these
// ever carry the raw Amadeus response body, headers, or credential values.
export class AmadeusAuthError extends Error {}
export class AmadeusProviderError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus: number,
  ) {
    super(message);
  }
}
export class AmadeusMalformedResponseError extends Error {}
export class AmadeusTimeoutError extends Error {}

// A single request to this Worker makes at most one token request (only
// when no valid cached token exists) and exactly one flight-offers
// request — never a retry loop (Phase 13.3 Part K: "one frontend search
// should result in one appropriate provider search").
const REQUEST_TIMEOUT_MS = 10_000;

// ---- OAuth2 client-credentials token, cached in module scope ------------
// Amadeus tokens are valid for ~30 minutes. Caching the token (not flight
// prices/offers — this cache never touches offer data, so it cannot
// return a stale price) across requests handled by the same Worker
// isolate is the one caching mechanism Phase 13.3 Part K allows for
// ("a very small, clearly documented safe mechanism"): it only reduces
// redundant token requests, and a cold isolate simply fetches a fresh
// token on its first request. Never persisted (no KV/Durable Object) —
// purely an in-memory, best-effort optimization.
interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
  baseUrl: string;
}
let cachedToken: CachedToken | null = null;

/** Test-only: clears the module-level token cache so tests don't leak
 *  state into each other. Not used by any non-test code path. */
export function __resetAmadeusTokenCacheForTests(): void {
  cachedToken = null;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AmadeusTimeoutError('Amadeus request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken(env: Env, baseUrl: string, fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now();
  // 5s safety margin so a token never expires mid-flight of the very
  // request that reused it.
  if (cachedToken && cachedToken.baseUrl === baseUrl && cachedToken.expiresAtMs > now + 5000) {
    return cachedToken.accessToken;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(fetchImpl, `${baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.AMADEUS_API_KEY,
        client_secret: env.AMADEUS_API_SECRET,
      }).toString(),
    });
  } catch (err) {
    if (err instanceof AmadeusTimeoutError) throw err;
    throw new AmadeusAuthError('Could not reach Amadeus authentication endpoint.');
  }

  if (!res.ok) {
    // Deliberately generic: never echoes the response body (which, for a
    // 4xx here, is Amadeus explaining what's wrong with our credentials —
    // still not something to hand to a browser) or any header.
    throw new AmadeusAuthError(`Amadeus authentication failed (status ${res.status}).`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AmadeusAuthError('Amadeus authentication response was not valid JSON.');
  }
  const token = data as { access_token?: unknown; expires_in?: unknown };
  if (typeof token.access_token !== 'string' || typeof token.expires_in !== 'number') {
    throw new AmadeusAuthError('Amadeus authentication response was missing expected fields.');
  }

  cachedToken = { accessToken: token.access_token, expiresAtMs: now + token.expires_in * 1000, baseUrl };
  return cachedToken.accessToken;
}

// ---- Flight Offers Search + normalization --------------------------------
export interface NormalizedFlightSearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
}

export interface Airport {
  iata: string;
  name: string;
  countryCode: string;
}

export interface TravelSegment {
  origin: Airport;
  destination: Airport;
  departureTime: string;
  arrivalTime: string;
  airlineCode: string;
  carrierName?: string;
  /** Phase 13.4b: this leg's own flown duration (from Amadeus segment's
   *  own `duration` field), not the itinerary/offer total. */
  durationMinutes: number;
}

/** Phase 13.4b: one stop between two segments of the SAME itinerary
 *  (never between the outbound and return itineraries of a round trip —
 *  that gap is ground time between two separate journeys, not a
 *  layover). `airport` is the connecting airport (arrival airport of the
 *  segment before, departure airport of the segment after — always the
 *  same code). */
export interface Layover {
  airport: Airport;
  durationMinutes: number;
}

export interface FlightOffer {
  id: string;
  segments: TravelSegment[];
  price: { amount: number; currency: string };
  durationMinutes: number;
  stops: number;
  /** Phase 13.4b: one entry per stop, same order as `segments`. Length
   *  always equals `stops`. Empty for a non-stop or single-itinerary
   *  direct offer. */
  layovers: Layover[];
}

// ISO 8601 durations as Amadeus returns them, e.g. "PT15H30M". Minimal
// parser covering the H/M/S components flight durations actually use —
// not a general-purpose ISO 8601 duration library, which would be
// unnecessary complexity for this one field (Phase 13.3 Part F: "do not
// add unsupported or unnecessary parameters merely for complexity").
function parseIsoDurationToMinutes(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}

// Amadeus segment departure/arrival `at` timestamps are local wall-clock
// time WITHOUT a UTC offset (e.g. "2026-12-01T13:00:00"). Parsing that
// string directly with `new Date(...)` is environment-dependent (Node
// uses the host's local timezone for an offset-less ISO string; a
// Cloudflare Worker always runs in UTC) — not deterministic across
// runtimes. This function forces a deterministic parse by treating the
// string as UTC when it carries no offset, so the SAME input always
// produces the SAME millisecond value everywhere. Known limitation
// (documented, not hidden): a layover spanning two airports in different
// real timezones is computed from these wall-clock values as given,
// which is exactly what Amadeus' own response provides — no timezone
// database is available offline, and Part K/NO NEW EXTERNAL APIS forbids
// fetching one.
function parseAmadeusLocalDateTimeMs(iso: string): number {
  const hasOffset = /(?:[Zz]|[+-]\d{2}:\d{2})$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}Z`).getTime();
}

interface AmadeusLocationDictEntry {
  cityCode?: string;
  countryCode?: string;
}

function toAirport(iataCode: unknown, locations: Record<string, AmadeusLocationDictEntry>): Airport {
  const iata = typeof iataCode === 'string' ? iataCode : '';
  const entry = locations[iata];
  // Amadeus' flight-offers response does not include a full airport name
  // (only IATA code + city/country via `dictionaries.locations`) without
  // a separate Airport & City Search API call, which Part F explicitly
  // says not to add merely for extra detail. Using the real IATA code as
  // `name` is an honest, non-fabricated fallback — never an invented
  // airport name.
  return { iata, name: iata, countryCode: entry?.countryCode ?? '' };
}

/** Normalizes one raw Amadeus flight-offer object (from `data[]`) into a
 *  FlightOffer. Never passes any raw Amadeus field through unexamined —
 *  every value is read, validated for the shape this function expects,
 *  and re-packed into this module's own types. Throws
 *  AmadeusMalformedResponseError if the offer doesn't have the minimum
 *  shape this function needs (rather than silently producing a
 *  half-populated, misleading offer). */
function normalizeOffer(raw: unknown, locations: Record<string, AmadeusLocationDictEntry>): FlightOffer {
  const offer = raw as Record<string, unknown>;
  const id = offer.id;
  const itineraries = offer.itineraries;
  const price = offer.price as Record<string, unknown> | undefined;

  if (typeof id !== 'string' || !Array.isArray(itineraries) || itineraries.length === 0 || !price) {
    throw new AmadeusMalformedResponseError('Amadeus flight offer was missing required fields.');
  }
  const totalRaw = price.total;
  const currency = price.currency;
  const amount = typeof totalRaw === 'string' ? Number.parseFloat(totalRaw) : NaN;
  if (!Number.isFinite(amount) || typeof currency !== 'string') {
    throw new AmadeusMalformedResponseError('Amadeus flight offer had an invalid price.');
  }

  const segments: TravelSegment[] = [];
  const layovers: Layover[] = [];
  let durationMinutes = 0;
  for (const itinerary of itineraries as unknown[]) {
    const it = itinerary as Record<string, unknown>;
    durationMinutes += parseIsoDurationToMinutes(typeof it.duration === 'string' ? it.duration : undefined);
    const itSegments = it.segments;
    if (!Array.isArray(itSegments) || itSegments.length === 0) {
      throw new AmadeusMalformedResponseError('Amadeus itinerary had no segments.');
    }
    // Reset per itinerary: a layover only exists BETWEEN two segments of
    // the SAME itinerary. The gap between the last outbound segment and
    // the first return segment is ground time between two separate
    // journeys, not a layover, so it must never be carried across this
    // boundary.
    let previousArrival: { at: string; iataCode: unknown } | undefined;
    for (const seg of itSegments as unknown[]) {
      const s = seg as Record<string, unknown>;
      const departure = s.departure as Record<string, unknown> | undefined;
      const arrival = s.arrival as Record<string, unknown> | undefined;
      if (!departure || !arrival || typeof departure.at !== 'string' || typeof arrival.at !== 'string') {
        throw new AmadeusMalformedResponseError('Amadeus segment was missing departure/arrival details.');
      }

      if (previousArrival) {
        const gapMinutes = Math.round(
          (parseAmadeusLocalDateTimeMs(departure.at) - parseAmadeusLocalDateTimeMs(previousArrival.at)) / 60000,
        );
        layovers.push({
          airport: toAirport(previousArrival.iataCode, locations),
          durationMinutes: Math.max(0, gapMinutes),
        });
      }

      segments.push({
        origin: toAirport(departure.iataCode, locations),
        destination: toAirport(arrival.iataCode, locations),
        departureTime: departure.at,
        arrivalTime: arrival.at,
        airlineCode: typeof s.carrierCode === 'string' ? s.carrierCode : '',
        carrierName: undefined, // populated by index.ts from dictionaries.carriers, kept out of this pure-data-shape function
        durationMinutes: parseIsoDurationToMinutes(typeof s.duration === 'string' ? s.duration : undefined),
      });
      previousArrival = { at: arrival.at, iataCode: arrival.iataCode };
    }
  }

  // Stops across the whole trip = every segment boundary that isn't the
  // start of a new itinerary (outbound vs. return each start a fresh,
  // non-stop "leg 0"). Always equal to layovers.length by construction.
  const stops = segments.length - itineraries.length;

  return { id, segments, price: { amount, currency }, durationMinutes, stops: Math.max(0, stops), layovers };
}

export interface FlightOffersSearchResult {
  offers: FlightOffer[];
}

/** Performs the full Amadeus flow for one normalized request: get/reuse a
 *  token, call Flight Offers Search, normalize the response. Throws one
 *  of this module's typed errors on any failure — callers (index.ts) are
 *  expected to catch and map to a safe client response, never to let a
 *  raw error escape to the browser. */
export async function searchAmadeusFlightOffers(
  env: Env,
  request: NormalizedFlightSearchRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<FlightOffersSearchResult> {
  const baseUrl = resolveAmadeusBaseUrl(env);
  const token = await getAccessToken(env, baseUrl, fetchImpl);

  const params = new URLSearchParams({
    originLocationCode: request.origin,
    destinationLocationCode: request.destination,
    departureDate: request.departureDate,
    adults: String(request.passengers),
    // Bounds response size/cost — an officially supported parameter, not
    // an invented one (Amadeus Flight Offers Search's own `max` param).
    max: '10',
  });
  if (request.returnDate) params.set('returnDate', request.returnDate);

  let res: Response;
  try {
    res = await fetchWithTimeout(fetchImpl, `${baseUrl}/v2/shopping/flight-offers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err instanceof AmadeusTimeoutError) throw err;
    throw new AmadeusProviderError('Could not reach Amadeus Flight Offers Search.', 0);
  }

  if (!res.ok) {
    throw new AmadeusProviderError(`Amadeus Flight Offers Search failed (status ${res.status}).`, res.status);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new AmadeusMalformedResponseError('Amadeus Flight Offers Search response was not valid JSON.');
  }

  const parsed = body as Record<string, unknown>;
  const data = parsed.data;
  if (!Array.isArray(data)) {
    throw new AmadeusMalformedResponseError('Amadeus Flight Offers Search response was missing "data".');
  }

  const dictionaries = (parsed.dictionaries as Record<string, unknown> | undefined) ?? {};
  const locations = (dictionaries.locations as Record<string, AmadeusLocationDictEntry> | undefined) ?? {};
  const carriers = (dictionaries.carriers as Record<string, string> | undefined) ?? {};

  const offers = data.map((raw) => {
    const offer = normalizeOffer(raw, locations);
    // Fill in carrier display names from the dictionary now that we have
    // it (normalizeOffer itself stays a pure function of one offer +
    // locations, so it doesn't need to know about `carriers` too).
    offer.segments = offer.segments.map((seg) => ({
      ...seg,
      carrierName: carriers[seg.airlineCode] ?? undefined,
    }));
    return offer;
  });

  return { offers };
}
