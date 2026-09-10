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

export function useLocationRequest() {
  const { dispatch } = useAppState();

  const request = useCallback(async (): Promise<GeolocationOutcome> => {
    dispatch({ type: 'LOCATION_REQUEST' });
    const result = await requestBrowserLocation();
    if (result.ok) {
      dispatch({ type: 'LOCATION_GRANTED', coords: result.coords });
    } else {
      dispatch({ type: 'LOCATION_FAILED', status: result.status });
    }
    return result;
  }, [dispatch]);

  return { request };
}
