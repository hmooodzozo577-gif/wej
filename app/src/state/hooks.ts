// Split from AppStateContext.tsx so that file exports only the Provider
// component (keeps React Fast Refresh happy — a lint-only concern, no
// behavior change).
import { useContext } from 'react';
import { AppStateContext } from './context';
import { I18N } from '../data/i18n';

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within an AppStateProvider');
  return ctx;
}

/** Convenience: the active I18nDict for the current language, plus the language itself. */
export function useI18n() {
  const { state } = useAppState();
  return { lang: state.lang, t: I18N[state.lang] };
}
