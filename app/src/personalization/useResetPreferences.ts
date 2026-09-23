// Phase 18 — one reset for every surface that offers it (Results, Explore):
// removes only the saved profile and the questionnaire state derived from
// it, and drops a Personal Match sort so Explore returns to its general
// default. Theme, language, location and other filters are untouched.
import { useCallback } from 'react';
import { useAppState } from '../state/hooks';
import { PERSONAL_SORTS } from '../state/types';
import { usePersonalization } from './usePersonalization';

export function useResetPreferences(): () => void {
  const { state, dispatch } = useAppState();
  const { reset } = usePersonalization();
  const personalSortActive = PERSONAL_SORTS.includes(state.explore.sort);
  return useCallback(() => {
    reset();
    dispatch({ type: 'RESTART_ALL' });
    if (personalSortActive) dispatch({ type: 'RESET_EXPLORE_SORT' });
  }, [reset, dispatch, personalSortActive]);
}
