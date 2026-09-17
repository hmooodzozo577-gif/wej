// buildIntelligenceHealth() — admin observability for the Country
// Intelligence layer (task 3.23). Tested against the REAL committed
// bundled snapshot, the same one intelligence.ts serves from, since this
// function reads no D1 (see its own doc comment for why).
import { describe, expect, it } from 'vitest';
import { buildIntelligenceHealth } from './analytics';

// Duplicated here rather than imported from app/src/intelligence/types —
// worker/ and app/ are separate TypeScript projects/packages, and this
// list is small and stable enough that a literal is simpler than a
// cross-package import.
const SUITABLE_PURPOSES = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness'];

describe('buildIntelligenceHealth', () => {
  it('reports one entry per suitable purpose, with a real model version', async () => {
    const health = await buildIntelligenceHealth();
    expect(health.purposes.length).toBe(SUITABLE_PURPOSES.length);
    for (const purpose of health.purposes) {
      expect(purpose.modelVersion).toMatch(/^[a-z]+-v\d+$/);
      expect(SUITABLE_PURPOSES).toContain(purpose.purpose);
    }
  });

  it('totalCountries matches the effective catalog size (194)', async () => {
    const health = await buildIntelligenceHealth();
    expect(health.totalCountries).toBe(194);
  });

  it('sufficient + insufficient always adds up to the total for every purpose', async () => {
    const health = await buildIntelligenceHealth();
    for (const purpose of health.purposes) {
      expect(purpose.sufficientDataCount + purpose.insufficientDataCount).toBe(purpose.totalCountries);
    }
  });

  it('averageCoverage is a sane percentage for every purpose', async () => {
    const health = await buildIntelligenceHealth();
    for (const purpose of health.purposes) {
      expect(purpose.averageCoverage).toBeGreaterThanOrEqual(0);
      expect(purpose.averageCoverage).toBeLessThanOrEqual(100);
    }
  });

  it('reports a real, parseable generation timestamp', async () => {
    const health = await buildIntelligenceHealth();
    expect(Number.isNaN(new Date(health.generatedAt).getTime())).toBe(false);
  });

  it('is deterministic across repeated calls', async () => {
    const first = await buildIntelligenceHealth();
    const second = await buildIntelligenceHealth();
    expect(second).toEqual(first);
  });
});
