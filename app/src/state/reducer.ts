import { selectNextQuestion } from '../adaptive';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { AppAction, AppState } from './types';

export const initialAppState: AppState = {
  lang: 'ar',
  purpose: null,
  qIndex: 0,
  path: [],
  answers: {},
  questionnaireCheckpointPassed: false,
  results: null,
  explore: { q: '', region: '', purpose: '', cost: '' },
  location: { status: 'idle', coords: null },
};

function initialPath(purpose: AppState['purpose']): string[] {
  if (!purpose) return [];
  const first = selectNextQuestion(QUESTION_BANKS[purpose], {}, []);
  return first ? [first.id] : [];
}

function startPurpose(state: AppState, purpose: NonNullable<AppState['purpose']>): AppState {
  return {
    ...state,
    purpose,
    qIndex: 0,
    path: initialPath(purpose),
    answers: {},
    questionnaireCheckpointPassed: false,
    results: null,
  };
}

function advance(state: AppState): AppState {
  if (!state.purpose) return state;
  if (state.qIndex + 1 < state.path.length) return { ...state, qIndex: state.qIndex + 1 };
  const next = selectNextQuestion(QUESTION_BANKS[state.purpose], state.answers, state.path);
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
