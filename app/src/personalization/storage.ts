// Phase 18.1 — browser-local persistence for the personalization profile.
//
// Anonymous and local-first: the profile lives in this browser's
// localStorage only. No account, no server copy, no sync — a different
// device, browser, private window or cleared site data starts without one.
// Every access is guarded: storage can be missing, blocked, full, or throw
// on access (some private modes), and none of that may break the site.
import { parseStoredProfile } from './profile';
import type { PersonalizationProfile } from './types';

/** Versioned key. A future breaking format keeps this key and migrates
 *  (profile.ts); the suffix only changes if the key itself must be retired. */
export const PERSONALIZATION_STORAGE_KEY = 'wejhaty.personalization.v1';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadProfile(storage: StorageLike | null = browserStorage()): PersonalizationProfile | null {
  if (!storage) return null;
  try {
    return parseStoredProfile(storage.getItem(PERSONALIZATION_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Returns false when the profile could not be written; the in-memory
 *  profile still works for the current visit. */
export function saveProfile(profile: PersonalizationProfile, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Removes ONLY the personalization profile — never theme, language or any
 *  other site preference. */
export function clearProfile(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(PERSONALIZATION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
