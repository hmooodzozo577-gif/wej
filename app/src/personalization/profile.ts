// Phase 18.1 — the versioned personalization profile: creation, strict
// validation of anything read back from storage, and an explicit migration
// pipeline. Pure functions only; storage.ts owns the browser I/O.
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import type { PurposeId, Question } from '../data/types';
import type { Answers } from '../engine/types';
import { PROFILE_SCHEMA_VERSION, type PersonalizationProfile } from './types';

const PURPOSE_IDS = Object.keys(QUESTION_BANKS) as PurposeId[];

/** One step upgrades a stored record from version N (the key) to N + 1.
 *  v1 is the first schema, so the registry is empty today; the runner is
 *  still exercised by tests so the first real migration drops into a
 *  pipeline that is already proven. A step must be deterministic and must
 *  set `schemaVersion` to N + 1. */
export type ProfileMigration = (data: Record<string, unknown>) => Record<string, unknown>;
export const PROFILE_MIGRATIONS: Readonly<Record<number, ProfileMigration>> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPurpose(value: unknown): value is PurposeId {
  return typeof value === 'string' && (PURPOSE_IDS as string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

/** Every question a profile for this purpose may hold an answer to: the
 *  purpose's bank plus its optional land-border question. */
function questionsFor(purpose: PurposeId): Map<string, Question | 'landBorder'> {
  const map = new Map<string, Question | 'landBorder'>(QUESTION_BANKS[purpose].map((question) => [question.id, question]));
  map.set(landBorderQuestionId(purpose), 'landBorder');
  return map;
}

function isValidAnswer(question: Question | 'landBorder', value: unknown): value is string | number {
  if (question === 'landBorder') return value === 0 || value === 1;
  return question.options.some((option) => option.value === value);
}

/** Keeps only answers that are real options of real questions for this
 *  purpose. Anything else — a renamed question, a removed option, a
 *  tampered value — is dropped rather than trusted. */
export function sanitizeAnswers(purpose: PurposeId, answers: unknown): Answers {
  if (!isRecord(answers)) return {};
  const questions = questionsFor(purpose);
  const clean: Answers = {};
  for (const [id, value] of Object.entries(answers)) {
    const question = questions.get(id);
    if (question && isValidAnswer(question, value)) clean[id] = value;
  }
  return clean;
}

export function sanitizePath(purpose: PurposeId, path: unknown): string[] {
  if (!Array.isArray(path)) return [];
  const questions = questionsFor(purpose);
  const seen = new Set<string>();
  return path.filter((id): id is string => {
    if (typeof id !== 'string' || !questions.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Runs the registered migrations up to the current schema. Returns null
 *  for anything it cannot upgrade honestly: a missing or non-integer
 *  version, a version newer than this build understands (never guess at a
 *  future format), or a gap in the registry. */
export function migrateProfileData(
  data: Record<string, unknown>,
  migrations: Readonly<Record<number, ProfileMigration>> = PROFILE_MIGRATIONS,
  target: number = PROFILE_SCHEMA_VERSION,
): Record<string, unknown> | null {
  let version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
  if (version > target) return null;
  let current = data;
  while (version < target) {
    const step: ProfileMigration | undefined = migrations[version];
    if (!step) return null;
    current = step({ ...current });
    version += 1;
    if (current.schemaVersion !== version) return null;
  }
  return current;
}

/** Validates an already-migrated record and returns a clean profile, or
 *  null. A profile with no usable answer left is treated as no profile. */
export function validateProfile(data: unknown): PersonalizationProfile | null {
  if (!isRecord(data)) return null;
  if (data.schemaVersion !== PROFILE_SCHEMA_VERSION) return null;
  if (!isPurpose(data.purpose)) return null;
  if (!isIsoDate(data.createdAt) || !isIsoDate(data.updatedAt)) return null;
  const answers = sanitizeAnswers(data.purpose, data.answers);
  if (!Object.keys(answers).length) return null;
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    purpose: data.purpose,
    answers,
    path: sanitizePath(data.purpose, data.path),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** Parses the raw stored string. Never throws. */
export function parseStoredProfile(raw: string | null | undefined): PersonalizationProfile | null {
  if (!raw || raw.length > 20_000) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const migrated = migrateProfileData(data);
  return migrated ? validateProfile(migrated) : null;
}

/** Builds the profile saved when a questionnaire completes. Editing the
 *  same trip (same purpose) keeps its creation time; a different purpose is
 *  a new trip and starts a new profile. */
export function createProfile(
  purpose: PurposeId,
  answers: Answers,
  path: string[],
  now: Date = new Date(),
  previous: PersonalizationProfile | null = null,
): PersonalizationProfile | null {
  const stamp = now.toISOString();
  return validateProfile({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    purpose,
    answers,
    path,
    createdAt: previous && previous.purpose === purpose ? previous.createdAt : stamp,
    updatedAt: stamp,
  });
}
