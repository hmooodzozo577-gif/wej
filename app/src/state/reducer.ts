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
      return { ...state, purpose: action.purpose, qIndex: 0, answers: {}, satisfaction: {}, confidence: {}, results: null, path: initialPath(action.purpose) };

    case 'PRESELECT_PURPOSE':
      return { ...state, purpose: action.purpose };

    // Landing directly on /quiz/:purpose (e.g. via back/forward or a typed
    // URL) with no in-progress quiz for that purpose: start fresh, same as
    // clicking the purpose card would.
    case 'SYNC_QUIZ_PURPOSE':
      return { ...state, purpose: action.purpose, qIndex: 0, answers: {}, satisfaction: {}, confidence: {}, results: null, path: initialPath(action.purpose) };

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
        return { ...state, answers, satisfaction, confidence: confidenceMap, path: truncatedPath, qIndex: pos };
      }
      return { ...state, answers, satisfaction, confidence: confidenceMap };
    }

    // Phase 16.5 — "un-apply" a confirmed AI-interpreted preference (the
    // remove control on the "already accounted for" list). Refuses to
    // touch anything not recorded as 'ai_interpreted' — a 'direct'
    // answer (or one already overwritten by editing its own question
    // directly) can never be cleared through this action, only through
    // the normal question UI. The question was never in `path` (that's
    // the entire point of an interpreted answer), so there is nothing
    // to truncate: it simply becomes unknown again, and the next
    // NEXT_QUESTION computation (selectNextQuestion, reading `answers`
    // fresh) can offer it up as a real question once more.
    case 'REMOVE_AI_ANSWER': {
      if (state.satisfaction[action.questionId] !== 'ai_interpreted') return state;
      const answers = { ...state.answers };
      const satisfaction = { ...state.satisfaction };
      const confidence = { ...state.confidence };
      delete answers[action.questionId];
      delete satisfaction[action.questionId];
      delete confidence[action.questionId];
      return { ...state, answers, satisfaction, confidence };
    }

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
      return { ...state, purpose: null, qIndex: 0, path: [], answers: {}, satisfaction: {}, confidence: {}, results: null };

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
