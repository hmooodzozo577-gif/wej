// Phase 18.3 — the Personal Match engine. Deterministic, bounded, no AI,
// no network, no invented data. Methodology version:
// PERSONAL_MATCH_METHODOLOGY_VERSION (types.ts); full description in
// README.md next to this file.
//
//   personalMatch = round( (Σ wᵢ·fitᵢ + W₀·50) / (Σ wᵢ + W₀) ), clamped 0–100
//
// over the preferences that could be EVALUATED for the country. W₀ is a
// small neutral prior: with one or two answers the score stays nearer 50,
// so a single matching preference can never produce a confident-looking
// 100%. A preference the country has no direct data for (Phase 14 would
// substitute a worldwide median) or that needs a location the traveller did
// not share is UNAVAILABLE: excluded from the score and reported, never
// treated as a mismatch. Coverage and confidence say how much of the
// traveller's own stated preference weight the number rests on.
import { CLIMATE_COMPAT } from '../data/questionBanks';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import { countryInfoOf, resolvedBordersOf } from '../data/worldCatalog';
import { approximateCountryOf, haversineKm, type Coords } from '../data/geo';
import type { CatalogEntry, RecommendationProfile, RecommendationProfileKey } from '../data/types';
import type { RankedResult } from '../engine/types';
import {
  PERSONAL_MATCH_METHODOLOGY_VERSION,
  type ConstraintStatus,
  type FactorId,
  type FactorOutcome,
  type FactorResult,
  type NormalizedPreferences,
  type PersonalConfidence,
  type PersonalMatch,
  type PreferenceSignal,
} from './types';

/** Neutral prior weight (≈ one typical preference) — see header. */
export const EVIDENCE_PRIOR_WEIGHT = 8;
export const POSITIVE_FIT = 75;
export const PARTIAL_FIT = 50;
/** Distance at which the proximity fit falls to 1/e (~37). */
export const NEAR_DISTANCE_SCALE_KM = 4000;
/** Budget: each price level UNDER the chosen one costs a little (a
 *  traveller who chose a level is best served at it), each level OVER it
 *  costs a lot. */
const BUDGET_BELOW_STEP = 6;
const BUDGET_ABOVE_STEP = 45;

const PROFILE_KEY_BY_FACTOR: Partial<Record<FactorId, RecommendationProfileKey>> = {
  climate: 'climate',
  budget: 'costLevel',
  setting: 'urbanity',
  coast: 'coastal',
  island: 'island',
  size: 'size',
  popularity: 'popularity',
  safety: 'safety',
  health: 'health',
  income: 'income',
  opportunity: 'opportunity',
  education: 'education',
  investment: 'investment',
  growth: 'growth',
};

