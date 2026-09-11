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
  DimensionCatalogEntry,
  ExplainRecommendationResult,
  InterpretableQuestion,
  InterpretPreferencesResult,
  NextTurnServiceResult,
  RankedDestinationContext,
} from './types';

// ---- Worker endpoint configuration ----------------------------------------
// Same Worker as travelService.ts's VITE_TRAVEL_WORKER_URL (see
// worker/src/index.ts's /api/ai/* routes, added alongside the existing
// /api/travel/flights route — no second backend was created). Kept as
// its own env var, per-concern, matching the convention
// VITE_TRAVEL_WORKER_URL already established. Set at build time in
// .github/workflows/deploy-pages.yml to the real deployed Worker
// origin — see SECRETS.md's Phase 16 section.
const AI_WORKER_BASE_URL: string | undefined = import.meta.env.VITE_AI_WORKER_URL;

const INTERPRET_ENDPOINT_PATH = '/api/ai/interpret-preferences';
const EXPLAIN_ENDPOINT_PATH = '/api/ai/explain-recommendation';
const NEXT_TURN_ENDPOINT_PATH = '/api/ai/next-turn';

// Phase 16.5 TRUE adaptive-interview pass — a single, synchronous "is the
// AI capability configured at all" check, shared by every capability
// (interpret/explain/next-turn all live behind the same Worker). Used by
// adaptive/useAdaptiveInterview.ts to decide, once, whether the AI-driven
// interview loop should even attempt to run — "never configured" is
// treated as ordinary unavailability (Section 19/20), i.e. the SAME
// fallback outcome a runtime failure produces, just decided up front
// instead of after one wasted request.
export function isAiConfigured(): boolean {
  return !!AI_WORKER_BASE_URL;
}
// PRODUCTION-FAILURE FIX: a real user's browser request timed out here
// (this constant was still 15s) even though the Worker's own AI-call
// budget had already been raised to 30s in a prior pass — the browser
// gave up and discarded the response before the Worker could ever
// finish, collapsing to the generic "couldn't interpret" fallback.
// Reproduced with a browser-equivalent request (production Origin,
// real user's exact phrase, full question bank): the Worker itself
// took 30.08s and several other real calls in the same investigation
// exceeded even that. The Worker's own timeout
// (worker/src/ai/cloudflareWorkersAiProvider.ts's RUN_TIMEOUT_MS) was
// raised to 45s from that same evidence — this value MUST stay
// strictly greater than that one, with margin for real network time,
// or this exact failure returns. Keep the two in sync by hand (the
// two packages don't share code — see that file's own comment).
const REQUEST_TIMEOUT_MS = 50_000;

// Mirrors worker/src/ai/validate.ts's limits — client-side pre-check so
// an obviously oversized request never reaches the network, same
// rationale as travelService.ts's validateTravelSearchRequest.
const MAX_TEXT_LENGTH = 500;
const MAX_QUESTIONS = 20;
const MAX_TOP_RESULTS = 10;

// Phase 16.5 completion pass — hard AI call budget per interview. Never
// enforced server-side (the Worker has no session concept), so every
// CALLER (NaturalPreferenceInput's initial interpretation, and its
// follow-up free-text escape hatch) must check `state.aiCallsUsed <
// MAX_AI_CALLS_PER_INTERVIEW` before calling and dispatch
// INCREMENT_AI_CALLS after. Budget: 1 initial interpretation + up to 2
// scoped follow-up interpretations (one per contextual clarification —
// see adaptive/followupTemplates.ts's MAX_FOLLOWUP_TURNS, which bounds
// the number of follow-ups that can even be offered). No polling, no
// retry loop anywhere in this file counts separately — a single
// request's own internal timeout/abort is not a second call.
export const MAX_AI_CALLS_PER_INTERVIEW = 3;

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

// Phase 16.5 completion pass — location integration. A COARSE, already-
// resolved country NAME only (see ai/buildLocationContext.ts, which
// derives it locally from the existing voluntary location system via
// data/geo.ts's resolveCurrentCountry — never a coordinate). Bounded
// length client-side as an extra guard alongside the Worker's own.
const MAX_ORIGIN_COUNTRY_LENGTH = 100;

/** Interprets optional free-text user input into structured preferences
 *  over `questions` (the caller's own current question set — the SAME
 *  ids/options the questionnaire already uses, never a Worker-side
 *  copy). The result is a PROPOSAL only: callers must show it to the
 *  user for review/confirmation before dispatching SET_ANSWER — this
 *  function never mutates any application state itself.
 *
 *  `originCountry`, when given, MUST already be a coarse country name
 *  (never coordinates, never a full address) — see
 *  ai/buildLocationContext.ts, the one place this project derives it. */
