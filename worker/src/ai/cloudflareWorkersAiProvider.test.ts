// Phase 16 — concrete Cloudflare Workers AI adapter tests. `env.AI.run`
// is mocked throughout (a `vi.fn()` standing in for the real Cloudflare
// binding) — never a real, paid inference call, matching the task's
// own explicit requirement. Proves the translation both directions:
// Wejhaty request -> Workers AI call shape, and Workers AI response ->
// Wejhaty's validated AiProvider return shape.
import { describe, expect, it, vi } from 'vitest';
import type { Ai } from '@cloudflare/workers-types';
import { createCloudflareWorkersAiProvider, WORKERS_AI_MODEL } from './cloudflareWorkersAiProvider';
import { AiInvalidResponseError, AiProviderError, AiTimeoutError } from './types';
import type { ExplainRecommendationRequest, InterpretPreferencesRequest } from './types';
import type { NextTurnRequest } from './types';

function fakeAi(run: (...args: unknown[]) => unknown): Ai {
  return { run: vi.fn(run) } as unknown as Ai;
}

function chatResult(content: unknown) {
  return { choices: [{ message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }] };
}

const interpretReq: InterpretPreferencesRequest = {
  lang: 'ar',
  text: 'أبغى دولة باردة وهادية وفيها طبيعة',
  questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] }],
};

const explainReq: ExplainRecommendationRequest = {
  lang: 'en',
  purposeName: 'Tourism',
  profileSummary: 'Prefers cold, quiet destinations.',
  topResults: [{ destId: 'japan', name: 'Japan', score: 82, reasons: ['Climate match'], facts: 'Climate: Mild.' }],
};

const nextTurnReq: NextTurnRequest = {
  lang: 'ar',
  purposeName: 'Tourism',
  confirmedProfile: {},
  turnNumber: 1,
  catalog: [
    {
      id: 'budget',
      kind: 'target',
      rankingSupported: true,
      resolved: false,
      alreadyAsked: false,
      options: [{ value: 1, label: 'Low' }, { value: 2, label: 'Medium' }],
    },
  ],
};

describe('createCloudflareWorkersAiProvider — request shape', () => {
  it('calls env.AI.run with the documented model id, chat messages (system+user, separated), and a json_schema response_format', async () => {
    const run = vi.fn().mockResolvedValue(chatResult({ interpreted: [], unmapped: [] }));
    const ai = fakeAi(run);
    await createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq);

    expect(run).toHaveBeenCalledTimes(1);
    const [model, input] = run.mock.calls[0] as [string, { messages: Array<{ role: string; content: string }>; response_format: { type: string } }];
    expect(model).toBe(WORKERS_AI_MODEL);
    expect(input.messages).toHaveLength(2);
    expect(input.messages[0]?.role).toBe('system');
    expect(input.messages[1]?.role).toBe('user');
    // The untrusted user text must land ONLY in the user message, never
    // folded into the system instructions (prompts.ts's own contract).
    expect(input.messages[1]?.content).toBe(interpretReq.text);
    expect(input.messages[0]?.content).not.toContain(interpretReq.text);
    expect(input.response_format.type).toBe('json_schema');
  });

  it('Arabic request: the system prompt instructs Arabic output', async () => {
    const run = vi.fn().mockResolvedValue(chatResult({ interpreted: [], unmapped: [] }));
    const ai = fakeAi(run);
    await createCloudflareWorkersAiProvider(ai).interpretPreferences({ ...interpretReq, lang: 'ar' });
    const [, input] = run.mock.calls[0] as [string, { messages: Array<{ content: string }> }];
    expect(input.messages[0]?.content).toMatch(/Arabic/i);
  });

  it('English request: the system prompt instructs English output', async () => {
    const run = vi.fn().mockResolvedValue(chatResult({ interpreted: [], unmapped: [] }));
    const ai = fakeAi(run);
    await createCloudflareWorkersAiProvider(ai).interpretPreferences({ ...interpretReq, lang: 'en' });
    const [, input] = run.mock.calls[0] as [string, { messages: Array<{ content: string }> }];
    expect(input.messages[0]?.content).toMatch(/English/i);
  });

  it('Capability C sends Gemma 4\'s ChatCompletions JSON Schema envelope and disables unnecessary model thinking', async () => {
    const run = vi.fn().mockResolvedValue(
      chatResult({ status: 'complete', questionType: 'none', targetDimensions: [], prompt: '', options: [] }),
    );
    await createCloudflareWorkersAiProvider(fakeAi(run)).nextTurn(nextTurnReq);

    const [, input] = run.mock.calls[0] as [
      string,
      {
        chat_template_kwargs?: { enable_thinking?: boolean };
        max_completion_tokens?: number;
        temperature?: number;
        response_format: { json_schema: { name?: string; schema?: { required?: string[] }; strict?: boolean } };
      },
    ];
    expect(input.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(input.max_completion_tokens).toBe(512);
    expect(input.temperature).toBe(0);
    expect(input.response_format.json_schema.name).toBe('next_turn');
    expect(input.response_format.json_schema.schema?.required).toEqual([
      'status',
      'questionType',
      'targetDimensions',
      'prompt',
      'options',
    ]);
    expect(input.response_format.json_schema).not.toHaveProperty('strict');
  });
});

