// Acceptance fix — see exploreCatalog.test.ts and this hook's own header
// comment for the production bug this closes (Nearest-to-me excluding the
// wrong country, or none at all, because of the old nearest-centroid
// resolver). This file tests the hook's own contract in isolation: it must
// never report a code before resolution for the CURRENT coordinates has
// actually completed.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResolvedCountryCode } from './useResolvedCountryCode';
import * as geo from '../data/geo';

const DAMMAM = { lat: 26.4207, lng: 50.0888 };
const RIYADH = { lat: 24.7136, lng: 46.6753 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResolvedCountryCode', () => {
  it('returns undefined with no coordinates, and never calls the resolver', () => {
    const spy = vi.spyOn(geo, 'resolveCurrentCountry');
    const { result } = renderHook(() => useResolvedCountryCode(null));
    expect(result.current).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns undefined while resolution is still in flight, then the resolved code', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof geo.resolveCurrentCountry>>) => void;
    vi.spyOn(geo, 'resolveCurrentCountry').mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useResolvedCountryCode(DAMMAM));
    expect(result.current).toBeUndefined();

    await act(async () => {
      resolve({ result: { entry: { countryCode: 'SA' } } as never, method: 'boundary' });
    });

    await waitFor(() => expect(result.current).toBe('SA'));
  });

  it('never reports a stale code from a previous coordinate while the new one is still resolving', async () => {
    const deferred: { resolve: (v: Awaited<ReturnType<typeof geo.resolveCurrentCountry>>) => void }[] = [];
    vi.spyOn(geo, 'resolveCurrentCountry').mockImplementation(
      () => new Promise((resolve) => deferred.push({ resolve })),
    );

    const { result, rerender } = renderHook(({ coords }) => useResolvedCountryCode(coords), {
      initialProps: { coords: DAMMAM as typeof DAMMAM | typeof RIYADH },
    });
    await act(async () => {
      deferred[0]!.resolve({ result: { entry: { countryCode: 'SA' } } as never, method: 'boundary' });
    });
    await waitFor(() => expect(result.current).toBe('SA'));

    // Coordinates change before the new resolution completes — the OLD
    // resolved code must not leak through as if it were still current.
    rerender({ coords: RIYADH });
    expect(result.current).toBeUndefined();

    await act(async () => {
      deferred[1]!.resolve({ result: { entry: { countryCode: 'SA' } } as never, method: 'boundary' });
    });
    await waitFor(() => expect(result.current).toBe('SA'));
  });

  it('resolves to undefined (not a guess) when the resolver itself cannot resolve anything', async () => {
    vi.spyOn(geo, 'resolveCurrentCountry').mockResolvedValue(undefined);
    const { result } = renderHook(() => useResolvedCountryCode(DAMMAM));
    await waitFor(() => expect(geo.resolveCurrentCountry).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it('going back to no coordinates returns undefined immediately', async () => {
    vi.spyOn(geo, 'resolveCurrentCountry').mockResolvedValue({ result: { entry: { countryCode: 'SA' } } as never, method: 'boundary' });
    const { result, rerender } = renderHook(({ coords }) => useResolvedCountryCode(coords), {
      initialProps: { coords: DAMMAM as typeof DAMMAM | null },
    });
    await waitFor(() => expect(result.current).toBe('SA'));
    rerender({ coords: null });
    expect(result.current).toBeUndefined();
  });
});
