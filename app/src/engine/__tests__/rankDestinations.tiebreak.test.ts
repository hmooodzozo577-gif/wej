// Phase 14 — dedicated unit test for rankDestinations()'s deterministic
// tie-breaker (see rankDestinations.ts's own doc comment for the audit
// finding and fix). Uses a small SYNTHETIC destination set (mocked
// data/destinations module) rather than relying on whichever real
// destinations happen to tie under some real answer profile — that
// would be fragile (a future data edit could silently remove the tie
// and make this test meaningless without failing).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination } from '../../data/types';

/** A minimal, valid, fully-populated synthetic Destination — every
 *  scoreDestination()-relevant field is identical across all three
 *  fixtures below except `id`/name, so any purpose/answers combination
 *  scores them identically (a guaranteed, deliberate tie), independent
 *  of which real question banks happen to be active. */
function makeDestination(id: string): Destination {
  return {
    id,
    nameEn: id,
    nameAr: id,
    region: 'Asia',
    citiesEn: [],
    citiesAr: [],
    descEn: '',
    descAr: '',
    costLevel: 2,
    safety: 70,
    climate: 'temperate',
    nature: 50,
    urban: 50,
    beaches: 50,
    adventure: 50,
    culture: 50,
    nightlife: 50,
    salary: 50,
    jobMarket: 50,
    careerGrowth: 50,
    english: 50,
    tuition: 2,
    uniRank: 50,
    healthcare: 50,
    waiting: 50,
    immiFriendly: 50,
    qol: 50,
    bizEase: 50,
    growth: 50,
    stability: 50,
    spa: 50,
    quiet: 50,
    visaDiff: 'moderate',
    livingCostEn: '',
    livingCostAr: '',
    pTourism: 60,
    pWork: 60,
    pEdu: 60,
    pMed: 60,
    pImmi: 60,
    pInvest: 60,
    pWellness: 60,
    strengthsEn: [],
    strengthsAr: [],
    weaknessesEn: [],
    weaknessesAr: [],
    langEn: '',
    langAr: '',
    countryCode: id.slice(0, 2).toUpperCase(),
    recommendationReady: true,
  };
}

describe('Phase 14 — rankDestinations deterministic tie-breaking', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('../../data/destinations');
  });

  it('breaks an exact score tie by destination id, ascending — never insertion order, never randomness', async () => {
    // Deliberately out of alphabetical order in the source array, so a
    // passing test proves real re-sorting happened, not an accidental
    // match with the array's own order.
    const synthetic = [makeDestination('zulu'), makeDestination('alpha'), makeDestination('mike')];
    vi.doMock('../../data/destinations', () => ({ DESTINATIONS: synthetic }));

    const { rankDestinations } = await import('../rankDestinations');
    const result = rankDestinations('tourism', {});

    expect(result.map((r) => r.score)).toEqual([result[0]!.score, result[0]!.score, result[0]!.score]); // confirms the tie is real
    expect(result.map((r) => r.dest.id)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('is deterministic across repeated calls with the same synthetic tie', async () => {
    const synthetic = [makeDestination('bravo'), makeDestination('alpha')];
    vi.doMock('../../data/destinations', () => ({ DESTINATIONS: synthetic }));

    const { rankDestinations } = await import('../rankDestinations');
    const first = rankDestinations('tourism', {}).map((r) => r.dest.id);
    const second = rankDestinations('tourism', {}).map((r) => r.dest.id);
    expect(first).toEqual(second);
    expect(first).toEqual(['alpha', 'bravo']);
  });

  it('still sorts by score first — a genuinely higher-scoring destination always outranks a tied pair, regardless of id', async () => {
    const winner = { ...makeDestination('zzz-winner'), pTourism: 95 };
    const synthetic = [makeDestination('alpha'), makeDestination('bravo'), winner];
    vi.doMock('../../data/destinations', () => ({ DESTINATIONS: synthetic }));

    const { rankDestinations } = await import('../rankDestinations');
    const result = rankDestinations('tourism', {});
    expect(result[0]!.dest.id).toBe('zzz-winner');
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });
});
