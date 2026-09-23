// Loads the bundled entry-requirements snapshot on demand. It is a separate
// chunk (dynamic import), so the ~tens of KB of official-source tables are
// only downloaded once a traveller has chosen a passport — every other
// visitor never pays for them.
import { parseEntrySnapshot, type EntrySnapshot } from './entryInfo';

/** A stalled chunk request must not leave the section spinning forever. */
export const SNAPSHOT_LOAD_TIMEOUT_MS = 15_000;

let pending: Promise<EntrySnapshot | null> | null = null;

export function loadEntrySnapshot(): Promise<EntrySnapshot | null> {
  if (!pending) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SNAPSHOT_LOAD_TIMEOUT_MS);
    });
    const load = import('../data/generated/entryRequirements.json')
      .then((module) => parseEntrySnapshot(module.default))
      .catch(() => null);
    pending = Promise.race([load, timeout]).then((snapshot) => {
      clearTimeout(timer);
      // A failure is not cached: the next mount tries again.
      if (!snapshot) pending = null;
      return snapshot;
    });
  }
  return pending;
}
