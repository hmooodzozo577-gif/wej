// Phase 12 — Location Personalization. A single self-contained card: a
// "Use My Location" action, permission/status feedback, and — once
// granted — the resolved current country plus a short row of
// nearby-country links. Reuses existing detail-card / meta-chip visual
// language; no new styling introduced.
//
// Phase 12 fix: current-country resolution now goes through
// resolveCurrentCountry() (real point-in-polygon, async — see data/geo.ts),
// not the old synchronous nearest-centroid call. The resolution result is
// local component state (not global app state): it's pure presentation
// derived from state.location.coords, doesn't need to survive route
// changes, and keeping it local avoids adding new reducer/action surface
// for what's fundamentally a render concern.
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { requestBrowserLocation } from '../geo/geolocation';
import { nearbyCountries, resolveCurrentCountry, type CountryResolution } from '../data/geo';
import { nameOf } from '../data/destinationText';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';

export function LocationPersonalize() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const loc = t.location;
  const { status, coords } = state.location;

  const [resolution, setResolution] = useState<CountryResolution | undefined>(undefined);
  const [resolving, setResolving] = useState(false);

  const handleRequest = useCallback(() => {
    dispatch({ type: 'LOCATION_REQUEST' });
    setResolution(undefined);
    requestBrowserLocation().then(async (geoResult) => {
      if (!geoResult.ok) {
        dispatch({ type: 'LOCATION_FAILED', status: geoResult.status });
        return;
      }
      dispatch({ type: 'LOCATION_GRANTED', coords: geoResult.coords });
      setResolving(true);
      const result = await resolveCurrentCountry(geoResult.coords);
      setResolution(result);
      setResolving(false);
    });
  }, [dispatch]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'LOCATION_RESET' });
    setResolution(undefined);
  }, [dispatch]);

  // Recomputed only when coords actually change, not on every render.
  // nearbyCountries() is unchanged by the Phase 12 fix — still sync,
  // still centroid-distance ranking, which is the correct tool for "nearby".
  const nearby = useMemo(() => (coords ? nearbyCountries(coords, 6) : []), [coords]);

  const canRequest = status === 'idle' || status === 'denied' || status === 'unavailable' || status === 'timeout';
  // One message per terminal non-'granted' status; undefined while idle/requesting/granted.
  const statusMessage: string | undefined = {
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
          <p style={{ marginTop: 10 }}>
            {resolution.method === 'boundary' ? loc.currentCountry : loc.nearestCountry}:{' '}
            <FlagChip dest={resolution.result.entry} width={20} height={15} /> {nameOf(resolution.result.entry, lang)}
          </p>
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
    </div>
  );
}
