// Phase 13.2 (Part B, Task B5) — the ONLY module a component may call for
// flight search. Components must never import an Amadeus/Duffel SDK type,
// never parse a provider-specific response shape, never hold a provider
// URL or API key — all of that is out of scope for the frontend entirely
// (see ../../../SECRETS.md) and belongs, later, to the Worker
// (../../../worker).
//
// THIS STEP DOES NOT CALL ANY PROVIDER. searchFlights() validates the
// request shape and returns an explicit 'unavailable' result — it never
// performs a network call, and it never fabricates a successful offer.
// The Worker's POST /api/travel/flights contract already exists and is
// tested (see worker/src/index.ts), but nothing wires this function to it
// yet, because the Worker itself is not deployed in this step (Task B1).
// A later phase (13.3+, under separate authorization) is expected to
// change only this function's body — fetch the deployed Worker URL and
// translate its response into a TravelSearchResult — while keeping this
// exact exported signature, so anything written against it today does
// not need to change.
import type { TravelSearchRequest, TravelSearchResult } from './types';

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
  if (request.returnDate !== undefined && !DATE_RE.test(request.returnDate)) {
    errors.push('returnDate must be an ISO date string (YYYY-MM-DD) if provided.');
  }
  if (!Number.isInteger(request.passengers) || request.passengers < 1 || request.passengers > 9) {
    errors.push('passengers must be an integer between 1 and 9.');
  }

  return errors;
}

/** Searches for flight offers matching `request`. See the module doc
 *  comment above: in Phase 13.2 this NEVER calls a real provider and
 *  NEVER returns a fabricated `ok` result — it only validates the
 *  request and, if valid, reports that search is not available yet. This
 *  is deliberate, not a placeholder bug: components can already be built
 *  against the full TravelSearchResult contract (including a real `ok`
 *  case) today, and will start receiving real offers once a later phase
 *  wires this function to the deployed Worker, with no signature change
 *  required here. */
export async function searchFlights(request: TravelSearchRequest): Promise<TravelSearchResult> {
  const fields = validateTravelSearchRequest(request);
  if (fields.length > 0) {
    return { status: 'invalid_request', fields };
  }

  return {
    status: 'unavailable',
    reason: 'Flight search is not available yet. Provider integration is planned for a later phase.',
  };
}
