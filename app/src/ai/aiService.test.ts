// Phase 16 — AI API Integration, frontend service tests. Same two-group
// convention as travel/travelService.test.ts: (1) this repository's real
// unconfigured state (no VITE_AI_WORKER_URL set anywhere) — validation
// and a deterministic 'unavailable'/'invalid_request' result with NO
// network call; (2) Worker-configured behavior with global fetch
// mocked — never a real network call, never a real credential.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DimensionCatalogEntry, InterpretableQuestion, RankedDestinationContext } from './types';

const questions: InterpretableQuestion[] = [
  { id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] },
];

const topResults: RankedDestinationContext[] = [
  { destId: 'japan', name: 'Japan', score: 82, reasons: ['Strong climate match'], facts: 'Climate: Mild.' },
];

// Phase 16.5 TRUE adaptive-interview pass — Capability C fixtures.
const catalog: DimensionCatalogEntry[] = [
  { id: 'climate', kind: 'climate', question: 'What climate do you prefer?', rankingWeight: 8, rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 'cold', label: 'Cold' }] },
  {
    id: 'naturecity',
    kind: 'target',
    question: 'Nature or cities?',
    rankingWeight: 10,
    rankingSupported: true,
    resolved: false,
    alreadyAsked: false,
    options: [{ value: 15, label: 'Nature' }, { value: 90, label: 'Cities' }],
  },
];

