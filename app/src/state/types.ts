import type { Lang, PurposeId } from '../data/types';
import type { Answers, RankedResult } from '../engine';

export interface ExploreFilters {
  q: string;
  region: string;
  purpose: string;
  cost: string;
}

export interface LocationCoords {
  lat: number;
  lng: number;
}

/** Phase 12 — Location Personalization. `idle`: never requested (default,
 *  and what's restored by LOCATION_RESET). `requesting`: the browser
 *  permission prompt / getCurrentPosition call is in flight. `granted`:
 *  coords are populated. The rest are terminal failure states, mapped
 *  1:1 from the browser Geolocation API outcomes — see geo/geolocation.ts. */
export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Coordinates live in memory only — never persisted (no localStorage, no
 *  backend), never sent anywhere, cleared by LOCATION_RESET or a fresh
 *  page load. Only populated when status is 'granted'. */
export interface LocationState {
  status: LocationStatus;
  coords: LocationCoords | null;
}

/** Phase 16.5 — provenance of a single answered question: `'direct'`
 *  means the traveler picked it by walking through that question in
 *  the interview UI (the only kind Phase 15 ever produced);
 *  `'ai_interpreted'` means it was set from a CONFIRMED natural-
 *  language interpretation (NaturalPreferenceInput's "Apply"), and was
 *  never shown as a normal question at all — see
 *  adaptive/selectNextQuestion.ts, which now skips any question whose
 *  id already has an answer, direct or interpreted. `'ai_followup'`
 *  (completion pass) means it was resolved through a bounded,
 *  AI-triggered contextual clarification (see adaptive/
 *  followupTemplates.ts) — a distinct provenance so the Travel Profile
 *  can honestly report HOW a dimension became known, even though it is
 *  treated identically to 'ai_interpreted' everywhere that matters
 *  (elimination, restoration, Phase 14 input). Only `answers[id]` (not
 *  this map) is ever read by Phase 14 scoring — this is purely an
 *  interview/UI-layer concept, so it can never affect ranking. */
export type AnswerProvenance = 'direct' | 'ai_interpreted' | 'ai_followup';

/** Completion pass — a single selectable answer of a pending contextual
 *  follow-up (see adaptive/followupTemplates.ts). `satisfies` maps
 *  question ids to the EXACT canonical value that question would have
 *  received directly — never an arbitrary/generated score, always one
 *  of that question's own real allowed values from QUESTION_BANKS. */
export interface FollowupOption {
  id: string;
  label: Record<Lang, string>;
  satisfies: Record<string, string | number>;
}

/** Completion pass — the currently pending AI-guided contextual
 *  clarification, if any. Bounded and schema-shaped: a fixed template
 *  (see followupTemplates.ts) selected deterministically from the
 *  AI's own `unmapped` output plus the current profile — never
 *  freshly-authored English/Arabic prose generated at request time.
 *  `candidateDimensionIds` bounds the free-text escape hatch (if used)
 *  to only these ids, the same safety boundary NaturalPreferenceInput
 *  already applies to its own request. */
export interface PendingFollowup {
  templateId: string;
  prompt: Record<Lang, string>;
  options: FollowupOption[];
  allowFreeText: boolean;
  candidateDimensionIds: string[];
}

/** Mirrors the original's single mutable `state` object — minus `view`,
 *  `selectedId`, and `fromResults`, which react-router now owns (the URL
 *  and navigation `state` respectively). */
