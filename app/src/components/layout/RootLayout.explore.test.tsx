// Acceptance fix — production screenshot showed TWO location-request
// surfaces stacked on /explore: the app-wide LocationIntro ("حسّن اقتراحات
// وجهتك" / "استخدام موقعي الآن", mounted once in RootLayout for every
// route) and Explore's own LocationPersonalize ("التخصيص حسب الموقع" /
// "استخدام موقعي"). Both are legitimate components used correctly
// elsewhere — the bug was mounting BOTH on the same page. Explore already
// owns a full location surface (resolution, nearby countries, retry), so
// RootLayout now excludes LocationIntro on /explore only; every other
// route is unaffected (see RootLayout.tsx).
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateContext } from '../../state/context';
import { appReducer, initialAppState } from '../../state/reducer';
import type { AppState, LocationStatus } from '../../state/types';
import { RootLayout } from './RootLayout';
import { Explore } from '../../routes/Explore';
import { Home } from '../../routes/Home';

// RootLayout mounts Header -> ThemeSwitch, which reads matchMedia — stub it
// so this file can render the real layout rather than reimplementing it.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderAt(path: string, status: LocationStatus) {
  const initialState: AppState = { ...initialAppState, lang: 'en', location: { status, coords: null, diagnostic: null } };
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

// LocationIntro's own "Allow" CTA text is stable across every non-terminal
// status it renders for (idle/timeout/unavailable); LocationPersonalize's
// button text switches between "Use My Location" (idle) and "Try Again"
// (denied/unavailable/timeout) — both are counted as "a location CTA".
function countLocationCtas() {
  const introCtas = [
    ...screen.queryAllByText('Allow location'),
    ...screen.queryAllByText('Try again'),
  ];
  const personalizeCtas = [
    ...screen.queryAllByText('Use My Location'),
    ...screen.queryAllByText('Try Again'),
  ];
  return introCtas.length + personalizeCtas.length;
}

describe('Explore location request — exactly one surface, not two', () => {
  it.each<LocationStatus>(['idle', 'requesting', 'granted', 'denied', 'unavailable'])(
    'status=%s: LocationIntro never renders on /explore, only LocationPersonalize',
    (status) => {
      renderAt('/explore', status);
      // LocationIntro's own unique heading text — must never appear here.
      expect(screen.queryByText('Improve your destination suggestions')).not.toBeInTheDocument();
      // LocationPersonalize's own unique heading — must always be mounted
      // (it renders its own status-appropriate body/CTA/message internally).
      expect(screen.getByText('Location Personalization')).toBeInTheDocument();
    },
  );

  it('idle: exactly ONE actionable location CTA is visible on /explore', () => {
    renderAt('/explore', 'idle');
    expect(countLocationCtas()).toBe(1);
    expect(screen.getByText('Use My Location')).toBeInTheDocument();
  });

  it('requesting: no actionable CTA (request already in flight), still only one surface', () => {
    renderAt('/explore', 'requesting');
    expect(countLocationCtas()).toBe(0);
  });

  it('denied: exactly one retry CTA from LocationPersonalize, no second ask from LocationIntro', () => {
    renderAt('/explore', 'denied');
    expect(countLocationCtas()).toBe(1);
  });

  it('unavailable: exactly one retry CTA', () => {
    renderAt('/explore', 'unavailable');
    expect(countLocationCtas()).toBe(1);
  });

  it('other routes are unaffected — LocationIntro still mounts on Home', () => {
    renderAt('/', 'idle');
    expect(screen.getByText('Improve your destination suggestions')).toBeInTheDocument();
  });
});
