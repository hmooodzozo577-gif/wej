import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from './questionBanks';
import { WORLD_CATALOG } from './worldCatalog';
import { RECOMMENDATION_PROFILES, idealAnswersFor } from './worldRecommendation';
import { rankDestinations } from '../engine';
import { countryInfoOf } from './worldCatalog';
import { haversineKm } from './geo';
import { selectNextQuestion } from '../adaptive';
import type { PurposeId } from './types';

const PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];

describe('worldwide deterministic recommendation coverage', () => {
  it('has one sourced/derived profile for every effective country and excludes IL', () => {
    expect(RECOMMENDATION_PROFILES).toHaveLength(194);
    expect(new Set(RECOMMENDATION_PROFILES.map((profile) => profile.countryCode)).size).toBe(194);
    expect(RECOMMENDATION_PROFILES.some((profile) => profile.countryCode === 'IL')).toBe(false);
    expect(RECOMMENDATION_PROFILES.some((profile) => profile.countryCode === 'MC')).toBe(true);
    expect(new Set(RECOMMENDATION_PROFILES.map((profile) => profile.countryCode))).toEqual(
      new Set(WORLD_CATALOG.map((country) => country.countryCode)),
    );
  });

  it('uses a materially larger bank with explicit, distinct option branches', () => {
    const total = PURPOSES.reduce((sum, purpose) => sum + QUESTION_BANKS[purpose].length, 0);
    expect(total).toBeGreaterThanOrEqual(64);

    for (const purpose of PURPOSES) {
      const bank = QUESTION_BANKS[purpose];
      expect(bank.length, purpose).toBeGreaterThanOrEqual(8);
      expect(new Set(bank.map((question) => question.id)).size, purpose).toBe(bank.length);
      for (const question of bank.filter((item) => item.nextByValue)) {
        const targets = Object.values(question.nextByValue!);
        expect(targets, `${purpose}/${question.id}`).toHaveLength(question.options.length);
        expect(new Set(targets).size, `${purpose}/${question.id}`).toBe(targets.length);
      }
    }
  });

  it('gives every country a reachable profile that can place it in the top five', () => {
    const unreachable: string[] = [];
    for (const profile of RECOMMENDATION_PROFILES) {
      const appears = PURPOSES.some((purpose) => {
        const answers = idealAnswersFor(profile, purpose);
        const destination = WORLD_CATALOG.find((country) => country.countryCode === profile.countryCode)!;
        const topFive = rankDestinations(purpose, answers, countryInfoOf(destination.id)!.latlng).slice(0, 5).map((result) => result.dest.countryCode);
        return topFive.includes(profile.countryCode);
      });
      if (!appears) unreachable.push(profile.countryCode);
    }
    expect(unreachable).toEqual([]);
  });

  it('uses proximity only to break an exact score tie when location is available', () => {
    const proximity = QUESTION_BANKS.tourism.find((question) => question.kind === 'proximity')!;
    const origin = countryInfoOf('ksa')!.latlng;
    const declined = rankDestinations('tourism', { [proximity.id]: 0 }, origin);
    const withoutLocation = rankDestinations('tourism', { [proximity.id]: 0 });
    expect(declined.map((item) => item.dest.id)).toEqual(withoutLocation.map((item) => item.dest.id));

    const requestedWithoutLocation = rankDestinations('tourism', { [proximity.id]: 100 });
    expect(requestedWithoutLocation.map((item) => item.dest.id)).toEqual(withoutLocation.map((item) => item.dest.id));

    const nearby = rankDestinations('tourism', { [proximity.id]: 100 }, origin);
    const averageDistance = (items: typeof nearby) => items.slice(0, 20).reduce((sum, item) => sum + (item.distanceKm ?? 0), 0) / 20;
    expect(averageDistance(nearby)).toBeLessThan(
      withoutLocation.slice(0, 20).reduce((sum, item) => sum + haversineKm(origin, countryInfoOf(item.dest.id)!.latlng), 0) / 20,
    );
  });

  it('covers at least 190 countries across 16,000 varied real branch paths', () => {
    let seed = 194;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const appearances = new Map(RECOMMENDATION_PROFILES.map((profile) => [profile.countryCode, 0]));
    for (const purpose of PURPOSES) {
      const bank = QUESTION_BANKS[purpose];
      for (let run = 0; run < 2000; run += 1) {
        const answers: Record<string, string | number> = {};
        const path: string[] = [];
        let question = selectNextQuestion(bank, answers, path);
        while (question) {
          path.push(question.id);
          answers[question.id] = question.kind === 'proximity'
            ? 100
            : question.options[Math.floor(random() * question.options.length)]!.value;
          question = selectNextQuestion(bank, answers, path);
        }
        const originCountry = WORLD_CATALOG[run % WORLD_CATALOG.length]!;
        const origin = countryInfoOf(originCountry.id)!.latlng;
        for (const result of rankDestinations(purpose, answers, origin).slice(0, 5)) {
          appearances.set(result.dest.countryCode, appearances.get(result.dest.countryCode)! + 1);
        }
      }
    }
    expect([...appearances.values()].filter((count) => count > 0).length).toBeGreaterThanOrEqual(190);
  }, 60_000);
});
