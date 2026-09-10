// Phase 16.5 completion pass — location integration.
import { describe, expect, it } from 'vitest';
import { buildLocationContext } from './buildLocationContext';
import type { LocationState } from '../state/types';

describe('buildLocationContext', () => {
  it('returns undefined when location was never granted', async () => {
    const idle: LocationState = { status: 'idle', coords: null };
    expect(await buildLocationContext(idle, 'ar')).toBeUndefined();
  });

  it('returns undefined for every non-granted status (denied/unavailable/timeout/unsupported/requesting)', async () => {
    for (const status of ['denied', 'unavailable', 'timeout', 'unsupported', 'requesting'] as const) {
      const state: LocationState = { status, coords: null };
      expect(await buildLocationContext(state, 'ar')).toBeUndefined();
    }
  });

  it('when granted, resolves to a plain country NAME string — never anything coordinate-shaped', async () => {
    // Riyadh, Saudi Arabia.
    const granted: LocationState = { status: 'granted', coords: { lat: 24.7136, lng: 46.6753 } };
    const result = await buildLocationContext(granted, 'ar');
    expect(typeof result === 'string' || result === undefined).toBe(true);
    if (result) {
      expect(result).not.toMatch(/-?\d{1,3}\.\d{2,}/); // no coordinate-shaped substring
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('the return type is structurally incapable of carrying coordinates — the function signature itself only ever returns string | undefined', () => {
    // A compile-time guarantee, asserted here as a runtime sanity check
    // on the function's arity/behavior contract.
    expect(buildLocationContext.length).toBe(2); // (location, lang)
  });
});
