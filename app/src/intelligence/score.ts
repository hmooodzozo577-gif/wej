// Deterministic, versioned purpose-suitability scoring (task 3.6-3.11).
//
// SCORE SEMANTICS: the score is a weighted average of NORMALIZED VALUES
// ACTUALLY OBSERVED for a country, re-weighted over the factors that were
// observed (not the full methodology) — so a genuinely strong country with
// one missing indicator is not artificially dragged down by a data gap.
// The data gap itself is disclosed separately, honestly, via `coverage`
// and `confidence` — never silently blended into the score number itself
// (task 3.10: "A percentage without data-quality context is insufficient").
//
// INSUFFICIENT DATA (task 3.11): below a purpose's minCoverage fraction of
// factors observed, no score is computed at all — `score: null`,
// `insufficientData: true` — rather than presenting a low-coverage number
// as if it meant the same thing as a well-covered one.
import { buildNormalizer } from './normalize';
import { methodologyFor } from './methodology';
import type { ComponentScore, ConfidenceLevel, PurposeSuitability, SuitablePurposeId } from './types';

export interface RawObservation {
  value: number;
  year: string;
}

export interface CountryObservations {
  countryCode: string;
  /** Keyed by IntelligenceSource id (sources.ts) — e.g. 'homicideRate',
   *  'priceLevelIndex'. Decoupled from any one snapshot file's exact JSON
   *  shape; callers (the generator script) adapt their source data into
   *  this shape once. */
  observations: Record<string, RawObservation | undefined>;
}

function confidenceFor(coveragePct: number, components: ComponentScore[]): ConfidenceLevel {
  const currentYear = new Date().getUTCFullYear();
  const observedYears = components
    .filter((component) => component.status === 'observed' && component.dataYear)
    .map((component) => Number(component.dataYear));
  const avgAgeYears = observedYears.length
    ? observedYears.reduce((sum, year) => sum + (currentYear - year), 0) / observedYears.length
    : Infinity;
  if (coveragePct >= 90 && avgAgeYears <= 3) return 'high';
  if (coveragePct >= 60) return 'medium';
  return 'low';
}

/** Computes suitability for ONE purpose across a population of countries.
 *  Factor normalizers are built once from the WHOLE population passed in,
 *  so scores are comparable across countries — call this with the full
 *  194-country set, not one country at a time. */
export function computePurposeSuitability(
  purpose: SuitablePurposeId,
  countries: CountryObservations[],
  updatedAt: string,
): Map<string, PurposeSuitability> {
  const methodology = methodologyFor(purpose);

  const normalizers = new Map(
    methodology.factors.map((factor) => {
      const populationValues = countries
        .map((country) => country.observations[factor.sourceId]?.value)
        .filter((value): value is number => value !== undefined);
      return [factor.key, buildNormalizer(populationValues, factor.direction, factor.transform)] as const;
    }),
  );

  const result = new Map<string, PurposeSuitability>();

  for (const country of countries) {
    const components: ComponentScore[] = methodology.factors.map((factor) => {
      const observation = country.observations[factor.sourceId];
      const normalize = normalizers.get(factor.key)!;
      const normalizedValue = observation ? normalize(observation.value) : null;
      const contribution = normalizedValue === null ? null : (factor.weight * normalizedValue) / 100;
      return {
        factor: factor.key,
        label: factor.label,
        rawValue: observation?.value ?? null,
        normalizedValue,
        contribution,
        weight: factor.weight,
        dataYear: observation?.year ?? null,
        sourceId: factor.sourceId,
        status: observation ? 'observed' : 'missing',
      };
    });

    const observed = components.filter((component) => component.status === 'observed');
    const coverageFraction = components.length > 0 ? observed.length / components.length : 0;
    const coverage = Math.round(coverageFraction * 100);
    const meetsThreshold = coverageFraction >= methodology.minCoverage;

    let score: number | null = null;
    let confidence: ConfidenceLevel | null = null;
    if (meetsThreshold) {
      const observedWeight = observed.reduce((sum, component) => sum + component.weight, 0);
      if (observedWeight > 0) {
        const weightedSum = observed.reduce((sum, component) => sum + (component.contribution ?? 0), 0);
        score = Math.max(0, Math.min(100, Math.round((weightedSum / observedWeight) * 100)));
      }
      if (score !== null) confidence = confidenceFor(coverage, components);
    }
    const insufficientData = score === null;

    result.set(country.countryCode, {
      countryCode: country.countryCode,
      purpose,
      modelVersion: methodology.modelVersion,
      score,
      insufficientData,
      coverage,
      confidence,
      updatedAt,
      components,
      sources: [...new Set(observed.map((component) => component.sourceId))],
    });
  }

  return result;
}
