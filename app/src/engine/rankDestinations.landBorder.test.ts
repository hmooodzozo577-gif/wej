import { describe, expect, it } from 'vitest';
import { rankDestinations } from './rankDestinations';
import { landBorderQuestionId } from '../data/questionBanks';
import { countryInfoOf, resolvedBordersOf, WORLD_CATALOG } from '../data/worldCatalog';

describe('item #7 — land-travel filter in rankDestinations', () => {
  it('narrows results to only countries sharing a direct land border, when answered "yes"', () => {
    const ksa = WORLD_CATALOG.find((c) => c.id === 'ksa')!;
    const origin = countryInfoOf('ksa')!.latlng;
    const expectedBorderCodes = new Set(resolvedBordersOf('ksa').map((c) => c.countryCode));
    expect(expectedBorderCodes.size).toBeGreaterThan(0);

    const results = rankDestinations('tourism', { [landBorderQuestionId('tourism')]: 1 }, origin);
    expect(results.length).toBe(expectedBorderCodes.size);
    for (const result of results) expect(expectedBorderCodes.has(result.dest.countryCode)).toBe(true);
    // KSA itself is never a candidate for its own "reachable by land" list.
    expect(results.some((r) => r.dest.id === ksa.id)).toBe(false);
  });

  it('ranks all destinations normally when answered "no" or left unanswered', () => {
    const origin = countryInfoOf('ksa')!.latlng;
    const no = rankDestinations('tourism', { [landBorderQuestionId('tourism')]: 0 }, origin);
    const unanswered = rankDestinations('tourism', {}, origin);
    expect(no.length).toBe(WORLD_CATALOG.length);
    expect(unanswered.length).toBe(WORLD_CATALOG.length);
  });

  it('falls back to the full catalog (never an empty result) when the resolved country has no land borders', () => {
    // Japan is an island nation — no land borders at all.
    const origin = countryInfoOf('japan')!.latlng;
    const results = rankDestinations('tourism', { [landBorderQuestionId('tourism')]: 1 }, origin);
    expect(results.length).toBe(WORLD_CATALOG.length);
  });

  it('never filters when there is no location at all', () => {
    const results = rankDestinations('tourism', { [landBorderQuestionId('tourism')]: 1 }, null);
    expect(results.length).toBe(WORLD_CATALOG.length);
  });
});
