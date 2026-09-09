// Phase 12 — the LocationPersonalize card: permission flow, status
// messages, nearby-country rendering (with the current country correctly
// excluded), city-level location display, localization, that an excluded
// country never appears through it, and the ?debugLocation=1 diagnostic
// panel. Mocks requestBrowserLocation() itself (already covered against
// the real browser API shape in geo/geolocation.test.ts) — no real device
// location involved anywhere in this file.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { LocationPersonalize } from './LocationPersonalize';
import type { Lang } from '../data/types';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';
import * as geolocationModule from '../geo/geolocation';

function renderWith(lang: Lang, path = '/') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <LocationPersonalize />
      </MemoryRouter>
    </Providers>,
  );
}

const ABHA_GEO_RESULT = {
  ok: true as const,
  coords: { lat: 18.2164, lng: 42.5053 },
  accuracy: 35,
  timestamp: 1_700_000_000_000,
};
const RIYADH_GEO_RESULT = {
  ok: true as const,
  coords: { lat: 24.7136, lng: 46.6753 },
  accuracy: 20,
  timestamp: 1_700_000_000_000,
};
const JEDDAH_GEO_RESULT = { ok: true as const, coords: { lat: 21.4858, lng: 39.1925 }, accuracy: 20, timestamp: 0 };
const PARIS_GEO_RESULT = { ok: true as const, coords: { lat: 48.8566, lng: 2.3522 }, accuracy: 20, timestamp: 0 };
const TOKYO_GEO_RESULT = { ok: true as const, coords: { lat: 35.6762, lng: 139.6503 }, accuracy: 20, timestamp: 0 };
// Open Pacific — no country polygon match, no nearby city; exercises the
// centroid-fallback path where city resolution is skipped entirely.
const OPEN_OCEAN_GEO_RESULT = { ok: true as const, coords: { lat: 0, lng: -160 }, accuracy: 20, timestamp: 0 };

