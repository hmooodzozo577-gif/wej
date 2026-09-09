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

const TIMEOUT_MS = 10000;

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
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
