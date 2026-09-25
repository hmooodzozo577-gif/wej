import { describe, expect, it } from 'vitest';
import { snapshotDataChanged } from './snapshotChanged.mjs';

const base = { snapshotUpdatedAt: '2026-09-09T19:43:19.394Z', entries: [{ countryCode: 'AD', value: 1 }] };

describe('snapshotDataChanged', () => {
  it('ignores a new run stamp when the data is identical', () => {
    const next = { ...base, snapshotUpdatedAt: '2026-09-25T22:56:59.502Z' };
    expect(snapshotDataChanged(JSON.stringify(base), JSON.stringify(next))).toBe(false);
  });

  it('reports a real data change', () => {
    const next = { ...base, entries: [{ countryCode: 'AD', value: 2 }] };
    expect(snapshotDataChanged(JSON.stringify(base), JSON.stringify(next))).toBe(true);
  });

  it('treats a missing or unreadable committed snapshot as changed', () => {
    expect(snapshotDataChanged(null, JSON.stringify(base))).toBe(true);
    expect(snapshotDataChanged('{not json', JSON.stringify(base))).toBe(true);
  });
});
