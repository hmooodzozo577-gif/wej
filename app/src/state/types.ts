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

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Precise coordinates remain in memory only and are never persisted. */
export interface LocationState {
  status: LocationStatus;
  coords: LocationCoords | null;
}

export interface AppState {
  lang: Lang;
  purpose: PurposeId | null;
  qIndex: number;
  /** Ordered question ids actually shown in the deterministic branch. */
  path: string[];
  answers: Answers;
  questionnaireCheckpointPassed: boolean;
  results: RankedResult[] | null;
  explore: ExploreFilters;
  location: LocationState;
}

export type AppAction =
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'START_QUIZ'; purpose: PurposeId }
  | { type: 'PRESELECT_PURPOSE'; purpose: PurposeId }
  | { type: 'SYNC_QUIZ_PURPOSE'; purpose: PurposeId }
  | { type: 'SET_ANSWER'; questionId: string; value: string | number }
  | { type: 'CONTINUE_QUESTIONS' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'SET_RESULTS'; results: RankedResult[] }
  | { type: 'RESTART_ALL' }
  | { type: 'SET_EXPLORE_FILTER'; key: keyof ExploreFilters; value: string }
  | { type: 'RESET_EXPLORE_FILTERS' }
  | { type: 'LOCATION_REQUEST' }
  | { type: 'LOCATION_GRANTED'; coords: LocationCoords }
  | { type: 'LOCATION_FAILED'; status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'> }
  | { type: 'LOCATION_RESET' };