export interface AppState {
  lang: Lang;
  purpose: PurposeId | null;
  qIndex: number;
  /** Phase 15 — Adaptive Questions. The ORDERED question ids actually
   *  presented so far, computed by adaptive/selectNextQuestion.ts one
   *  question at a time as the user progresses — never the full bank
   *  order up front. `qIndex` indexes into this, not into
   *  QUESTION_BANKS[purpose] directly. Truncated (and any now-stale
   *  downstream answers removed) when the user goes back and changes
   *  an earlier answer — see reducer.ts's SET_ANSWER case.
   *
   *  Phase 16.5: an `'ai_interpreted'` answer is NEVER added to `path`
   *  — the whole point is that its question never gets shown. `path`
   *  therefore only ever lists questions the traveler actually saw. */
  path: string[];
  answers: Answers;
  /** Phase 16.5 — parallel to `answers`: same keys, records HOW each
   *  one was answered (see AnswerProvenance). Only ever read by the
   *  interview UI (to show/remove the "already accounted for" list) —
   *  never by Phase 14. Reset together with `answers` on
   *  START_QUIZ/SYNC_QUIZ_PURPOSE/RESTART_ALL. */
  satisfaction: Record<string, AnswerProvenance>;
  /** Phase 16.5 completion pass — Travel Profile support: the model's
   *  own reported confidence for an 'ai_interpreted' answer, carried
   *  alongside `satisfaction` (only ever populated for that provenance
   *  — a 'direct' answer has no AI confidence to record). Same
   *  UI/interview-layer-only guarantee as `satisfaction`: never read by
   *  Phase 14. See profile/travelProfile.ts, which surfaces this as
   *  part of each dimension's confirmed knowledge. */
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  /** Completion pass — the one currently active contextual follow-up
   *  (null when none is pending). Only ever one at a time — a new one
   *  is never offered while another is unresolved. */
  followup: PendingFollowup | null;
  /** Completion pass — bounded multi-turn orchestration counters. Both
   *  reset with the rest of interview state on START_QUIZ/
   *  SYNC_QUIZ_PURPOSE/RESTART_ALL; both are UI/orchestration-layer
   *  only, never read by Phase 14.
   *  `followupTurnsUsed`: how many contextual follow-ups have already
   *  been shown (resolved OR dismissed) — bounds total follow-up
   *  turns (see adaptive/followupTemplates.ts's MAX_FOLLOWUP_TURNS).
   *  `aiCallsUsed`: every real network call to the interpret-
   *  preferences endpoint (initial + any scoped free-text follow-up
   *  interpretation) — bounds the total AI call budget per interview
   *  (see aiService.ts's MAX_AI_CALLS_PER_INTERVIEW) and is asserted
   *  directly by the multi-turn orchestration test suite. */
  followupTurnsUsed: number;
  aiCallsUsed: number;
  results: RankedResult[] | null;
  explore: ExploreFilters;
  location: LocationState;
}

export type AppAction =
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'START_QUIZ'; purpose: PurposeId }
  // Ports `go('purpose', {purpose: id})` from Home's purpose-preview cards:
  // pre-selects a purpose on the Purpose Select screen WITHOUT resetting
  // qIndex/answers/results (unlike START_QUIZ) — matches the original's
  // `Object.assign(state, extra)`, which only ever touched `purpose` here.
  | { type: 'PRESELECT_PURPOSE'; purpose: PurposeId }
  | { type: 'SYNC_QUIZ_PURPOSE'; purpose: PurposeId }
  // `provenance` defaults to 'direct' when omitted — every pre-Phase-16.5
  // call site (Quiz.tsx's onSelect) keeps working unchanged.
  | { type: 'SET_ANSWER'; questionId: string; value: string | number; provenance?: AnswerProvenance; confidence?: 'high' | 'medium' | 'low' }
  // Phase 16.5 — "un-apply" a single AI-interpreted answer (the small
  // remove control on the "already accounted for" list). Refuses to
  // touch a 'direct' answer (reducer-level safety, not just a UI
  // affordance) — see reducer.ts. The question becomes unknown again
  // and can re-enter the remaining interview via selectNextQuestion.
  | { type: 'REMOVE_AI_ANSWER'; questionId: string }
  // Completion pass — bounded multi-turn orchestration. SET_PENDING_FOLLOWUP
  // offers exactly one contextual clarification (refuses if one is already
  // pending — see reducer.ts). RESOLVE_FOLLOWUP_CHOICE applies every
  // dimension the chosen option satisfies (provenance 'ai_followup') and
  // clears the pending follow-up. DISMISS_FOLLOWUP clears it WITHOUT
  // applying anything (still counts the turn, so a dismissed follow-up is
  // never immediately re-offered). INCREMENT_AI_CALLS is dispatched by
  // aiService callers around every real network attempt, for the AI call
  // budget the orchestration test suite asserts directly.
  | { type: 'SET_PENDING_FOLLOWUP'; followup: PendingFollowup }
  | { type: 'RESOLVE_FOLLOWUP_CHOICE'; optionId: string }
  | { type: 'DISMISS_FOLLOWUP' }
  | { type: 'INCREMENT_AI_CALLS' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'SET_RESULTS'; results: RankedResult[] }
  | { type: 'RESTART_ALL' }
  | { type: 'SET_EXPLORE_FILTER'; key: keyof ExploreFilters; value: string }
  | { type: 'RESET_EXPLORE_FILTERS' }
  // Phase 12 — Location Personalization. Dispatched around a single
  // getCurrentPosition() call in components/LocationPersonalize.tsx; the
  // reducer itself stays a pure function, the browser API call is the
  // component's side effect.
  | { type: 'LOCATION_REQUEST' }
  | { type: 'LOCATION_GRANTED'; coords: LocationCoords }
  | { type: 'LOCATION_FAILED'; status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'> }
  | { type: 'LOCATION_RESET' };
