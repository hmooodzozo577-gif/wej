// v1.1 — the passport selector's initial value, from the country the
// traveller is in right now. This is ONLY a default to save a few taps:
// being in a country says nothing about which passport someone holds, and
// nothing here claims it does. So:
//   - it uses a location the traveller already granted (no new request);
//   - only a real point-in-polygon match counts (never the nearest-centroid
//     fallback, and never an excluded country);
//   - it applies only while the traveller has not chosen, changed, cleared
//     or skipped the passport in this session, and never overwrites that;
//   - it is not written anywhere: not app state, not the personalization
//     profile, not storage, not analytics. It becomes the passport only if
//     the traveller continues with it shown (see Quiz.tsx).
import { useEffect, useState } from 'react';
import { resolveCurrentCountry } from '../data/geo';
import type { AppState } from '../state/types';

export function usePassportDefault(state: Pick<AppState, 'location' | 'passportCode' | 'passportChosen'>): string | null {
  const coords = state.location.status === 'granted' ? state.location.coords : null;
  const key = coords ? `${coords.lat},${coords.lng}` : null;
  const [resolved, setResolved] = useState<{ key: string | null; code: string | null }>({ key: null, code: null });

  useEffect(() => {
    if (!coords || !key) return;
    let cancelled = false;
    void resolveCurrentCountry(coords).then((resolution) => {
      if (cancelled) return;
      setResolved({ key, code: resolution?.method === 'boundary' ? resolution.result.entry.countryCode : null });
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the coordinate values, not the coords object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.passportChosen || state.passportCode) return null;
  return resolved.key === key ? resolved.code : null;
}
