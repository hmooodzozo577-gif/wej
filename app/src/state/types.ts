import type { Lang, PurposeId } from '../data/types';
import type { Answers, RankedResult } from '../engine';

export interface ExploreFilters {
  q: string;
  region: string;
  purpose: string;
  cost: string;
}

/** Mirrors the original's single mutable `state` object — minus `view`,
 *  `selectedId`, and `fromResults`, which react-router now owns (the URL
 *  and navigation `state` respectively). */
export interface AppState {
  lang: Lang;
  purpose: PurposeId | null;
  qIndex: number;
  answers: Answers;
  results: RankedResult[] | null;
  explore: ExploreFilters;
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
  | { type: 'SET_ANSWER'; questionId: string; value: string | number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'SET_RESULTS'; results: RankedResult[] }
  | { type: 'RESTART_ALL' }
  | { type: 'SET_EXPLORE_FILTER'; key: keyof ExploreFilters; value: string }
  | { type: 'RESET_EXPLORE_FILTERS' };
