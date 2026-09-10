// Phase 16 — AI API Integration. The ONLY module a component may call for
// an AI feature — same role travelService.ts plays for flight search.
// Components must never import a provider SDK type, never hold a Worker
// URL/API key, never parse a provider-specific response shape.
//
// Never a hard dependency: every function here returns a safe, typed
// result for every failure mode (not configured, invalid request,
// network failure, timeout, malformed response) — never throws to the
// caller, and never blocks the deterministic questionnaire/results from
// working with AI absent entirely.
import type {
  ExplainRecommendationResult,
  InterpretableQuestion,
  InterpretPreferencesResult,
  RankedDestinationContext,
} from './types';

// ---- Worker endpoint configuration ----------------------------------------
// Same Worker as travelService.ts's VITE_TRAVEL_WORKER_URL (see
// worker/src/index.ts's /api/ai/* routes, added alongside the existing
// /api/travel/flights route — no second backend was created). Kept as
// its own env var, per-concern, matching the convention
// VITE_TRAVEL_WORKER_URL already established; once the Worker is
// deployed, both variables would typically point at the same host.
// Deliberately unset in this repository today: no AI provider is
// configured (see worker/src/ai/provider.ts), so every function below
// deterministically returns an 'unavailable' result with zero network
// attempt.
const AI_WORKER_BASE_URL: string | undefined = import.meta.env.VITE_AI_WORKER_URL;

const INTERPRET_ENDPOINT_PATH = '/api/ai/interpret-preferences';
const EXPLAIN_ENDPOINT_PATH = '/api/ai/explain-recommendation';
const REQUEST_TIMEOUT_MS = 15_000;

// Mirrors worker/src/ai/validate.ts's limits — client-side pre-check so
// an obviously oversized request never reaches the network, same
// rationale as travelService.ts's validateTravelSearchRequest.
const MAX_TEXT_LENGTH = 500;
const MAX_QUESTIONS = 20;
const MAX_TOP_RESULTS = 10;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isInterpretedPreferenceShaped(value: unknown): value is { questionId: string; value: string | number; confidence: string } {
  const v = value as Record<string, unknown> | null;
  return (
    !!v &&
    typeof v.questionId === 'string' &&
    (typeof v.value === 'string' || typeof v.value === 'number') &&
    typeof v.confidence === 'string'
  );
}

function isInterpretResponseShaped(
  body: unknown,
): body is { interpreted: Array<{ questionId: string; value: string | number; confidence: 'high' | 'medium' | 'low' }>; unmapped: string[] } {
  const b = body as { interpreted?: unknown; unmapped?: unknown } | null;
  return (
    !!b &&
    Array.isArray(b.interpreted) &&
    b.interpreted.every(isInterpretedPreferenceShaped) &&
    Array.isArray(b.unmapped) &&
    b.unmapped.every((u) => typeof u === 'string')
  );
}

async function postJson(basePath: string, body: unknown): Promise<{ ok: true; body: unknown } | { ok: false; result: { status: 'error'; message: string } }> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${AI_WORKER_BASE_URL}${basePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure or timeout — never expose the underlying error
    // message (could contain a raw URL/host detail).
    return { ok: false, result: { status: 'error', message: 'Could not reach the AI service. Please try again later.' } };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, result: { status: 'error', message: 'Received an unreadable response from the AI service.' } };
  }

  if (!res.ok) {
    // Worker's own safe error contracts (503 ai_not_configured, 504
    // ai_timeout, 502 ai_provider_error/ai_invalid_response, 400
    // invalid_request, etc.) — never expose more than the Worker's own
    // already-generic message.
    const b = json as { message?: unknown };
    return {
      ok: false,
      result: { status: 'error', message: typeof b.message === 'string' ? b.message : 'The AI service returned an error.' },
    };
  }

  return { ok: true, body: json };
}

/** Interprets optional free-text user input into structured preferences
 *  over `questions` (the caller's own current question set — the SAME
 *  ids/options the questionnaire already uses, never a Worker-side
 *  copy). The result is a PROPOSAL only: callers must show it to the
 *  user for review/confirmation before dispatching SET_ANSWER — this
 *  function never mutates any application state itself. */
export async function interpretPreferences(
  lang: 'ar' | 'en',
  text: string,
  questions: InterpretableQuestion[],
): Promise<InterpretPreferencesResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { status: 'invalid_request', message: 'Please describe your preferences first.' };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { status: 'invalid_request', message: `Text must be at most ${MAX_TEXT_LENGTH} characters.` };
  }
  if (questions.length > MAX_QUESTIONS) {
    return { status: 'invalid_request', message: `Too many questions supplied (max ${MAX_QUESTIONS}).` };
  }

  if (!AI_WORKER_BASE_URL) {
    return { status: 'unavailable', reason: 'AI preference interpretation is not available yet.' };
  }

  const outcome = await postJson(INTERPRET_ENDPOINT_PATH, { lang, text: trimmed, questions });
  if (!outcome.ok) return outcome.result;

  if (!isInterpretResponseShaped(outcome.body)) {
    return { status: 'error', message: 'Received an unexpected response from the AI service.' };
  }
  return { status: 'ok', interpreted: outcome.body.interpreted, unmapped: outcome.body.unmapped };
}

function isDestinationExplanationShaped(value: unknown): value is { destId: string; explanation: string } {
  const v = value as Record<string, unknown> | null;
  return !!v && typeof v.destId === 'string' && typeof v.explanation === 'string';
}

function isExplainResponseShaped(
  body: unknown,
): body is { summary: string; perDestination: Array<{ destId: string; explanation: string }>; caveats: string[] } {
  const b = body as { summary?: unknown; perDestination?: unknown; caveats?: unknown } | null;
  return (
    !!b &&
    typeof b.summary === 'string' &&
    Array.isArray(b.perDestination) &&
    b.perDestination.every(isDestinationExplanationShaped) &&
    Array.isArray(b.caveats) &&
    b.caveats.every((c) => typeof c === 'string')
  );
}

/** Explains WHY the given (already Phase-14-ranked) destinations fit,
 *  given verified structured context — never generates or reorders the
 *  ranking itself; the ranking has already happened by the time this is
 *  called. Callers should invoke this once, only after results/profile
 *  are ready, never on every render/keystroke. */
export async function explainRecommendation(
  lang: 'ar' | 'en',
  purposeName: string,
  profileSummary: string,
  topResults: RankedDestinationContext[],
): Promise<ExplainRecommendationResult> {
  if (topResults.length === 0) {
    return { status: 'unavailable', reason: 'No results to explain yet.' };
  }
  if (topResults.length > MAX_TOP_RESULTS) {
    return { status: 'unavailable', reason: 'Too many results to explain.' };
  }

  if (!AI_WORKER_BASE_URL) {
    return { status: 'unavailable', reason: 'AI recommendation explanation is not available yet.' };
  }

  const outcome = await postJson(EXPLAIN_ENDPOINT_PATH, { lang, purposeName, profileSummary, topResults });
  if (!outcome.ok) return outcome.result;

  if (!isExplainResponseShaped(outcome.body)) {
    return { status: 'error', message: 'Received an unexpected response from the AI service.' };
  }
  return {
    status: 'ok',
    summary: outcome.body.summary,
    perDestination: outcome.body.perDestination,
    caveats: outcome.body.caveats,
  };
}