export interface MatchContext {
  /** In-memory coordinates, only when the traveller shared a location. */
  origin?: Coords | null;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function outcomeOf(fit: number): FactorOutcome {
  if (fit >= POSITIVE_FIT) return 'positive';
  if (fit >= PARTIAL_FIT) return 'partial';
  return 'negative';
}

function unavailable(signal: PreferenceSignal, reason: FactorResult['reason']): FactorResult {
  return {
    factor: signal.factor,
    questionId: signal.questionId,
    kind: signal.kind,
    outcome: 'unavailable',
    fit: null,
    weight: signal.weight,
    strength: signal.strength,
    reason,
  };
}

function evaluated(signal: PreferenceSignal, rawFit: number, extra: Partial<FactorResult> = {}): FactorResult {
  const fit = Math.round(clamp(rawFit));
  return {
    factor: signal.factor,
    questionId: signal.questionId,
    kind: signal.kind,
    outcome: outcomeOf(fit),
    fit,
    weight: signal.weight,
    strength: signal.strength,
    ...extra,
  };
}

function evaluateSignal(signal: PreferenceSignal, dest: CatalogEntry, profile: RecommendationProfile | undefined, ctx: MatchContext): FactorResult {
  if (signal.kind === 'near') {
    const info = countryInfoOf(dest.id);
    if (!ctx.origin) return unavailable(signal, 'noLocation');
    if (!info) return unavailable(signal, 'noData');
    const distanceKm = haversineKm(ctx.origin, info.latlng);
    return evaluated(signal, 100 * Math.exp(-distanceKm / NEAR_DISTANCE_SCALE_KM), { distanceKm: Math.round(distanceKm) });
  }

  const key = PROFILE_KEY_BY_FACTOR[signal.factor];
  if (!profile || !key || profile.imputedKeys.includes(key)) return unavailable(signal, 'noData');
  const countryValue = profile[key];

  switch (signal.kind) {
    case 'climate': {
      const table = CLIMATE_COMPAT[String(signal.value)];
      const fit = table?.[profile.climate] ?? (profile.climate === signal.value ? 100 : 30);
      return evaluated(signal, fit, { countryValue: profile.climate });
    }
    case 'budget': {
      if (typeof countryValue !== 'number' || typeof signal.value !== 'number') return unavailable(signal, 'noData');
      const gap = countryValue - signal.value;
      const fit = gap <= 0 ? 100 + gap * BUDGET_BELOW_STEP : 100 - gap * BUDGET_ABOVE_STEP;
      return evaluated(signal, fit, { countryValue, ...(gap !== 0 ? { direction: gap > 0 ? 'above' : 'below' } : {}) });
    }
    case 'target': {
      if (typeof countryValue !== 'number' || typeof signal.value !== 'number') return unavailable(signal, 'noData');
      const gap = countryValue - signal.value;
      return evaluated(signal, 100 - Math.abs(gap), { countryValue, ...(gap !== 0 ? { direction: gap > 0 ? 'above' : 'below' } : {}) });
    }
    case 'want':
    case 'avoid': {
      if (typeof countryValue !== 'number') return unavailable(signal, 'noData');
      return evaluated(signal, signal.kind === 'want' ? countryValue : 100 - countryValue, { countryValue });
    }
    case 'importance': {
      if (typeof countryValue !== 'number') return unavailable(signal, 'noData');
      return evaluated(signal, countryValue, { countryValue });
    }
    default:
      return unavailable(signal, 'noData');
  }
}

/** Countries sharing a land border with the traveller's current country, or
 *  null when that cannot be determined (no location, unresolvable, or an
 *  island nation) — in which case the constraint is reported unavailable
 *  and excludes nothing, exactly like Phase 14's own land-border filter. */
export function landBorderIds(origin: Coords | null | undefined): Set<string> | null {
  if (!origin) return null;
  const current = approximateCountryOf(origin)?.entry;
  if (!current) return null;
  const borders = resolvedBordersOf(current.id);
  return borders.length ? new Set(borders.map((entry) => entry.id)) : null;
}

function confidenceOf(evaluatedCount: number, coverage: number): PersonalConfidence {
  if (evaluatedCount >= 4 && coverage >= 0.8) return 'high';
  if (evaluatedCount >= 2 && coverage >= 0.5) return 'medium';
  return 'low';
}

export function computePersonalMatch(
  dest: CatalogEntry,
  prefs: NormalizedPreferences,
  ctx: MatchContext = {},
  borders: Set<string> | null | undefined = undefined,
): PersonalMatch {
  const profile = RECOMMENDATION_PROFILE_BY_CODE.get(dest.countryCode);
  const factors = prefs.signals.map((signal) => evaluateSignal(signal, dest, profile, ctx));

  const scored = factors.filter((factor): factor is FactorResult & { fit: number } => factor.fit !== null);
  const expressedWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const evaluatedWeight = scored.reduce((sum, factor) => sum + factor.weight, 0);
  const weightedFit = scored.reduce((sum, factor) => sum + factor.weight * factor.fit, 0);

  const score = scored.length
    ? Math.round(clamp((weightedFit + EVIDENCE_PRIOR_WEIGHT * 50) / (evaluatedWeight + EVIDENCE_PRIOR_WEIGHT)))
    : null;
  const coverage = expressedWeight > 0 ? Math.round((evaluatedWeight / expressedWeight) * 1000) / 1000 : 0;

  const borderSet = borders === undefined ? landBorderIds(ctx.origin) : borders;
  const constraints = prefs.constraints.map((constraint) => {
    let status: ConstraintStatus = 'unavailable';
    if (borderSet) status = borderSet.has(dest.id) ? 'pass' : 'fail';
    return { kind: constraint.kind, status };
  });

  return {
    methodologyVersion: PERSONAL_MATCH_METHODOLOGY_VERSION,
    countryCode: dest.countryCode,
    score,
    confidence: score === null ? null : confidenceOf(scored.length, coverage),
    coverage,
    evaluatedCount: scored.length,
    expressedCount: factors.length,
    eligible: constraints.every((constraint) => constraint.status !== 'fail'),
    constraints,
    factors,
  };
}

/** Personal Match for many countries at once (Explore, Surprise). */
export function personalMatchesFor(
  dests: readonly CatalogEntry[],
  prefs: NormalizedPreferences,
  ctx: MatchContext = {},
): Map<string, PersonalMatch> {
  const borders = prefs.constraints.length ? landBorderIds(ctx.origin) : null;
  return new Map(dests.map((dest) => [dest.id, computePersonalMatch(dest, prefs, ctx, borders)]));
}

/** Orders two countries for a personalized list: eligible first, then the
 *  higher Personal Match, then (callers' choice) a secondary key, then id. */
export function comparePersonal(a: PersonalMatch | undefined, b: PersonalMatch | undefined): number {
  const eligible = Number(b?.eligible ?? false) - Number(a?.eligible ?? false);
  if (eligible) return eligible;
  return (b?.score ?? -1) - (a?.score ?? -1);
}

/** How many of Phase 14's top results Personal Match may reorder. */
export const REFINEMENT_POOL_SIZE = 10;

export interface RefinedResult {
  result: RankedResult;
  personal: PersonalMatch;
}

/**
 * Phase 14 decides WHICH countries are candidates and supplies the
 * baseline order; Personal Match only reorders WITHIN its top
 * REFINEMENT_POOL_SIZE. Phase 14's own scores are carried through
 * untouched. Ties fall back to an optional secondary rank (visa
 * convenience), then Phase 14's score, then the destination id — fully
 * deterministic.
 */
export function refineRanking(
  phase14Results: readonly RankedResult[],
  prefs: NormalizedPreferences,
  ctx: MatchContext = {},
  secondaryRank: (result: RankedResult) => number = () => 0,
  poolSize: number = REFINEMENT_POOL_SIZE,
): RefinedResult[] {
  const pool = phase14Results.slice(0, poolSize);
  const borders = prefs.constraints.length ? landBorderIds(ctx.origin) : null;
  return pool
    .map((result) => ({ result, personal: computePersonalMatch(result.dest, prefs, ctx, borders) }))
    .sort((a, b) =>
      comparePersonal(a.personal, b.personal) ||
      secondaryRank(a.result) - secondaryRank(b.result) ||
      b.result.score - a.result.score ||
      a.result.dest.id.localeCompare(b.result.dest.id),
    );
}
