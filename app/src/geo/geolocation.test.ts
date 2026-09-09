// Phase 12 — requestBrowserLocation(): the browser Geolocation API is
// mocked directly (a Position/PositionError-shaped stub on
// navigator.geolocation), never a real device location.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBrowserLocation } from './geolocation';

function mockGeolocation(impl: {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void;
}) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl,
  });
}

afterEach(() => {
  // Restore a plain, unset geolocation between tests.
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  vi.restoreAllMocks();
});

describe('Phase 12 — requestBrowserLocation', () => {
  it('resolves with coords on success', async () => {
    mockGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 24.7, longitude: 46.7 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    });
    const result = await requestBrowserLocation();
    expect(result).toEqual({ ok: true, coords: { lat: 24.7, lng: 46.7 } });
  });

  it('resolves with status "denied" on PERMISSION_DENIED', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    });
    expect(await requestBrowserLocation()).toEqual({ ok: false, status: 'denied' });
  });

  it('resolves with status "timeout" on TIMEOUT', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    });
    expect(await requestBrowserLocation()).toEqual({ ok: false, status: 'timeout' });
  });

  it('resolves with status "unavailable" on POSITION_UNAVAILABLE', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    });
    expect(await requestBrowserLocation()).toEqual({ ok: false, status: 'unavailable' });
  });

  it('resolves with status "unsupported" when navigator.geolocation is absent', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    expect(await requestBrowserLocation()).toEqual({ ok: false, status: 'unsupported' });
  });

  it('never throws or rejects, regardless of outcome', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 999, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as unknown as GeolocationPositionError);
      },
    });
    await expect(requestBrowserLocation()).resolves.toBeDefined();
  });
});