describe('Phase 16 — aiService (unconfigured Worker: this repo\'s real current state)', () => {
  it('interpretPreferences rejects empty text and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', '   ', questions);
    expect(result.status).toBe('invalid_request');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('interpretPreferences rejects oversized text and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', 'x'.repeat(600), questions);
    expect(result.status).toBe('invalid_request');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('interpretPreferences returns "unavailable" for well-formed input (no Worker URL configured) and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', 'I want somewhere cold', questions);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('explainRecommendation returns "unavailable" for a well-formed request and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { explainRecommendation } = await import('./aiService');
    const result = await explainRecommendation('en', 'Tourism', 'Prefers cold, quiet places.', topResults);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('explainRecommendation returns "unavailable" for an empty results list, before ever checking the Worker URL', async () => {
    const { explainRecommendation } = await import('./aiService');
    const result = await explainRecommendation('en', 'Tourism', 'x', []);
    expect(result.status).toBe('unavailable');
  });

  it('isAiConfigured is false — this repository\'s real current unconfigured state', async () => {
    const { isAiConfigured } = await import('./aiService');
    expect(isAiConfigured()).toBe(false);
  });

  it('nextTurn returns "unavailable" for a well-formed request and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, { climate: 'cold' }, 1);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('nextTurn rejects an empty catalog and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', [], {}, 1);
    expect(result.status).toBe('invalid_request');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('nextTurn rejects turnNumber < 1 and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, {}, 0);
    expect(result.status).toBe('invalid_request');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('neither result ever contains anything secret-shaped', async () => {
    const { interpretPreferences, explainRecommendation } = await import('./aiService');
    const r1 = (await interpretPreferences('en', 'cold places', questions)) as unknown as Record<string, unknown>;
    const r2 = (await explainRecommendation('en', 'Tourism', 'x', topResults)) as unknown as Record<string, unknown>;
    for (const r of [r1, r2]) {
      expect(r.apiKey).toBeUndefined();
      expect(r.token).toBeUndefined();
      expect(r.authorization).toBeUndefined();
    }
  });
});

describe('Phase 16 — aiService (Worker configured, fetch mocked — never a real paid API call)', () => {
  const WORKER_URL = 'https://worker.example';

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_WORKER_URL', WORKER_URL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('interpretPreferences posts to /api/ai/interpret-preferences and returns validated interpreted preferences', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ interpreted: [{ questionId: 'climate', value: 'cold', confidence: 'medium' }], unmapped: [] }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', 'somewhere cold', questions);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.interpreted).toEqual([{ questionId: 'climate', value: 'cold', confidence: 'medium' }]);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${WORKER_URL}/api/ai/interpret-preferences`);
  });

  it('LOCATION: originCountry, when given, is included in the POST body as a plain string — never a coordinate', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpreted: [], unmapped: [] }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    await interpretPreferences('en', 'somewhere cold', questions, 'Saudi Arabia');
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.originCountry).toBe('Saudi Arabia');
    expect(JSON.stringify(body)).not.toMatch(/-?\d{1,3}\.\d{4,}/); // no coordinate-shaped value anywhere
  });

  it('LOCATION: omitted originCountry never appears in the POST body at all', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpreted: [], unmapped: [] }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    await interpretPreferences('en', 'somewhere cold', questions);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect('originCountry' in body).toBe(false);
  });

  it('interpretPreferences: a malformed Worker response maps to "error", never passed through half-validated', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nonsense: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', 'somewhere cold', questions);
    expect(result.status).toBe('error');
  });

  it('interpretPreferences: a 503 ai_not_configured Worker response maps to "error" with the Worker\'s own message, never a raw exception', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'ai_not_configured', message: 'AI is not configured yet.' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const result = await interpretPreferences('en', 'somewhere cold', questions);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toBe('AI is not configured yet.');
  });

  it('interpretPreferences: a network failure/timeout maps to a safe "error" result, never throws', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    await expect(interpretPreferences('en', 'somewhere cold', questions)).resolves.toMatchObject({ status: 'error' });
  });

  it('REGRESSION (real production failure): a slow-but-real Worker response (~45s, matching observed real Worker/model latency) still succeeds — the frontend timeout must not fire before the Worker has a chance to finish', async () => {
    // A real production request with this exact phrase/bank shape
    // measured the deployed Worker taking 30+s; the frontend's own
    // timeout was still 15s at the time, discarding every real
    // response before it could arrive. This proves the fix: a
    // response arriving well past the OLD 15s cutoff, but before the
    // current REQUEST_TIMEOUT_MS, still resolves as 'ok'.
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => resolve({ ok: true, status: 200, json: async () => ({ interpreted: [], unmapped: [] }) }),
          45_000,
        );
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { interpretPreferences } = await import('./aiService');
    const pending = interpretPreferences('en', 'somewhere cold', questions);
    const assertion = expect(pending).resolves.toEqual({ status: 'ok', interpreted: [], unmapped: [] });
    await vi.advanceTimersByTimeAsync(45_000);
    await assertion;
    vi.useRealTimers();
  });

  it('explainRecommendation posts to /api/ai/explain-recommendation and returns validated explanation content', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ summary: 'Great fit.', perDestination: [{ destId: 'japan', explanation: 'Matches your climate preference.' }], caveats: [] }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { explainRecommendation } = await import('./aiService');
    const result = await explainRecommendation('en', 'Tourism', 'Prefers cold places.', topResults);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.perDestination).toEqual([{ destId: 'japan', explanation: 'Matches your climate preference.' }]);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${WORKER_URL}/api/ai/explain-recommendation`);
  });

  it('explainRecommendation: a malformed Worker response maps to "error"', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ summary: 42 }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { explainRecommendation } = await import('./aiService');
    const result = await explainRecommendation('en', 'Tourism', 'x', topResults);
    expect(result.status).toBe('error');
  });

  it('explainRecommendation output only ever carries the destIds it was given (also enforced server-side; this proves the client does not add its own)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ summary: 'x', perDestination: [{ destId: 'japan', explanation: 'x' }], caveats: [] }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { explainRecommendation } = await import('./aiService');
    const result = await explainRecommendation('en', 'Tourism', 'x', topResults);
    if (result.status === 'ok') {
      const requestedIds = new Set(topResults.map((r) => r.destId));
      for (const item of result.perDestination) expect(requestedIds.has(item.destId)).toBe(true);
    }
  });

  it('isAiConfigured is true once VITE_AI_WORKER_URL is set', async () => {
    const { isAiConfigured } = await import('./aiService');
    expect(isAiConfigured()).toBe(true);
  });

  it('nextTurn posts to /api/ai/next-turn and returns a validated "ask" outcome', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ask', questionType: 'choice', targetDimensions: ['naturecity'], prompt: 'x', options: [{ id: 'a', label: 'Nature', updates: { naturecity: 15 } }] }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, { climate: 'cold' }, 1);
    expect(result.status).toBe('ok');
    if (result.status === 'ok' && result.outcome.kind === 'ask' && result.outcome.questionType === 'choice') {
      expect(result.outcome.options).toEqual([{ id: 'a', label: 'Nature', updates: { naturecity: 15 } }]);
    }
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${WORKER_URL}/api/ai/next-turn`);
  });

  it('nextTurn returns a validated "complete" outcome', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'complete' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, { climate: 'cold' }, 1);
    expect(result).toEqual({ status: 'ok', outcome: { kind: 'complete' } });
  });

  it('nextTurn returns a validated free_text "ask" outcome', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ask', questionType: 'free_text', targetDimensions: ['naturecity'], prompt: 'Tell us more?' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, { climate: 'cold' }, 1);
    expect(result).toEqual({ status: 'ok', outcome: { kind: 'ask', questionType: 'free_text', targetDimensions: ['naturecity'], prompt: 'Tell us more?' } });
  });

  it('nextTurn: a malformed Worker response maps to "error", never passed through half-validated', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nonsense: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, {}, 1);
    expect(result.status).toBe('error');
  });

  it('nextTurn: a 502 ai_provider_error Worker response (e.g. a DUPLICATE PREVENTION rejection) maps to "error" with the Worker\'s own message', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'ai_provider_error', message: 'The AI service returned an unexpected response.' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    const result = await nextTurn('en', 'tourism', 'Tourism', catalog, {}, 1);
    expect(result).toEqual({ status: 'error', message: 'The AI service returned an unexpected response.' });
  });

  it('LOCATION: nextTurn includes originCountry as a plain string when given, omits it otherwise — never a coordinate', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'complete' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    await nextTurn('en', 'tourism', 'Tourism', catalog, {}, 1, 'Saudi Arabia');
    const withLocation = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(withLocation.originCountry).toBe('Saudi Arabia');
    await nextTurn('en', 'tourism', 'Tourism', catalog, {}, 1);
    const without = JSON.parse((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect('originCountry' in without).toBe(false);
  });

  it('nextTurn sends bounded unresolved phrases but drops coordinate-shaped content', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'complete' }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { nextTurn } = await import('./aiService');
    await nextTurn('ar', 'tourism', 'Tourism', catalog, { climate: 'cold' }, 1, undefined, ['هادئة', '24.7136, 46.6753']);
    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.unresolvedPreferences).toEqual(['هادئة']);
  });
});
