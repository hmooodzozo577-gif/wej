import type { CatalogEntry, Destination, PurposeId } from '../data/types';

/** A user's answers for the current quiz: questionId -> selected option value. */
export type Answers = Record<string, string | number>;

/** One scored factor behind a destination's match — mirrors the original's `reasons` entries. */
export interface Reason {
  id: string;
  weight: number;
  fit: number;
}

export interface ScoreResult {
  score: number;
  reasons: Reason[];
}

export interface RankedResult {
  dest: CatalogEntry;
  score: number;
  reasons: Reason[];
  distanceKm?: number;
}

export type { Destination, PurposeId };
