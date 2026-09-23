import { selectNextQuestion } from '../adaptive';
import { effectiveQuestionBank, isLocationDependentQuestionId } from '../data/questionBanks';
import type { AppAction, AppState } from './types';

export const initialAppState: AppState = {
  lang: 'ar',
  purpose: null,
  qIndex: 0,
  path: [],
  answers: {},
  questionnaireCheckpointPassed: false,
  results: null,
  explore: { q: '', region: '', purpose: '', cost: '', sort: 'default' },
  exploreSortChosen: false,
  location: { status: 'idle', coords: null, diagnostic: null },
  passportCode: null,
};

function initialPath(purpose: AppState['purpose'], hasLocation: boolean): string[] {
  if (!purpose) return [];
  const first = selectNextQuestion(effectiveQuestionBank(purpose, hasLocation), {}, []);
  return first ? [first.id] : [];
}

function startPurpose(state: AppState, purpose: NonNullable<AppState['purpose']>): AppState {
  return {
    ...state,
    purpose,
    qIndex: 0,
    path: initialPath(purpose, !!state.location.coords),
    answers: {},
    questionnaireCheckpointPassed: false,
    results: null,
  };
}

/** Item #8 — when location context goes away, any answer that only existed
 *  BECAUSE there was location context (proximity, land-border) can no longer
 *  be honoured honestly, so it is dropped from both the answered set and the
 *  asked path rather than silently surviving as a stale preference. Ranking
 *  already ignores them without coordinates (rankDestinations.ts guards on
 *  `origin`); this keeps the questionnaire's own state consistent with what
 *  effectiveQuestionBank() would produce now. */
function withoutLocationQuestions(state: AppState): AppState {
  const stale = state.path.filter((id) => isLocationDependentQuestionId(id));
  if (!stale.length && !Object.keys(state.answers).some(isLocationDependentQuestionId)) return state;
  const answers = { ...state.answers };
  for (const id of Object.keys(answers)) if (isLocationDependentQuestionId(id)) delete answers[id];
  const path = state.path.filter((id) => !isLocationDependentQuestionId(id));
  return {
    ...state,
    answers,
    path,
    qIndex: Math.min(state.qIndex, Math.max(0, path.length - 1)),
    results: null,
  };
}

function advance(state: AppState): AppState {
  if (!state.purpose) return state;
  if (state.qIndex + 1 < state.path.length) return { ...state, qIndex: state.qIndex + 1 };
  const next = selectNextQuestion(effectiveQuestionBank(state.purpose, !!state.location.coords), state.answers, state.path);
  if (!next) return state;
  return { ...state, path: [...state.path, next.id], qIndex: state.qIndex + 1 };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang };
    case 'START_QUIZ':
    case 'SYNC_QUIZ_PURPOSE':
      return startPurpose(state, action.purpose);
    case 'PRESELECT_PURPOSE':
      return { ...state, purpose: action.purpose };
    case 'SET_ANSWER': {
      const changed = state.answers[action.questionId] !== action.value;
      const position = state.path.indexOf(action.questionId);
      const isPastQuestion = position >= 0 && position < state.path.length - 1;
      const answers = { ...state.answers, [action.questionId]: action.value };
      if (!changed || !isPastQuestion) return { ...state, answers };

      for (const staleId of state.path.slice(position + 1)) delete answers[staleId];
      return {
        ...state,
        answers,
        path: state.path.slice(0, position + 1),
        qIndex: position,
        questionnaireCheckpointPassed: false,
        results: null,
      };
    }
    case 'CONTINUE_QUESTIONS':
      return advance({ ...state, questionnaireCheckpointPassed: true });
    case 'NEXT_QUESTION':
      return advance(state);
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
        questionnaireCheckpointPassed: false,
        results: null,
      };
    case 'SET_EXPLORE_FILTER':
      return {
        ...state,
        explore: { ...state.explore, [action.key]: action.value },
        exploreSortChosen: action.key === 'sort' ? true : state.exploreSortChosen,
      };
    case 'RESET_EXPLORE_FILTERS':
      return { ...state, explore: { q: '', region: '', purpose: '', cost: '', sort: 'default' }, exploreSortChosen: false };
    case 'RESET_EXPLORE_SORT':
      return { ...state, explore: { ...state.explore, sort: 'default' }, exploreSortChosen: false };
    case 'LOCATION_REQUEST':
      return { ...state, location: { status: 'requesting', coords: null, diagnostic: null } };
    case 'LOCATION_GRANTED':
      return { ...state, location: { status: 'granted', coords: action.coords, diagnostic: action.diagnostic ?? null } };
    case 'LOCATION_FAILED':
      return withoutLocationQuestions({
        ...state,
        location: { status: action.status, coords: null, diagnostic: action.diagnostic ?? null },
      });
    case 'LOCATION_RESOLVE_DIAGNOSTIC':
      return { ...state, location: { ...state.location, diagnostic: action.diagnostic } };
    case 'LOCATION_RESET':
      return withoutLocationQuestions({ ...state, location: { status: 'idle', coords: null, diagnostic: null } });
    case 'SET_PASSPORT':
      return { ...state, passportCode: action.countryCode };
    case 'HYDRATE_QUIZ_FROM_PROFILE': {
      // Keep only questions that exist in the bank the traveller can be
      // asked NOW — a location-dependent answer saved earlier is dropped
      // when there is no location this visit, the same rule
      // withoutLocationQuestions() applies.
      const bank = effectiveQuestionBank(action.purpose, !!state.location.coords);
      const askable = new Set(bank.map((question) => question.id));
      const answers = Object.fromEntries(Object.entries(action.answers).filter(([id]) => askable.has(id)));
      let path = action.path.filter((id) => askable.has(id) && answers[id] !== undefined);
      if (!path.length) path = initialPath(action.purpose, !!state.location.coords);
      return {
        ...state,
        purpose: action.purpose,
        answers,
        path,
        qIndex: 0,
        // The saved answers already passed the early-results checkpoint.
        questionnaireCheckpointPassed: true,
        results: null,
      };
    }
    default:
      return state;
  }
}
