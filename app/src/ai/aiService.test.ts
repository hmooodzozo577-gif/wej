// Phase 16 — AI API Integration, frontend service tests. Same two-group
// convention as travel/travelService.test.ts: (1) this repository's real
// unconfigured state (no VITE_AI_WORKER_URL set anywhere) — validation
// and a deterministic 'unavailable'/'invalid_request' result with NO
// network call; (2) Worker-configured behavior with global fetch
// mocked — never a real network call, never a real credential.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterpretableQuestion, RankedDestinationContext } from './types';

const questions: InterpretableQuestion[] = [{ id: 'climate', kind: 'climate', options: ['hot', 'mild', 'cold'] }];

const topResults: RankedDestinationContext[] = [
  { destId: 'japan', name: 'Japan', score: 82, reasons: ['Strong climate match'], facts: 'Climate: Mild.' },
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
});
