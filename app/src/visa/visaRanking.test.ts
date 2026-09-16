// Item #12C — the bounded ranking layer.
//
// The user approved visa data affecting suitability but did NOT approve a
// new weighting scheme, and Phase 14 remains the ranking authority. These
// tests pin exactly that boundary: reordering within a narrow band of
// near-equal scores, no score changed, nothing at all without a passport.
import { describe, expect, it } from 'vitest';
import { REORDER_WINDOW, applyVisaRanking, visaRankingChangedOrder } from './visaRanking';
import type { VisaRequirement, VisaRequirementCategory } from './types';
import { visaConvenienceRank } from './types';
import type { RankedResult } from '../engine';
import type { CatalogEntry } from '../data/types';

function result(countryCode: string, score: number): RankedResult {
  return {
    dest: { id: countryCode.toLowerCase(), countryCode, nameEn: countryCode, nameAr: countryCode } as CatalogEntry,
    score,
    reasons: [],
  };
}

function requirement(destinationCode: string, category: VisaRequirementCategory): VisaRequirement {
  return {
    passportCode: 'SA',
    destinationCode,
    category,
    provider: 'test',
    checkedAt: '2026-09-16T00:00:00.000Z',
  };
}

function requirementsOf(entries: [string, VisaRequirementCategory][]) {
  return new Map(entries.map(([code, category]) => [code, requirement(code, category)]));
}

describe('the layer is inert unless it has everything it needs', () => {
  const results = [result('AA', 80), result('BB', 79)];

  it('does nothing without a passport', () => {
    const requirements = requirementsOf([['BB', 'visaFree'], ['AA', 'embassyVisaRequired']]);
    expect(applyVisaRanking({ results, requirements, passportCode: null })).toBe(results);
  });

  it('does nothing with no requirement data at all', () => {
    expect(applyVisaRanking({ results, requirements: new Map(), passportCode: 'SA' })).toBe(results);
  });

  it('leaves a destination with no requirement entry exactly where Phase 14 put it', () => {
    const requirements = requirementsOf([['AA', 'visaFree']]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered.map((item) => item.dest.countryCode)).toEqual(['AA', 'BB']);
  });
});

describe('no Phase 14 score is ever changed', () => {
  it('returns the same score objects, only reordered', () => {
    const results = [result('AA', 80), result('BB', 79), result('CC', 78)];
    const requirements = requirementsOf([
      ['AA', 'embassyVisaRequired'],
      ['BB', 'embassyVisaRequired'],
      ['CC', 'visaFree'],
    ]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered.map((item) => item.score).sort()).toEqual([78, 79, 80]);
    for (const item of ordered) {
      const original = results.find((entry) => entry.dest.countryCode === item.dest.countryCode)!;
      expect(item.score).toBe(original.score);
      expect(item).toBe(original);
    }
  });
});

describe('reordering is bounded by the score window', () => {
  it('promotes a visa-free destination above a near-equal one that needs an embassy visa', () => {
    const results = [result('AA', 80), result('BB', 79)];
    const requirements = requirementsOf([['AA', 'embassyVisaRequired'], ['BB', 'visaFree']]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered.map((item) => item.dest.countryCode)).toEqual(['BB', 'AA']);
  });

  it('never promotes across a gap wider than the window', () => {
    const results = [result('AA', 90), result('BB', 90 - REORDER_WINDOW - 1)];
    const requirements = requirementsOf([['AA', 'embassyVisaRequired'], ['BB', 'visaFree']]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered.map((item) => item.dest.countryCode)).toEqual(['AA', 'BB']);
  });

  it('reorders exactly at the window edge and not one point beyond it', () => {
    const atEdge = applyVisaRanking({
      results: [result('AA', 90), result('BB', 90 - REORDER_WINDOW)],
      requirements: requirementsOf([['AA', 'embassyVisaRequired'], ['BB', 'visaFree']]),
      passportCode: 'SA',
    });
    expect(atEdge.map((item) => item.dest.countryCode)).toEqual(['BB', 'AA']);

    const pastEdge = applyVisaRanking({
      results: [result('AA', 90), result('BB', 90 - REORDER_WINDOW - 1)],
      requirements: requirementsOf([['AA', 'embassyVisaRequired'], ['BB', 'visaFree']]),
      passportCode: 'SA',
    });
    expect(pastEdge.map((item) => item.dest.countryCode)).toEqual(['AA', 'BB']);
  });

  it('cannot let visa convenience dominate a long list', () => {
    // A visa-free country 40 points down must stay 40 points down.
    const results = [
      result('AA', 95),
      result('BB', 90),
      result('CC', 85),
      result('DD', 55),
    ];
    const requirements = requirementsOf([
      ['AA', 'embassyVisaRequired'],
      ['BB', 'embassyVisaRequired'],
      ['CC', 'embassyVisaRequired'],
      ['DD', 'visaFree'],
    ]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered[ordered.length - 1]!.dest.countryCode).toBe('DD');
  });
});

describe('the ordering itself is deterministic and sensible', () => {
  it('orders a band by visa convenience, most convenient first', () => {
    const results = [
      result('AA', 80),
      result('BB', 80),
      result('CC', 80),
      result('DD', 80),
      result('EE', 80),
    ];
    const requirements = requirementsOf([
      ['AA', 'embassyVisaRequired'],
      ['BB', 'authorizationRequired'],
      ['CC', 'eVisa'],
      ['DD', 'visaOnArrival'],
      ['EE', 'visaFree'],
    ]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered.map((item) => item.dest.countryCode)).toEqual(['EE', 'DD', 'CC', 'BB', 'AA']);
  });

  it('breaks a visa tie by Phase 14 score, then by id — never randomly', () => {
    const results = [result('BB', 80), result('AA', 80), result('CC', 81)];
    const requirements = requirementsOf([['AA', 'visaFree'], ['BB', 'visaFree'], ['CC', 'visaFree']]);
    const first = applyVisaRanking({ results: [...results], requirements, passportCode: 'SA' });
    const second = applyVisaRanking({ results: [...results], requirements, passportCode: 'SA' });
    expect(first.map((item) => item.dest.countryCode)).toEqual(second.map((item) => item.dest.countryCode));
    expect(first.map((item) => item.dest.countryCode)).toEqual(['CC', 'AA', 'BB']);
  });

  it('treats an unknown requirement as neither a reward nor a penalty', () => {
    expect(visaConvenienceRank('unknown')).toBeGreaterThan(visaConvenienceRank('visaFree'));
    expect(visaConvenienceRank('unknown')).toBeLessThan(visaConvenienceRank('embassyVisaRequired'));
  });

  it('keeps the list the same length and loses nothing', () => {
    const results = [result('AA', 80), result('BB', 79), result('CC', 60), result('DD', 59)];
    const requirements = requirementsOf([['AA', 'embassyVisaRequired'], ['BB', 'visaFree'], ['DD', 'visaFree']]);
    const ordered = applyVisaRanking({ results, requirements, passportCode: 'SA' });
    expect(ordered).toHaveLength(results.length);
    expect(new Set(ordered.map((item) => item.dest.countryCode))).toEqual(
      new Set(results.map((item) => item.dest.countryCode)),
    );
  });
});

describe('visaRankingChangedOrder', () => {
  it('is false when nothing moved', () => {
    const results = [result('AA', 80), result('BB', 79)];
    expect(visaRankingChangedOrder(results, results)).toBe(false);
  });

  it('is true when something moved', () => {
    const results = [result('AA', 80), result('BB', 79)];
    expect(visaRankingChangedOrder(results, [results[1]!, results[0]!])).toBe(true);
  });
});
