// Phase 13.6 — Full Travel Integration. Renders on the destination detail
// page (Destination.tsx), reusing everything Phase 12/13 already built:
// geo.ts's resolveCurrentCountry() for the origin country, this same
// module's resolveTravelSearchRequest()/searchFlights()/estimateFlight()
// (app/src/travel/ — the ONLY authorized entry points; no provider SDK,
// no Worker URL, no Amadeus type is imported here or anywhere in this
// file), and worldCatalog's countryInfoOf() for the destination centroid.
//
// SAFE FALLBACK (mandatory): whenever a real Worker search doesn't
// produce a usable offer — Worker not configured, network/timeout
// failure, no airport resolved, or genuinely no offers — this component
// shows flightEstimate.ts's deterministic, offline distance/duration
// estimate instead. It NEVER shows a fabricated price or invents a
// ticket; the only "price" ever rendered comes from a real, shape-
// validated searchFlights() 'ok' result.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { resolveCurrentCountry } from '../data/geo';
import { countryInfoOf } from '../data/worldCatalog';
import { resolveTravelSearchRequest } from '../travel/resolveTravelRequest';
import { estimateFlight, searchFlights } from '../travel/travelService';
import type { FlightOffer } from '../travel/types';
import type { CatalogEntry } from '../data/types';
import { Icon } from './Icon';

// A fixed, deterministic lookahead — this app has no date picker (Phase
// 13.6 is explicitly "no UI overhaul"), so a single representative future
// date is used for the search parameters. Not fabricated flight data —
// only a search INPUT, same role a date picker's default value would
// play.
const DEPARTURE_LOOKAHEAD_DAYS = 30;

function defaultDepartureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEPARTURE_LOOKAHEAD_DAYS);
  return d.toISOString().slice(0, 10);
}

type TravelInfoState =
  | { kind: 'loading' }
  | { kind: 'estimate'; distanceKm: number; durationMinutes: number }
  | { kind: 'offer'; offer: FlightOffer }
  | { kind: 'none' };

function formatDuration(minutes: number, unit: { h: string; m: string }): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}${unit.h} ${m}${unit.m}`;
}

export function TravelInfo({ destination }: { destination: CatalogEntry }) {
  const { state } = useAppState();
  const { t } = useI18n();
  const tt = t.travel;
  const { status, coords } = state.location;

  const [info, setInfo] = useState<TravelInfoState>({ kind: 'loading' });

  useEffect(() => {
    if (status !== 'granted' || !coords) return;

    let cancelled = false;
    setInfo({ kind: 'loading' });

    (async () => {
      const originResolution = await resolveCurrentCountry(coords);
      if (cancelled) return;
      if (!originResolution) {
        setInfo({ kind: 'none' });
        return;
      }
      const originCountryCode = originResolution.result.entry.countryCode;

      // A domestic "flight" to one's own country isn't a meaningful
      // travel-estimate case here — skip rather than show a zero-ish or
      // confusing result.
      if (originCountryCode === destination.countryCode) {
        setInfo({ kind: 'none' });
        return;
      }

      const request = await resolveTravelSearchRequest({
        originCoords: coords,
        originCountryCode,
        destination,
        departureDate: defaultDepartureDate(),
        passengers: 1,
      });
      if (cancelled) return;

      if (request) {
        const result = await searchFlights(request);
        if (cancelled) return;
        if (result.status === 'ok' && result.offers.length > 0) {
          setInfo({ kind: 'offer', offer: result.offers[0]! });
          return;
        }
        // status is 'invalid_request' | 'unavailable' | 'error', or 'ok'
        // with zero offers — every one of these falls through to the
        // offline estimate below, never to a fabricated offer.
      }

      // Fallback: a straight-line distance/duration estimate between the
      // real origin coordinates and the destination's own centroid
      // (countryInfoOf — the same country-info lookup CountryInfoCard
      // already uses on this page, not a new data source).
      const destinationInfo = countryInfoOf(destination.id);
      if (!destinationInfo) {
        setInfo({ kind: 'none' });
        return;
      }
      setInfo({ kind: 'estimate', ...estimateFlight(coords, destinationInfo.latlng) });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, coords?.lat, coords?.lng, destination.id]);

  if (status !== 'granted' || !coords) {
    return (
      <div className="detail-card travel-card">
        <h3>
          <Icon name="map" size={18} /> {tt.title}
        </h3>
        <p>
          {tt.needLocation}{' '}
          <Link to="/explore" className="meta-chip">
            {tt.setLocationCta}
          </Link>
        </p>
      </div>
    );
  }

  if (info.kind === 'none') return null;

  return (
    <div className="detail-card travel-card">
      <h3>
        <Icon name="map" size={18} /> {tt.title}
      </h3>
      {info.kind === 'loading' ? <p>{tt.loading}</p> : null}
      {info.kind === 'estimate' ? (
        <>
          <div className="info-grid">
            <div className="info-item">
              <div className="label">{tt.distanceLabel}</div>
              <div className="value">{info.distanceKm.toLocaleString('en-US')} {tt.distanceUnit}</div>
            </div>
            <div className="info-item">
              <div className="label">{tt.durationLabel}</div>
              <div className="value">{formatDuration(info.durationMinutes, tt.durationUnit)}</div>
            </div>
          </div>
          <p style={{ marginTop: 8 }}>{tt.estimateNote}</p>
        </>
      ) : null}
      {info.kind === 'offer' ? (
        <>
          <div className="info-grid">
            <div className="info-item">
              <div className="label">{tt.priceLabel}</div>
              <div className="value">
                {info.offer.price.amount.toLocaleString('en-US')} {info.offer.price.currency}
              </div>
            </div>
            <div className="info-item">
              <div className="label">{tt.durationLabel}</div>
              <div className="value">{formatDuration(info.offer.durationMinutes, tt.durationUnit)}</div>
            </div>
            <div className="info-item">
              <div className="label">{tt.stopsLabel}</div>
              <div className="value">{info.offer.stops === 0 ? tt.nonStop : info.offer.stops}</div>
            </div>
          </div>
          <p style={{ marginTop: 8 }}>{tt.offerFoundNote}</p>
        </>
      ) : null}
    </div>
  );
}
