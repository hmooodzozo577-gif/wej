// Workstream C — LocationIntro: the app-wide first-visit "why we're
// asking" prompt. Mocks requestBrowserLocation() (already covered
// against the real browser API shape in geo/geolocation.test.ts) — no
// real device location anywhere in this file. Clears the persisted
// dismissal flag before each test so tests don't leak into each other
// via jsdom's shared localStorage.
import { useReducer, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { LocationIntro } from './LocationIntro';
import { LocationPersonalize } from './LocationPersonalize';
import type { Lang } from '../data/types';
import * as geolocationModule from '../geo/geolocation';

const DISMISSED_KEY = 'wejhaty.locationIntroDismissed';

function renderWith(lang: Lang = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <LocationIntro />
    </Providers>,
  );
}

const GRANTED_RESULT = { ok: true as const, coords: { lat: 24.7136, lng: 46.6753 }, accuracy: 20, timestamp: 0 };

describe('Phase 12/Workstream C — LocationIntro', () => {
  beforeEach(() => {
    localStorage.removeItem(DISMISSED_KEY);
    vi.restoreAllMocks();
  });
  afterEach(() => {
    localStorage.removeItem(DISMISSED_KEY);
  });

  it('shows the intro on a first visit (English)', () => {
    renderWith('en');
    expect(screen.getByText('Improve your destination suggestions')).toBeInTheDocument();
    expect(screen.getByText('Allow location')).toBeInTheDocument();
    expect(screen.getByText('Not now')).toBeInTheDocument();
  });

  it('shows the intro in Arabic', () => {
    renderWith('ar');
    expect(screen.getByText('حسّن اقتراحات وجهتك')).toBeInTheDocument();
    expect(screen.getByText('السماح بالموقع')).toBeInTheDocument();
    expect(screen.getByText('ليس الآن')).toBeInTheDocument();
  });

  it('never calls the browser Geolocation API merely by rendering — only after an explicit "Allow" click', () => {
    const spy = vi.spyOn(geolocationModule, 'requestBrowserLocation');
    renderWith('en');
    expect(spy).not.toHaveBeenCalled();
  });

  it('clicking "Allow" calls requestBrowserLocation exactly once and hides the intro', async () => {
    const spy = vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(GRANTED_RESULT);
    renderWith('en');
    fireEvent.click(screen.getByText('Allow location'));
    expect(spy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument());
  });

  it('clicking "Not now" never calls requestBrowserLocation and hides the intro immediately', () => {
    const spy = vi.spyOn(geolocationModule, 'requestBrowserLocation');
    renderWith('en');
    fireEvent.click(screen.getByText('Not now'));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument();
  });

  it('never nags again after "Not now" — a fresh mount (e.g. a route change) does not show it', () => {
    const { unmount } = renderWith('en');
    fireEvent.click(screen.getByText('Not now'));
    unmount();
    renderWith('en');
    expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument();
  });

  it('never nags again after "Allow" either — a fresh mount does not re-show it', async () => {
    vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(GRANTED_RESULT);
    const { unmount } = renderWith('en');
    fireEvent.click(screen.getByText('Allow location'));
    await waitFor(() => expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument());
    unmount();
    renderWith('en');
    expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument();
  });

  it('does not show at all if the dismissal flag is already set (simulates a returning visitor)', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    renderWith('en');
    expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument();
  });

  it('shares one request/state with Explore\'s LocationPersonalize (as they would side-by-side via RootLayout + /explore): "Allow" here updates the same global status Explore reads, with only ONE browser call total', async () => {
    const spy = vi.spyOn(geolocationModule, 'requestBrowserLocation').mockResolvedValue(GRANTED_RESULT);

    function Providers({ children }: { children: ReactNode }) {
      const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'en' as Lang });
      return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
    }

    render(
      <Providers>
        <LocationIntro />
        <MemoryRouter>
          <LocationPersonalize />
        </MemoryRouter>
      </Providers>,
    );

    // Explore's own control starts idle (its "Use My Location" button
    // is the intro's sibling here, both reading the same state.location).
    expect(screen.getByText('Use My Location')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Allow location'));

    // The shared status flips out of 'idle' immediately (synchronously,
    // before the mocked promise even resolves) — Explore's button
    // (only shown for idle/denied/unavailable/timeout) reacts to the
    // SAME dispatch, proving one shared piece of state, not two.
    expect(screen.queryByText('Use My Location')).not.toBeInTheDocument();

    // Give the mocked promise's .then chain a tick, then confirm exactly
    // one browser call happened in total — the point of this test (a
    // second, independent call from a competing component would show up
    // here as callCount > 1).
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });
});
