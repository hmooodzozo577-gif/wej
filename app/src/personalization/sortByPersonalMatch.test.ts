// Explore's Personal Match sorts over the whole 194-country catalog:
// direction, grouping (unscored and hard-requirement misses never float
// up), stable ties, determinism, and "sorting, never filtering".
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { filteredCatalog, sortCatalog } from '../data/exploreCatalog';
import { landBorderQuestionId } from '../data/questionBanks';
import { normalizePreferences } from './signals';
import { personalMatchesFor } from './personalMatch';
import { sortByPersonalMatch } from './sortByPersonalMatch';
import type { PersonalMatch } from './types';
import type { Answers } from '../engine/types';
import type { PurposeId } from '../data/types';

const BASELINE = sortCatalog(filteredCatalog({ q: '', region: '', purpose: '', cost: '', sort: 'default' }), 'default', 'ar', null, undefined);
const RIYADH = { lat: 24.7136, lng: 46.6753 };

function group(match: PersonalMatch | undefined) {
  if (!match || match.score === null) return 2;
  return match.eligible ? 0 : 1;
}

function checkOrder(sorted: typeof BASELINE, matches: Map<string, PersonalMatch>, direction: 'desc' | 'asc') {
  expect(sorted).toHaveLength(BASELINE.length);
  expect(new Set(sorted.map((d) => d.id))).toEqual(new Set(BASELINE.map((d) => d.id)));
  const baseIndex = new Map(BASELINE.map((d, i) => [d.id, i]));
  for (let i = 1; i < sorted.length; i++) {
    const a = matches.get(sorted[i - 1]!.id);
    const b = matches.get(sorted[i]!.id);
    const ga = group(a);
    const gb = group(b);
    expect(ga).toBeLessThanOrEqual(gb);
    if (ga !== gb) continue;
    if (ga < 2) {
      if (direction === 'desc') expect(a!.score!).toBeGreaterThanOrEqual(b!.score!);
      else expect(a!.score!).toBeLessThanOrEqual(b!.score!);
    }
    // Equal scores (and every unscored pair) keep the baseline order.
    if (ga === 2 || a!.score === b!.score) expect(baseIndex.get(sorted[i - 1]!.id)!).toBeLessThan(baseIndex.get(sorted[i]!.id)!);
  }
}

describe('sortByPersonalMatch — full catalog', () => {
  const profiles: { purpose: PurposeId; answers: Answers }[] = [
    { purpose: 'tourism', answers: { 'tourism-climate': 'cold', 'tourism-cost': 3, 'tourism-coastal': 100, 'tourism-safety': 75 } },
    { purpose: 'work', answers: { 'work-climate': 'temperate', 'work-opportunity': 100 } },
    // Land-border requirement: with Riyadh as origin, some countries fail it.
    { purpose: 'tourism', answers: { 'tourism-climate': 'hot', [landBorderQuestionId('tourism')]: 1 } },
  ];

  for (const profile of profiles) {
    for (const origin of [null, RIYADH]) {
      it(`orders ${profile.purpose} ${Object.keys(profile.answers).join('+')} ${origin ? 'with' : 'without'} location, both directions`, () => {
        const matches = personalMatchesFor(WORLD_CATALOG, normalizePreferences(profile.purpose, profile.answers), { origin });
        for (const direction of ['desc', 'asc'] as const) {
          const sorted = sortByPersonalMatch(BASELINE, matches, direction);
          checkOrder(sorted, matches, direction);
          // Deterministic.
          expect(sortByPersonalMatch(BASELINE, matches, direction).map((d) => d.id)).toEqual(sorted.map((d) => d.id));
        }
      });
    }
  }

  it('keeps hard-requirement misses after every eligible country (real data)', () => {
    const matches = personalMatchesFor(WORLD_CATALOG, normalizePreferences('tourism', { 'tourism-climate': 'hot', [landBorderQuestionId('tourism')]: 1 }), { origin: RIYADH });
    const failing = [...matches.values()].filter((m) => m.score !== null && !m.eligible).length;
    expect(failing).toBeGreaterThan(50);
    for (const direction of ['desc', 'asc'] as const) {
      const sorted = sortByPersonalMatch(BASELINE, matches, direction);
      const firstMiss = sorted.findIndex((d) => !matches.get(d.id)!.eligible);
      expect(sorted.slice(firstMiss).every((d) => !matches.get(d.id)!.eligible || matches.get(d.id)!.score === null)).toBe(true);
    }
  });

  it('puts unscored countries last in both directions and keeps ties in baseline order', () => {
    const ids = BASELINE.slice(0, 8).map((d) => d.id);
    const fake = (id: string, score: number | null, eligible = true) => [id, { score, eligible } as PersonalMatch] as const;
    const matches = new Map([
      fake(ids[0]!, null), fake(ids[1]!, 70), fake(ids[2]!, 40), fake(ids[3]!, 70),
      fake(ids[4]!, 90, false), fake(ids[5]!, null), fake(ids[6]!, 10), fake(ids[7]!, 40),
    ]);
    const list = BASELINE.slice(0, 8);
    expect(sortByPersonalMatch(list, matches, 'desc').map((d) => ids.indexOf(d.id))).toEqual([1, 3, 2, 7, 6, 4, 0, 5]);
    expect(sortByPersonalMatch(list, matches, 'asc').map((d) => ids.indexOf(d.id))).toEqual([6, 2, 7, 1, 3, 4, 0, 5]);
  });

  it('treats a country missing from the map as unscored, never as a top result', () => {
    const list = BASELINE.slice(0, 3);
    const matches = new Map([[list[1]!.id, { score: 5, eligible: true } as PersonalMatch]]);
    expect(sortByPersonalMatch(list, matches, 'asc')[0]!.id).toBe(list[1]!.id);
    expect(sortByPersonalMatch(list, matches, 'desc')[0]!.id).toBe(list[1]!.id);
  });
});
