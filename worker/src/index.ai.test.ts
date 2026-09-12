// Phase 16 — AI API Integration. Worker-level tests: real HTTP routing
// through handleRequest() (proving routing isolation — the existing
// travel route and unknown paths are unaffected), and the full
// validation/provider-call/structured-output-validation/error-mapping
// pipeline via handleInterpretPreferences()/handleExplainRecommendation()
// injected with the deterministic mock provider or a fake
// error-throwing provider — never a real paid API call (task's own
// explicit requirement).
import { describe, expect, it } from 'vitest';
import { handleExplainRecommendation, handleInterpretPreferences, handleNextTurn, handleRequest, type Env } from './index';
import { createMockAiProvider } from './ai/mockProvider';
import { AiInvalidResponseError, AiProviderError, AiTimeoutError, type AiProvider } from './ai/types';

const ALLOWED_ORIGIN = 'https://hmooodzozo577-gif.github.io';
const env: Env = {
  AMADEUS_API_KEY: 'test-fixture-client-id-not-real',
  AMADEUS_API_SECRET: 'test-fixture-client-secret-not-real',
  // AI_PROVIDER/AI_API_KEY deliberately absent — the real current state
  // of this repository (see ai/provider.ts).
};

function postAi(path: string, body: unknown, origin = ALLOWED_ORIGIN): Request {
  return new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

const validInterpretBody = {
  lang: 'ar',
  text: 'أبغى دولة باردة وهادية',
  questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] }],
};

const validExplainBody = {
  lang: 'en',
  purposeName: 'Tourism',
  profileSummary: 'Prefers cold, quiet destinations.',
  topResults: [{ destId: 'japan', name: 'Japan', score: 80, reasons: ['Climate match'], facts: 'Climate: Mild.' }],
};

const validNextTurnBody = {
  lang: 'en',
  purposeId: 'tourism',
  purposeName: 'Tourism',
  turnNumber: 1,
  confirmedProfile: {},
  catalog: [
    {
      id: 'climate',
      kind: 'climate',
      question: 'What climate do you prefer?',
      rankingSupported: true,
      resolved: false,
      alreadyAsked: false,
      options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }],
    },
  ],
};
const VALID_SCENARIO_ID = 'tourism-trip-rhythm--honest-tradeoff';