describe('createCloudflareWorkersAiProvider — response parsing', () => {
  it('parses a valid JSON chat-completion response into the expected shape', async () => {
    const ai = fakeAi(() => Promise.resolve(chatResult({ interpreted: [{ questionId: 'climate', value: 'cold', confidence: 'high' }], unmapped: [] })));
    const result = await createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq);
    expect(result.interpreted).toEqual([{ questionId: 'climate', value: 'cold', confidence: 'high' }]);
  });

  it('malformed (non-JSON) model output throws AiInvalidResponseError, never crashes', async () => {
    const ai = fakeAi(() => Promise.resolve(chatResult('not valid json {{{')));
    await expect(createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq)).rejects.toBeInstanceOf(AiInvalidResponseError);
  });

  it('empty/missing content throws AiInvalidResponseError', async () => {
    const ai = fakeAi(() => Promise.resolve({ choices: [{ message: { role: 'assistant', content: null } }] }));
    await expect(createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq)).rejects.toBeInstanceOf(AiInvalidResponseError);
  });

  it('a provider exception (e.g. rate limit) is wrapped as AiProviderError, never the raw upstream error re-thrown as-is', async () => {
    const ai = fakeAi(() => Promise.reject(new Error('429: rate limited, upstream account quota exceeded')));
    await expect(createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq)).rejects.toBeInstanceOf(AiProviderError);
  });

  it('a hung env.AI.run() call times out as AiTimeoutError rather than hanging the response forever', async () => {
    vi.useFakeTimers();
    const ai = fakeAi(() => new Promise(() => {})); // never resolves
    const pending = createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq);
    const assertion = expect(pending).rejects.toBeInstanceOf(AiTimeoutError);
    await vi.advanceTimersByTimeAsync(50_000);
    await assertion;
    vi.useRealTimers();
  });

  it('REGRESSION (production-failure fix): a call resolving just under the 45s budget still succeeds — the timeout must not fire prematurely', async () => {
    vi.useFakeTimers();
    const ai = fakeAi(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(chatResult({ interpreted: [], unmapped: [] })), 40_000);
        }),
    );
    const pending = createCloudflareWorkersAiProvider(ai).interpretPreferences(interpretReq);
    const assertion = expect(pending).resolves.toEqual({ interpreted: [], unmapped: [] });
    await vi.advanceTimersByTimeAsync(40_000);
    await assertion;
    vi.useRealTimers();
  });
});

describe('createCloudflareWorkersAiProvider — explainRecommendation', () => {
  it('sends the ranked destIds/facts as context and parses a valid explanation response', async () => {
    const run = vi.fn().mockResolvedValue(
      chatResult({ summary: 'Great fit.', perDestination: [{ destId: 'japan', explanation: 'Matches your climate preference.' }], caveats: [] }),
    );
    const ai = fakeAi(run);
    const result = await createCloudflareWorkersAiProvider(ai).explainRecommendation(explainReq);
    expect(result.perDestination).toEqual([{ destId: 'japan', explanation: 'Matches your climate preference.' }]);
    const [, input] = run.mock.calls[0] as [string, { messages: Array<{ content: string }> }];
    expect(input.messages[0]?.content).toContain('japan');
  });

  it('a fabricated destId in the model output is still returned by the adapter (the adapter itself does not filter) — the CALLER (index.ts, via validate.ts) is what drops it, proven separately in index.ai.test.ts', async () => {
    const ai = fakeAi(() => Promise.resolve(chatResult({ summary: 'x', perDestination: [{ destId: 'atlantis', explanation: 'made up' }], caveats: [] })));
    const result = await createCloudflareWorkersAiProvider(ai).explainRecommendation(explainReq);
    expect(result.perDestination[0]?.destId).toBe('atlantis'); // adapter is a dumb pipe; validate.ts is the safety net
  });
});
