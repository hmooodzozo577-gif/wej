// Phase 12 — Location Personalization: a thin, typed wrapper over the
// standard browser Geolocation API. Single-shot only (getCurrentPosition,
// never watchPosition — no continuous tracking). Coordinates never leave
// the browser: nothing here sends them to any server, and nothing in this
// project's state persists them (see state/reducer.ts — LOCATION_RESET or
// a page reload clears them; there's no localStorage/backend write).
import type { LocationCoords, LocationStatus } from '../state/types';

export type GeolocationFailureStatus = Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'>;

/** One attempt's outcome, with NO coordinates in it — safe to log, send as
 *  telemetry, or render in the debug panel. `stage` is 1-based. */
export interface GeolocationAttempt {
  stage: number;
  highAccuracy: boolean;
  timeoutMs: number;
  durationMs: number;
  outcome: 'ok' | GeolocationFailureStatus;
}

/** Everything the app knows about HOW a location request went, minus the
 *  location itself. `phase` answers the question item #6 asks explicitly:
 *  did we fail waiting for the BROWSER to produce a fix, or later, while
 *  the app resolved that fix to a country/city? This object only ever
 *  describes the browser phase; state/reducer.ts records a 'resolve'-phase
 *  diagnostic separately. */
export interface GeolocationDiagnostic {
  phase: 'browser';
  attempts: GeolocationAttempt[];
  totalMs: number;
}

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
      /** Always present from requestBrowserLocation(); optional only so a
       *  test double may omit it when the test is not about timing. */
      diagnostic?: GeolocationDiagnostic;
    }
  | { ok: false; status: GeolocationFailureStatus; diagnostic?: GeolocationDiagnostic };

// Root cause of the user-reported "استغرق طلب الموقع وقتًا طويلاً" (item #6):
// the previous implementation made exactly ONE attempt —
// {enableHighAccuracy: false, timeout: 15000} — and treated its TIMEOUT as
// final. enableHighAccuracy:false asks the browser for a NETWORK/Wi-Fi
// position, which is the provider that is unavailable or slow in precisely
// the situations users hit: a desktop on a wired connection with no
// scannable Wi-Fi, a browser whose network-location backend is unreachable,
// or a phone with Wi-Fi off. In all of those the coarse provider never
// answers, the 15s deadline expires, and the GPS provider — which WOULD
// have answered on a phone — was never asked, because a single call can
// only use one accuracy mode.
//
// So this is now a two-stage request:
//
//   Stage 1  coarse, short deadline, a cached fix accepted. This is the
//            fast path: if the browser already has a recent position (or
//            can get one from the network quickly) it returns almost
//            immediately, which is the common case and is FASTER than the
//            old single attempt because the deadline is shorter.
//   Stage 2  only entered when stage 1 produced TIMEOUT or
//            POSITION_UNAVAILABLE — never after a PERMISSION_DENIED, which
//            is a real, final answer and must not be re-prompted. Asks the
//            OTHER provider (enableHighAccuracy: true → GPS on mobile) with
//            a longer deadline and maximumAge: 0.
//
// PERMISSION_DENIED still fails immediately after stage 1: retrying a denial
// would re-prompt a user who already said no.
const STAGE_ONE_TIMEOUT_MS = 8000;
const STAGE_TWO_TIMEOUT_MS = 20000;
// A position up to 10 minutes old is accepted on stage 1. Safe for this
// app's resolution granularity (country/nearest-major-city/nearest-major-
// airport, all with multi-km tolerances): even at highway speed (~100km/h)
// 10 minutes covers ~17km, still inside those tolerances and not enough to
// plausibly cross a country border and change the resolved country. Not
// used for anything finer-grained than that. Stage 2 uses maximumAge: 0 —
// if stage 1's relaxed cache lookup found nothing there is no cache to
// reuse, and a fresh fix is the only thing left to wait for.
const STAGE_ONE_MAXIMUM_AGE_MS = 600000;

function statusOf(error: GeolocationPositionError): GeolocationFailureStatus {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  // POSITION_UNAVAILABLE, or any other browser-specific failure.
  return 'unavailable';
}

function attempt(
  stage: number,
  options: PositionOptions & { timeout: number; enableHighAccuracy: boolean },
): Promise<{ position: GeolocationPosition | null; attempt: GeolocationAttempt; status?: GeolocationFailureStatus }> {
  const startedAt = Date.now();
  const base = { stage, highAccuracy: options.enableHighAccuracy, timeoutMs: options.timeout };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          position,
          attempt: { ...base, durationMs: Date.now() - startedAt, outcome: 'ok' },
        });
      },
      (error) => {
        const status = statusOf(error);
        resolve({
          position: null,
          status,
          attempt: { ...base, durationMs: Date.now() - startedAt, outcome: status },
        });
      },
      options,
    );
  });
}

/** Requests the user's current position, escalating from a fast coarse
 *  attempt to a slower high-accuracy one before giving up (see the block
 *  comment above for why). Never throws/rejects — every outcome
 *  (unsupported browser, permission denied, position unavailable, timeout,
 *  success) resolves to a typed result so callers can dispatch directly
 *  without try/catch. The returned diagnostic never contains coordinates. */
export async function requestBrowserLocation(): Promise<GeolocationOutcome> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ok: false, status: 'unsupported', diagnostic: { phase: 'browser', attempts: [], totalMs: 0 } };
  }

  const startedAt = Date.now();
  const attempts: GeolocationAttempt[] = [];

  const first = await attempt(1, {
    enableHighAccuracy: false,
    timeout: STAGE_ONE_TIMEOUT_MS,
    maximumAge: STAGE_ONE_MAXIMUM_AGE_MS,
  });
  attempts.push(first.attempt);

  let final = first;
  // Only a soft failure (no fix yet) is worth asking the other provider
  // about. 'denied' is the user's answer, not a transport problem.
  if (!first.position && (first.status === 'timeout' || first.status === 'unavailable')) {
    const second = await attempt(2, {
      enableHighAccuracy: true,
      timeout: STAGE_TWO_TIMEOUT_MS,
      maximumAge: 0,
    });
    attempts.push(second.attempt);
    final = second;
  }

  const diagnostic: GeolocationDiagnostic = { phase: 'browser', attempts, totalMs: Date.now() - startedAt };

  if (final.position) {
    return {
      ok: true,
      // Passed through exactly as the browser reports them — no
      // rounding, no reordering, no derived/copied value.
      coords: { lat: final.position.coords.latitude, lng: final.position.coords.longitude },
      accuracy: final.position.coords.accuracy,
      timestamp: final.position.timestamp,
      diagnostic,
    };
  }
  return { ok: false, status: final.status ?? 'unavailable', diagnostic };
}
