import type { Lang, PurposeId } from '../data/types';
import type { Answers, RankedResult } from '../engine';

export interface ExploreFilters {
  q: string;
  region: string;
  purpose: string;
  cost: string;
  sort: ExploreSort;
}

export type ExploreSort =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'area-desc'
  | 'area-asc'
  | 'cost-asc'
  | 'cost-desc'
  | 'nearest'
  | 'farthest';

/** The two distance sorts are only meaningful with real location context —
 *  see Explore.tsx, which gates them on `state.location.coords`, and
 *  exploreCatalog.ts, which returns the list unsorted rather than
 *  pretending when `origin` is absent. */
export const LOCATION_DEPENDENT_SORTS: ExploreSort[] = ['nearest', 'farthest'];

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

/** Item #6 — WHERE a location request spent its time / failed, with no
 *  coordinates in it, so it is safe to render in the debug panel and to
 *  send as anonymous telemetry. 'browser' covers waiting for
 *  getCurrentPosition (see geo/geolocation.ts, which builds this);
 *  'resolve' covers the app's own country/city resolution AFTER real
 *  coordinates were already available. Distinguishing the two is the whole
 *  point: the same "this took too long" symptom has two different causes
 *  and only one of them is a browser timeout. */
export interface LocationDiagnostic {
  phase: 'browser' | 'resolve';
  attempts: {
    stage: number;
    highAccuracy: boolean;
    timeoutMs: number;
    durationMs: number;
    outcome: string;
  }[];
  totalMs: number;
}

/** Precise coordinates remain in memory only and are never persisted. */
export interface LocationState {
  status: LocationStatus;
  coords: LocationCoords | null;
  /** Last request's timing/outcome breakdown. Never contains coordinates.
   *  Optional so a test can build a LocationState without one. */
  diagnostic?: LocationDiagnostic | null;
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
  | { type: 'LOCATION_GRANTED'; coords: LocationCoords; diagnostic?: LocationDiagnostic }
  | { type: 'LOCATION_FAILED'; status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'>; diagnostic?: LocationDiagnostic }
  | { type: 'LOCATION_RESOLVE_DIAGNOSTIC'; diagnostic: LocationDiagnostic }
  | { type: 'LOCATION_RESET' }
  | { type: 'SET_NATIONALITY'; countryCode: string | null };
