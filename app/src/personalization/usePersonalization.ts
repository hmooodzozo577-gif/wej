import { useContext } from 'react';
import { PersonalizationContext, type PersonalizationContextValue } from './context';

const INERT: PersonalizationContextValue = {
  profile: null,
  preferences: null,
  persisted: false,
  saveFromQuiz: () => {},
  reset: () => {},
};

/** Personalization for the current browser. Outside a provider (isolated
 *  component tests) it behaves exactly like a first visit: no profile. */
export function usePersonalization(): PersonalizationContextValue {
  return useContext(PersonalizationContext) ?? INERT;
}
