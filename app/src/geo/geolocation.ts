// Phase 12 — Location Personalization: a thin, typed wrapper over the
// standard browser Geolocation API. Single-shot only (getCurrentPosition,
// never watchPosition — no continuous tracking). Coordinates never leave
// the browser: nothing here sends them to any server, and nothing in this
// project's state persists them (see state/reducer.ts — LOCATION_RESET or
// a page reload clears them; there's no localStorage/backend write).
import type { LocationCoords, LocationStatus } from '../state/types';

export type GeolocationOutcome =
  | {
      ok: true;
      coords: LocationCoords;
      /** Meters, as reported by the browser (position.coords.accuracy). Not
       *  otherwise used by resolution — carried through only so the debug
       *  panel (LocationPersonalize.tsx, ?debugLocation=1) can show it. */
      accuracy: number;
      /** position.timestamp (ms since epoch), same reason as accuracy above. */
      timestamp: number;
    }
  | { ok: false; status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'> };

// Bug fix (post-Phase 13.6): the previous 10s timeout + maximumAge: 0
// (never accept a cached fix, even one from seconds ago) combination
// produced real-world TIMEOUT failures on devices/browsers with a slower
// first position fix (weak signal, cold GPS/Wi-Fi positioning) — every
// single call, including Retry, had to acquire a brand-new fix from
// scratch within 10s. enableHighAccuracy is already false here (network/
// Wi-Fi positioning, not GPS), so a high-accuracy-then-relaxed retry
// doesn't apply — forcing enableHighAccuracy: true in would typically
// make a fix SLOWER, not faster, and isn't what this implementation uses.
const TIMEOUT_MS = 15000;
// A position up to 5 minutes old is accepted. Safe for this app's
// resolution granularity (country/nearest-major-city/nearest-major-
// airport, all with multi-km tolerances): even at highway speed
// (~100km/h) 5 minutes covers ~8km, well inside those tolerances and not
// enough to plausibly cross a country border. Not used for anything
// finer-grained than that.
const MAXIMUM_AGE_MS = 300000;

/** Requests the user's current position once. Never throws/rejects — every
 *  outcome (unsupported browser, permission denied, position unavailable,
 *  timeout, success) resolves to a typed result so callers can dispatch
 *  directly without try/catch. */
export function requestBrowserLocation(): Promise<GeolocationOutcome> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, status: 'unsupported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          // Passed through exactly as the browser reports them — no
          // rounding, no reordering, no derived/copied value.
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, status: 'denied' });
        } else if (error.code === error.TIMEOUT) {
          resolve({ ok: false, status: 'timeout' });
        } else {
          // POSITION_UNAVAILABLE, or any other browser-specific failure.
          resolve({ ok: false, status: 'unavailable' });
        }
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: MAXIMUM_AGE_MS },
    );
  });
}
