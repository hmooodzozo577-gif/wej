// Location Permissions API pre-detection.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryGeolocationPermission } from './permissionsApi';

describe('queryGeolocationPermission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error test cleanup only
    delete navigator.permissions;
  });

  it('returns "unsupported" when navigator.permissions does not exist at all (this repo\'s real jsdom test default)', async () => {
    expect(await queryGeolocationPermission()).toBe('unsupported');
  });

  it('returns "granted" when the browser reports it, without ever calling geolocation', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'granted' });
    // @ts-expect-error test-only stub
    navigator.permissions = { query };
    const geoSpy = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: geoSpy } });
    expect(await queryGeolocationPermission()).toBe('granted');
    expect(geoSpy).not.toHaveBeenCalled();
  });

  it('returns "denied" when the browser reports it', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'denied' });
    // @ts-expect-error test-only stub
    navigator.permissions = { query };
    expect(await queryGeolocationPermission()).toBe('denied');
  });

  it('returns "prompt" when the browser reports it', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'prompt' });
    // @ts-expect-error test-only stub
    navigator.permissions = { query };
    expect(await queryGeolocationPermission()).toBe('prompt');
  });

  it('returns "unsupported" if query() rejects (e.g. an unrecognized permission name)', async () => {
    const query = vi.fn().mockRejectedValue(new Error('not supported'));
    // @ts-expect-error test-only stub
    navigator.permissions = { query };
    expect(await queryGeolocationPermission()).toBe('unsupported');
  });

  it('queries the "geolocation" permission name specifically', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'prompt' });
    // @ts-expect-error test-only stub
    navigator.permissions = { query };
    await queryGeolocationPermission();
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
  });
});
