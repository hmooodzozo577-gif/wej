// Phase 12 — the LocationPersonalize card: permission flow, status
// messages, nearby-country rendering, localization, that an excluded
// country never appears through it, and (this investigation) the
// ?debugLocation=1 diagnostic panel. Mocks requestBrowserLocation() itself
// (already covered against the real browser API shape in
// geo/geolocation.test.ts) — no real device location involved.
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

  it('on success, shows the nearest country and a nearby-countries list, none of them the excluded country', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));

    await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });

    for (const excluded of EXCLUDED_COUNTRIES) {
      const link = document.querySelector(`a[href="/destination/${excluded.iso2.toLowerCase()}"]`);
      expect(link, `found a nearby link to excluded ${excluded.iso2}`).toBeNull();
    }
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

  it('resolves the Abha regression case end-to-end: current country shown is Saudi Arabia, no approximation caveat (real boundary match)', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/Your current country/)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText('Saudi Arabia')).toBeInTheDocument();
    // A real boundary match — the approximation caveat is only for the
    // nearest-centroid fallback and must not appear here.
    expect(screen.queryByText(/approximate straight-line estimate/)).not.toBeInTheDocument();
  });

  it('Arabic localized country name is correct for the resolved current country', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
    renderWith('ar');
    fireEvent.click(screen.getByRole('button', { name: /استخدام موقعي/ }));
    await waitFor(() => expect(screen.getByText(/دولتك الحالية/)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText('المملكة العربية السعودية')).toBeInTheDocument();
  });

  it('never shows raw coordinates anywhere in the rendered output when debug mode is off', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(RIYADH_GEO_RESULT);
    renderWith('en'); // no ?debugLocation=1
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument(), { timeout: 5000 });
    expect(document.body.textContent).not.toMatch(/24\.7136/);
    expect(document.body.textContent).not.toMatch(/46\.6753/);
  });

  describe('?debugLocation=1 diagnostic panel', () => {
    it('is NOT shown without the query flag — normal production UI is unchanged', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/'); // no flag
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Your current country/)).toBeInTheDocument(), { timeout: 5000 });
      expect(screen.queryByText('DEBUG — Location Debug')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/18\.216400/);
    });

    it('is NOT shown for an unrelated or malformed query value', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=true'); // not exactly "1"
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText(/Your current country/)).toBeInTheDocument(), { timeout: 5000 });
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

    it('shows the resolved country and method, and distances to the 4 reference countries', async () => {
      vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(ABHA_GEO_RESULT);
      renderWith('en', '/?debugLocation=1');
      fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
      await waitFor(() => expect(screen.getByText('DEBUG — Location Debug')).toBeInTheDocument(), { timeout: 5000 });

      expect(screen.getByText('Resolved country: Saudi Arabia')).toBeInTheDocument();
      expect(screen.getByText('Resolution method: boundary')).toBeInTheDocument();
      expect(screen.getByText(/Distance to Saudi Arabia centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Eritrea centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Yemen centroid:/)).toBeInTheDocument();
      expect(screen.getByText(/Distance to Djibouti centroid:/)).toBeInTheDocument();
    });
  });
});
