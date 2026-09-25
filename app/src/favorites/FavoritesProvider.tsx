// v1.1 — Favorites state for the whole app. Hydrates once from storage,
// writes every change back, and follows changes made in another tab. When
// storage is unavailable the list still works for this page and simply is
// not remembered (`persisted` reports that).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { browserStorage, readItem, writeItem, type StorageLike } from '../site/safeStorage';
import { FAVORITES_STORAGE_KEY, cleanFavoriteIds, parseFavorites, serializeFavorites } from './store';

import { FavoritesContext, type FavoritesValue } from './context';

export function FavoritesProvider({ children, storage }: { children: ReactNode; storage?: StorageLike | null }) {
  const store = storage === undefined ? browserStorage() : storage;
  const [ids, setIds] = useState<string[]>(() => parseFavorites(readItem(FAVORITES_STORAGE_KEY, store)));
  const [persisted, setPersisted] = useState(true);

  const commit = useCallback((next: string[]) => {
    const clean = cleanFavoriteIds(next);
    setIds(clean);
    setPersisted(writeItem(FAVORITES_STORAGE_KEY, serializeFavorites(clean), store));
  }, [store]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_STORAGE_KEY) setIds(parseFavorites(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<FavoritesValue>(() => ({
    ids,
    has: (id) => ids.includes(id),
    toggle: (id) => commit(ids.includes(id) ? ids.filter((saved) => saved !== id) : [...ids, id]),
    remove: (id) => commit(ids.filter((saved) => saved !== id)),
    persisted,
  }), [commit, ids, persisted]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
