// requestBrowserLocation(): the browser Geolocation API is mocked directly
// (a Position/PositionError-shaped stub on navigator.geolocation), never a
// real device location.
//
// Item #6 rewrite: these tests previously pinned a SINGLE-attempt contract
// (exactly one getCurrentPosition call, timeout 15000, maximumAge 300000,
// enableHighAccuracy always false). That contract was the root cause of the
// user-reported "the location request took too long" failure — a coarse,
// network-positioning-only attempt has no fallback when the coarse provider
// never answers. The staged contract is pinned here instead, along with
// every invariant that survived unchanged (denied is never reported as a
// timeout; coordinates pass through with no rounding; nothing ever throws).
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

function positionError(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

function position(lat: number, lng: number, accuracy = 1, timestamp = 0): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy } as GeolocationCoordinates,
    timestamp,
  } as GeolocationPosition;
}

afterEach(() => {
  // Restore a plain, unset geolocation between tests.
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  vi.restoreAllMocks();
});

describe('requestBrowserLocation', () => {
  it('resolves with coords on success', async () => {
    const fixedTimestamp = 1_700_000_000_000;
    mockGeolocation({
      getCurrentPosition: (success) => success(position(24.7, 46.7, 35, fixedTimestamp)),
    });
    const result = await requestBrowserLocation();
    expect(result).toMatchObject({
      ok: true,
      coords: { lat: 24.7, lng: 46.7 },
      accuracy: 35,
      timestamp: fixedTimestamp,
    });
  });

  it('preserves accuracy and timestamp exactly as reported by the browser, with no rounding', async () => {
    const preciseTimestamp = 1_700_123_456_789;
    mockGeolocation({
      getCurrentPosition: (success) => success(position(18.216437, 42.505312, 12.5, preciseTimestamp)),
    });
    const result = await requestBrowserLocation();
    if (!result.ok) throw new Error('expected ok:true');
    expect(result.coords).toEqual({ lat: 18.216437, lng: 42.505312 });
    expect(result.accuracy).toBe(12.5);
    expect(result.timestamp).toBe(preciseTimestamp);
  });

  it('resolves with status "denied" on PERMISSION_DENIED', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(1)) });
    expect(await requestBrowserLocation()).toMatchObject({ ok: false, status: 'denied' });
  });

  it('resolves with status "timeout" when BOTH stages time out', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(3)) });
    expect(await requestBrowserLocation()).toMatchObject({ ok: false, status: 'timeout' });
  });

  it('resolves with status "unavailable" when BOTH stages report POSITION_UNAVAILABLE', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(2)) });
    expect(await requestBrowserLocation()).toMatchObject({ ok: false, status: 'unavailable' });
  });

  it('resolves with status "unsupported" when navigator.geolocation is absent', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    expect(await requestBrowserLocation()).toMatchObject({ ok: false, status: 'unsupported' });
  });

  it('never throws or rejects, regardless of outcome', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(999)) });
    await expect(requestBrowserLocation()).resolves.toBeDefined();
  });

  // --- Item #6: the staged contract -------------------------------------

  it('stage 1 asks for a fast coarse fix and accepts a recently cached one', async () => {
    let capturedOptions: PositionOptions | undefined;
    mockGeolocation({
      getCurrentPosition: (success, _error, options) => {
        capturedOptions = options;
        success(position(1, 1));
      },
    });
    await requestBrowserLocation();
    expect(capturedOptions?.enableHighAccuracy).toBe(false);
    expect(capturedOptions?.timeout).toBe(8000);
    expect(capturedOptions?.maximumAge).toBe(600000);
  });

  it('a stage-1 success makes exactly one getCurrentPosition call — no speculative second attempt', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position(1, 1)));
    mockGeolocation({ getCurrentPosition });
    await requestBrowserLocation();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('escalates to a high-accuracy second attempt after a stage-1 TIMEOUT, and succeeds on it', async () => {
    const seen: PositionOptions[] = [];
    let call = 0;
    mockGeolocation({
      getCurrentPosition: (success, error, options) => {
        if (options) seen.push(options);
        call += 1;
        if (call === 1) error?.(positionError(3));
        else success(position(21.5, 39.2, 8, 42));
      },
    });
    const result = await requestBrowserLocation();
    expect(call).toBe(2);
    expect(seen[0]?.enableHighAccuracy).toBe(false);
    expect(seen[1]?.enableHighAccuracy).toBe(true);
    expect(seen[1]?.timeout).toBe(20000);
    // Stage 2 must not reuse a cache stage 1 already failed to find.
    expect(seen[1]?.maximumAge).toBe(0);
    expect(result).toMatchObject({ ok: true, coords: { lat: 21.5, lng: 39.2 } });
  });

  it('escalates after a stage-1 POSITION_UNAVAILABLE too', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
      if (getCurrentPosition.mock.calls.length === 1) error?.(positionError(2));
      else success(position(2, 2));
    });
    mockGeolocation({ getCurrentPosition });
    const result = await requestBrowserLocation();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('never re-prompts after PERMISSION_DENIED — a denial is the user\'s answer, not a transport failure', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.(positionError(1));
    });
    mockGeolocation({ getCurrentPosition });
    const result = await requestBrowserLocation();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, status: 'denied' });
  });

  it('PERMISSION_DENIED resolves to "denied", distinct from "timeout" — permission denial is never reported as a timeout', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(1)) });
    const result = await requestBrowserLocation();
    expect(result).toMatchObject({ ok: false, status: 'denied' });
    expect(result).not.toMatchObject({ status: 'timeout' });
  });

  it('POSITION_UNAVAILABLE resolves to "unavailable", distinct from "timeout"', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(2)) });
    const result = await requestBrowserLocation();
    expect(result).toMatchObject({ ok: false, status: 'unavailable' });
    expect(result).not.toMatchObject({ status: 'timeout' });
  });

  // --- Item #6: the diagnostic, and what it must never contain -----------

  it('reports which phase and which stages were used, with no coordinates anywhere in the diagnostic', async () => {
    let call = 0;
    mockGeolocation({
      getCurrentPosition: (success, error) => {
        call += 1;
        if (call === 1) error?.(positionError(3));
        else success(position(24.7, 46.7, 35, 1));
      },
    });
    const result = await requestBrowserLocation();
    expect(result.diagnostic?.phase).toBe('browser');
    expect(result.diagnostic?.attempts.map((item) => [item.stage, item.outcome])).toEqual([
      [1, 'timeout'],
      [2, 'ok'],
    ]);
    const serialized = JSON.stringify(result.diagnostic);
    for (const forbidden of ['24.7', '46.7', 'lat', 'lng', 'latitude', 'longitude', 'accuracy', 'coords']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('records a failed final stage in the diagnostic rather than dropping it', async () => {
    mockGeolocation({ getCurrentPosition: (_success, error) => error?.(positionError(3)) });
    const result = await requestBrowserLocation();
    expect(result.diagnostic?.attempts).toHaveLength(2);
    expect(result.diagnostic?.attempts.every((item) => item.outcome === 'timeout')).toBe(true);
  });
});
