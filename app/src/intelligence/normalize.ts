// Deterministic, documented 0–100 normalization for a raw indicator across
// a fixed population of countries.
//
// SEMANTIC MEANING OF THE 0–100 SCALE (task 3.13): a normalized value of
// 100 means "at or above the 95th percentile of countries actually
// observed for this factor"; 0 means "at or below the 5th percentile";
// values in between are a LINEAR position within that winsorized range.
// This is a criterion-based position within the observed population, not
// a global rank or percentile itself — two countries scoring 80 and 90 are
// not necessarily 10 ranks apart, they are equally close to the top of the
// observed range. This keeps one extreme outlier from crushing everyone
// else toward the same end of the scale (task 3.12) — the winsorizing at
// p5/p95 is exactly what bounds that.
//
// Independent of app/src/data/worldRecommendation.ts's own normalizer
// (Phase 14's own tool for a different purpose, MATCH scoring) even though
// the underlying technique is the same well-known winsorized min-max
// approach — kept as separate code so a change to one can never silently
// change the other.
import type { FactorDirection, FactorTransform } from './types';

function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, Math.round((sortedAscending.length - 1) * p)));
  return sortedAscending[index]!;
}

function applyTransform(value: number, transform: FactorTransform): number {
  if (transform === 'log') return Math.log10(Math.max(0, value) + 1);
  return value;
}

/** Builds a reusable normalizer from the full observed population for one
 *  factor. Call once per factor across all countries, then apply per
 *  country — this is what makes the winsorizing population-relative
 *  rather than recomputed (and therefore inconsistent) per country. */
export function buildNormalizer(
  observedValues: number[],
  direction: FactorDirection,
  transform: FactorTransform,
): (raw: number | null | undefined) => number | null {
  const finite = observedValues.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return () => null;

  const transformed = [...finite].map((value) => applyTransform(value, transform)).sort((a, b) => a - b);
  const low = percentile(transformed, 0.05);
  const high = percentile(transformed, 0.95);

  return (raw) => {
    if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
    const value = applyTransform(raw, transform);
    // A degenerate population (every observed value identical) has no
    // discriminating range — everyone sits at the midpoint rather than an
    // arbitrary 0 or 100, since neither extreme would be meaningful here.
    const ratio = high === low ? 0.5 : Math.max(0, Math.min(1, (value - low) / (high - low)));
    const scored = direction === 'lowerIsBetter' ? 1 - ratio : ratio;
    return Math.round(scored * 100);
  };
}
