// React Context + useReducer for application/quiz state, per the approved
// architecture. Also ports setLang()'s document-level side effects
// (documentElement.lang/dir; the title is per page since v1.1, see
// seo/useDocumentMeta.ts) — everything else setLang()
// used to do (updating specific DOM nodes by id) is now just React
// re-rendering from context, so it doesn't need to be replicated here.
import { useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { appReducer, initialAppState } from './reducer';
import { I18N } from '../data/i18n';
import { AppStateContext } from './context';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  useEffect(() => {
    const dict = I18N[state.lang];
    document.documentElement.lang = dict.htmlLang;
    document.documentElement.dir = dict.dir;
  }, [state.lang]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
