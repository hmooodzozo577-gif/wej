// Ports the original's state mutator functions (setLang's state assignment,
// startQuiz, restartAll, and the direct `state.answers[q.id] = val` /
// `state.qIndex++` / `state.explore = {...}` assignments from bindViewEvents)
// into a single reducer.
//
// Phase 15 — Adaptive Questions: `qIndex` now indexes into `state.path`
// (the ordered question ids actually presented so far, computed one
// question at a time by adaptive/selectNextQuestion.ts) rather than
// directly into QUESTION_BANKS[purpose]. See adaptive/README.md for the
// full audit/design this was built on. The reducer stays a pure
// function — selectNextQuestion() is itself pure/deterministic, no side
// effects introduced here.
//
// Phase 16.5 — a confirmed natural-language interpretation now calls
// SET_ANSWER with provenance:'ai_interpreted' (see
// components/NaturalPreferenceInput.tsx) instead of ever walking
// through that question — selectNextQuestion.ts now skips any
// question whose id already has ANY answer (not just already-asked
// ones), so an interpreted answer genuinely removes its question from
// the remaining interview. `state.satisfaction` records provenance
// per question id purely for the UI (the "already accounted for"
// list and its remove control) — Phase 14 never reads it, only
// `answers`' final values, so this cannot affect ranking.
import type { AppAction, AppState } from './types';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from '../adaptive';

export const initialAppState: AppState = {
  lang: 'ar', // Arabic remains the default language.
  purpose: null,
  qIndex: 0,
  path: [],
  answers: {},
  satisfaction: {},
  confidence: {},
  unresolvedPreferences: [],
  followup: null,
  followupTurnsUsed: 0,
  aiCallsUsed: 0,
  interviewStatus: 'active',
  interviewComplete: false,
  turnCount: 0,
  askedDimensionIds: [],
  results: null,
  explore: { q: '', region: '', purpose: '', cost: '' },
  location: { status: 'idle', coords: null },
};

/** The adaptively-chosen first question for a purpose's bank, given no
 *  answers yet — deterministic (see selectNextQuestion's own flavor-
 *  first / highest-weight-first rule), same shape used by both
 *  START_QUIZ and SYNC_QUIZ_PURPOSE below. */
