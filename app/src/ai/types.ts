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

export interface InterpretableQuestion {
  id: string;
  kind: string;
  options: Array<string | number>;
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
