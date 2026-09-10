// Phase 16.5 completion pass — location integration for the AI interview.
//
// The ONLY place this project turns the existing voluntary Geolocation
// system (Phase 12, state.location) into anything sent toward the AI.
// Structurally cannot leak a coordinate: the return type is a plain
// string (a country name) or undefined — there is no code path from
// here that forwards `state.location.coords` itself.
import { resolveCurrentCountry } from '../data/geo';
import { nameOf } from '../data/destinationText';
import type { Lang } from '../data/types';
import type { LocationState } from '../state/types';

/** Resolves a COARSE origin-country name from the existing voluntary
 *  location system, or undefined if location was never granted (the
 *  interview must work identically either way — this is enrichment,
 *  never a requirement). Never returns anything coordinate-shaped. */
export async function buildLocationContext(location: LocationState, lang: Lang): Promise<string | undefined> {
  if (location.status !== 'granted' || !location.coords) return undefined;
  const resolution = await resolveCurrentCountry(location.coords);
  if (!resolution) return undefined;
  return nameOf(resolution.result.entry, lang);
}
