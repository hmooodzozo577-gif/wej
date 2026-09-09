// Phase 12 — the LocationPersonalize card: permission flow, status
// messages, nearby-country rendering, localization, and that an excluded
// country never appears through it. Mocks requestBrowserLocation() itself
// (already covered against the real browser API shape in geo/geolocation.test.ts) —
// no real device location involved.
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

function renderWith(lang: Lang) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <LocationPersonalize />
      </MemoryRouter>
    </Providers>,
  );
}

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
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue({
      ok: true,
      coords: { lat: 24.7136, lng: 46.6753 }, // Riyadh
    });
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));

    await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument());

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

  it('never shows raw coordinates anywhere in the rendered output', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue({
      ok: true,
      coords: { lat: 24.7136, lng: 46.6753 },
    });
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: /Use My Location/ }));
    await waitFor(() => expect(screen.getByText(/Nearby countries/)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/24\.7136/);
    expect(document.body.textContent).not.toMatch(/46\.6753/);
  });
});
