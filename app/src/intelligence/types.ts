// Country Intelligence + Purpose Suitability Scoring — Phase 11.x/14.x.
//
// This is a deliberately SEPARATE layer from the Phase 14 engine
// (app/src/engine/, app/src/data/questionBanks.ts). It answers a different
// question — "how suitable is this country for this purpose in general"
// (a COUNTRY SUITABILITY score) — not "how well does this country match
// THIS traveller's answers" (Phase 14's MATCH score). The two must never be
// merged: Phase 14's DIMENSIONS/PURPOSE_DIMENSIONS/weights are untouched by
// this module, and nothing here writes into a RecommendationProfile or a
// Phase 14 score. Personal Match (combining this with a user's own answers)
// is explicitly left for Phase 18 — see COUNTRY_INTELLIGENCE.md.
import type { PurposeId } from '../data/types';

/** 'other' is a catch-all fallback purpose with no defined identity of its
 *  own (see purposes.json: pScoreKey: null) — there is nothing to build a
 *  purpose-specific methodology FOR, so it is excluded from suitability
 *  scoring rather than given an arbitrary/generic methodology. */
export type SuitablePurposeId = Exclude<PurposeId, 'other'>;

export const SUITABLE_PURPOSES: readonly SuitablePurposeId[] = [
  'tourism',
  'work',
  'education',
  'medical',
  'immigration',
  'investment',
  'wellness',
];

/** Source-quality tier, per the task's reliability ranking. Every source
 *  actually used by this layer is tier 1 or 2 — no blogs, no scraped
 *  rankings, nothing model-generated. */
export type SourceTier =
  | 'official-national'
  | 'official-international'
  | 'authoritative-institutional';

export interface IntelligenceSource {
  id: string;
  /** Human-readable name, e.g. "World Bank — Intentional homicides". */
  name: string;
  provider: string;
  tier: SourceTier;
  /** The indicator's own durable identifier at the provider, e.g. the World
   *  Bank indicator code, for exact traceability independent of wording. */
  indicatorId: string;
  url: string;
  license: string;
}

export type FactorDirection = 'higherIsBetter' | 'lowerIsBetter';
export type FactorTransform = 'linear' | 'log';

export interface FactorDefinition {
  /** Stable key, e.g. 'safety'. Distinct from the raw indicator field name
   *  it reads (see extractRawObservation in data.ts) because one factor's
   *  meaning (e.g. "affordability") can be reused with the same direction
   *  across purposes while the raw indicator stays the single source. */
  key: string;
  label: string;
  sourceId: string;
  direction: FactorDirection;
  transform: FactorTransform;
  /** Weight within this purpose's methodology. All of one purpose's
   *  factor weights sum to 100 — enforced by a test, not just documented. */
  weight: number;
}

export interface PurposeMethodology {
  purpose: SuitablePurposeId;
  modelVersion: string;
  /** Below this fraction of factors actually observed, the purpose score
   *  is reported as insufficient data rather than computed from whatever
   *  partial data exists. */
  minCoverage: number;
  factors: FactorDefinition[];
  /** Candidate factors considered and deliberately NOT included, with why
   *  — required so "we didn't think of it" and "no trustworthy data
   *  exists for it" stay distinguishable in the documentation this feeds. */
  excluded: { factor: string; reason: string }[];
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ComponentScore {
  factor: string;
  label: string;
  rawValue: number | null;
  /** 0–100 after winsorized normalization; null when the raw observation
   *  is missing for this country. */
  normalizedValue: number | null;
  /** Points this factor contributed to the final weighted score
   *  (weight * normalizedValue / 100), or null when not observed. */
  contribution: number | null;
  weight: number;
  dataYear: string | null;
  sourceId: string;
  status: 'observed' | 'missing';
}

export interface PurposeSuitability {
  countryCode: string;
  purpose: SuitablePurposeId;
  modelVersion: string;
  /** null exactly when insufficientData is true. */
  score: number | null;
  insufficientData: boolean;
  /** 0–100, percentage of this purpose's factors actually observed. */
  coverage: number;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
  components: ComponentScore[];
  sources: string[];
}

/** The compact record shipped to the frontend bundle — everything a "Suitable
 *  for" card needs, none of the full component/source detail (that stays
 *  server-side; see worker/src/intelligence.ts). */
export interface CountryIntelligenceSummary {
  countryCode: string;
  purpose: SuitablePurposeId;
  modelVersion: string;
  score: number | null;
  insufficientData: boolean;
  coverage: number;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
}
