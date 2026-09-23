import { createContext } from 'react';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';
import type { NormalizedPreferences, PersonalizationProfile } from './types';

export interface PersonalizationContextValue {
  /** The saved profile for this browser, or null. */
  profile: PersonalizationProfile | null;
  /** Signals derived from the profile (memoized), or null. */
  preferences: NormalizedPreferences | null;
  /** False when this browser refuses local storage: personalization still
   *  works for the current visit but will not be remembered. */
  persisted: boolean;
  /** Called when a questionnaire completes. */
  saveFromQuiz: (purpose: PurposeId, answers: Answers, path: string[]) => void;
  /** Removes the profile — and only the profile — from this browser. */
  reset: () => void;
}

export const PersonalizationContext = createContext<PersonalizationContextValue | null>(null);
