// Phase 12 — Location Personalization. A single self-contained card: a
// "Use My Location" action, permission/status feedback, and — once
// granted — the resolved current location (city + country, or country
// only) plus a short row of nearby-country links. Reuses existing
// detail-card / meta-chip visual language; no new styling introduced.
//
// Phase 12 fix: current-country resolution now goes through
// resolveCurrentCountry() (real point-in-polygon, async — see data/geo.ts),
// not the old synchronous nearest-centroid call. The resolution result is
// local component state (not global app state): it's pure presentation
// derived from state.location.coords, doesn't need to survive route
// changes, and keeping it local avoids adding new reducer/action surface
// for what's fundamentally a render concern.
//
// City-level personalization (this change): once the country is resolved
// via a real boundary match, resolveNearestCity() (data/cities.ts, a
// module entirely separate from geo.ts — the boundary resolver itself is
// untouched) finds the nearest known major city WITHIN that same country,
// using the real browser coordinates. If no qualifying city is close
// enough, the UI cleanly falls back to country-only — never a guess.
//
// Nearby-countries fix (this change): the already-resolved current
// country is structurally excluded from the nearby list by countryCode
// (never by matching the localized display string), after fetching one
// extra candidate to keep the visible list at its usual length.
//
// Diagnostic instrumentation (?debugLocation=1): unchanged from the prior
// investigation — still shows the raw browser result alongside what was
// passed to the resolver. See geo/geolocation.ts / this file's DEBUG panel.
//
// Workstream C (Global Location Personalization): the request lifecycle
// itself (dispatch LOCATION_REQUEST -> requestBrowserLocation() ->
// dispatch GRANTED/FAILED) now goes through the shared
// useLocationRequest() hook — the SAME one LocationIntro.tsx (the new
// global first-visit prompt) uses — so there is exactly one place in
// the app that ever calls requestBrowserLocation(), never two
// independent call sites racing each other. Everything below this
// component's own concern (country/city resolution, nearby list, the
// debug panel) is unchanged.
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { useLocationRequest } from '../state/useLocationRequest';
import { useGeolocationPermission } from '../geo/useGeolocationPermission';
import { haversineKm, nearbyCountries, resolveCurrentCountry, type CountryResolution } from '../data/geo';
import { resolveNearestCity, type CityResolution } from '../data/cities';
import { WORLD_CATALOG, countryInfoOf } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';

interface LocationDebugInfo {
  browserLat: number;
  browserLng: number;
  accuracy: number;
  timestamp: number;
  // What was actually passed into resolveCurrentCountry() — captured
  // separately from the browser values above so a future divergence
  // between the two (a copy/mutation bug) would be visible here rather
  // than assumed away.
  resolverLat: number;
  resolverLng: number;
}

// The 4 countries this specific investigation is about (Eritrea/Yemen/
// Djibouti as candidates a nearest-centroid approach could plausibly have
// picked for a point near Abha, vs. Saudi Arabia itself). Fixed to exactly
// these 4 deliberately — this is a debug display for one investigation,
// not a general-purpose "distance to every country" feature.
const DEBUG_REFERENCE_COUNTRIES: { label: string; iso2: string }[] = [
  { label: 'Saudi Arabia', iso2: 'SA' },
  { label: 'Eritrea', iso2: 'ER' },
  { label: 'Yemen', iso2: 'YE' },
  { label: 'Djibouti', iso2: 'DJ' },
];