describe('Phase 12 — LocationPersonalize', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the initial call-to-action before anything is requested (Arabic)', () => {
    renderWith('ar');
    expect(screen.getByRole('button', { name: /استخدام موقعي/ })).toBeInTheDocument();
  });

  it('shows the initial call-to-action in English', () => {
    renderWith('en');
    expect(screen.getByRole('button', { name: /Use My Location/ })).toBeInTheDocument();
  });

  it('shows the denied message and lets the user retry, without breaking anything else', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue({ ok: false, status: 'denied' });
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/Location permission was denied/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Try Again/ })).toBeInTheDocument();
  });

  it('shows the unsupported message and no request button when geolocation is unavailable in the browser', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue({ ok: false, status: 'unsupported' });
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/does not support location services/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Try Again/ })).not.toBeInTheDocument();
  });

  it('never shows raw coordinates anywhere in the rendered output when debug mode is off', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
    renderWith('en'); // no ?debugLocation=1
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
    expect(document.body.textContent).not.toMatch(/24\.7136/);
    expect(document.body.textContent).not.toMatch(/46\.6753/);
  });

  describe('city-level location display (issue 2)', () => {
    it('Abha resolves to "📍 Abha, Saudi Arabia" in English', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      // Wait for the city pin itself, not just the "Current location" label
      // — country resolution finishes slightly before city resolution, so
      // waiting on the label alone can catch the brief country-only render.
      await waitFor(() => expect(screen.getByText(/📍 Abha, /)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByText(/Current location/).closest('p')?.textContent).toContain('Saudi Arabia');
    });

    it('Abha resolves to the exact Arabic wording "موقعك الحالي: 📍 أبها، المملكة العربية السعودية"', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('ar');
      fireEvent.click(screen.getByRole('button', { name: /استخدام موقعي/ }));
      await waitFor(() => expect(screen.getByText(/📍 أبها، /)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByText(/موقعك الحالي/).closest('p')?.textContent).toContain('المملكة العربية السعودية');
    });

    it('is NOT hardcoded to Abha — a different city (Jeddah) resolves correctly too', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(JEDDAH_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/📍 Jeddah, /)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.queryByText(/📍 Abha/)).not.toBeInTheDocument();
    });

    it('resolves a French city for Paris coordinates', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(PARIS_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/📍 Paris, /)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByText(/Current location/).closest('p')?.textContent).toContain('France');
    });

    it('resolves a Japanese city for Tokyo coordinates', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(TOKYO_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/📍 Tokyo, /)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByText(/Current location/).closest('p')?.textContent).toContain('Japan');
    });

    it('falls back to country-only display when no boundary match exists (open ocean) — no bogus city, no approximation caveat contradiction', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(OPEN_OCEAN_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
      // Centroid-fallback path: no city pin at all.
      expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
    });
  });

  describe('current country excluded from nearby countries (issue 1)', () => {
    it('Saudi Arabia does not appear in the nearby list when it is the current country', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
      expect(document.querySelector('a[href="/destination/ksa"]')).toBeNull();
    });

    it('France does not appear in the nearby list when it is the current country', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(PARIS_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
      expect(document.querySelector('a[href="/destination/france"]')).toBeNull();
    });

    it('Japan does not appear in the nearby list when it is the current country', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(TOKYO_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
      expect(document.querySelector('a[href="/destination/japan"]')).toBeNull();
    });

    it('the exclusion is independent of language — still excluded in Arabic, filtered by code not by localized name', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
      renderWith('ar');
      fireEvent.click(screen.getByRole('button', { name: /استخدام موقعي/ }));
      await waitFor(() => expect(screen.getByText(/الدول القريبة/)).toBeInTheDocument(), { timeout: 5000 });
      expect(document.querySelector('a[href="/destination/ksa"]')).toBeNull();
    });

    it('none of the visible nearby countries is ever the excluded country (independent of the current-country fix)', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
      renderWith('en');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
      for (const excluded of EXCLUDED_COUNTRIES) {
        const link = document.querySelector(`a[href="/destination/${excluded.iso2.toLowerCase()}"]`);
        expect(link, `found a nearby link to excluded ${excluded.iso2}`).toBeNull();
      }
    });
  });

  describe('?debugLocation=1 diagnostic panel', () => {
    it('is NOT shown without the query flag — normal production UI is unchanged', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/'); // no flag
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Current location/)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.queryByText('DEBUG — Location Debug')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/18\.216400/);
    });

    it('is NOT shown for an unrelated or malformed query value', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=true'); // not exactly "1"
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Current location/)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.queryByText('DEBUG — Location Debug')).not.toBeInTheDocument();
    });

    it('IS shown when ?debugLocation=1 is present, with the exact browser lat/lng/accuracy/timestamp, undistorted (6+ decimal places, no rounding)', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=1');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText('DEBUG — Location Debug')).toBeInTheDocument(), { timeout: 5000 });

      expect(screen.getByText('Browser latitude: 18.216400')).toBeInTheDocument();
      expect(screen.getByText('Browser longitude: 42.505300')).toBeInTheDocument();
      expect(screen.getByText('Accuracy: 35 m')).toBeInTheDocument();
      expect(screen.getByText(new Date(ABHA_GEO_RESULT.timestamp).toISOString(), { exact: false })).toBeInTheDocument();
    });

    it('shows resolver input identical to the browser values (no coordinate swap, no mutation)', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=1');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText('DEBUG — Location Debug')).toBeInTheDocument(), { timeout: 5000 });

      expect(screen.getByText('Resolver latitude: 18.216400')).toBeInTheDocument();
      expect(screen.getByText('Resolver longitude: 42.505300')).toBeInTheDocument();
      expect(screen.getByText('Latitude match: yes')).toBeInTheDocument();
      expect(screen.getByText('Longitude match: yes')).toBeInTheDocument();
    });

    it('shows the resolved country, method, resolved city, and distances to the 4 reference countries', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=1');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      // Wait for the resolved-city line specifically — it's set after both
      // country AND city resolution finish, so waiting on it (rather than
      // the debug panel's mere presence) avoids the same country-resolves-
      // before-city race as the display tests above.
      await waitFor(() => expect(screen.getByText('Resolved city: Abha')).toBeInTheDocument(), { timeout: 5000 });

      expect(screen.getByText('Resolved country: Saudi Arabia')).toBeInTheDocument();
      expect(screen.getByText('Resolution method: boundary')).toBeInTheDocument();
      expect(screen.getByText(/Distance to Saudi Arabia centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Eritrea centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Yemen centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Djibouti centroid:/)).toBeInTheDocument();
    });
  });
});
