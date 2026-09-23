import { describe, expect, it } from 'vitest';
import {
  PROFILE_MIGRATIONS,
  createProfile,
  migrateProfileData,
  parseStoredProfile,
  sanitizeAnswers,
  validateProfile,
} from './profile';
import { PERSONALIZATION_STORAGE_KEY, clearProfile, loadProfile, saveProfile, type StorageLike } from './storage';
import { PROFILE_SCHEMA_VERSION } from './types';

const NOW = new Date('2026-09-23T10:00:00.000Z');
const ANSWERS = { 'tourism-climate': 'cold', 'tourism-cost': 1, 'tourism-coastal': 100 };
const PATH = ['tourism-climate', 'tourism-cost', 'tourism-coastal'];

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('personalization profile', () => {
  it('creates a versioned profile holding only the quiz answers, path and timestamps', () => {
    const profile = createProfile('tourism', ANSWERS, PATH, NOW)!;
    expect(profile).toEqual({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      purpose: 'tourism',
      answers: ANSWERS,
      path: PATH,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(Object.keys(profile).sort()).toEqual(['answers', 'createdAt', 'path', 'purpose', 'schemaVersion', 'updatedAt']);
  });

  it('keeps createdAt when the same trip is edited, and starts fresh for a new purpose', () => {
    const first = createProfile('tourism', ANSWERS, PATH, NOW)!;
    const later = new Date('2026-10-01T00:00:00.000Z');
    const edited = createProfile('tourism', { ...ANSWERS, 'tourism-cost': 2 }, PATH, later, first)!;
    expect(edited.createdAt).toBe(first.createdAt);
    expect(edited.updatedAt).toBe(later.toISOString());
    const newTrip = createProfile('work', { 'work-climate': 'temperate' }, ['work-climate'], later, first)!;
    expect(newTrip.createdAt).toBe(later.toISOString());
  });

  it('drops answers that are not real options of real questions for the purpose', () => {
    expect(sanitizeAnswers('tourism', {
      'tourism-climate': 'cold',
      'tourism-cost': 99,
      'work-income': 50,
      'tourism-safety': '75',
      'tourism-landBorder': 1,
      __proto__: 1,
    })).toEqual({ 'tourism-climate': 'cold', 'tourism-landBorder': 1 });
  });

  it('rejects malformed, empty or wrong-purpose records instead of trusting them', () => {
    const good = createProfile('tourism', ANSWERS, PATH, NOW)!;
    expect(validateProfile(good)).toEqual(good);
    expect(validateProfile(null)).toBeNull();
    expect(validateProfile([])).toBeNull();
    expect(validateProfile({ ...good, purpose: 'space' })).toBeNull();
    expect(validateProfile({ ...good, createdAt: 'yesterday' })).toBeNull();
    expect(validateProfile({ ...good, answers: { nope: 1 } })).toBeNull();
    expect(validateProfile({ ...good, schemaVersion: 2 })).toBeNull();
  });

  it('never throws on corrupt stored text', () => {
    for (const raw of [null, '', '{', 'null', '42', '"text"', '[]', '{"schemaVersion":"1"}', 'x'.repeat(30_000)]) {
      expect(parseStoredProfile(raw)).toBeNull();
    }
  });

  it('refuses a profile written by a newer release rather than guessing at its format', () => {
    const good = createProfile('tourism', ANSWERS, PATH, NOW)!;
    expect(parseStoredProfile(JSON.stringify({ ...good, schemaVersion: PROFILE_SCHEMA_VERSION + 1 }))).toBeNull();
  });

  describe('migration pipeline', () => {
    it('has no registered steps while v1 is the only schema', () => {
      expect(Object.keys(PROFILE_MIGRATIONS)).toEqual([]);
    });

    it('upgrades an old record through each registered step, deterministically', () => {
      const migrations = {
        0: (data: Record<string, unknown>) => ({ ...data, schemaVersion: 1, answers: data.prefs, prefs: undefined }),
      };
      const old = { schemaVersion: 0, purpose: 'tourism', prefs: ANSWERS, path: PATH, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
      const once = migrateProfileData(old, migrations, 1);
      const twice = migrateProfileData(old, migrations, 1);
      expect(once).toEqual(twice);
      expect(validateProfile(once)?.answers).toEqual(ANSWERS);
    });

    it('fails closed on a gap, a bad step, or a non-integer version', () => {
      expect(migrateProfileData({ schemaVersion: 0 }, {}, 1)).toBeNull();
      expect(migrateProfileData({ schemaVersion: 0 }, { 0: (d) => ({ ...d, schemaVersion: 5 }) }, 1)).toBeNull();
      expect(migrateProfileData({ schemaVersion: 1.5 }, {}, 2)).toBeNull();
      expect(migrateProfileData({}, {}, 1)).toBeNull();
    });
  });
});

describe('personalization storage', () => {
  it('saves, reloads and clears under one versioned key', () => {
    const storage = memoryStorage({ 'wejhaty.theme': 'dark', wejhatyLang: 'en' });
    const profile = createProfile('tourism', ANSWERS, PATH, NOW)!;
    expect(saveProfile(profile, storage)).toBe(true);
    expect(PERSONALIZATION_STORAGE_KEY).toBe('wejhaty.personalization.v1');
    expect(loadProfile(storage)).toEqual(profile);
    expect(clearProfile(storage)).toBe(true);
    expect(loadProfile(storage)).toBeNull();
    // Reset touches nothing else on the site.
    expect(storage.data).toEqual({ 'wejhaty.theme': 'dark', wejhatyLang: 'en' });
  });

  it('returns no profile for corrupt stored data', () => {
    expect(loadProfile(memoryStorage({ [PERSONALIZATION_STORAGE_KEY]: '{not json' }))).toBeNull();
  });

  it('survives storage that is missing or throws on every call', () => {
    const profile = createProfile('tourism', ANSWERS, PATH, NOW)!;
    expect(loadProfile(null)).toBeNull();
    expect(saveProfile(profile, null)).toBe(false);
    expect(loadProfile(throwingStorage)).toBeNull();
    expect(saveProfile(profile, throwingStorage)).toBe(false);
    expect(clearProfile(throwingStorage)).toBe(false);
  });

  it('stores no coordinates, passport or identity fields', () => {
    const storage = memoryStorage();
    saveProfile(createProfile('tourism', ANSWERS, PATH, NOW)!, storage);
    const raw = storage.data[PERSONALIZATION_STORAGE_KEY]!;
    expect(raw).not.toMatch(/lat|lng|coords|passport|email|name/i);
  });
});
