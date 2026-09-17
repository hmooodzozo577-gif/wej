import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAIStatus, clearAIStatusMemo, requestAIExplanation } from './aiExplanationClient';
import type { AIExplanationRequest } from './types';

const sampleRequest: AIExplanationRequest = {
  kind: 'recommendation',
  lang: 'en',
  countryCode: 'JP',
  purpose: 'tourism',
  matchScore: 82,
};

beforeEach(() => {
  clearAIStatusMemo();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkAIStatus', () => {
  it('returns false and calls nothing without a configured Worker URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await checkAIStatus()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when the Worker reports a configured provider', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: true }), { status: 200 })));
    expect(await checkAIStatus()).toBe(true);
  });

  it('returns false when the Worker reports no provider configured', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false }), { status: 200 })));
    expect(await checkAIStatus()).toBe(false);
  });

  it('survives a network failure without throwing', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    await expect(checkAIStatus()).resolves.toBe(false);
  });

  it('memoizes the check — only one fetch for many callers on the same page', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ available: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([checkAIStatus(), checkAIStatus(), checkAIStatus()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('requestAIExplanation', () => {
  it('answers not_configured and calls nothing without a configured Worker URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestAIExplanation(sampleRequest)).toEqual({ available: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the request body as JSON and returns the parsed result on success', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ available: true, explanation: { summary: 'ok', whyItFits: [], tradeoffs: [], confidenceNotes: '', missingDataNotes: [] }, cached: false, modelVersion: 'x' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await requestAIExplanation(sampleRequest);
    expect(result).toMatchObject({ available: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://worker.test/api/ai/explain');
    expect(JSON.parse(init.body as string)).toEqual(sampleRequest);
  });

  it('degrades to provider_error on a non-2xx response rather than throwing', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect(await requestAIExplanation(sampleRequest)).toEqual({ available: false, reason: 'provider_error' });
  });

  it('degrades to network_error on a thrown/aborted fetch rather than throwing', async () => {
    vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    expect(await requestAIExplanation(sampleRequest)).toEqual({ available: false, reason: 'network_error' });
  });
});
