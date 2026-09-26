// Phase 18 — Personalization. Types for the anonymous, browser-local
// personalization profile and the Personal Match layer built on it.
//
// Two concepts that must never be merged:
//   - GENERAL SUITABILITY (intelligence/, "مناسب لـ"): how suitable a
//     country is for a purpose, for anyone. Never personalized.
//   - PERSONAL MATCH (this module): how well a country fits THIS
//     traveller's own expressed preferences.
// Phase 14 (engine/) stays the candidate/ranking baseline; Personal Match
// refines order within its candidates and never rewrites its numbers.
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';

/** Bump only with a matching entry in PROFILE_MIGRATIONS (profile.ts).
 *  v2 (v1.1): may also hold the optional travel-need answers (language,
 *  Islamic practice, halal food — travelNeeds.ts). A v1 profile migrates
 *  with every answer kept and the new questions simply unanswered. */
export const PROFILE_SCHEMA_VERSION = 2 as const;

/** Bump whenever a formula, weight, threshold or factor changes, so a
 *  future calibration can never silently change what an old number meant.
 *  personal-match-1.1 adds three optional factors (language, Islamic
 *  practice, halal food); every personal-match-1.0 factor, weight and
 *  threshold is unchanged, so a profile without the new answers scores
 *  exactly as it did under 1.0. */
export const PERSONAL_MATCH_METHODOLOGY_VERSION = 'personal-match-1.1' as const;

/** What is remembered on this browser. Deliberately minimal: the quiz
 *  answers themselves are the traveller's preferences (signals are derived
 *  from them deterministically — see signals.ts), plus the order they were
 *  asked in so "edit my preferences" can replay the same questionnaire.
 *  Never stored: coordinates, passport, name, or any identifier. */
export interface PersonalizationProfile {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  purpose: PurposeId;
  /** Canonical quiz answers: question id -> option value. */
  answers: Answers;
  /** Question ids in the order they were asked. */
  path: string[];
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type FactorId =
  | 'climate'
  | 'budget'
  | 'setting'
  | 'coast'
  | 'island'
  | 'size'
  | 'popularity'
  | 'safety'
  | 'health'
  | 'income'
  | 'opportunity'
  | 'education'
  | 'investment'
  | 'growth'
  | 'proximity'
  // personal-match-1.1 (travelNeeds.ts)
  | 'language'
  | 'islamicPractice'
  | 'halalFood';

/** How a preference is compared with a country:
 *  - climate: compatibility table between climates
 *  - budget: asymmetric — at or under the chosen level fits, above does not
 *  - target: closeness to a chosen point on a 0–100 scale
 *  - want / avoid: a yes/no characteristic the traveller wants or avoids
 *  - importance: a real indicator, weighted by how much it matters
 *  - near: straight-line distance, only with a shared location
 *  - language (1.1): the traveller's languages vs the country's official ones
 *  - evidence (1.1): mapped places (mosques, halal food), positive evidence only */
export type SignalKind = 'climate' | 'budget' | 'target' | 'want' | 'avoid' | 'importance' | 'near' | 'language' | 'evidence';

/** strong = "a deciding factor"; minor = "a secondary factor". Every other
 *  answer is a normal preference. None of these is a hard constraint. */
export type SignalStrength = 'strong' | 'normal' | 'minor';

export interface PreferenceSignal {
  factor: FactorId;
  questionId: string;
  kind: SignalKind;
  /** The traveller's own answer (option value). */
  value: string | number;
  /** Effective weight after strength. */
  weight: number;
  strength: SignalStrength;
}

/** A genuine requirement the questionnaire asks as one (currently only the
 *  optional "must be reachable by land" question). Evaluated separately —
 *  a weighted average can never override it. */
export interface HardConstraint {
  kind: 'landBorder';
  questionId: string;
}

export interface NormalizedPreferences {
  purpose: PurposeId;
  signals: PreferenceSignal[];
  constraints: HardConstraint[];
  /** Answered with an explicit "no preference" / "does not matter": neither
   *  scored nor penalized. */
  neutral: string[];
}

export type FactorOutcome = 'positive' | 'partial' | 'negative' | 'unavailable';

/** noData: the country has no directly observed value for this factor
 *  (Phase 14 would use a worldwide median — Personal Match does not).
 *  noLocation: the factor needs a location the traveller has not shared.
 *  noEvidence (1.1): the data exists but shows too little either way — none
 *  of the traveller's languages is official there, or too few places are
 *  mapped. Absence of evidence is never scored as a mismatch. */
export type UnavailableReason = 'noData' | 'noLocation' | 'noEvidence';

export interface FactorResult {
  factor: FactorId;
  questionId: string;
  kind: SignalKind;
  outcome: FactorOutcome;
  /** 0–100; null when unavailable. */
  fit: number | null;
  weight: number;
  strength: SignalStrength;
  reason?: UnavailableReason;
  /** For budget/target/near: which side of the preference the country is. */
  direction?: 'above' | 'below';
  /** The country's own value on this factor, when one was used. */
  countryValue?: number | string;
  /** Straight-line distance for the 'near' factor, rounded, in km. */
  distanceKm?: number;
}

export type PersonalConfidence = 'high' | 'medium' | 'low';

export type ConstraintStatus = 'pass' | 'fail' | 'unavailable';

export interface PersonalMatch {
  methodologyVersion: string;
  countryCode: string;
  /** 0–100 integer; null when not a single preference could be evaluated. */
  score: number | null;
  confidence: PersonalConfidence | null;
  /** 0–1: share of the traveller's expressed preference weight that could
   *  actually be evaluated for this country. */
  coverage: number;
  evaluatedCount: number;
  expressedCount: number;
  /** False when a hard constraint fails. */
  eligible: boolean;
  constraints: { kind: HardConstraint['kind']; status: ConstraintStatus }[];
  /** Every expressed preference, strongest weight first. */
  factors: FactorResult[];
}
