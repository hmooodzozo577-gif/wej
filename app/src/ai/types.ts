// Phase 16 — AI API Integration, frontend side. Mirrors
// worker/src/ai/types.ts's request/result shapes (the two packages are
// structurally separate — app/ never imports from worker/ — so these are
// duplicated the same way travelService.ts's validateTravelSearchRequest
// deliberately duplicates the Worker's own validator rather than sharing
// code across the app/worker boundary).
//
// Components must never import a provider SDK type, never see a raw AI
// API response, and never hold a provider URL or API key — all of that
// stays server-side in the Worker (see ../../../SECRETS.md). This module
// (together with aiService.ts) is the ONLY thing a component may talk to
// for AI features.

// ---- Capability A: natural preference interpretation ----------------------

/** An allowed value paired with its human-readable label in the
 *  request's own language — sent so the Worker/model has something to
 *  ground a numeric value in (see worker/src/ai/types.ts's matching
 *  doc comment for the real production bug this fixes: a bare-number
 *  option list gave the model nothing but a variable name to guess
 *  from, and it guessed "naturecity" backwards for an explicit "فيها
 *  طبيعة" statement). */
export interface InterpretableOption {
  value: string | number;
  label: string;
}

export interface InterpretableQuestion {
  id: string;
  kind: string;
  options: InterpretableOption[];
}

export interface InterpretedPreference {
  questionId: string;
  value: string | number;
  confidence: 'high' | 'medium' | 'low';
}

/** Discriminated union, same convention as TravelSearchResult
 *  (travel/types.ts): every failure mode (not configured, invalid
 *  request, network/timeout, malformed response) maps to a safe typed
 *  result. There is no path that fabricates an 'ok' result without a
 *  real, shape-validated Worker response. */
export type InterpretPreferencesResult =
  | { status: 'ok'; interpreted: InterpretedPreference[]; unmapped: string[] }
  | { status: 'unavailable'; reason: string }
  | { status: 'invalid_request'; message: string }
  | { status: 'error'; message: string };

// ---- Capability C: AI-driven interview next-turn decision ------------------
// Phase 16.5 TRUE adaptive-interview pass. Mirrors
// worker/src/ai/types.ts's own Capability C section — see that file's doc
// comments for the full security/duplicate-prevention rationale. The
// Worker (worker/src/ai/validate.ts's validateNextTurnResult) is the
// authoritative gate: every value here has already been checked against
// the real catalog by the time this frontend module sees it.

export interface DimensionCatalogEntry {
  id: string;
  kind: string;
  /** Original bank wording. Sent as reference so the Worker can reject
   *  model output that merely copies the deterministic question. */
  question: string;
  /** Existing deterministic Phase 14 question weight. The AI may use it
   *  to prioritize gaps but may never alter or invent it. */
  rankingWeight: number;
  rankingSupported: boolean;
  resolved: boolean;
  alreadyAsked: boolean;
  options: InterpretableOption[];
}

export interface NextTurnCatalogRequest {
  lang: 'ar' | 'en';
  purposeName: string;
  catalog: DimensionCatalogEntry[];
  confirmedProfile: Record<string, string | number>;
  turnNumber: number;
  unresolvedPreferences?: string[];
  /** See InterpretPreferencesRequest's own doc comment — identical
   *  coarse-context-only contract. */
  originCountry?: string;
}

export interface NextTurnOption {
  id: string;
  /** Single-language, AI-generated text (the request's own `lang`) —
   *  see PendingFollowup's doc comment (state/types.ts) for how this is
   *  stored alongside the pre-translated template shape. */
  label: string;
  updates: Record<string, string | number>;
}

/** Discriminated union covering every outcome the Worker's own
 *  `/api/ai/next-turn` route can return, including its transport-level
 *  failure modes — same convention as InterpretPreferencesResult. */
export type NextTurnServiceResult =
  | { status: 'ok'; outcome: { kind: 'ask'; questionType: 'choice'; targetDimensions: string[]; prompt: string; options: NextTurnOption[] } }
  | { status: 'ok'; outcome: { kind: 'ask'; questionType: 'free_text'; targetDimensions: string[]; prompt: string } }
  | { status: 'ok'; outcome: { kind: 'complete' } }
  | { status: 'unavailable'; reason: string }
  | { status: 'invalid_request'; message: string }
  | { status: 'error'; message: string };

// ---- Capability B: personalized recommendation explanation ----------------

export interface RankedDestinationContext {
  destId: string;
  name: string;
  score: number;
  /** Already-computed deterministic Phase 14 reasons (human-readable
   *  strings, e.g. from buildWhyText) — the AI explains these, it never
   *  invents its own. */
  reasons: string[];
  /** Verified facts already shown elsewhere on the page (cost level,
   *  safety, climate, etc.) as plain text — never precise coordinates,
   *  never a fabricated number. May be empty. */
  facts: string;
}

export interface DestinationExplanation {
  destId: string;
  explanation: string;
}

export type ExplainRecommendationResult =
  | { status: 'ok'; summary: string; perDestination: DestinationExplanation[]; caveats: string[] }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string };
