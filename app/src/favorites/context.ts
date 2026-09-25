import { createContext, useContext } from 'react';

export interface FavoritesValue {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  /** False when the last change could not be saved on this device. */
  persisted: boolean;
}

export const FavoritesContext = createContext<FavoritesValue | null>(null);

export function useFavorites(): FavoritesValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return value;
}

/** For controls that may render outside the provider (isolated component
 *  tests): they render nothing instead of failing. The app always has one. */
export function useOptionalFavorites(): FavoritesValue | null {
  return useContext(FavoritesContext);
}