export function LocationPersonalize() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const loc = t.location;
  const { status, coords } = state.location;
  const { request } = useLocationRequest();

  const [searchParams] = useSearchParams();
  const debugEnabled = searchParams.get('debugLocation') === '1';

  const [resolution, setResolution] = useState<CountryResolution | undefined>(undefined);
  const [cityResolution, setCityResolution] = useState<CityResolution | undefined>(undefined);
  const [resolving, setResolving] = useState(false);
  const [debugInfo, setDebugInfo] = useState<LocationDebugInfo | null>(null);

  const handleRequest = useCallback(() => {
    setResolution(undefined);
    setCityResolution(undefined);
    setDebugInfo(null);
    request().then(async (geoResult) => {
      if (!geoResult.ok) return;
      const browserCoords = geoResult.coords;
      if (debugEnabled) {
        setDebugInfo({
          browserLat: browserCoords.lat,
          browserLng: browserCoords.lng,
          accuracy: geoResult.accuracy,
          timestamp: geoResult.timestamp,
          // Same object passed straight through below with no copy — this
          // is literally the resolver's input, not a re-derivation of it.
          resolverLat: browserCoords.lat,
          resolverLng: browserCoords.lng,
        });
      }
      setResolving(true);
      const result = await resolveCurrentCountry(browserCoords);
      setResolution(result);
      // City resolution only follows a real boundary match — compounding
      // it on top of the already-approximate centroid fallback would
      // stack two approximations, so that case stays country-only.
      if (result?.method === 'boundary') {
        const city = await resolveNearestCity(browserCoords, result.result.entry.countryCode);
        setCityResolution(city);
      }
      setResolving(false);
    });
  }, [request, debugEnabled]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'LOCATION_RESET' });
    setResolution(undefined);
    setCityResolution(undefined);
    setDebugInfo(null);
  }, [dispatch]);

  // Recomputed only when coords/resolution actually change, not on every
  // render. nearbyCountries() itself is unchanged by either Phase 12 fix —
  // still sync, still centroid-distance ranking, which is the correct tool
  // for "nearby". One extra candidate is fetched so removing the current
  // country (structurally, by countryCode — never by localized name)
  // still leaves the usual number of results.
  const nearby = useMemo(() => {
    if (!coords) return [];
    const candidates = nearbyCountries(coords, 7);
    const currentCode = resolution?.result.entry.countryCode;
    const filtered = currentCode ? candidates.filter((n) => n.entry.countryCode !== currentCode) : candidates;
    return filtered.slice(0, 6);
  }, [coords, resolution]);

  const debugDistances = useMemo(() => {
    if (!debugInfo) return [];
    const from = { lat: debugInfo.resolverLat, lng: debugInfo.resolverLng };
    return DEBUG_REFERENCE_COUNTRIES.map(({ label, iso2 }) => {
      const entry = WORLD_CATALOG.find((c) => c.countryCode === iso2);
      const info = entry ? countryInfoOf(entry.id) : undefined;
      const distanceKm = info ? haversineKm(from, info.latlng) : undefined;
      return { label, iso2, distanceKm };
    });
  }, [debugInfo]);

  const canRequest = status === 'idle' || status === 'denied' || status === 'unavailable' || status === 'timeout';
  // Permissions API pre-detection: while
  // still 'idle' (no real request attempted yet this session), a
  // browser-level 'denied' permission is shown proactively rather than
  // waiting for a doomed click to surface the same guidance a beat
  // later. Read-only — never fires the OS prompt itself, never skips
  // the CTA (the user may still click to retry after changing their
  // browser setting; requestBrowserLocation() decides the real outcome).
  const permission = useGeolocationPermission();
  // One message per terminal non-'granted' status; undefined while idle/requesting/granted.
  const statusMessage: string | undefined =
    status === 'idle' && permission === 'denied'
      ? loc.denied
      : {
          idle: undefined,
          requesting: loc.requesting,
          granted: undefined,
          denied: loc.denied,
          unavailable: loc.unavailable,
          timeout: loc.timeout,
          unsupported: loc.unsupported,
        }[status];

  return (
    <div className="detail-card">
      <h3>
        <Icon name="compass" size={18} /> {loc.title}
      </h3>
      <p>{loc.sub}</p>

      {canRequest ? (
        <button type="button" className="btn btn-gold btn-sm" style={{ marginTop: 10 }} onClick={handleRequest}>
          <Icon name="compass" size={15} /> {status === 'idle' ? loc.cta : loc.retry}
        </button>
      ) : null}

      {statusMessage ? <p style={{ marginTop: 10 }}>{statusMessage}</p> : null}
      {status === 'granted' && resolving ? <p style={{ marginTop: 10 }}>{loc.resolving}</p> : null}

      {status === 'granted' && resolution ? (
        <>
          {resolution.method === 'boundary' ? (
            <p style={{ marginTop: 10 }}>
              {loc.currentLocation}:{' '}
              {cityResolution ? (
                <>
                  📍 {lang === 'ar' ? cityResolution.city.nameAr : cityResolution.city.nameEn}
                  {lang === 'ar' ? '، ' : ', '}
                </>
              ) : null}
              <FlagChip dest={resolution.result.entry} width={20} height={15} /> {nameOf(resolution.result.entry, lang)}
            </p>
          ) : (
            <p style={{ marginTop: 10 }}>
              {loc.nearestCountry}: <FlagChip dest={resolution.result.entry} width={20} height={15} />{' '}
              {nameOf(resolution.result.entry, lang)}
            </p>
          )}
          {resolution.method === 'centroid-fallback' ? (
            <p style={{ marginTop: 6 }}>{loc.approxNote}</p>
          ) : null}
          <h3 style={{ marginTop: 16 }}>
            <Icon name="map" size={18} /> {loc.nearbyTitle}
          </h3>
          <div className="dest-meta">
            {nearby.map((n) => (
              <Link key={n.entry.id} to={`/destination/${n.entry.id}`} className="meta-chip">
                <FlagChip dest={n.entry} width={16} height={12} /> {nameOf(n.entry, lang)}
              </Link>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={handleReset}>
            {loc.reset}
          </button>
        </>
      ) : null}

      {debugEnabled && debugInfo ? (
        <div style={{ marginTop: 16, padding: 12, border: '1px dashed currentColor', fontSize: '0.82rem' }}>
          <strong>DEBUG — Location Debug</strong>
          <p style={{ marginTop: 8 }}>Browser latitude: {debugInfo.browserLat.toFixed(6)}</p>
          <p style={{ marginTop: 4 }}>Browser longitude: {debugInfo.browserLng.toFixed(6)}</p>
          <p style={{ marginTop: 4 }}>Accuracy: {Math.round(debugInfo.accuracy)} m</p>
          <p style={{ marginTop: 4 }}>Timestamp: {new Date(debugInfo.timestamp).toISOString()}</p>
          <p style={{ marginTop: 8 }}>Resolver latitude: {debugInfo.resolverLat.toFixed(6)}</p>
          <p style={{ marginTop: 4 }}>Resolver longitude: {debugInfo.resolverLng.toFixed(6)}</p>
          <p style={{ marginTop: 4 }}>
            Latitude match: {debugInfo.browserLat === debugInfo.resolverLat ? 'yes' : 'NO — MISMATCH'}
          </p>
          <p style={{ marginTop: 4 }}>
            Longitude match: {debugInfo.browserLng === debugInfo.resolverLng ? 'yes' : 'NO — MISMATCH'}
          </p>
          <p style={{ marginTop: 8 }}>Resolved country: {resolution ? nameOf(resolution.result.entry, 'en') : '—'}</p>
          <p style={{ marginTop: 4 }}>Resolution method: {resolution?.method ?? '—'}</p>
          <p style={{ marginTop: 4 }}>Resolved city: {cityResolution ? cityResolution.city.nameEn : 'none (country-only)'}</p>
          {debugDistances.map((d) => (
            <p key={d.iso2} style={{ marginTop: 4 }}>
              Distance to {d.label} centroid: {d.distanceKm !== undefined ? `${d.distanceKm.toFixed(1)} km` : 'n/a'}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
