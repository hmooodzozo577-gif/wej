import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.example');
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('anonymous product data client', () => {
  it('sends anonymous session/device context without exact coordinates', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendProductEvent } = await import('./productDataClient');

    await sendProductEvent('page_view', { theme: 'dark' }, { path: '/explore', locale: 'ar' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body.sessionId).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
    expect(body.properties).toEqual({ theme: 'dark' });
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude|fingerprint/i);
  });

  it('refuses to send properties containing precise coordinates', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { sendProductEvent } = await import('./productDataClient');

    const sent = await sendProductEvent('location_permission', { latitude: 24.7 }, { path: '/', locale: 'ar' });

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
