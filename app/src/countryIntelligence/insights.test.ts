import { describe, expect, it } from 'vitest';
import { deriveLimitations, deriveStrengths } from './insights';
import type { SuitabilityComponent } from './detailClient';

function component(overrides: Partial<SuitabilityComponent>): SuitabilityComponent {
  return {
    factor: 'safety',
    label: 'Safety',
    rawValue: 1,
    normalizedValue: 50,
    contribution: 10,
    weight: 20,
    dataYear: '2024',
    sourceId: 'homicideRate',
    status: 'observed',
    ...overrides,
  };
}

describe('deriveStrengths / deriveLimitations', () => {
  it('picks strong (>=70) components, sorted highest first, capped at 3', () => {
    const components = [
      component({ factor: 'a', normalizedValue: 60 }),
      component({ factor: 'b', normalizedValue: 90 }),
      component({ factor: 'c', normalizedValue: 75 }),
      component({ factor: 'd', normalizedValue: 100 }),
      component({ factor: 'e', normalizedValue: 71 }),
    ];
    const strengths = deriveStrengths(components).map((c) => c.factor);
    expect(strengths).toEqual(['d', 'b', 'c']);
  });

  it('picks weak (<40) components, sorted lowest first, capped at 3', () => {
    const components = [
      component({ factor: 'a', normalizedValue: 50 }),
      component({ factor: 'b', normalizedValue: 10 }),
      component({ factor: 'c', normalizedValue: 39 }),
      component({ factor: 'd', normalizedValue: 5 }),
      component({ factor: 'e', normalizedValue: 30 }),
    ];
    const limitations = deriveLimitations(components).map((c) => c.factor);
    expect(limitations).toEqual(['d', 'b', 'e']);
  });

  it('never includes a missing (unobserved) component in either list', () => {
    const components = [
      component({ factor: 'missingHigh', status: 'missing', normalizedValue: null }),
      component({ factor: 'realHigh', normalizedValue: 90 }),
    ];
    expect(deriveStrengths(components).map((c) => c.factor)).toEqual(['realHigh']);
    expect(deriveLimitations(components).map((c) => c.factor)).toEqual([]);
  });

  it('returns an empty array rather than a forced pick when nothing qualifies', () => {
    const components = [component({ normalizedValue: 55 })];
    expect(deriveStrengths(components)).toEqual([]);
    expect(deriveLimitations(components)).toEqual([]);
  });

  it('a component can never appear in both strengths and limitations', () => {
    const components = [
      component({ factor: 'a', normalizedValue: 90 }),
      component({ factor: 'b', normalizedValue: 10 }),
    ];
    const strengthKeys = new Set(deriveStrengths(components).map((c) => c.factor));
    const limitationKeys = new Set(deriveLimitations(components).map((c) => c.factor));
    for (const key of strengthKeys) expect(limitationKeys.has(key)).toBe(false);
  });
});
