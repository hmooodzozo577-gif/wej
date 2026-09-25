// v1.1 — Favorites: destinations a traveller keeps, on this device only.
//
// No account, no backend, no Worker call. The stored value holds nothing
// but canonical destination ids — never a country object, a passport, a
// location or any personalization answer:
//
//   localStorage["wejhaty.favorites.v1"] = {"version":1,"ids":["japan","af"]}
//
// Reading is defensive: bad JSON, an unknown version, duplicates, ids that
// are not (or are no longer) in the effective catalog — Israel included —
// all resolve to a clean list instead of an error.
import { WORLD_CATALOG } from '../data/worldCatalog';

export const FAVORITES_STORAGE_KEY = 'wejhaty.favorites.v1';
export const FAVORITES_VERSION = 1;

const CATALOG_IDS = new Set(WORLD_CATALOG.map((entry) => entry.id));

export interface StoredFavorites {
  version: typeof FAVORITES_VERSION;
  ids: string[];
}

/** Keeps only canonical catalog ids, once each, in their first order. */
export function cleanFavoriteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && CATALOG_IDS.has(id) && !seen.has(id)) seen.add(id);
  }
  return [...seen];
}

export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return [];
    const record = value as Partial<StoredFavorites>;
    // Only version 1 exists. A future or unknown version is not guessed at.
    if (record.version !== FAVORITES_VERSION) return [];
    return cleanFavoriteIds(record.ids);
  } catch {
    return [];
  }
}

export function serializeFavorites(ids: string[]): string {
  const stored: StoredFavorites = { version: FAVORITES_VERSION, ids: cleanFavoriteIds(ids) };
  return JSON.stringify(stored);
}
