// Phase 16.5 completion pass — Location Permissions API pre-detection.
// Thin React seam over permissionsApi.ts's pure query function: resolves
// once on mount, and re-resolves live via PermissionStatus's own
// 'change' event where the browser supports it (e.g. the user grants/
// revokes location for this site from the browser's own UI while the
// tab is open) — never by polling. Local component state only, never
// written to global app state/localStorage: this is presentation-layer
// pre-detection, not a fact worth persisting (see permissionsApi.ts's
// own doc comment for why re-querying is always safe/free).
import { useEffect, useState } from 'react';
import { queryGeolocationPermission, type GeolocationPermissionState } from './permissionsApi';

export function useGeolocationPermission(): GeolocationPermissionState {
  const [state, setState] = useState<GeolocationPermissionState>('unsupported');

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | undefined;
    const onChange = () => {
      if (!cancelled && status) setState(status.state as GeolocationPermissionState);
    };

    queryGeolocationPermission().then((result) => {
      if (!cancelled) setState(result);
    });

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((s) => {
          if (cancelled) return;
          status = s;
          status.addEventListener('change', onChange);
        })
        .catch(() => {
          // Already handled by queryGeolocationPermission() above resolving 'unsupported'.
        });
    }

    return () => {
      cancelled = true;
      status?.removeEventListener('change', onChange);
    };
  }, []);

  return state;
}
