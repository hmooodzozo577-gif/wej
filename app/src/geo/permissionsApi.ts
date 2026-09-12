// Location Permissions API pre-detection.
//
// `navigator.permissions.query({name:'geolocation'})` NEVER triggers the
// browser's OS-level permission prompt by itself — querying the current
// state is not the same action as requesting it (that's still, and only
// ever, geo/geolocation.ts's requestBrowserLocation(), called from a real
// user click — see state/useLocationRequest.ts). This module is purely
// read-only pre-detection: it lets the UI show accurate copy (skip "please
// grant" wording when already granted, skip a doomed "Allow" click when
// already denied) WITHOUT ever calling getCurrentPosition itself and
// WITHOUT changing when a real geolocation request may fire.
export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

/** Resolves the CURRENT browser-level geolocation permission state, or
 *  'unsupported' when the Permissions API itself isn't available (older
 *  Safari/WebViews, or a browser that supports Geolocation but not
 *  Permissions) — callers must treat 'unsupported' identically to never
 *  having queried at all (fall back to the pre-existing idle-first-ask
 *  behavior), never as a synonym for 'denied'. */
export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unsupported';
  } catch {
    // Some browsers throw for an unrecognized/unsupported permission
    // name rather than rejecting cleanly — same fallback either way.
    return 'unsupported';
  }
}
