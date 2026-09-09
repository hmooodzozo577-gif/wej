// Phase 13.2 (Part B, Task B4) — normalized, provider-agnostic travel
// types. Nothing in this file (or anywhere under src/travel/) may import
// an Amadeus/Duffel SDK type or shape a type around one provider's
// response — that's the whole point of this layer: components talk to
// these types and to travelService.ts's functions, never to a provider
// directly. A future Worker (see ../../../worker) is responsible for
// translating whatever a real provider returns into exactly this shape.
//
// Deliberately minimal (Task B4: "minimum viable, not over-engineered") —
// only what's needed to describe a flight search request/result. No
// hotels, no booking, no pricing rules beyond a single total amount.

/** A minimal airport reference for travel purposes. Distinct from (but
 *  structurally compatible with) data/types.ts's AirportLocation — this
 *  one deliberately omits lat/lng, which travel components don't need,
 *  keeping this layer's types free of any dependency on the geo data
 *  module. */
export interface Airport {
  iata: string;
  name: string;
  countryCode: string;
}

/** One flown leg of an offer. */
export interface TravelSegment {
  origin: Airport;
  destination: Airport;
  /** ISO 8601 date-time, e.g. "2026-12-01T08:30:00Z". */
  departureTime: string;
  /** ISO 8601 date-time. */
  arrivalTime: string;
  /** Airline/operator display name, when known. */
  carrierName?: string;
}

export interface FlightOfferPrice {
  amount: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
}

/** One bookable flight offer, already normalized — never a raw provider
 *  payload. `segments` is ordered outbound-then-return when a round trip. */
export interface FlightOffer {
  id: string;
  segments: TravelSegment[];
  price: FlightOfferPrice;
}

/** What a caller asks travelService.searchFlights() for. IATA codes only
 *  (3-letter, uppercase) — resolving a country/city to an IATA code is
 *  data/airports.ts's job (resolveNearestAirport), not this layer's. */
export interface TravelSearchRequest {
  originIata: string;
  destinationIata: string;
  /** ISO date, YYYY-MM-DD. */
  departureDate: string;
  /** ISO date, YYYY-MM-DD. Omit for a one-way search. */
  returnDate?: string;
  /** 1-9, matching the Worker's own validation range. */
  passengers: number;
}

/** searchFlights()'s result. A tagged union so callers must explicitly
 *  handle each case — there is no implicit "empty offers array" that
 *  could be mistaken for "no flights found" when it actually means
 *  "search isn't implemented yet" or "the request was invalid". This is
 *  the type-level enforcement of Task B5's "never fabricate flight data
 *  or silently fall back to fake offers" requirement: there is no `ok`
 *  variant this module can produce without a real provider result to put
 *  in it. */
export type TravelSearchResult =
  | { status: 'ok'; offers: FlightOffer[] }
  | { status: 'invalid_request'; fields: string[] }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string };