describe('handleRequest — AI routing isolation', () => {
  it('POST /api/ai/interpret-preferences with no provider configured returns 503 ai_not_configured (this repo\'s real current state) — never a crash', async () => {
    const res = await handleRequest(postAi('/api/ai/interpret-preferences', validInterpretBody), env);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('ai_not_configured');
  });

  it('POST /api/ai/explain-recommendation with no provider configured returns 503 ai_not_configured', async () => {
    const res = await handleRequest(postAi('/api/ai/explain-recommendation', validExplainBody), env);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('ai_not_configured');
  });

  it('POST /api/ai/next-turn with no provider configured returns 503 ai_not_configured', async () => {
    const res = await handleRequest(postAi('/api/ai/next-turn', validNextTurnBody), env);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('ai_not_configured');
  });

  it('unsupported method (GET) on an AI route is rejected — 405, never routed through to the provider', async () => {
    const res = await handleRequest(new Request('https://worker.example/api/ai/interpret-preferences', { method: 'GET', headers: { Origin: ALLOWED_ORIGIN } }), env);
    expect(res.status).toBe(405);
  });

  it('the existing travel route is completely unaffected by the AI routes existing (routing isolation)', async () => {
    // No stubbed fetch here — this deliberately exercises only the
    // ROUTING decision (unknown/known path), not a real Amadeus call;
    // a 404 would mean the AI routes broke travel routing, which is
    // the isolation property under test. Any other status confirms the
    // travel route was reached and is handling its own logic normally.
    const res = await handleRequest(new Request('https://worker.example/api/travel/flights', { method: 'GET', headers: { Origin: ALLOWED_ORIGIN } }), env);
    expect(res.status).toBe(405); // method_not_allowed — proves the route was matched, not 404
  });

  it('an unknown AI-shaped path still 404s (no accidental wildcard route)', async () => {
    const res = await handleRequest(postAi('/api/ai/something-else', {}), env);
    expect(res.status).toBe(404);
  });

  it('CORS: a disallowed origin gets no Access-Control-Allow-Origin header on an AI route response', async () => {
    const res = await handleRequest(postAi('/api/ai/interpret-preferences', validInterpretBody, 'https://evil.example'), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('handleInterpretPreferences — full pipeline via the mock provider (never a real paid API call)', () => {
  const mock = createMockAiProvider();

  it('provider not configured (null) -> 503, before ever touching a provider', async () => {
    const [body, status] = await handleInterpretPreferences(null, validInterpretBody);
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('ai_not_configured');
  });

  it('server-side request validation rejects a malformed request before calling the provider', async () => {
    const [body, status] = await handleInterpretPreferences(mock, { lang: 'xx' });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('invalid_request');
  });

  it('oversized request (text too long) is rejected — 400, never sent to a provider', async () => {
    const [, status] = await handleInterpretPreferences(mock, { ...validInterpretBody, text: 'x'.repeat(600) });
    expect(status).toBe(400);
  });

  it('a valid request with a real (mock) provider succeeds and returns validated structured output', async () => {
    const [body, status] = await handleInterpretPreferences(mock, { ...validInterpretBody, text: 'climate matters to me' });
    expect(status).toBe(200);
    expect((body as { interpreted: unknown[] }).interpreted.length).toBeGreaterThan(0);
  });

  it('an invalid/malformed model response is validated and fails safely (empty, not passed through)', async () => {
    const brokenProvider: AiProvider = {
      interpretPreferences: async () => ({ interpreted: 'not an array' }) as never,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: mock.nextTurn,
    };
    const [body, status] = await handleInterpretPreferences(brokenProvider, validInterpretBody);
    expect(status).toBe(200); // the ROUTE succeeds; the CONTENT is safely empty
    expect((body as { interpreted: unknown[] }).interpreted).toEqual([]);
  });

  it('provider timeout maps to 504 ai_timeout, no raw error/stack ever reaches the response', async () => {
    const timingOutProvider: AiProvider = {
      interpretPreferences: async () => {
        throw new AiTimeoutError('timed out');
      },
      explainRecommendation: mock.explainRecommendation,
      nextTurn: mock.nextTurn,
    };
    const [body, status] = await handleInterpretPreferences(timingOutProvider, validInterpretBody);
    expect(status).toBe(504);
    expect(JSON.stringify(body)).not.toMatch(/stack|at Object|at async/);
  });

  it('provider unavailable/error maps to 502 ai_provider_error, never the raw upstream body', async () => {
    const failingProvider: AiProvider = {
      interpretPreferences: async () => {
        throw new AiProviderError('upstream 500', 500);
      },
      explainRecommendation: mock.explainRecommendation,
      nextTurn: mock.nextTurn,
    };
    const [body, status] = await handleInterpretPreferences(failingProvider, validInterpretBody);
    expect(status).toBe(502);
    expect((body as { message: string }).message).not.toContain('upstream 500');
  });

  it('invalid-response-shape provider error maps to 502 as well', async () => {
    const badShapeProvider: AiProvider = {
      interpretPreferences: async () => {
        throw new AiInvalidResponseError('could not parse model output');
      },
      explainRecommendation: mock.explainRecommendation,
      nextTurn: mock.nextTurn,
    };
    const [, status] = await handleInterpretPreferences(badShapeProvider, validInterpretBody);
    expect(status).toBe(502);
  });
});

describe('handleExplainRecommendation — full pipeline via the mock provider', () => {
  const mock = createMockAiProvider();

  it('provider not configured -> 503', async () => {
    const [, status] = await handleExplainRecommendation(null, validExplainBody);
    expect(status).toBe(503);
  });

  it('AI explanation never changes/reorders the ranking it was given — the response contains only destIds/scores the request itself supplied', async () => {
    const [body, status] = await handleExplainRecommendation(mock, validExplainBody);
    expect(status).toBe(200);
    const result = body as { perDestination: Array<{ destId: string }> };
    const requestedIds = new Set(validExplainBody.topResults.map((r) => r.destId));
    for (const item of result.perDestination) {
      expect(requestedIds.has(item.destId)).toBe(true);
    }
  });

  it('a request claiming a destination outside the real ranking is rejected by structured-output validation, not trusted', async () => {
    const sneakyProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      nextTurn: mock.nextTurn,
      explainRecommendation: async () => ({
        summary: 'x',
        perDestination: [{ destId: 'made-up-destination', explanation: 'x' }],
        caveats: [],
      }),
    };
    const [body] = await handleExplainRecommendation(sneakyProvider, validExplainBody);
    expect((body as { perDestination: unknown[] }).perDestination).toEqual([]);
  });

  it('oversized topResults is rejected before calling the provider', async () => {
    const topResults = Array.from({ length: 15 }, (_, i) => ({ destId: `d${i}`, name: `D${i}`, score: 1, reasons: [], facts: '' }));
    const [, status] = await handleExplainRecommendation(mock, { ...validExplainBody, topResults });
    expect(status).toBe(400);
  });
});

describe('handleNextTurn — full pipeline via the mock provider (Phase 16.5 TRUE adaptive-interview Capability C)', () => {
  const mock = createMockAiProvider();

  it('provider not configured (null) -> 503, before ever touching a provider', async () => {
    const [body, status] = await handleNextTurn(null, validNextTurnBody);
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('ai_not_configured');
  });

  it('server-side request validation rejects a malformed request before calling the provider', async () => {
    const [body, status] = await handleNextTurn(mock, { lang: 'xx' });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('invalid_request');
  });

  it('a valid request with a real (mock) provider succeeds and asks about the one unresolved catalog entry', async () => {
    const [body, status] = await handleNextTurn(mock, validNextTurnBody);
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ask');
  });

  it('every catalog entry already resolved/asked -> 200 status complete, not a fabricated question', async () => {
    const [body, status] = await handleNextTurn(mock, {
      ...validNextTurnBody,
      confirmedProfile: { climate: 'cold' },
      catalog: [{ ...validNextTurnBody.catalog[0], resolved: true, alreadyAsked: true }],
    });
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('complete');
  });

  // Task 5 Section 12 — semantic (dimension-level) duplicate prevention is
  // the real security gate: a provider claiming to target an already-
  // resolved dimension is rejected at the ROUTE level, never trusted and
  // never silently downgraded to {status:'complete'} (that would falsely
  // claim the profile is sufficient).
  it('DUPLICATE PREVENTION: a provider targeting an already-resolved dimension is rejected -> 502 ai_provider_error, not passed through', async () => {
    const sneakyProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => ({
        status: 'ask',
        scenarioId: VALID_SCENARIO_ID,
        questionType: 'choice',
        targetDimensions: ['climate'],
        prompt: 'What climate do you like?',
        options: [{ id: 'a', label: 'Cold', updates: { climate: 'cold' } }],
      }),
    };
    const [body, status] = await handleNextTurn(sneakyProvider, {
      ...validNextTurnBody,
      confirmedProfile: { climate: 'cold' },
      catalog: [{ ...validNextTurnBody.catalog[0], resolved: true, alreadyAsked: true }],
    });
    expect(status).toBe(502);
    expect((body as { error: string }).error).toBe('ai_provider_error');
  });

  it('malformed model response (bad shape) is validated and fails safely -> 502, never a raw pass-through', async () => {
    const brokenProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => ('not an object' as never),
    };
    const [body, status] = await handleNextTurn(brokenProvider, validNextTurnBody);
    expect(status).toBe(502);
    expect((body as { error: string }).error).toBe('ai_provider_error');
  });

  it('retries one semantically invalid AI decision and accepts a valid second decision before fallback', async () => {
    let calls = 0;
    const retryDiagnostics: Array<string | undefined> = [];
    const recoveringProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async (_request, retryDiagnostic) => {
        calls += 1;
        retryDiagnostics.push(retryDiagnostic);
        if (calls === 1) {
          return {
            status: 'ask',
            scenarioId: VALID_SCENARIO_ID,
            questionType: 'choice',
            targetDimensions: ['climate'],
            prompt: 'Choose a climate',
            options: [{ id: 'bad', label: 'Invented', updates: { climate: 'invented' } }],
          };
        }
        return {
          status: 'ask',
          scenarioId: VALID_SCENARIO_ID,
          questionType: 'choice',
          targetDimensions: ['climate'],
          prompt: 'Which atmosphere would make this trip comfortable for you?',
          options: [
            { id: 'cold', label: 'Crisp days with cool evenings', updates: { climate: 'cold' } },
            { id: 'mild', label: 'Gentle days with balanced temperatures', updates: { climate: 'mild' } },
          ],
        };
      },
    };

    const [body, status] = await handleNextTurn(recoveringProvider, validNextTurnBody);
    expect(status).toBe(200);
    expect(calls).toBe(2);
    expect(retryDiagnostics).toEqual([undefined, 'choice_options']);
    expect(body).toMatchObject({ status: 'ask', targetDimensions: ['climate'] });
  });

  it('falls back with a safe diagnostic after three invalid AI decisions', async () => {
    let calls = 0;
    const invalidProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => {
        calls += 1;
        return { status: 'ask', scenarioId: VALID_SCENARIO_ID, questionType: 'choice', targetDimensions: ['climate'], prompt: 'Choose', options: [] };
      },
    };

    const [body, status] = await handleNextTurn(invalidProvider, validNextTurnBody);
    expect(status).toBe(502);
    expect(calls).toBe(3);
    expect(body).toMatchObject({ error: 'ai_provider_error', diagnostic: 'choice_options' });
  });

  it('uses the latest safe diagnostic to repair a two-stage failure on the third attempt', async () => {
    let calls = 0;
    const retryDiagnostics: Array<string | undefined> = [];
    const stagedProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async (_request, retryDiagnostic) => {
        calls += 1;
        retryDiagnostics.push(retryDiagnostic);
        if (calls === 1) {
          return {
            status: 'ask',
            scenarioId: VALID_SCENARIO_ID,
            questionType: 'free_text',
            targetDimensions: ['climate'],
            prompt: 'Do you prefer crisp winter days or gentle mild weather?',
          };
        }
        if (calls === 2) {
          return {
            status: 'ask',
            scenarioId: VALID_SCENARIO_ID,
            questionType: 'choice',
            targetDimensions: ['climate'],
            prompt: 'Which atmosphere would make this trip comfortable for you?',
            options: [{ id: 'cold', label: 'Cold', updates: { climate: 'cold' } }],
          };
        }
        return {
          status: 'ask',
          scenarioId: VALID_SCENARIO_ID,
          questionType: 'choice',
          targetDimensions: ['climate'],
          prompt: 'Which atmosphere would make this trip comfortable for you?',
          options: [
            { id: 'cold', label: 'Crisp days with cool evenings', updates: { climate: 'cold' } },
            { id: 'mild', label: 'Gentle days with balanced temperatures', updates: { climate: 'mild' } },
          ],
        };
      },
    };

    const [body, status] = await handleNextTurn(stagedProvider, validNextTurnBody);
    expect(status).toBe(200);
    expect(calls).toBe(3);
    expect(retryDiagnostics).toEqual([undefined, 'free_text_alternatives', 'choice_options']);
    expect(body).toMatchObject({ status: 'ask', questionType: 'choice', targetDimensions: ['climate'] });
  });

  it('provider timeout maps to 504 ai_timeout, no raw error/stack ever reaches the response', async () => {
    const timingOutProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => {
        throw new AiTimeoutError('timed out');
      },
    };
    const [body, status] = await handleNextTurn(timingOutProvider, validNextTurnBody);
    expect(status).toBe(504);
    expect(JSON.stringify(body)).not.toMatch(/stack|at Object|at async/);
  });

  it('provider unavailable/error maps to 502 ai_provider_error, never the raw upstream body', async () => {
    const failingProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => {
        throw new AiProviderError('upstream 500', 500);
      },
    };
    const [body, status] = await handleNextTurn(failingProvider, validNextTurnBody);
    expect(status).toBe(502);
    expect((body as { message: string }).message).not.toContain('upstream 500');
  });

  it('invalid-response-shape provider error maps to 502 as well', async () => {
    const badShapeProvider: AiProvider = {
      interpretPreferences: mock.interpretPreferences,
      explainRecommendation: mock.explainRecommendation,
      nextTurn: async () => {
        throw new AiInvalidResponseError('could not parse model output');
      },
    };
    const [, status] = await handleNextTurn(badShapeProvider, validNextTurnBody);
    expect(status).toBe(502);
  });
});

