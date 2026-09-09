// Ports the original's state mutator functions (setLang's state assignment,
// startQuiz, restartAll, and the direct `state.answers[q.id] = val` /
// `state.qIndex++` / `state.explore = {...}` assignments from bindViewEvents)
// into a single reducer.
import type { AppAction, AppState } from './types';

export const initialAppState: AppState = {
  lang: 'ar', // Arabic remains the default language.
  purpose: null,
  qIndex: 0,
  answers: {},
  results: null,
  explore: { q: '', region: '', purpose: '', cost: '' },
  location: { status: 'idle', coords: null },
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang };

    case 'START_QUIZ':
      return { ...state, purpose: action.purpose, qIndex: 0, answers: {}, results: null };

    case 'PRESELECT_PURPOSE':
      return { ...state, purpose: action.purpose };

    // Landing directly on /quiz/:purpose (e.g. via back/forward or a typed
    // URL) with no in-progress quiz for that purpose: start fresh, same as
    // clicking the purpose card would.
    case 'SYNC_QUIZ_PURPOSE':
      return { ...state, purpose: action.purpose, qIndex: 0, answers: {}, results: null };

    case 'SET_ANSWER':
      return { ...state, answers: { ...state.answers, [action.questionId]: action.value } };

    case 'NEXT_QUESTION':
      return { ...state, qIndex: state.qIndex + 1 };

    case 'PREV_QUESTION':
      return { ...state, qIndex: Math.max(0, state.qIndex - 1) };

    case 'SET_RESULTS':
      return { ...state, results: action.results };

    case 'RESTART_ALL':
      return { ...state, purpose: null, qIndex: 0, answers: {}, results: null };

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
