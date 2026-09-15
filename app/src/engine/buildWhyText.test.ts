import { describe, expect, it } from 'vitest';
import { buildWhyText } from './buildWhyText';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Reason } from './types';

describe('buildWhyText (item #12 — dynamic, answer-driven explanation)', () => {
  const dest = WORLD_CATALOG.find((c) => c.id === 'ksa')!;

  it('varies the match-strength phrase with the real score', () => {
    const reasons: Reason[] = [{ id: '__purpose', weight: 25, fit: 90 }];
    const strong = buildWhyText('en', 'tourism', reasons, dest, 85);
    const partial = buildWhyText('en', 'tourism', reasons, dest, 40);
    expect(strong).toMatch(/very strong match/);
    expect(partial).toMatch(/partial match/);
    expect(strong).not.toBe(partial);
  });

  it('names a trade-off only when a real answered factor scored a meaningfully weak fit', () => {
    const withWeak: Reason[] = [
      { id: '__purpose', weight: 25, fit: 90 },
      { id: 'tourism-safety', weight: 11, fit: 20 },
    ];
    const allStrong: Reason[] = [
      { id: '__purpose', weight: 25, fit: 90 },
      { id: 'tourism-safety', weight: 11, fit: 95 },
    ];
    expect(buildWhyText('en', 'tourism', withWeak, dest, 80)).toMatch(/One trade-off:/);
    expect(buildWhyText('en', 'tourism', allStrong, dest, 80)).not.toMatch(/trade-off/);
  });

  it('never mentions a dimension the user never actually answered (weight 0)', () => {
    const reasons: Reason[] = [
      { id: '__purpose', weight: 25, fit: 90 },
      { id: 'tourism-coastal', weight: 0, fit: 10 },
    ];
    const text = buildWhyText('en', 'tourism', reasons, dest, 85);
    expect(text).not.toMatch(/coastal/i);
  });
});
