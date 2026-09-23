// Phase 18.5 — holds the browser-local personalization profile for the app.
// Hydrates once from localStorage (validated, migrated, never throwing) and
// writes back on every change. Nothing here touches theme, language or any
// other stored site preference.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';
import { PersonalizationContext } from './context';
import { createProfile } from './profile';
import { normalizePreferences } from './signals';
import { browserStorage, clearProfile, loadProfile, saveProfile, type StorageLike } from './storage';
import type { PersonalizationProfile } from './types';

export function PersonalizationProvider({
  children,
  storage = browserStorage(),
}: {
  children: ReactNode;
  /** Injectable for tests; defaults to this browser's localStorage. */
  storage?: StorageLike | null;
}) {
  const [profile, setProfile] = useState<PersonalizationProfile | null>(() => loadProfile(storage));
  const [persisted, setPersisted] = useState(() => !!storage);

  const saveFromQuiz = useCallback((purpose: PurposeId, answers: Answers, path: string[]) => {
    setProfile((previous) => {
      const next = createProfile(purpose, answers, path, new Date(), previous);
      if (next) setPersisted(saveProfile(next, storage));
      return next ?? previous;
    });
  }, [storage]);

  const reset = useCallback(() => {
    clearProfile(storage);
    setProfile(null);
  }, [storage]);

  const preferences = useMemo(() => (profile ? normalizePreferences(profile.purpose, profile.answers) : null), [profile]);
  const value = useMemo(() => ({ profile, preferences, persisted, saveFromQuiz, reset }), [profile, preferences, persisted, saveFromQuiz, reset]);
  return <PersonalizationContext.Provider value={value}>{children}</PersonalizationContext.Provider>;
}
