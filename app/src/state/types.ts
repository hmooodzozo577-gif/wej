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

/** Phase 12 — Location Personalization. `idle`: never requested (default,
 *  and what's restored by LOCATION_RESET). `requesting`: the browser
 *  permission prompt / getCurrentPosition call is in flight. `granted`:
 *  coords are populated. The rest are terminal failure states, mapped
 *  1:1 from the browser Geolocation API outcomes — see geo/geolocation.ts. */
export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Coordinates live in memory only — never persisted (no localStorage, no
 *  backend), never sent anywhere, cleared by LOCATION_RESET or a fresh
 *  page load. Only populated when status is 'granted'. */
export interface LocationState {
  status: LocationStatus;
  coords: LocationCoords | null;
}

/** Mirrors the original's single mutable `state` object — minus `view`,
 *  `selectedId`, and `fromResults`, which react-router now owns (the URL
 *  and navigation `state` respectively). */
export interface AppState {
  lang: Lang;
  purpose: PurposeId | null;
  qIndex: number;
  /** Phase 15 — Adaptive Questions. The ORDERED question ids actually
   *  presented so far, computed by adaptive/selectNextQuestion.ts one
   *  question at a time as the user progresses — never the full bank
   *  order up front. `qIndex` indexes into this, not into
   *  QUESTION_BANKS[purpose] directly. Truncated (and any now-stale
   *  downstream answers removed) when the user goes back and changes
   *  an earlier answer — see reducer.ts's SET_ANSWER case. */
  path: string[];
  answers: Answers;
  results: RankedResult[] | null;
  explore: ExploreFilters;
  location: LocationState;
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
  | { type: 'RESET_EXPLORE_FILTERS' }
  // Phase 12 — Location Personalization. Dispatched around a single
  // getCurrentPosition() call in components/LocationPersonalize.tsx; the
  // reducer itself stays a pure function, the browser API call is the
  // component's side effect.
  | { type: 'LOCATION_REQUEST' }
  | { type: 'LOCATION_GRANTED'; coords: LocationCoords }
  | { type: 'LOCATION_FAILED'; status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'> }
  | { type: 'LOCATION_RESET' };
