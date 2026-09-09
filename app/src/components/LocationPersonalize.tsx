// Phase 12 — Location Personalization. A single self-contained card: a
// "Use My Location" action, permission/status feedback, and — once
// granted — the nearest catalog country (explicitly labeled approximate)
// plus a short row of nearby-country links. Reuses existing detail-card /
// meta-chip visual language; no new styling introduced.
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { requestBrowserLocation } from '../geo/geolocation';
import { approximateCountryOf, nearbyCountries } from '../data/geo';
import { nameOf } from '../data/destinationText';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';

export function LocationPersonalize() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const loc = t.location;
  const { status, coords } = state.location;

  const handleRequest = useCallback(() => {
    dispatch({ type: 'LOCATION_REQUEST' });
    requestBrowserLocation().then((result) => {
      if (result.ok) {
        dispatch({ type: 'LOCATION_GRANTED', coords: result.coords });
      } else {
        dispatch({ type: 'LOCATION_FAILED', status: result.status });
      }
    });
  }, [dispatch]);

  const handleReset = useCallback(() => dispatch({ type: 'LOCATION_RESET' }), [dispatch]);

  // Recomputed only when coords actually change, not on every render.
  const nearest = useMemo(() => (coords ? approximateCountryOf(coords) : undefined), [coords]);
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

      {status === 'granted' && nearest ? (
        <>
          <p style={{ marginTop: 10 }}>
            {loc.nearestCountry}: <FlagChip dest={nearest.entry} width={20} height={15} />{' '}
            {nameOf(nearest.entry, lang)}
          </p>
          <p style={{ marginTop: 6 }}>{loc.approxNote}</p>
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
