import { describe, expect, it } from 'vitest';
import { buildNormalizer } from './normalize';

describe('buildNormalizer', () => {
  it('maps higher-is-better values so the top of the observed range scores near 100', () => {
    const normalize = buildNormalizer([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 'higherIsBetter', 'linear');
    expect(normalize(100)).toBeGreaterThanOrEqual(95);
    expect(normalize(10)).toBeLessThanOrEqual(5);
    expect(normalize(55)).toBeGreaterThan(40);
    expect(normalize(55)).toBeLessThan(60);
  });

  it('inverts lower-is-better factors so a smaller raw value scores higher', () => {
    const normalize = buildNormalizer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'lowerIsBetter', 'linear');
    expect(normalize(1)!).toBeGreaterThan(normalize(10)!);
  });

  it('every normalized value stays within 0..100 inclusive, for both directions', () => {
    const values = [0, 1, 2, 5, 10, 50, 100, 1000, 100000];
    for (const direction of ['higherIsBetter', 'lowerIsBetter'] as const) {
      const normalize = buildNormalizer(values, direction, 'linear');
      for (const value of values) {
        const result = normalize(value)!;
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result)).toBe(true);
      }
    }
  });

  it('winsorizes outliers instead of letting one extreme crush the rest of the scale', () => {
    // A realistic-sized population (matching the ~190-country scale this
    // module actually normalizes over) where most countries cluster
    // around 10-14 and a handful of extreme outliers sit far above them.
    // p5/p95 nearest-rank needs enough points for the tails to actually
    // exclude the outliers — this is the same technique Phase 14's own
    // normalizer uses, at a size where it behaves as intended.
    const cluster = Array.from({ length: 90 }, (_, i) => 10 + (i % 5));
    const outliers = [50000, 60000, 70000, 80000, 90000];
    const values = [...cluster, ...outliers];
    const normalize = buildNormalizer(values, 'higherIsBetter', 'linear');
    const midRangeScore = normalize(12)!;
    // A solidly mid-pack value must still land in a meaningfully
    // discriminating middle band, not be crushed toward 0.
    expect(midRangeScore).toBeGreaterThan(20);
  });

  it('clamps a raw value above the observed 95th percentile to 100, not beyond', () => {
    const normalize = buildNormalizer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'higherIsBetter', 'linear');
    expect(normalize(1_000_000)).toBe(100);
  });

  it('clamps a raw value below the observed 5th percentile to 0, not below', () => {
    const normalize = buildNormalizer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'higherIsBetter', 'linear');
    expect(normalize(-1_000_000)).toBe(0);
  });

  it('returns null for missing data (null, undefined, NaN, Infinity) rather than a fabricated number', () => {
    const normalize = buildNormalizer([1, 2, 3, 4, 5], 'higherIsBetter', 'linear');
    expect(normalize(null)).toBeNull();
    expect(normalize(undefined)).toBeNull();
    expect(normalize(NaN)).toBeNull();
    expect(normalize(Infinity)).toBeNull();
    expect(normalize(-Infinity)).toBeNull();
  });

  it('returns null for every input when the observed population itself is empty', () => {
    const normalize = buildNormalizer([], 'higherIsBetter', 'linear');
    expect(normalize(50)).toBeNull();
  });

  it('a degenerate population (identical observed values) scores everyone at the midpoint, not an arbitrary extreme', () => {
    const normalize = buildNormalizer([42, 42, 42, 42], 'higherIsBetter', 'linear');
    expect(normalize(42)).toBe(50);
  });

  it('log transform still respects direction (higher raw -> higher score) and stays bounded', () => {
    const values = [100, 1_000, 10_000, 100_000, 1_000_000];
    const normalize = buildNormalizer(values, 'higherIsBetter', 'log');
    expect(normalize(1_000_000)!).toBeGreaterThan(normalize(100)!);
    expect(normalize(1_000_000)).toBeLessThanOrEqual(100);
    expect(normalize(100)).toBeGreaterThanOrEqual(0);
  });

  it('ignores non-finite values in the population when computing the range', () => {
    const withJunk = buildNormalizer([1, 2, 3, NaN, Infinity, -Infinity, 4, 5], 'higherIsBetter', 'linear');
    const clean = buildNormalizer([1, 2, 3, 4, 5], 'higherIsBetter', 'linear');
    expect(withJunk(3)).toBe(clean(3));
  });
});
