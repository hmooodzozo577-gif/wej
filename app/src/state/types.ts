import type { Lang, PurposeId } from '../data/types';
import type { Answers, RankedResult } from '../engine';

export interface ExploreFilters {
  q: string;
  region: string;
  purpose: string;
  cost: string;
  sort: ExploreSort;
}

export type ExploreSort = 'default' | 'name-asc' | 'name-desc' | 'area-desc' | 'area-asc' | 'cost-asc' | 'cost-desc' | 'nearest';

export interface DestinationNavigation {
  source: 'explore' | 'results' | 'surprise';
  ids: string[];
  index: number;
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
  /** Item #13 — optional, skippable, self-reported nationality (ISO
   *  3166-1 alpha-2). Never inferred from location/coordinates, never used
   *  by the ranking engine, and never treated as a passport-level source of
   *  truth for a real personalized visa-eligibility claim — Wejhaty has no
   *  verified per-nationality visa data. It exists only so the UI can be
   *  honest about the difference between a generic visa reference and a
   *  claim personalized to the user, and to avoid ever conflating location
   *  (where the user IS) with nationality (what passport they hold). */
  nationalityCode: string | null;
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
  | { type: 'LOCATION_RESET' }
  | { type: 'SET_NATIONALITY'; countryCode: string | null };
