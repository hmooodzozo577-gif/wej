// buildIntelligenceHealth() — admin observability for the Country
// Intelligence layer (task 3.23). Tested against the REAL committed
// bundled snapshot, the same one intelligence.ts serves from, since this
// function reads no D1 (see its own doc comment for why).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAIHealth, buildIntelligenceHealth } from './analytics';
import { _resetAIStateForTests } from './ai';

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

// buildAIHealth() — Phase 16 workstream H. The metrics themselves are
// exercised in depth in ai.test.ts; this only proves the admin summary
// shape (percentages, configured flag, no leaked secret) is correct.
describe('buildAIHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetAIStateForTests();
  });

  it('reports not configured with all-zero counts when no key is set', async () => {
    const health = await buildAIHealth({});
    expect(health.configured).toBe(false);
    expect(health.provider).toBe('none');
    expect(health.requestCount).toBe(0);
    expect(health.successRatePct).toBe(0);
  });

  it('never leaks the API key into the summary', async () => {
    const health = await buildAIHealth({ ANTHROPIC_API_KEY: 'super-secret-key' });
    expect(JSON.stringify(health)).not.toContain('super-secret-key');
    expect(health.configured).toBe(true);
    expect(health.provider).toBe('anthropic');
  });

  it('computes success/fallback/cache-hit rates from real recorded metrics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ summary: 'ok' }) }] }), { status: 200 }),
    ));
    const { createAnthropicProvider } = await import('./ai');
    const provider = createAnthropicProvider({ ANTHROPIC_API_KEY: 'key' });
    await provider.explain({ kind: 'recommendation', lang: 'en', countryCode: 'JP', purpose: 'tourism' });
    await provider.explain({ kind: 'recommendation', lang: 'en', countryCode: 'JP', purpose: 'tourism' }); // cache hit

    const health = await buildAIHealth({ ANTHROPIC_API_KEY: 'key' });
    expect(health.requestCount).toBe(1);
    expect(health.successCount).toBe(1);
    expect(health.cacheHitCount).toBe(1);
    expect(health.successRatePct).toBe(50);
    expect(health.cacheHitRatePct).toBe(50);
  });
});
