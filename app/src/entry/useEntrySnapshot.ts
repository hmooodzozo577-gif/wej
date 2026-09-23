import { useEffect, useState } from 'react';
import type { EntrySnapshot } from './entryInfo';
import { loadEntrySnapshot } from './snapshotLoader';

export type EntrySnapshotState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; snapshot: EntrySnapshot }
  | { status: 'error' };

/** The snapshot, loaded only while `enabled` (a passport is chosen). */
export function useEntrySnapshot(enabled: boolean): EntrySnapshotState {
  const [loaded, setLoaded] = useState<EntrySnapshotState>({ status: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadEntrySnapshot().then((snapshot) => {
      if (!cancelled) setLoaded(snapshot ? { status: 'ready', snapshot } : { status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? loaded : { status: 'idle' };
}
