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

  describe('write timeout (Security Pass 2, E1)', () => {
    const context = { path: '/explore', locale: 'en' as const };
    const rating = { kind: 'results' as const, overallScore: 4 };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the answer, and a completed write is never aborted afterwards', async () => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Response(JSON.stringify({ saved: true }), { status: 201 });
      });
      vi.stubGlobal('fetch', fetchMock);
      const { submitRating, WRITE_TIMEOUT_MS } = await import('./productDataClient');

      await expect(submitRating(rating, context)).resolves.toEqual({ ok: true, data: { saved: true } });
      expect(signal).toBeInstanceOf(AbortSignal);
      // The timeout was cleared with the answer: running past it aborts nothing.
      await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS * 2);
      expect(signal!.aborted).toBe(false);
    });

    it('reports a network failure or an error status as not ok', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
      let client = await import('./productDataClient');
      await expect(client.submitRating(rating, context)).resolves.toEqual({ ok: false });

      vi.resetModules();
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })));
      client = await import('./productDataClient');
      await expect(client.submitRating(rating, context)).resolves.toEqual({ ok: false, data: { error: 'rate_limited' } });
    });

    it('aborts a write the Worker never answers after the timeout', async () => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })));
      const { submitFeedback, WRITE_TIMEOUT_MS } = await import('./productDataClient');
      expect(WRITE_TIMEOUT_MS).toBe(15_000);

      let settled: unknown = 'pending';
      const pending = submitFeedback({ type: 'bug', message: 'Something is off.' }, context).then((value) => { settled = value; });
      await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS - 1);
      expect(settled).toBe('pending');
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(signal?.aborted).toBe(true);
      expect(settled).toEqual({ ok: false });
    });

    it('lets the traveller retry after a timeout, with a fresh request that can succeed', async () => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      let call = 0;
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init!.signal!);
        call += 1;
        if (call === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          });
        }
        return Promise.resolve(new Response(JSON.stringify({ saved: true, referenceId: 'WJH-1' }), { status: 201 }));
      });
      vi.stubGlobal('fetch', fetchMock);
      const { submitFeedback, WRITE_TIMEOUT_MS } = await import('./productDataClient');

      const first = submitFeedback({ type: 'bug', message: 'Something is off.' }, context);
      await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);
      await expect(first).resolves.toEqual({ ok: false });

      await expect(submitFeedback({ type: 'bug', message: 'Something is off.' }, context))
        .resolves.toEqual({ ok: true, data: { saved: true, referenceId: 'WJH-1' } });
      // No automatic retry: exactly one request per submission.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(signals[0]!.aborted).toBe(true);
      expect(signals[1]!.aborted).toBe(false);
    });
  });
});
