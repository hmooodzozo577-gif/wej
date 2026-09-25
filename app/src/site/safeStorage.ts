// v1.1 (audit D5) — localStorage access that can never throw. Storage can be
// missing, blocked (Safari "Block All Cookies", some private modes: even
// reading throws SecurityError) or full (QuotaExceededError). New v1.1
// features read and write through here; the pre-v1.1 callers keep their own
// guards and are not churned.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The raw string, or null when absent or unreadable. */
export function readItem(key: string, storage: StorageLike | null = browserStorage()): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** True when the value was stored. */
export function writeItem(key: string, value: string, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