function initialPath(purposeId: AppState['purpose']): string[] {
  if (!purposeId) return [];
  const first = selectNextQuestion(QUESTION_BANKS[purposeId], {}, []);
  return first ? [first.id] : [];
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang };

    case 'START_QUIZ':
      return {
        ...state,
        purpose: action.purpose,
        qIndex: 0,
        answers: {},
        satisfaction: {},
        confidence: {},
        unresolvedPreferences: [],
        followup: null,
        followupTurnsUsed: 0,
        aiCallsUsed: 0,
        interviewStatus: 'active',
        interviewComplete: false,
        turnCount: 0,
        askedDimensionIds: [],
        results: null,
        path: initialPath(action.purpose),
      };

    case 'PRESELECT_PURPOSE':
      return { ...state, purpose: action.purpose };

    // Landing directly on /quiz/:purpose (e.g. via back/forward or a typed
    // URL) with no in-progress quiz for that purpose: start fresh, same as
    // clicking the purpose card would.
    case 'SYNC_QUIZ_PURPOSE':
      return {
        ...state,
        purpose: action.purpose,
        qIndex: 0,
        answers: {},
        satisfaction: {},
        confidence: {},
        unresolvedPreferences: [],
        followup: null,
        followupTurnsUsed: 0,
        aiCallsUsed: 0,
        interviewStatus: 'active',
        interviewComplete: false,
        turnCount: 0,
        askedDimensionIds: [],
        results: null,
        path: initialPath(action.purpose),
      };

    case 'SET_ANSWER': {
      const { questionId, value, provenance = 'direct', confidence } = action;
      const valueChanged = state.answers[questionId] !== value;
      const pos = state.path.indexOf(questionId);
      const isPastQuestion = pos !== -1 && pos < state.path.length - 1;
      const answers = { ...state.answers, [questionId]: value };
      const satisfaction = { ...state.satisfaction, [questionId]: provenance };
      const confidenceMap = { ...state.confidence };
      if (confidence) confidenceMap[questionId] = confidence;
      else delete confidenceMap[questionId];

      // Back / changed-answer behavior: the user navigated back to an
      // EARLIER question (not the current frontier) and picked a
      // DIFFERENT value than before — the adaptive path computed
      // forward from the old value may no longer be the right one.
      // Truncate `path` right after this question and drop every
      // now-stale downstream answer (never leave a hidden answer from
      // an invalidated branch silently influencing the final result).
      // Re-selecting the SAME value, or editing the current frontier
      // question (nothing downstream exists yet), never truncates.
      // An 'ai_interpreted' answer is never itself a past-path entry
      // (see AppState.path's own doc comment), so this branch only
      // ever fires for a 'direct' edit — unaffected by Phase 16.5.
      if (isPastQuestion && valueChanged) {
        const truncatedPath = state.path.slice(0, pos + 1);
        const staleIds = state.path.slice(pos + 1);
        for (const id of staleIds) {
          delete answers[id];
          delete satisfaction[id];
          delete confidenceMap[id];
        }
        // Completion pass — a pending follow-up was selected from the
        // profile state that existed BEFORE this edit; changing an
        // earlier answer can change what's still worth clarifying, so
        // a stale pending follow-up is dropped rather than answered
        // against now-invalid context. It can be re-offered fresh on
        // the next AI interaction if still relevant.
        return { ...state, answers, satisfaction, confidence: confidenceMap, path: truncatedPath, qIndex: pos, followup: null };
      }

      // The first AI turn may finish while the traveler is still typing
      // the optional natural-language description. Once that description
      // is confirmed, the pending turn was chosen from an obsolete empty
      // profile. Drop it, release its target dimensions, and let the
      // adaptive driver request a fresh question using the newly confirmed
      // context. This prevents a generic pre-profile question from being
      // presented as though it were personalized.
      if (provenance === 'ai_interpreted' && state.followup) {
        const staleTargets = new Set(state.followup.candidateDimensionIds);
        return {
          ...state,
          answers,
          satisfaction,
          confidence: confidenceMap,
          followup: null,
          askedDimensionIds: state.askedDimensionIds.filter((id) => !staleTargets.has(id)),
          turnCount: Math.max(0, state.turnCount - 1),
          interviewComplete: false,
        };
      }
      return { ...state, answers, satisfaction, confidence: confidenceMap };
    }

    case 'SET_UNRESOLVED_PREFERENCES':
      return { ...state, unresolvedPreferences: action.values };

    // The optional natural-language interpretation can finish after an
    // empty-profile Capability C request has already produced a question
    // or entered fallback. Applying the confirmed profile starts a fresh
    // adaptive decision from that newer truth and invalidates the stale
    // pre-profile outcome without discarding any confirmed answers.
    case 'RESTART_AI_INTERVIEW_FROM_PROFILE':
      return {
        ...state,
        interviewStatus: 'active',
        interviewComplete: false,
        followup: null,
        askedDimensionIds: [],
        turnCount: 0,
      };

    // Phase 16.5 — "un-apply" a confirmed AI-derived preference (the
    // remove control on the "already accounted for" list). Refuses to
    // touch anything not recorded as 'ai_interpreted' or (completion
    // pass) 'ai_followup' — a 'direct' answer (or one already
    // overwritten by editing its own question directly) can never be
    // cleared through this action, only through the normal question
    // UI. The question was never in `path` (that's the entire point of
    // an AI-derived answer, interpreted or follow-up), so there is
    // nothing to truncate: it simply becomes unknown again, and the
    // next NEXT_QUESTION computation (selectNextQuestion, reading
    // `answers` fresh) can offer it up as a real question once more.
    case 'REMOVE_AI_ANSWER': {
      const provenance = state.satisfaction[action.questionId];
      if (provenance !== 'ai_interpreted' && provenance !== 'ai_followup') return state;
      const answers = { ...state.answers };
      const satisfaction = { ...state.satisfaction };
      const confidence = { ...state.confidence };
      delete answers[action.questionId];
      delete satisfaction[action.questionId];
      delete confidence[action.questionId];
      // Phase 16.5 TRUE adaptive-interview pass — Section 34 (edit
      // invalidation). This IS the edit/undo mechanism for an AI-driven
      // dimension (the AI-active loop has no traditional back-question
      // stepper — see Quiz.tsx). Un-asking it lets
      // adaptive/buildDimensionCatalog.ts mark it eligible again, and
      // clearing `interviewComplete` lets the AI loop reconsider it
      // instead of staying stuck at a stale "done" state.
      return {
        ...state,
        answers,
        satisfaction,
        confidence,
        askedDimensionIds: state.askedDimensionIds.filter((id) => id !== action.questionId),
        interviewComplete: false,
      };
    }

    // Completion pass — bounded multi-turn orchestration. See
    // PendingFollowup's own doc comment (state/types.ts) for the shape.
    // Refuses to overwrite an already-pending follow-up (one at a time;
    // the caller must resolve or dismiss the current one first).
    case 'SET_PENDING_FOLLOWUP': {
      if (state.followup) return state;
      // Phase 16.5 TRUE adaptive-interview pass — this is the ONE place a
      // follow-up (legacy template or, normally now, a real AI next-turn
      // decision) becomes pending, so it's the one place to record
      // dimension-level "already asked" state (Section 12) and count the
      // turn (Section 22's ceiling) — regardless of whether it's ever
      // resolved or dismissed.
      const askedDimensionIds = Array.from(new Set([...state.askedDimensionIds, ...action.followup.candidateDimensionIds]));
      return { ...state, followup: action.followup, askedDimensionIds, turnCount: state.turnCount + 1 };
    }

    // Applies every dimension the chosen option satisfies — provenance
    // 'ai_followup', exactly like a confirmed interpretation otherwise
    // (never added to `path`, so its question(s) never appear). Bumps
    // followupTurnsUsed (bounds total follow-up turns — see
    // adaptive/followupTemplates.ts's MAX_FOLLOWUP_TURNS) and clears
    // the pending follow-up. An option id that doesn't exist on the
    // current pending follow-up (stale dispatch) is a safe no-op.
    case 'RESOLVE_FOLLOWUP_CHOICE': {
      if (!state.followup) return state;
      const option = state.followup.options.find((o) => o.id === action.optionId);
      if (!option) return state;
      const answers = { ...state.answers };
      const satisfaction = { ...state.satisfaction };
      for (const [questionId, value] of Object.entries(option.satisfies)) {
        answers[questionId] = value;
        satisfaction[questionId] = 'ai_followup';
      }
      return { ...state, answers, satisfaction, followup: null, followupTurnsUsed: state.followupTurnsUsed + 1 };
    }

    // Dismissed without applying anything — still counts the turn so
    // the same (or an equally-triggered) clarification is never
    // immediately re-offered in a loop.
    case 'DISMISS_FOLLOWUP':
      if (!state.followup) return state;
      return { ...state, followup: null, followupTurnsUsed: state.followupTurnsUsed + 1 };

    case 'INCREMENT_AI_CALLS':
      return { ...state, aiCallsUsed: state.aiCallsUsed + 1 };

    // Phase 16.5 TRUE adaptive-interview pass — see AppState.interviewStatus's
    // own doc comment for the one-way-switch rationale. Clears any pending
    // AI-turn follow-up as moot (it was decided under a capability that just
    // failed) — the traveler lands on the deterministic Phase 15 bank
    // continuing from `state.answers`/`path` exactly as they are now.
    case 'SET_INTERVIEW_FALLBACK':
      if (state.interviewStatus === 'fallback') return state;
      return { ...state, interviewStatus: 'fallback', followup: null };

    case 'SET_INTERVIEW_COMPLETE':
      if (state.interviewComplete) return state;
      return { ...state, interviewComplete: true };

    case 'NEXT_QUESTION': {
      if (!state.purpose) return state;
      // Already have a cached next question from before (the user went
      // back then forward again without changing anything) — reuse it
      // as-is rather than recomputing, which also trivially guarantees
      // "unchanged answers -> unchanged path" determinism.
      if (state.qIndex + 1 < state.path.length) {
        return { ...state, qIndex: state.qIndex + 1 };
      }
      const bank = QUESTION_BANKS[state.purpose];
      const next = selectNextQuestion(bank, state.answers, state.path);
      if (!next) return state; // already at the true end — nothing left to ask
      return { ...state, path: [...state.path, next.id], qIndex: state.qIndex + 1 };
    }

    case 'PREV_QUESTION':
      return { ...state, qIndex: Math.max(0, state.qIndex - 1) };

    case 'SET_RESULTS':
      return { ...state, results: action.results };

    case 'RESTART_ALL':
      return {
        ...state,
        purpose: null,
        qIndex: 0,
        path: [],
        answers: {},
        satisfaction: {},
        confidence: {},
        unresolvedPreferences: [],
        followup: null,
        followupTurnsUsed: 0,
        aiCallsUsed: 0,
        interviewStatus: 'active',
        interviewComplete: false,
        turnCount: 0,
        askedDimensionIds: [],
        results: null,
      };

    case 'SET_EXPLORE_FILTER':
      return { ...state, explore: { ...state.explore, [action.key]: action.value } };

    case 'RESET_EXPLORE_FILTERS':
      return { ...state, explore: { q: '', region: '', purpose: '', cost: '' } };

    case 'LOCATION_REQUEST':
      return { ...state, location: { status: 'requesting', coords: null } };

    case 'LOCATION_GRANTED':
      return { ...state, location: { status: 'granted', coords: action.coords } };

    case 'LOCATION_FAILED':
      return { ...state, location: { status: action.status, coords: null } };

    case 'LOCATION_RESET':
      return { ...state, location: { status: 'idle', coords: null } };

    default:
      return state;
  }
}
