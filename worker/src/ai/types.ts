// Phase 16 — AI API Integration. Shared types for the AI intelligence
// layer. Worker-local (never imports from app/ — the two packages are
// structurally separate, same convention as amadeus.ts's own
// FlightSearchRequestBody), and deliberately provider-neutral: nothing
// here names a specific vendor.
//
// SECRETS: no AI API key is ever read outside ai/provider.ts, logged,
// included in an error message, or returned to a caller — same
// discipline as AMADEUS_API_KEY/AMADEUS_API_SECRET in amadeus.ts (see
// ../../../SECRETS.md). Note that the SELECTED provider below (native
// Cloudflare Workers AI, see cloudflareWorkersAiProvider.ts) needs no
// API key at all — see that file's own doc comment for why.
import type { Ai } from '@cloudflare/workers-types';

export interface Env {
  /** Native Cloudflare Workers AI binding (wrangler.toml's `[ai]
   *  binding = "AI"`) — Cloudflare injects this directly, no API key
   *  involved. Absent in any environment that hasn't configured the
   *  binding (e.g. a unit test's plain object `Env`), which
   *  resolveAiProvider() treats exactly like "no provider available",
   *  never a crash. This is the PRIMARY provider path now that
   *  Cloudflare Workers AI has been selected — see provider.ts. */
  AI?: Ai;
  /** Legacy extension point for a hypothetical non-Workers-AI vendor
   *  requiring its own API key — kept only because resolveAiProvider()
   *  still falls back to it when `AI` is absent; no such vendor is
   *  registered (see provider.ts), so this is never actually read for
   *  a live call today. Absent from this repository's real
   *  configuration. */
  AI_PROVIDER?: string;
  /** See AI_PROVIDER above — same "never actually used today" status. */
  AI_API_KEY?: string;
}

// ---- Capability A: natural preference interpretation ----------------------

/** One allowed answer value for a question, paired with its
 *  human-readable label (in the request's own `lang`) — the label is
 *  context for the MODEL only, never trusted as the answer itself; the
 *  model must still return one of the listed `value`s, and the
 *  server-side validator (ai/validate.ts) checks the returned value
 *  against `value`, never against label text.
 *
 *  Why this exists (real production bug, Phase 16.5 correction pass):
 *  before this field existed, the Worker sent the model bare values
 *  like [15, 50, 90] for a question named "naturecity" with no
 *  indication of which number means what. The model had nothing to
 *  ground its answer in except guessing from the question id/kind
 *  string, and for a real user's explicit "فيها طبيعة" (nature) it
 *  guessed 90 — which this project's own question bank defines as
 *  "🏙️ Cities", the OPPOSITE meaning. The label is the fix: the model
 *  is told outright that 15 means "Nature" and 90 means "Cities", so
 *  it no longer has to guess numeric direction from a variable name it
 *  was never shown. */
export interface InterpretableOption {
  value: string | number;
  label: string;
}

/** One question the caller (the frontend) currently allows the model
 *  to propose an answer for — supplied BY the request, not looked up
 *  Worker-side (this Worker has no copy of app/'s question banks, by
 *  design: the frontend is the single source of truth for question
 *  metadata, avoiding a second, driftable copy here). `options` is the
 *  exhaustive real value set for that question, each with its label —
 *  the server-side validator (see ai/validate.ts) rejects any
 *  interpreted value not present in this list, so the model can never
 *  introduce a value that doesn't exist in the real questionnaire. */
export interface InterpretableQuestion {
  id: string;
  kind: string;
  options: InterpretableOption[];
}

export interface InterpretPreferencesRequest {
  lang: 'ar' | 'en';
  /** Free-text user input — untrusted, never treated as an instruction
   *  (see ai/prompts.ts's system/user separation). */
  text: string;
  questions: InterpretableQuestion[];
  /** Phase 16.5 completion pass — location integration. A COARSE
   *  country name ONLY (e.g. "Saudi Arabia") — the frontend's
   *  ai/buildLocationContext.ts is the one place this is derived, from
   *  the existing voluntary location system, and it structurally
   *  cannot produce anything coordinate-shaped. Optional: absent
   *  whenever location was never granted, which the interview must
   *  (and does) handle identically to having it. Used ONLY as coarse
   *  context (e.g. travel-distance practicality) — see prompts.ts's
   *  explicit instruction never to infer religion/ethnicity/values/
   *  cultural-tolerance from it. */
  originCountry?: string;
}

export interface InterpretedPreference {
  questionId: string;
  value: string | number;
  confidence: 'high' | 'medium' | 'low';
}

export interface InterpretPreferencesResult {
  interpreted: InterpretedPreference[];
  /** Parts of the user's text the model could not map to any allowed
   *  question — surfaced honestly rather than forced into a guess. */
  unmapped: string[];
}

// ---- Capability C: AI-driven interview next-turn decision ------------------
// Phase 16.5 TRUE adaptive-interview pass — replaces a deterministic
// keyword-classified template bank as the NORMAL question-selection path.
// The frontend sends the full dimension catalog (every question the current
// purpose bank supports, resolved or not) and the model decides ONE next
// turn: ask a bounded CHOICE, ask a bounded FREE-TEXT clarification, or
// declare the interview COMPLETE. The model never invents a dimension,
// never returns a value outside a dimension's real allowed set, and never
// re-targets an already-resolved or already-asked dimension — all
// re-checked here (ai/validate.ts), never trusted from the model's own
// claim.

