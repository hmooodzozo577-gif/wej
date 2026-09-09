// Phase 13.4a — Distance and Flight Duration Estimation. A pure,
// deterministic, client-side estimate: no network call, no external API,
// no npm package, and no Math.random() anywhere in this file — the same
// (origin, destination) pair always returns the same result.
//
// MANDATORY REUSE: distance comes from data/geo.ts's haversineKm() only.
// This file does not reimplement the Haversine formula.
//
// This is deliberately separate from searchFlights()'s real, Amadeus-
// backed FlightOffer.durationMinutes/stops (Phase 13.3): this module
// estimates a rough distance/duration independent of any live search —
// useful before a search is made, or when the Worker is unavailable — and
// it never claims to be a real flight time or overwrites a real offer's
// own duration. See types.ts's FlightEstimate for the returned shape.
import { haversineKm, type Coords } from '../data/geo';
import type { FlightEstimate } from './types';

/** Typical commercial jet cruising speed, km/h — a widely-used rough
 *  planning figure (comparable to a Boeing 737/Airbus A320 cruise speed
 *  of roughly 780-850 km/h). Not tuned per aircraft/route: this is a
 *  rough estimate, not a real flight-planning tool. Fixed and
 *  deterministic, never randomized. */
export const CRUISE_SPEED_KMH = 800;

/** Fixed overhead added to every non-zero-distance flight: taxi-out,
 *  takeoff, climb, descent, and landing/taxi-in time that straight-line
 *  cruise-speed math alone doesn't cover. 30 minutes is a standard rough
 *  aviation planning heuristic. Fixed — never distance-dependent, never
 *  randomized. */
export const FIXED_OVERHEAD_MINUTES = 30;

/** Great-circle distance between two points, in kilometers, rounded to
 *  one decimal place. Delegates entirely to geo.ts's haversineKm — see
 *  the module doc comment above; this function never reimplements that
 *  formula. */
export function estimateDistanceKm(origin: Coords, destination: Coords): number {
  return Math.round(haversineKm(origin, destination) * 10) / 10;
}

/** Deterministic flight-duration estimate from a distance, in minutes:
 *  cruise time (distanceKm / CRUISE_SPEED_KMH, converted to minutes)
 *  plus FIXED_OVERHEAD_MINUTES. Zero (or negative — not a real distance,
 *  but handled the same way defensively) distance returns exactly 0:
 *  there is no flight to estimate, so no overhead is added either. Never
 *  uses Math.random() or any other non-deterministic input — the same
 *  distanceKm always returns the same duration. */
export function estimateDurationMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const cruiseMinutes = (distanceKm / CRUISE_SPEED_KMH) * 60;
  return Math.round(cruiseMinutes + FIXED_OVERHEAD_MINUTES);
}

/** The function most callers should use: combines both into one
 *  FlightEstimate for a given origin/destination coordinate pair. */
export function estimateFlight(origin: Coords, destination: Coords): FlightEstimate {
  const distanceKm = estimateDistanceKm(origin, destination);
  return { distanceKm, durationMinutes: estimateDurationMinutes(distanceKm) };
}
