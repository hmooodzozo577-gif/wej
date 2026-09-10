// Phase 16 — the concrete, real AiProvider adapter. Provider decision
// (made by the task, not chosen silently by this code): Cloudflare
// Workers AI, via the native `env.AI` binding — see ../../wrangler.toml's
// `[ai]` block. This is the ONLY file that knows a Cloudflare Workers AI
// request/response shape; index.ts and the frontend only ever see the
// provider-neutral AiProvider contract (./types.ts).
//
// NO API KEY: unlike a hosted-vendor adapter (Anthropic/OpenAI/etc),
// Cloudflare Workers AI authenticates via the Worker's own Cloudflare
// account context (the same mechanism that lets this Worker respond to
// requests at all) — `env.AI` is injected by the Cloudflare runtime at
// request time, the same way env.AI_PROVIDER/env.AI_API_KEY would be for
// a hosted vendor, but with no secret value anywhere. Deploying THIS
// Worker (wrangler login / a CI API token) is a separate concern from
// AI inference — see ../../SECRETS.md's Phase 16 section.
import type { Ai } from '@cloudflare/workers-types';
import { buildExplainRecommendationPrompt, buildInterpretPreferencesPrompt } from './prompts';
import { AiInvalidResponseError, AiProviderError, AiTimeoutError } from './types';
import type {
  AiProvider,
  ExplainRecommendationRequest,
  ExplainRecommendationResult,
  InterpretPreferencesRequest,
  InterpretPreferencesResult,
} from './types';

/** The ONE place this model id is written — change it here only (task's
 *  own "document the model id in one maintainable location" instruction).
 *  Selected per the task's own model-selection rule: `gemma-4-26b-a4b-it`
 *  is Cloudflare's current primary candidate for this kind of
 *  structured, bilingual (Arabic+English) short-form generation task —
 *  see the final report's "Selected Model" / "Why That Model Was
 *  Selected" sections for the evaluated alternative and the reasoning
 *  (JSON-schema response-format support, function-calling/reasoning
 *  capability, and multilingual training make it the best fit of the
 *  two evaluated for this specific interpret/explain workload). */
export const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';

// Real gemma-4-26b-a4b-it latency, measured twice against the live
// deployed Worker (never guessed): a first pass found calls exceeding
// an original 15s budget, raised to 30s; a second pass (production-
// failure investigation, browser-equivalent request, the exact real
// user's Arabic phrase and full 8-question tourism bank) STILL hit
// this exact 30s ceiling at 30.08s wall-clock, and several later
// calls in that same run — including small 2-question prompts —
// also exceeded 30s. Latency is genuinely variable, not merely
// "sometimes a bit slow"; 30s was not a safe ceiling. 45s leaves
// real headroom above every observed real call across both
// measurement passes (worst case ~30s at the point curl cut it off).
//
// IMPORTANT — this value is a floor for app/src/ai/aiService.ts's
// own REQUEST_TIMEOUT_MS: the frontend's fetch must never abort
// BEFORE the Worker's own internal budget expires, or the frontend
// discards a response the Worker would still have delivered (this
// was the actual root cause of a real production failure — the
// frontend timeout was left at its own old, shorter value while this
// one was raised). If this constant changes, aiService.ts's timeout
// must be raised to at least match it, with margin for network time.
const RUN_TIMEOUT_MS = 45_000;

// JSON Schema (Cloudflare Workers AI JSON Mode: response_format:
// {type:"json_schema", json_schema:{name, schema}}) constrains what
// shape the model MUST reply in. This is a real safety layer, not
// decoration — but per Cloudflare's own docs, it is NOT a guarantee (a
// model can still fail to satisfy it), so validate.ts's structured-
// output re-validation against the actual request's real allowed
// values remains the authoritative safety net regardless of whether
// the model honored this schema.
const INTERPRET_JSON_SCHEMA = {
  type: 'object',
  properties: {
    interpreted: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionId: { type: 'string' },
          value: {},
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['questionId', 'value'],
      },
    },
    unmapped: { type: 'array', items: { type: 'string' } },
  },
  required: ['interpreted', 'unmapped'],
} as const;

const EXPLAIN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    perDestination: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          destId: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['destId', 'explanation'],
      },
    },
    caveats: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'perDestination', 'caveats'],
} as const;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AiTimeoutError('Cloudflare Workers AI request timed out.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Runs one chat-completion call against the configured model with a
 *  JSON-schema response format, and parses the resulting text as JSON.
 *  Returns `unknown` deliberately — the caller (index.ts's
 *  handleInterpretPreferences/handleExplainRecommendation, via
 *  validate.ts) re-validates every field against the real request
 *  before trusting any of it; this function's only job is "did the
 *  model return syntactically valid JSON at all", never "is this
 *  content trustworthy". */
async function runJsonCompletion(
  ai: Ai,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  let result: { choices?: Array<{ message?: { content?: string | null } }> };
  try {
    result = await withTimeout(
      ai.run(WORKERS_AI_MODEL, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, schema },
        },
      }),
      RUN_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof AiTimeoutError) throw err;
    // Never the raw upstream error/stack — a short, generic message
    // only (same discipline as amadeus.ts's provider-error mapping).
    throw new AiProviderError(err instanceof Error ? err.message : 'Cloudflare Workers AI request failed.', 0);
  }

  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new AiInvalidResponseError('Cloudflare Workers AI returned no text output.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiInvalidResponseError('Cloudflare Workers AI did not return valid JSON.');
  }
}

/** The real, live provider — created only when `env.AI` (the Workers AI
 *  binding) is actually present; see provider.ts's resolveAiProvider(). */
export function createCloudflareWorkersAiProvider(ai: Ai): AiProvider {
  return {
    async interpretPreferences(req: InterpretPreferencesRequest): Promise<InterpretPreferencesResult> {
      const { system, user } = buildInterpretPreferencesPrompt(req);
      const raw = await runJsonCompletion(ai, system, user, 'interpret_preferences', INTERPRET_JSON_SCHEMA);
      // Cast only to satisfy the AiProvider interface's declared return
      // type — index.ts's caller treats this as `unknown` regardless
      // (see validate.ts's validateInterpretPreferencesResult).
      return raw as InterpretPreferencesResult;
    },
    async explainRecommendation(req: ExplainRecommendationRequest): Promise<ExplainRecommendationResult> {
      const { system, user } = buildExplainRecommendationPrompt(req);
      const raw = await runJsonCompletion(ai, system, user, 'explain_recommendation', EXPLAIN_JSON_SCHEMA);
      return raw as ExplainRecommendationResult;
    },
  };
}
