// Phase 13.3 (Part H) — the documented, testable glue between Phase
// 13.2's airport resolver (data/airports.ts) and this phase's
// travelService.searchFlights(). This is the ONLY place that combines
// them, so nothing else needs to (or should) duplicate airport-resolution
// logic: both the current-user side and the destination side call the
// exact same resolveNearestAirport() from Phase 13.2, unmodified.
//
// Country resolution itself is untouched and not reimplemented here: the
// caller must already have resolved the user's current country (via
// geo.ts's resolveCurrentCountry(), exactly as LocationPersonalize.tsx
// already does) and pass its countryCode in — this module never infers a
// country from an airport, and never crosses a country boundary, because
// resolveNearestAirport() itself already enforces that (see its own doc
// comment).
//
// No UI is added in this phase (Part O): this function is the "minimal
// integration/test surface... necessary to verify the API path" — it and
// its tests exercise the full location → airport → flight-search-request
// pipeline without inventing a flight-results page. A later phase wires
// this into an actual UI flow.
import { resolveNearestAirport } from '../data/airports';
import type { Coords } from '../data/geo';
import type { CatalogEntry } from '../data/types';
import { countryInfoOf } from '../data/worldCatalog';
import type { TravelSearchRequest } from './types';

export interface TravelRequestParams {
  /** The current user's real coordinates (e.g. state.location.coords,
   *  already granted via requestBrowserLocation()) — never a country
   *  centroid. */
  originCoords: Coords;
  /** The country already resolved for those coordinates by
   *  geo.ts's resolveCurrentCountry() — never re-derived here. */
  originCountryCode: string;
  /** The destination the user picked from WORLD_CATALOG (a Destination or
   *  BasicCountry entry) — reused as-is, no second country model. */
  destination: CatalogEntry;
  /** ISO date, YYYY-MM-DD. */
  departureDate: string;
  /** ISO date, YYYY-MM-DD. Omit for a one-way search. */
  returnDate?: string;
  /** Defaults to 1 if omitted. */
  passengers?: number;
}

/** Resolves a ready-to-send TravelSearchRequest from a current location
 *  and a chosen destination, using Phase 13.2's resolveNearestAirport()
 *  for both ends — for the destination side, against that catalog
 *  entry's own centroid (`countryInfoOf(destination.id).latlng`, the same
 *  value LocationPersonalize.tsx's debug panel already reads), scoped to
 *  that entry's own `countryCode`.
 *
 *  Returns undefined — never a guess — when either side has no qualifying
 *  airport within range, or when the destination's country info can't be
 *  found. Never fabricates an IATA code. */
export async function resolveTravelSearchRequest(params: TravelRequestParams): Promise<TravelSearchRequest | undefined> {
  const originResolution = await resolveNearestAirport(params.originCoords, params.originCountryCode);
  if (!originResolution) return undefined;

  const destinationInfo = countryInfoOf(params.destination.id);
  if (!destinationInfo) return undefined;

  const destinationResolution = await resolveNearestAirport(destinationInfo.latlng, params.destination.countryCode);
  if (!destinationResolution) return undefined;

  return {
    originIata: originResolution.airport.iata,
    destinationIata: destinationResolution.airport.iata,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    passengers: params.passengers ?? 1,
  };
}