export async function interpretPreferences(
  lang: 'ar' | 'en',
  text: string,
  questions: InterpretableQuestion[],
  originCountry?: string,
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

  const trimmedOrigin = originCountry?.trim().slice(0, MAX_ORIGIN_COUNTRY_LENGTH);
  const body: Record<string, unknown> = { lang, text: trimmed, questions };
  if (trimmedOrigin) body.originCountry = trimmedOrigin;

  const outcome = await postJson(INTERPRET_ENDPOINT_PATH, body);
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

// ---- Capability C: AI-driven interview next-turn decision ------------------
// Phase 16.5 TRUE adaptive-interview pass. Mirrors worker/src/ai/validate.ts's
// own limits — client-side pre-check only; the Worker's own validation is
// the real, authoritative gate (see that file's validateNextTurnRequest/
// validateNextTurnResult).
const MAX_CATALOG_ENTRIES = 20;

function isNextTurnOptionShaped(value: unknown): value is { id: string; label: string; updates: Record<string, string | number> } {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.id !== 'string' || typeof v.label !== 'string' || typeof v.updates !== 'object' || v.updates === null) return false;
  return Object.values(v.updates as Record<string, unknown>).every((val) => typeof val === 'string' || typeof val === 'number');
}

function isNextTurnResponseShaped(body: unknown): body is
  | { status: 'ask'; questionType: 'choice'; targetDimensions: string[]; prompt: string; options: unknown[] }
  | { status: 'ask'; questionType: 'free_text'; targetDimensions: string[]; prompt: string }
  | { status: 'complete' } {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.status !== 'string') return false;
  if (b.status === 'complete') return true;
  if (b.status !== 'ask') return false;
  if (typeof b.prompt !== 'string' || !Array.isArray(b.targetDimensions) || !b.targetDimensions.every((d) => typeof d === 'string')) return false;
  if (b.questionType === 'free_text') return true;
  return b.questionType === 'choice' && Array.isArray(b.options) && b.options.every(isNextTurnOptionShaped);
}

/** Requests ONE next-turn decision from the AI: the next contextual
 *  question to ask (choice or free-text), or that the interview has
 *  enough information already. `catalog` must reflect the FULL current
 *  dimension set (resolved and unresolved, asked and unasked — see
 *  ai/buildDimensionCatalog.ts) so the model can see what it must never
 *  re-target; the Worker re-validates this server-side regardless. Never
 *  called on every render/keystroke — see adaptive/useAdaptiveInterview.ts
 *  for the one call site and its own guards against duplicate/overlapping
 *  requests. */
export async function nextTurn(
  lang: 'ar' | 'en',
  purposeName: string,
  catalog: DimensionCatalogEntry[],
  confirmedProfile: Record<string, string | number>,
  turnNumber: number,
  originCountry?: string,
): Promise<NextTurnServiceResult> {
  if (catalog.length === 0) {
    return { status: 'invalid_request', message: 'No dimensions to ask about.' };
  }
  if (catalog.length > MAX_CATALOG_ENTRIES) {
    return { status: 'invalid_request', message: `Too many catalog entries (max ${MAX_CATALOG_ENTRIES}).` };
  }
  if (turnNumber < 1) {
    return { status: 'invalid_request', message: 'turnNumber must be at least 1.' };
  }

  if (!AI_WORKER_BASE_URL) {
    return { status: 'unavailable', reason: 'The adaptive interview is not available yet.' };
  }

  const trimmedOrigin = originCountry?.trim().slice(0, MAX_ORIGIN_COUNTRY_LENGTH);
  const body: Record<string, unknown> = { lang, purposeName, catalog, confirmedProfile, turnNumber };
  if (trimmedOrigin) body.originCountry = trimmedOrigin;

  const outcome = await postJson(NEXT_TURN_ENDPOINT_PATH, body);
  if (!outcome.ok) return outcome.result;

  if (!isNextTurnResponseShaped(outcome.body)) {
    return { status: 'error', message: 'Received an unexpected response from the AI service.' };
  }
  if (outcome.body.status === 'complete') {
    return { status: 'ok', outcome: { kind: 'complete' } };
  }
  if (outcome.body.questionType === 'free_text') {
    return { status: 'ok', outcome: { kind: 'ask', questionType: 'free_text', targetDimensions: outcome.body.targetDimensions, prompt: outcome.body.prompt } };
  }
  return {
    status: 'ok',
    outcome: {
      kind: 'ask',
      questionType: 'choice',
      targetDimensions: outcome.body.targetDimensions,
      prompt: outcome.body.prompt,
      options: outcome.body.options as { id: string; label: string; updates: Record<string, string | number> }[],
    },
  };
}