/** One dimension (question) in the current purpose bank, as the model
 *  needs to understand it — resolved state and ranking-support status
 *  included so the model can reason about what's actually worth asking,
 *  never inferring importance from a bare id string. */
export interface DimensionCatalogEntry {
  id: string;
  kind: string;
  /** The deterministic bank wording, supplied only as semantic reference
   *  and for server-side duplicate-question rejection. Optional only for
   *  a safe rolling deployment with the previous frontend contract. */
  question?: string;
  /** Whether this id is an actual Phase 14 scoring input (every
   *  non-'flavor' kind) or interview-context only (flavor questions,
   *  excluded from scoring — see engine/scoreDestination.ts). Told to
   *  the model so it can prioritize ranking-supported gaps first. */
  rankingSupported: boolean;
  /** Already has a confirmed value (direct, AI-interpreted, or a prior
   *  turn) — the model must never target a resolved dimension again. */
  resolved: boolean;
  /** Already targeted by an earlier turn in this session (whether or
   *  not it ended up resolved) — also never re-targeted, the semantic-
   *  dimension-level duplicate prevention this phase requires. */
  alreadyAsked: boolean;
  options: InterpretableOption[];
}

export interface NextTurnRequest {
  lang: 'ar' | 'en';
  purposeName: string;
  catalog: DimensionCatalogEntry[];
  /** Confirmed values for every `resolved` catalog entry — lets the
   *  model reason about the traveler's existing profile (e.g. already
   *  cold+nature, so a "relaxing four days" mention might best resolve
   *  via the adventure dimension) without re-deriving it from scratch. */
  confirmedProfile: Record<string, string | number>;
  turnNumber: number;
  /** See InterpretPreferencesRequest's own doc comment — identical
   *  coarse-context-only contract, identical non-inference instruction. */
  originCountry?: string;
}

export interface NextTurnOption {
  id: string;
  label: string;
  /** Canonical dimension -> value updates this option applies if
   *  chosen. Every key MUST be a catalog dimension id targeted by this
   *  turn; every value MUST be one of that dimension's real allowed
   *  values — re-validated here, never trusted from the model. May
   *  cover more than one dimension (a single answer resolving multiple
   *  supported preferences at once). */
  updates: Record<string, string | number>;
}

export type NextTurnResult =
  | {
      status: 'ask';
      questionType: 'choice';
      targetDimensions: string[];
      prompt: string;
      options: NextTurnOption[];
    }
  | {
      status: 'ask';
      questionType: 'free_text';
      targetDimensions: string[];
      prompt: string;
    }
  | { status: 'complete' }
  /** The model's response was syntactically valid JSON but failed
   *  semantic re-validation (e.g. targeted an already-resolved
   *  dimension, invented a value, or was otherwise malformed) — index.ts
   *  maps this to the SAME 502 ai_provider_error response a malformed-
   *  JSON failure gets, never silently treated as 'complete' (that would
   *  falsely claim the interview has enough information) and never
   *  passed through to the frontend as if it were a real decision. */
  | { status: 'invalid' };

// ---- Capability B: personalized recommendation explanation ----------------

export interface RankedDestinationContext {
  destId: string;
  name: string;
  score: number;
  /** Human-readable top reasons, already computed by the (Phase 14)
   *  deterministic engine — the AI explains these, never invents its
   *  own. */
  reasons: string[];
  /** Verified, already-displayed facts about this destination, as
   *  plain text the frontend assembled from its own trusted data
   *  (country info, Tourism Insights, Travel Cost Index) — never
   *  precise coordinates, never anything not already shown to the
   *  user elsewhere on the page. May be empty. */
  facts: string;
}

export interface ExplainRecommendationRequest {
  lang: 'ar' | 'en';
  purposeName: string;
  /** Short, already-derived summary of the user's own answers — never
   *  raw browser storage, never location coordinates. */
  profileSummary: string;
  topResults: RankedDestinationContext[];
}

export interface DestinationExplanation {
  destId: string;
  explanation: string;
}

export interface ExplainRecommendationResult {
  summary: string;
  perDestination: DestinationExplanation[];
  /** Caveats grounded only in the supplied facts/known project
   *  limitations (e.g. "accommodation cost data is not yet available")
   *  — never a fabricated price/statistic dressed up as a caveat. */
  caveats: string[];
}

// ---- Provider adapter contract --------------------------------------------

/** A concrete AI vendor implementation must satisfy this. The rest of
 *  the Worker (index.ts) never imports a vendor SDK or knows a vendor
 *  API shape — it only ever calls through this interface. */
export interface AiProvider {
  interpretPreferences(req: InterpretPreferencesRequest): Promise<InterpretPreferencesResult>;
  explainRecommendation(req: ExplainRecommendationRequest): Promise<ExplainRecommendationResult>;
  nextTurn(req: NextTurnRequest): Promise<NextTurnResult>;
}

// ---- Typed, safe-to-log-free errors ----------------------------------------
export class AiNotConfiguredError extends Error {}
export class AiTimeoutError extends Error {}
export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus: number,
  ) {
    super(message);
  }
}
export class AiInvalidResponseError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: 'output_empty' | 'output_json' | 'output_truncated' | 'invalid_output' = 'invalid_output',
  ) {
    super(message);
  }
}
