import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from './questionBanks';
import { WORLD_CATALOG } from './worldCatalog';
import { RECOMMENDATION_PROFILES, idealAnswersFor } from './worldRecommendation';
import { rankDestinations } from '../engine';
import { countryInfoOf } from './worldCatalog';
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
    expect(total).toBeGreaterThanOrEqual(200);

    for (const purpose of PURPOSES) {
      const bank = QUESTION_BANKS[purpose];
      expect(bank.length, purpose).toBeGreaterThanOrEqual(25);
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
        const topFive = rankDestinations(purpose, answers).slice(0, 5).map((result) => result.dest.countryCode);
        return topFive.includes(profile.countryCode);
      });
      if (!appears) unreachable.push(profile.countryCode);
    }
    expect(unreachable).toEqual([]);
  });

  it('uses proximity only to break an exact score tie when location is available', () => {
    const baseline = rankDestinations('tourism', {});
    const pair = baseline.find((item, index) => index > 0 && item.score === baseline[index - 1]!.score);
    expect(pair).toBeDefined();
    const origin = countryInfoOf(pair!.dest.id)!.latlng;
    const withLocation = rankDestinations('tourism', {}, origin);
    const sameScore = withLocation.filter((item) => item.score === pair!.score);
    expect(sameScore[0]!.dest.id).toBe(pair!.dest.id);
    expect(withLocation.map((item) => item.score)).toEqual([...withLocation.map((item) => item.score)].sort((a, b) => b - a));
  });

  it('keeps every country visible across a broad deterministic sample of real branch paths', () => {
    let seed = 194;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const appearances = new Map(RECOMMENDATION_PROFILES.map((profile) => [profile.countryCode, 0]));
    for (const purpose of PURPOSES) {
      const bank = QUESTION_BANKS[purpose];
      for (let run = 0; run < 600; run += 1) {
        const answers: Record<string, string | number> = {};
        const path: string[] = [];
        let question = selectNextQuestion(bank, answers, path);
        while (question) {
          path.push(question.id);
          answers[question.id] = question.options[Math.floor(random() * question.options.length)]!.value;
          question = selectNextQuestion(bank, answers, path);
        }
        for (const result of rankDestinations(purpose, answers).slice(0, 5)) {
          appearances.set(result.dest.countryCode, appearances.get(result.dest.countryCode)! + 1);
        }
      }
    }
    expect([...appearances].filter(([, count]) => count === 0).map(([code]) => code)).toEqual([]);
  });
});
