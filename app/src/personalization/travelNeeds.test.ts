// v1.1 — the three optional travel needs (language, Islamic practice, halal
// food) in Personal Match (personal-match-1.1): questions, signals,
// evaluation, "missing evidence is never a low score", schema v2 migration,
// and that none of it reaches Phase 14, analytics or the admin catalog.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// A controlled evidence snapshot, so every tier is exercised whatever the
// committed snapshot currently holds.
vi.mock('../data/generated/islamicTravelEvidence.json', () => ({
  default: {
    snapshotUpdatedAt: '2026-09-26T00:00:00.000Z',
    entries: [
      // Muslim-majority, many mapped mosques, halal is the default and rarely tagged.
      { countryCode: 'SA', status: 'ok', mosques: 5000, halalPlaces: 3 },
      { countryCode: 'MY', status: 'ok', mosques: 3000, halalPlaces: 400 },
      // Non-Muslim-majority with real, mapped evidence.
      { countryCode: 'GB', status: 'ok', mosques: 1500, halalPlaces: 800 },
      { countryCode: 'JP', status: 'ok', mosques: 60, halalPlaces: 40 },
      { countryCode: 'MC', status: 'ok', mosques: 0, halalPlaces: 0 },
      // Muslim-majority, halal the default: few tags, but above the floor.
      { countryCode: 'EG', status: 'ok', mosques: 2362, halalPlaces: 97 },
      // Just under the halal floor.
      { countryCode: 'OM', status: 'ok', mosques: 2126, halalPlaces: 10 },
      // A small country with many mosques for its size (density rule).
      { countryCode: 'SG', status: 'ok', mosques: 76, halalPlaces: 331 },
      // A large country with the same kind of count stays partial.
      { countryCode: 'AU', status: 'ok', mosques: 124, halalPlaces: 107 },
      { countryCode: 'FR', status: 'unavailable' },
    ],
  },
}));

import { QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { rankDestinations } from '../engine';
import type { Answers } from '../engine/types';
import { factorDetail, personalSummary } from './explain';
import { computePersonalMatch } from './personalMatch';
import { parseStoredProfile, sanitizeAnswers } from './profile';
import { normalizePreferences } from './signals';
import {
  LANGUAGE_OPTIONS,
  isTravelNeedQuestionId,
  languageAnswer,
  parseLanguageAnswer,
  travelNeedQuestionId,
  travelNeedQuestions,
} from './travelNeeds';
import { PERSONAL_MATCH_METHODOLOGY_VERSION, PROFILE_SCHEMA_VERSION } from './types';
import { destinationSharePayload } from '../share/share';

const PURPOSES: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
const byId = (id: string) => WORLD_CATALOG.find((entry) => entry.id === id)!;
const CORE: Answers = { 'tourism-climate': 'mediterranean', 'tourism-cost': 2, 'tourism-safety': 100 };
const id = (need: Parameters<typeof travelNeedQuestionId>[1]) => travelNeedQuestionId('tourism', need);

function matchFor(destId: string, answers: Answers) {
  return computePersonalMatch(byId(destId), normalizePreferences('tourism', answers));
}

function factor(destId: string, answers: Answers, factorId: string) {
  return matchFor(destId, answers).factors.find((item) => item.factor === factorId);
}

describe('the questions', () => {
  it('asks exactly the four agreed questions, with independent Islamic-practice and halal questions', () => {
    const questions = travelNeedQuestions('tourism');
    expect(questions.map((q) => q.id)).toEqual([id('languageImportance'), id('languages'), id('islamicPractice'), id('halalFood')]);
    expect(questions[0]!.text.ar).toBe('ما مدى أهمية سهولة التواصل بلغة تعرفها أثناء السفر؟');
    expect(questions[1]!.text.ar).toBe('ما اللغات التي تستطيع استخدامها أثناء السفر؟');
    expect(questions[2]!.text.ar).toBe('ما مدى أهمية سهولة ممارسة شعائرك الإسلامية أثناء السفر؟');
    expect(questions[3]!.text.ar).toBe('ما مدى أهمية سهولة العثور على طعام حلال في وجهتك؟');
    for (const index of [0, 2, 3]) {
      expect(questions[index]!.options.map((o) => o.label.en)).toEqual(['Very important', 'Important', 'Not important']);
      expect(questions[index]!.parent).toBeUndefined();
    }
    // Only the language list depends on another answer.
    expect(questions[1]!.parent).toEqual({ questionId: id('languageImportance'), values: [100, 60] });
    // Never a question about a country's religiosity.
    expect(JSON.stringify(questions)).not.toMatch(/religious country|متدين|دولة إسلامية|Muslim-majority|percentage/i);
  });

  it('are never Phase 14 questions: not in QUESTION_BANKS, no profileKey, no weight', () => {
    for (const purpose of PURPOSES) {
      const bankIds = new Set(QUESTION_BANKS[purpose].map((q) => q.id));
      for (const question of travelNeedQuestions(purpose)) {
        expect(bankIds.has(question.id)).toBe(false);
        expect(question.profileKey).toBeUndefined();
        expect(question.weight).toBe(0);
        expect(isTravelNeedQuestionId(question.id)).toBe(true);
      }
    }
    expect(isTravelNeedQuestionId('tourism-climate')).toBe(false);
    expect(isTravelNeedQuestionId('tourism-landBorder')).toBe(false);
  });

  it('offers only languages the country data can actually evaluate', () => {
    const catalogLanguages = new Set<string>();
    for (const raw of Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/generated/countryInfo.json'), 'utf8')) as Record<string, { languagesEn?: string[] }>)) {
      for (const name of raw.languagesEn ?? []) catalogLanguages.add(name);
    }
    for (const option of LANGUAGE_OPTIONS) {
      expect(option.officialNames.some((name) => catalogLanguages.has(name)), option.code).toBe(true);
    }
  });
});

describe('Phase 14 never sees the travel needs', () => {
  it('ranks exactly as without them, for every purpose', () => {
    for (const purpose of PURPOSES) {
      const core: Answers = Object.fromEntries(QUESTION_BANKS[purpose].slice(0, 4).map((q) => [q.id, q.options[0]!.value]));
      const withNeeds: Answers = {
        ...core,
        [travelNeedQuestionId(purpose, 'languageImportance')]: 100,
        [travelNeedQuestionId(purpose, 'languages')]: 'ar,en',
        [travelNeedQuestionId(purpose, 'islamicPractice')]: 100,
        [travelNeedQuestionId(purpose, 'halalFood')]: 100,
      };
      const strip = (results: ReturnType<typeof rankDestinations>) => results.map((r) => [r.dest.id, r.score, r.reasons]);
      expect(strip(rankDestinations(purpose, withNeeds, null))).toEqual(strip(rankDestinations(purpose, core, null)));
    }
  });
});

describe('signals', () => {
  it('weights by importance like every other importance question; "not important" is neutral', () => {
    const prefs = normalizePreferences('tourism', {
      ...CORE,
      [id('languageImportance')]: 100,
      [id('languages')]: 'ar,en',
      [id('islamicPractice')]: 60,
      [id('halalFood')]: 0,
    });
    const language = prefs.signals.find((s) => s.factor === 'language')!;
    const islamic = prefs.signals.find((s) => s.factor === 'islamicPractice')!;
    expect(language).toMatchObject({ kind: 'language', value: 'ar,en', weight: 10, strength: 'strong', questionId: id('languages') });
    expect(islamic).toMatchObject({ kind: 'evidence', weight: 6, strength: 'normal' });
    expect(prefs.signals.some((s) => s.factor === 'halalFood')).toBe(false);
    expect(prefs.neutral).toContain(id('halalFood'));
  });

  it('never invents a language preference', () => {
    // Communication matters but no language list yet: nothing to compare.
    expect(normalizePreferences('tourism', { ...CORE, [id('languageImportance')]: 100 }).signals.some((s) => s.factor === 'language')).toBe(false);
    // "Not important": a leftover list is ignored.
    const notImportant = normalizePreferences('tourism', { ...CORE, [id('languageImportance')]: 0, [id('languages')]: 'ar' });
    expect(notImportant.signals.some((s) => s.factor === 'language')).toBe(false);
    expect(notImportant.neutral).toContain(id('languageImportance'));
  });
});

describe('evaluation — only positive evidence counts', () => {
  const needs = (extra: Answers) => ({ ...CORE, ...extra });

  it('an official language you speak is a good fit', () => {
    const answers = needs({ [id('languageImportance')]: 100, [id('languages')]: 'ar' });
    expect(factor('eg', answers, 'language')).toMatchObject({ outcome: 'positive', fit: 100, countryValue: 'ar' });
    expect(factor('austria', needs({ [id('languageImportance')]: 60, [id('languages')]: 'de' }), 'language')?.outcome).toBe('positive');
    expect(factor('switzerland', needs({ [id('languageImportance')]: 60, [id('languages')]: 'de' }), 'language')?.outcome).toBe('positive');
  });

  it('no official match is NOT counted — never a mismatch, never a lower score', () => {
    const answers = needs({ [id('languageImportance')]: 100, [id('languages')]: 'ar,en' });
    const result = factor('japan', answers, 'language')!;
    expect(result).toMatchObject({ outcome: 'unavailable', reason: 'noEvidence', fit: null });
    expect(matchFor('japan', answers).score).toBe(matchFor('japan', CORE).score);
    expect(matchFor('japan', answers).coverage).toBeLessThan(matchFor('japan', CORE).coverage);
    expect(factorDetail(result, 'en')).toMatch(/does not mean communication is hard/);
    expect(factorDetail(result, 'ar')).toMatch(/لا يعني ذلك صعوبة التواصل/);
  });

  it('mapped mosques: many (or dense) is a good fit, some is partial, too few is not counted', () => {
    const answers = needs({ [id('islamicPractice')]: 100 });
    expect(factor('ksa', answers, 'islamicPractice')).toMatchObject({ outcome: 'positive', fit: 100, countryValue: 5000 });
    expect(factor('uk', answers, 'islamicPractice')).toMatchObject({ outcome: 'positive', fit: 100 });
    expect(factor('japan', answers, 'islamicPractice')).toMatchObject({ outcome: 'partial', fit: 60, countryValue: 60 });
    // 76 mosques in about 700 km² is many for the size; 124 across Australia is not.
    expect(factor('singapore', answers, 'islamicPractice')).toMatchObject({ outcome: 'positive', fit: 100, countryValue: 76 });
    expect(factor('australia', answers, 'islamicPractice')).toMatchObject({ outcome: 'partial', fit: 60, countryValue: 124 });
    expect(factor('mc', answers, 'islamicPractice')).toMatchObject({ outcome: 'unavailable', reason: 'noEvidence', countryValue: 0 });
    expect(factor('france', answers, 'islamicPractice')).toMatchObject({ outcome: 'unavailable', reason: 'noData' });
    // Not in the snapshot at all.
    expect(factor('usa', answers, 'islamicPractice')).toMatchObject({ outcome: 'unavailable', reason: 'noData' });
  });

  it('halal is judged on its own evidence, with one level: enough tags is a match, fewer is not counted', () => {
    const answers = needs({ [id('halalFood')]: 100 });
    expect(factor('ksa', answers, 'halalFood')).toMatchObject({ outcome: 'unavailable', reason: 'noEvidence' });
    expect(matchFor('ksa', answers).score).toBe(matchFor('ksa', CORE).score);
    expect(factor('uk', answers, 'halalFood')).toMatchObject({ outcome: 'positive', fit: 100 });
    expect(factor('malaysia', answers, 'halalFood')?.outcome).toBe('positive');
    // No partial level: 97 tags in Egypt and 800 in the UK are both a match,
    // so a tagging habit never ranks one country as "less halal" than another.
    expect(factor('eg', answers, 'halalFood')).toMatchObject({ outcome: 'positive', fit: 100 });
    expect(factor('japan', answers, 'halalFood')).toMatchObject({ outcome: 'positive', fit: 100 });
    expect(factor('om', answers, 'halalFood')).toMatchObject({ outcome: 'unavailable', reason: 'noEvidence' });
    for (const dest of WORLD_CATALOG) expect(computePersonalMatch(dest, normalizePreferences('tourism', answers)).factors.find((f) => f.factor === 'halalFood')?.outcome).not.toBe('partial');
    // Independent questions: halal evidence says nothing about mosques and vice versa.
    const both = needs({ [id('islamicPractice')]: 100, [id('halalFood')]: 100 });
    expect(factor('ksa', both, 'islamicPractice')?.outcome).toBe('positive');
    expect(factor('ksa', both, 'halalFood')?.outcome).toBe('unavailable');
  });

  it('a travel need is never "negative" and an unavailable one never moves the score, for any country', () => {
    const answers = needs({
      [id('languageImportance')]: 100,
      [id('languages')]: 'en,fr',
      [id('islamicPractice')]: 100,
      [id('halalFood')]: 60,
    });
    const prefs = normalizePreferences('tourism', answers);
    const corePrefs = normalizePreferences('tourism', CORE);
    for (const dest of WORLD_CATALOG) {
      const match = computePersonalMatch(dest, prefs);
      const travel = match.factors.filter((f) => ['language', 'islamicPractice', 'halalFood'].includes(f.factor));
      expect(travel).toHaveLength(3);
      for (const item of travel) expect(item.outcome, `${dest.id} ${item.factor}`).not.toBe('negative');
      if (travel.every((item) => item.outcome === 'unavailable')) {
        expect(match.score, dest.id).toBe(computePersonalMatch(dest, corePrefs).score);
      }
      expect(match.methodologyVersion).toBe('personal-match-1.1');
    }
  });

  it('explains the evidence plainly, with its source and without religion statistics', () => {
    const answers = needs({ [id('islamicPractice')]: 100, [id('halalFood')]: 100 });
    const match = matchFor('japan', answers);
    const lines = match.factors.map((f) => factorDetail(f, 'en')).join(' ');
    expect(lines).toMatch(/60 mosques and Muslim prayer places mapped on OpenStreetMap — a limited number/);
    expect(lines).toMatch(/40 places tagged as serving halal food on OpenStreetMap(?! —)/);
    const all = [
      ...['ar', 'en'].flatMap((lang) => WORLD_CATALOG.slice(0, 40).flatMap((dest) => matchFor(dest.id, answers).factors.map((f) => factorDetail(f, lang as 'ar' | 'en')))),
      personalSummary(match, normalizePreferences('tourism', answers), byId('japan'), 'ar'),
    ].join(' ');
    expect(all).not.toMatch(/population|السكان|state religion|دين الدولة|religious country|%/i);
  });
});

describe('profile schema v2', () => {
  const v1 = {
    schemaVersion: 1,
    purpose: 'tourism',
    answers: CORE,
    path: Object.keys(CORE),
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  };

  it('migrates a v1.0 profile with every answer kept and the new questions unanswered', () => {
    const migrated = parseStoredProfile(JSON.stringify(v1))!;
    expect(PROFILE_SCHEMA_VERSION).toBe(2);
    expect(migrated).toEqual({ ...v1, schemaVersion: 2 });
    expect(Object.keys(migrated.answers).some(isTravelNeedQuestionId)).toBe(false);
    expect(PERSONAL_MATCH_METHODOLOGY_VERSION).toBe('personal-match-1.1');
  });

  it('keeps only valid travel-need answers', () => {
    expect(sanitizeAnswers('tourism', {
      [id('languageImportance')]: 100,
      [id('languages')]: 'ar,en',
      [id('islamicPractice')]: 50,
      [id('halalFood')]: '100',
    })).toEqual({ [id('languageImportance')]: 100, [id('languages')]: 'ar,en' });
    for (const bad of ['en,ar', 'ar,ar', 'ar,xx', '', 'ar,', 7, ['ar']]) {
      expect(sanitizeAnswers('tourism', { [id('languageImportance')]: 100, [id('languages')]: bad }), String(bad)).toEqual({ [id('languageImportance')]: 100 });
    }
    // The language list without "communication matters" is dropped.
    expect(sanitizeAnswers('tourism', { [id('languageImportance')]: 0, [id('languages')]: 'ar' })).toEqual({ [id('languageImportance')]: 0 });
    expect(sanitizeAnswers('tourism', { [id('languages')]: 'ar' })).toEqual({});
    // Another purpose's travel needs are not this profile's.
    expect(sanitizeAnswers('tourism', { [travelNeedQuestionId('work', 'halalFood')]: 100 })).toEqual({});
  });

  it('language answers have one canonical form', () => {
    expect(languageAnswer(['en', 'ar', 'en', 'xx'])).toBe('ar,en');
    expect(parseLanguageAnswer('ar,en')).toEqual(['ar', 'en']);
    expect(parseLanguageAnswer('ar,xx')).toBeNull();
  });
});

describe('privacy — local only', () => {
  it('the share text carries only the destination and the score', () => {
    const answers = { ...CORE, [id('languageImportance')]: 100, [id('languages')]: 'ar', [id('islamicPractice')]: 100, [id('halalFood')]: 100 };
    const match = matchFor('japan', answers);
    for (const lang of ['ar', 'en'] as const) {
      const payload = destinationSharePayload(byId('japan'), lang, match.score);
      expect(`${payload.text} ${payload.url}`).not.toMatch(/halal|حلال|mosque|مسجد|شعائر|islam|arabic|العربية|language|لغة/i);
    }
  });

  it('the admin catalog (and so the Worker) knows no travel-need question', () => {
    const catalog = fs.readFileSync(path.join(__dirname, '../../../worker/src/generated/adminCatalog.json'), 'utf8');
    expect(catalog).not.toMatch(/languageImportance|-languages"|islamicPractice|halalFood/);
  });
});