describe('handleRequest — full pipeline through the REAL Cloudflare Workers AI adapter (env.AI mocked, never a real paid call)', () => {
  const envWithAi: Env = {
    ...env,
    AI: { run: async () => ({ choices: [{ message: { role: 'assistant', content: JSON.stringify({ interpreted: [{ questionId: 'climate', value: 'hot', confidence: 'high' }], unmapped: [] }) } }] }) } as unknown as Env['AI'],
  };

  it('a fully configured env.AI binding routes a real HTTP request all the way through resolveAiProvider -> CloudflareWorkersAiProvider -> validated response — 200, no longer ai_not_configured', async () => {
    const res = await handleRequest(postAi('/api/ai/interpret-preferences', validInterpretBody), envWithAi);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.interpreted).toEqual([{ questionId: 'climate', value: 'hot', confidence: 'high' }]);
  });

  it('a fabricated destId from the real adapter path is still dropped by server-side structured-output validation — the AI cannot introduce a destination outside the real ranking even via env.AI', async () => {
    const sneakyEnv: Env = {
      ...env,
      AI: {
        run: async () => ({
          choices: [{ message: { role: 'assistant', content: JSON.stringify({ summary: 'x', perDestination: [{ destId: 'atlantis', explanation: 'made up' }], caveats: [] }) } }],
        }),
      } as unknown as Env['AI'],
    };
    const res = await handleRequest(postAi('/api/ai/explain-recommendation', validExplainBody), sneakyEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.perDestination).toEqual([]);
  });

  it('env.AI.run throwing (e.g. a Workers AI outage) still maps to the same safe 502, through the real routing path', async () => {
    const failingEnv: Env = {
      ...env,
      AI: { run: async () => { throw new Error('upstream Workers AI failure detail'); } } as unknown as Env['AI'],
    };
    const res = await handleRequest(postAi('/api/ai/interpret-preferences', validInterpretBody), failingEnv);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('upstream Workers AI failure detail');
  });
});
