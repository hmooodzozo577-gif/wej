// Workstream C — Global Location Personalization: a lightweight,
// app-wide, first-visit "why we're asking" prompt, mounted once in
// RootLayout so it's reachable from every route — not just Explore
// (Phase 12's LocationPersonalize.tsx, which remains untouched in
// purpose and UNREMOVED — see that file). This is deliberately a
// SEPARATE, smaller component: LocationPersonalize is the full
// card (resolution, nearby countries, retry, debug panel);
// LocationIntro is only ever the two-button "Allow / Not now" ask,
// and only while state.location.status is still 'idle' (nothing has
// been asked yet this session, on the shared global location state —
// see state/useLocationRequest.ts).
//
// CRITICAL: never calls the browser Geolocation API on its own mount —
// only requestBrowserLocation() (via useLocationRequest(), the SAME
// hook LocationPersonalize now also uses) after the user explicitly
// clicks "Allow". No OS permission dialog fires before this in-app
// explanation is shown.
//
// Coordinates and permission status remain in memory only. The intro is
// dismissed for the current page session, then returns on a later visit so a
// previous "Not now" choice cannot permanently prevent proximity features.
//
// Permissions API pre-detection
// (geo/permissionsApi.ts / geo/useGeolocationPermission.ts) is now used
// here: read-only, never fires the OS prompt itself, and never changes
// WHEN a real geolocation request may fire (still only on an explicit
// click) — it only lets the copy stop being misleading when the browser
// already reports 'granted' (skips the "why we're asking" pitch) or
// 'denied' (skips a doomed "Allow" click, shows guidance instead).
// 'prompt' and 'unsupported' render the ORIGINAL, unchanged ask.
//
// KNOWN LIMITATION (accepted, documented rather than silently
// omitted): if a user grants location via Explore's OWN control
// without ever touching this intro, that persists nothing here — a
// later fresh page load may show the intro once more. Clicking
// "Allow" at that point resolves instantly (the browser already has a
// standing grant, so no OS dialog fires again) or the user can click
// "Not now" once to stop seeing it — low friction either way, and
// avoids this component needing an effect that re-derives its own
// dismissal from a value (state.location.status) that already
// independently controls whether it renders at all (see the plain,
// non-state-setting persistence call in the render body below instead
// of a useEffect + setState round-trip for the same fact).
import { useState } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { useLocationRequest } from '../state/useLocationRequest';
import { useGeolocationPermission } from '../geo/useGeolocationPermission';

export function LocationIntro() {
  const { state } = useAppState();
  const { t } = useI18n();
  const li = t.locationIntro;
  const { request } = useLocationRequest();
  const [dismissed, setDismissed] = useState(false);
  // Permissions API pre-detection
  // (geo/permissionsApi.ts). Read-only: never triggers the OS prompt on
  // its own, so this can safely run every time this card would render.
  // 'prompt' and 'unsupported' fall through to the EXACT existing
  // ask/copy below, unchanged.
  const permission = useGeolocationPermission();

  // Item #6 — a recoverable failure (the browser never produced a fix) must
  // not permanently remove the only app-wide way to ask again. Before this,
  // a single timeout left status stuck on 'timeout', this component bailed
  // out on `status !== 'idle'`, and Explore's own card was the ONLY retry
  // affordance left anywhere in the app. 'denied' and 'unsupported' stay
  // excluded: re-asking cannot change either of those.
  const isRecoverableFailure = state.location.status === 'timeout' || state.location.status === 'unavailable';
  if (dismissed || (state.location.status !== 'idle' && !isRecoverableFailure)) return null;

  const handleAllow = () => {
    setDismissed(true);
    request();
  };

  const handleNotNow = () => {
    setDismissed(true);
  };

  // DENIED: a doomed "Allow" click is never offered — non-technical
  // guidance instead, still dismissible, never blocking the rest of the
  // app (Section 66/67).
  if (isRecoverableFailure) {
    return (
      <div className="location-intro-wrap">
        <div className="location-intro detail-card" role="region" aria-label={li.retryTitle}>
          <strong>{li.retryTitle}</strong>
          <p style={{ marginTop: 6 }}>{li.retryBody}</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-gold btn-sm" onClick={handleAllow}>
              {li.retryCta}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleNotNow}>
              {li.notNow}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="location-intro-wrap">
        <div className="location-intro detail-card" role="region" aria-label={li.title}>
          <p>{li.deniedNote}</p>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleNotNow}>
              {li.notNow}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GRANTED: the browser already allows this site to use location — the
  // "why we're asking" pitch would be misleading here. Still requires an
  // explicit click before any real geolocation call (Section 66:
  // "never call geolocation automatically merely because state is
  // granted") — only the copy changes, not the interaction model.
  const isAlreadyGranted = permission === 'granted';

  return (
    <div className="location-intro-wrap">
      <div className="location-intro detail-card" role="region" aria-label={li.title}>
        <strong>{li.title}</strong>
        <p style={{ marginTop: 6 }}>{isAlreadyGranted ? li.alreadyGrantedBody : li.body}</p>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-gold btn-sm" onClick={handleAllow}>
            {isAlreadyGranted ? li.alreadyGrantedCta : li.allow}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleNotNow}>
            {li.notNow}
          </button>
        </div>
      </div>
    </div>
  );
}
