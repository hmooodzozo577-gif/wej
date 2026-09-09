// Phase 12 — requestBrowserLocation(): the browser Geolocation API is
// mocked directly (a Position/PositionError-shaped stub on
// navigator.geolocation), never a real device location.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBrowserLocation } from './geolocation';

function mockGeolocation(impl: {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions,
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
    const fixedTimestamp = 1_700_000_000_000;
    mockGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 24.7, longitude: 46.7, accuracy: 35 } as GeolocationCoordinates,
          timestamp: fixedTimestamp,
        } as GeolocationPosition);
      },
    });
    const result = await requestBrowserLocation();
    expect(result).toEqual({
      ok: true,
      coords: { lat: 24.7, lng: 46.7 },
      accuracy: 35,
      timestamp: fixedTimestamp,
    });
  });

  it('preserves accuracy and timestamp exactly as reported by the browser, with no rounding', async () => {
    const preciseTimestamp = 1_700_123_456_789;
    mockGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 18.216437, longitude: 42.505312, accuracy: 12.5 } as GeolocationCoordinates,
          timestamp: preciseTimestamp,
        } as GeolocationPosition);
      },
    });
    const result = await requestBrowserLocation();
    if (!result.ok) throw new Error('expected ok:true');
    expect(result.coords).toEqual({ lat: 18.216437, lng: 42.505312 });
    expect(result.accuracy).toBe(12.5);
    expect(result.timestamp).toBe(preciseTimestamp);
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

  // Bug fix: real-device TIMEOUT failures on /explore, root-caused to
  // timeout: 10000 + maximumAge: 0 in the PositionOptions passed to
  // getCurrentPosition(). These tests pin the exact options going forward
  // so a regression back to the old values is caught immediately.
  it('passes timeout: 15000 to getCurrentPosition (was 10000)', async () => {
    let capturedOptions: PositionOptions | undefined;
    mockGeolocation({
      getCurrentPosition: (success, _error, options) => {
        capturedOptions = options;
        success({
          coords: { latitude: 1, longitude: 1, accuracy: 1 } as GeolocationCoordinates,
          timestamp: 0,
        } as GeolocationPosition);
      },
    });
    await requestBrowserLocation();
    expect(capturedOptions?.timeout).toBe(15000);
  });

  it('passes maximumAge: 300000 (5 minutes) to getCurrentPosition (was 0 — no cached fix ever accepted)', async () => {
    let capturedOptions: PositionOptions | undefined;
    mockGeolocation({
      getCurrentPosition: (success, _error, options) => {
        capturedOptions = options;
        success({
          coords: { latitude: 1, longitude: 1, accuracy: 1 } as GeolocationCoordinates,
          timestamp: 0,
        } as GeolocationPosition);
      },
    });
    await requestBrowserLocation();
    expect(capturedOptions?.maximumAge).toBe(300000);
  });

  it('does not request high accuracy — this implementation uses network/Wi-Fi positioning, not GPS, so no high-accuracy-then-relaxed retry applies', async () => {
    let capturedOptions: PositionOptions | undefined;
    mockGeolocation({
      getCurrentPosition: (success, _error, options) => {
        capturedOptions = options;
        success({
          coords: { latitude: 1, longitude: 1, accuracy: 1 } as GeolocationCoordinates,
          timestamp: 0,
        } as GeolocationPosition);
      },
    });
    await requestBrowserLocation();
    expect(capturedOptions?.enableHighAccuracy).toBe(false);
  });

  it('a single call makes exactly one getCurrentPosition call, never a retry loop of its own', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 1, longitude: 1, accuracy: 1 } as GeolocationCoordinates,
        timestamp: 0,
      } as GeolocationPosition);
    });
    mockGeolocation({ getCurrentPosition });
    await requestBrowserLocation();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('PERMISSION_DENIED resolves to "denied", distinct from "timeout" — permission denial is never reported as a timeout', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    });
    const result = await requestBrowserLocation();
    expect(result).toEqual({ ok: false, status: 'denied' });
    expect(result).not.toMatchObject({ status: 'timeout' });
  });

  it('POSITION_UNAVAILABLE resolves to "unavailable", distinct from "timeout"', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    });
    const result = await requestBrowserLocation();
    expect(result).toEqual({ ok: false, status: 'unavailable' });
    expect(result).not.toMatchObject({ status: 'timeout' });
  });
});
