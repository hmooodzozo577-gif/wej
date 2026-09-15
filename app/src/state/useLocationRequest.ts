// Workstream C — Global Location Personalization: the ONE place that
// dispatches LOCATION_REQUEST/GRANTED/FAILED and calls
// requestBrowserLocation() (geo/geolocation.ts, untouched — see that
// file's own doc comment and the d51a3e3 timeout fix it already has).
// Both LocationIntro.tsx (the new global first-visit prompt) and
// LocationPersonalize.tsx (Explore's existing control, refactored to
// use this too) call this SAME hook rather than each independently
// wiring up the browser Geolocation call — the concurrent-request risk
// this avoids: two components deciding "I should call
// getCurrentPosition now" at the same time. In practice this can't
// race either: `dispatch({ type: 'LOCATION_REQUEST' })` is applied
// synchronously by the reducer to app-wide state.location.status
// BEFORE the async requestBrowserLocation() call ever starts, so a
// caller gating its own "can I show a request button" on
// `status === 'idle'` (both LocationIntro and LocationPersonalize do)
// can never issue a second request while the first is in flight.
import { useCallback } from 'react';
import { useAppState } from './hooks';
import { requestBrowserLocation, type GeolocationOutcome } from '../geo/geolocation';
import { trackEvent } from '../telemetry/productDataClient';

export function useLocationRequest() {
  const { state, dispatch } = useAppState();
  const lang = state.lang;

  const request = useCallback(async (): Promise<GeolocationOutcome> => {
    dispatch({ type: 'LOCATION_REQUEST' });
    const result = await requestBrowserLocation();
    // Item #6 diagnosis, safely: stage/duration/outcome only. No latitude,
    // longitude, accuracy radius or timestamp is recorded here or sent
    // anywhere — the diagnostic type itself cannot carry them.
    const diagnostic = result.diagnostic ?? { phase: 'browser' as const, attempts: [], totalMs: 0 };
    trackEvent('location_request_outcome', {
      outcome: result.ok ? 'ok' : result.status,
      totalMs: diagnostic.totalMs,
      stages: diagnostic.attempts.map((item) => ({
        stage: item.stage,
        highAccuracy: item.highAccuracy,
        timeoutMs: item.timeoutMs,
        durationMs: item.durationMs,
        outcome: item.outcome,
      })),
    }, { path: typeof window === 'undefined' ? '' : window.location.pathname, locale: lang });
    if (result.ok) {
      dispatch({ type: 'LOCATION_GRANTED', coords: result.coords, diagnostic });
    } else {
      dispatch({ type: 'LOCATION_FAILED', status: result.status, diagnostic });
    }
    return result;
  }, [dispatch, lang]);

  return { request };
}
