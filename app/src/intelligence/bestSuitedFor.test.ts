import { describe, expect, it } from 'vitest';
import { bestSuitedFor, GROUPING_MARGIN_POINTS } from './bestSuitedFor';
import type { CountryIntelligenceSummary, SuitablePurposeId } from './types';

function summary(purpose: SuitablePurposeId, overrides: Partial<CountryIntelligenceSummary> = {}): CountryIntelligenceSummary {
  return {
    countryCode: 'XX',
    purpose,
    modelVersion: `${purpose}-v1`,
    score: 80,
    insufficientData: false,
    coverage: 95,
    confidence: 'high',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('bestSuitedFor — a single clear winner', () => {
  it('example from the task: Tourism 90, Work 79, Investment 77, Wellness 70, Education 64 -> "Best suited for Tourism" alone', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90 }),
      summary('work', { score: 79 }),
      summary('investment', { score: 77 }),
      summary('wellness', { score: 70 }),
      summary('education', { score: 64 }),
    ]);
    expect(result.eligible).toBe(true);
    expect(result.topGroup).toEqual(['tourism']);
    expect(result.topScore).toBe(90);
  });
});

describe('bestSuitedFor — grouping close scores instead of exaggerating a tiny gap', () => {
  it('90/89/88 groups all three rather than picking 90 alone', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90 }),
      summary('work', { score: 89 }),
      summary('investment', { score: 88 }),
      summary('education', { score: 50 }),
    ]);
    expect(result.topGroup).toEqual(['tourism', 'work', 'investment']);
  });

  it('is deterministic at the exact grouping boundary — exactly GROUPING_MARGIN_POINTS below the top is included', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90 }),
      summary('work', { score: 90 - GROUPING_MARGIN_POINTS }),
    ]);
    expect(result.topGroup).toEqual(['tourism', 'work']);
  });

  it('one point beyond the margin is excluded from the top group', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90 }),
      summary('work', { score: 90 - GROUPING_MARGIN_POINTS - 1 }),
    ]);
    expect(result.topGroup).toEqual(['tourism']);
  });

  it('groups are always in descending score order', () => {
    const result = bestSuitedFor([
      summary('work', { score: 88 }),
      summary('tourism', { score: 90 }),
      summary('investment', { score: 89 }),
    ]);
    expect(result.topGroup).toEqual(['tourism', 'investment', 'work']);
  });
});

describe('bestSuitedFor — confidence/coverage/freshness gating', () => {
  it('a purpose with insufficient data never becomes "best" even with a numerically high score field', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: null, insufficientData: true, confidence: null }),
      summary('work', { score: 75, confidence: 'high' }),
    ]);
    expect(result.topGroup).toEqual(['work']);
  });

  it('a purpose with only "low" confidence is excluded from "best" status, even if its score is the highest', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 95, confidence: 'low' }),
      summary('work', { score: 70, confidence: 'high' }),
    ]);
    expect(result.topGroup).toEqual(['work']);
    // The low-confidence purpose is still visible in the full ranked list.
    const tourismRow = result.ranked.find((row) => row.purpose === 'tourism')!;
    expect(tourismRow.eligible).toBe(false);
    expect(tourismRow.score).toBe(95);
  });

  it('if NO purpose has sufficient confidence/data, returns an honest insufficient state rather than forcing a winner', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: null, insufficientData: true, confidence: null }),
      summary('work', { score: 60, confidence: 'low' }),
    ]);
    expect(result.eligible).toBe(false);
    expect(result.topGroup).toBeNull();
    expect(result.topScore).toBeNull();
  });

  it('the group confidence is the WEAKEST confidence among its members, never overstating the group', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90, confidence: 'high' }),
      summary('work', { score: 89, confidence: 'medium' }),
    ]);
    expect(result.topGroup).toEqual(['tourism', 'work']);
    expect(result.topConfidence).toBe('medium');
  });
});

describe('bestSuitedFor — the full ranked list', () => {
  it('includes every purpose passed in, sorted descending by score, insufficient-data ones last', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 60 }),
      summary('work', { score: null, insufficientData: true, confidence: null }),
      summary('education', { score: 90 }),
    ]);
    expect(result.ranked.map((row) => row.purpose)).toEqual(['education', 'tourism', 'work']);
  });

  it('flags exactly the top-group members as inTopGroup and no others', () => {
    const result = bestSuitedFor([
      summary('tourism', { score: 90 }),
      summary('work', { score: 89 }),
      summary('education', { score: 50 }),
    ]);
    const flags = Object.fromEntries(result.ranked.map((row) => [row.purpose, row.inTopGroup]));
    expect(flags).toEqual({ tourism: true, work: true, education: false });
  });
});

describe('bestSuitedFor — determinism and purity', () => {
  it('is deterministic — same input, same output, regardless of input order', () => {
    const a = [summary('tourism', { score: 90 }), summary('work', { score: 70 })];
    const b = [summary('work', { score: 70 }), summary('tourism', { score: 90 })];
    expect(bestSuitedFor(a)).toEqual(bestSuitedFor(b));
  });

  it('handles an empty input without throwing', () => {
    expect(() => bestSuitedFor([])).not.toThrow();
    expect(bestSuitedFor([]).eligible).toBe(false);
  });

  it('handles a single purpose', () => {
    const result = bestSuitedFor([summary('tourism', { score: 72 })]);
    expect(result.topGroup).toEqual(['tourism']);
  });
});
