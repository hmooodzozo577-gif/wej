// Phase 16.5 TRUE adaptive-interview pass — the normal-path question
// driver required by Section 0 ("AI determines the most useful missing
// information -> AI generates the next contextual question... repeat
// while useful"), replacing Task 3's deterministic keyword-classified
// template bank as the thing that decides what to ask next. Phase 15
// (adaptive/selectNextQuestion.ts) is untouched and remains the
// FAILURE-FALLBACK-ONLY driver (see Quiz.tsx, which renders the old bank
// UI unchanged whenever `interviewStatus === 'fallback'`).
//
// Section 33 — interview domain state as a pure module, not buried in a
// component: `decideAdaptiveInterviewStep` is the actual decision logic,
// fully unit-testable with no React/network involved. `useAdaptiveInterview`
// is only the thin effect that calls it, calls the real AI service when
// asked to, and dispatches the result — nothing else lives here.
import { useEffect, useRef } from 'react';
import { nextTurn } from '../ai/aiService';
import { buildDimensionCatalog, computeMaxInterviewTurns } from '../ai/buildDimensionCatalog';
import type { AppAction, AppState, PendingFollowup } from '../state/types';
import type { DimensionCatalogEntry } from '../ai/types';
import type { PurposeId, Lang } from '../data/types';

type InterviewSnapshot = Pick<AppState, 'answers' | 'askedDimensionIds' | 'interviewStatus' | 'interviewComplete' | 'followup' | 'turnCount'>;

export type AdaptiveInterviewDecision =
  | { action: 'call'; catalog: DimensionCatalogEntry[]; confirmedProfile: Record<string, string | number>; turnNumber: number }
  // Nothing eligible left to ask, or the turn ceiling was reached —
  // settle the interview deterministically, without spending a real AI
  // call just to be told what is already knowable locally (Section 21 —
  // "no unnecessary rendering-triggered requests").
  | { action: 'complete' }
  // Not active, already has a pending turn, or already complete — do
  // nothing this tick.
  | { action: 'idle' };

/** Pure decision: given the current interview state, what should happen
 *  next? Never calls the network itself. */
export function decideAdaptiveInterviewStep(purposeId: PurposeId | null, state: InterviewSnapshot, lang: Lang): AdaptiveInterviewDecision {
  if (!purposeId) return { action: 'idle' }; // invalid route, or purpose not yet synced (see Quiz.tsx)
  if (state.interviewStatus !== 'active') return { action: 'idle' };
  if (state.interviewComplete) return { action: 'idle' };
  if (state.followup) return { action: 'idle' }; // one turn resolved/dismissed at a time

  const catalog = buildDimensionCatalog(purposeId, state, lang);
  const maxTurns = computeMaxInterviewTurns(catalog);
  if (state.turnCount >= maxTurns) return { action: 'complete' };

  const eligible = catalog.filter((d) => !d.resolved && !d.alreadyAsked);
  if (eligible.length === 0) return { action: 'complete' };

  const confirmedProfile: Record<string, string | number> = {};
  for (const d of catalog) {
    if (d.resolved) confirmedProfile[d.id] = state.answers[d.id] as string | number;
  }
  return { action: 'call', catalog, confirmedProfile, turnNumber: state.turnCount + 1 };
}

/** Turns a validated AI next-turn "ask" outcome into the existing
 *  PendingFollowup shape (reused, not renamed — see that type's own doc
 *  comment in state/types.ts for why). Exported standalone so the
 *  mapping itself is unit-testable without mounting the hook. */
export function toPendingFollowup(
  turnNumber: number,
  outcome:
    | { kind: 'ask'; questionType: 'choice'; targetDimensions: string[]; prompt: string; options: { id: string; label: string; updates: Record<string, string | number> }[] }
    | { kind: 'ask'; questionType: 'free_text'; targetDimensions: string[]; prompt: string },
): PendingFollowup {
  const prompt = { ar: outcome.prompt, en: outcome.prompt };
  if (outcome.questionType === 'free_text') {
    return { templateId: `ai-turn-${turnNumber}`, prompt, options: [], allowFreeText: true, candidateDimensionIds: outcome.targetDimensions, questionType: 'free_text' };
  }
  return {
    templateId: `ai-turn-${turnNumber}`,
    prompt,
    options: outcome.options.map((o) => ({ id: o.id, label: { ar: o.label, en: o.label }, satisfies: o.updates })),
    allowFreeText: false,
    candidateDimensionIds: outcome.targetDimensions,
    questionType: 'choice',
  };
}

/** Drives the AI-turn loop for the CURRENT purpose/quiz session. Fires
 *  whenever the decision changes to 'call' or 'complete'; requests are
 *  shared only while their context is unchanged, including StrictMode's
 *  effect replay (Section 21 — "no duplicate call for identical state").
 *  A response from an obsolete profile/session never changes current
 *  interview state. Any CURRENT request's
 *  non-'ok' result (unavailable/invalid_request/error — covers not-
 *  configured, timeout, provider error, quota exhaustion, and malformed/
 *  rejected responses alike, see aiService.ts's nextTurn) is treated as
 *  ordinary AI unavailability and flips the session to Phase 15
 *  fallback for good (Sections 19-20). */
export function useAdaptiveInterview(
  purposeId: PurposeId | null,
  purposeName: string,
  lang: Lang,
  originCountry: string | undefined,
  state: InterviewSnapshot,
  dispatch: (action: AppAction) => void,
): void {
  const inFlightRef = useRef<{ context: readonly unknown[]; promise: ReturnType<typeof nextTurn> } | null>(null);

  useEffect(() => {
    const decision = decideAdaptiveInterviewStep(purposeId, state, lang);
    if (decision.action === 'idle') return;
    if (decision.action === 'complete') {
      dispatch({ type: 'SET_INTERVIEW_COMPLETE' });
      return;
    }
    // Reducer-owned references detect both value edits and a fresh empty
    // session for the same purpose. Unrelated renders preserve them.
    const context = [purposeId, purposeName, lang, originCountry, state.answers, state.askedDimensionIds, state.turnCount, dispatch];
    let request = inFlightRef.current;
    if (!request || request.context.some((value, index) => value !== context[index])) {
      request = {
        context,
        promise: nextTurn(lang, purposeName, decision.catalog, decision.confirmedProfile, decision.turnNumber, originCountry),
      };
      inFlightRef.current = request;
    }
    let active = true;
    request.promise.then((result) => {
      if (!active || inFlightRef.current !== request) return;
      inFlightRef.current = null;
      if (result.status !== 'ok') {
        dispatch({ type: 'SET_INTERVIEW_FALLBACK' });
        return;
      }
      if (result.outcome.kind === 'complete') {
        dispatch({ type: 'SET_INTERVIEW_COMPLETE' });
        return;
      }
      dispatch({ type: 'SET_PENDING_FOLLOWUP', followup: toPendingFollowup(decision.turnNumber, result.outcome) });
    });
    return () => {
      active = false;
      // Keep the promise for an identical-context StrictMode replay.
      // The service owns the network timeout; cleanup only detaches this
      // subscriber so an old success/error/complete cannot be dispatched.
    };
    // Deliberately NOT depending on the whole `state` object (a fresh
    // object every render would re-run this on every unrelated render —
    // see react-best-practices review in the final report). Answer values
    // affect the AI's context even when eligibility/counts stay the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeId, purposeName, lang, originCountry, state.interviewStatus, state.interviewComplete, state.followup, state.turnCount, state.answers, state.askedDimensionIds, dispatch]);
}
