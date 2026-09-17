// Acceptance fix — "Nearest to me" was excluding the wrong country (or no
// country at all) because exploreCatalog.ts used to resolve "current
// country" itself via the old nearest-centroid approximateCountryOf().
// That technique is documented (data/geo.ts) as unreliable for exactly
// this question — a real prior bug resolved a user in Abha, Saudi Arabia
// to Eritrea — and reproduces with real coordinates for Dammam, Saudi
// Arabia, which resolves nearest-centroid to Bahrain.
//
// This hook resolves the real point-in-polygon country
// (data/geo.ts's resolveCurrentCountry — the same resolver
// LocationPersonalize.tsx and TravelInfo.tsx already use to show "your
// current country") once per coordinate change, so Explore.tsx can pass an
// accurate, already-resolved country code into exploreCatalog.ts's
// sortCatalog() instead of that function guessing on its own.
//
// Returns `undefined` while there are no coordinates, resolution is still
// in flight, OR the resolved code is stale (belongs to a previous
// coordinate) — callers must treat that as "not yet known", never as "no
// current country", so a Nearest-to-me sort never wrongly excludes a
// country before resolution for THESE coordinates has actually completed.
import { useEffect, useState } from 'react';
import { resolveCurrentCountry } from '../data/geo';
import type { LocationCoords } from '../state/types';

const COORD_KEY_NONE = Symbol('no-coords');

export function useResolvedCountryCode(coords: LocationCoords | null): string | undefined {
  const key = coords ? `${coords.lat},${coords.lng}` : COORD_KEY_NONE;
  const [resolved, setResolved] = useState<{ key: string | typeof COORD_KEY_NONE; code: string | undefined }>({
    key: COORD_KEY_NONE,
    code: undefined,
  });

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    void resolveCurrentCountry(coords).then((resolution) => {
      if (!cancelled) setResolved({ key, code: resolution?.result.entry.countryCode });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the coordinate values themselves, not the coords object identity
  }, [key]);

  return resolved.key === key ? resolved.code : undefined;
}
