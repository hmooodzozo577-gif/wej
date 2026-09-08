import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { AppAction, AppState } from './types';

export interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);
