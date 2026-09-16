// Root-cause regression coverage for the Contact/Suggestion "cannot be
// pressed or completed" bug: `useTurnstile` used to wait forever for a
// `load` event that a blocked/failed script never fires, leaving every
// caller's submit button disabled with no explanation and no way out.
// These tests exercise the shared hook directly, reproducing that failure
// mode (a script `error`, and a silent hang past the timeout) and proving
// it now surfaces as `failed` — with `retry()` offering a real way out —
// rather than an unexplained permanent block. `blocking` staying true the
// whole time confirms the fix never waives the challenge itself: a
// Turnstile failure must still block submission, or refusing to load the
// script would be a trivial way to bypass anti-abuse protection.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fresh module instance per test, WITHOUT vi.resetModules(): that clears
// the whole registry, including React itself, so a hook from the
// freshly-reimported turnstile.ts would run against a different React
// copy than the one @testing-library/react's `renderHook` uses — real
// symptom observed while writing this: effects silently not taking
// effect. A cache-busting query param instead gives turnstile.ts alone a
// new module record (so its module-scope `TURNSTILE_SITE_KEY` constant
// re-reads the freshly stubbed env), while React resolves to the same
// shared instance every time.
let importCounter = 0;
async function importFresh(siteKey: string | undefined) {
  if (siteKey === undefined) vi.unstubAllEnvs();
  else vi.stubEnv('VITE_TURNSTILE_SITE_KEY', siteKey);
  importCounter += 1;
  return import(/* @vite-ignore */ `./turnstile?case=${importCounter}`) as Promise<typeof import('./turnstile')>;
}

function scriptTag(): HTMLScriptElement {
  const script = document.querySelector<HTMLScriptElement>('script[data-wejhaty-turnstile]');
  if (!script) throw new Error('Turnstile script tag was not created');
  return script;
}

describe('useTurnstile', () => {
  beforeEach(() => {
    document.querySelectorAll('script[data-wejhaty-turnstile]').forEach((node) => node.remove());
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('is a no-op — required/blocking/failed all false — with no site key configured', async () => {
    const { useTurnstile } = await importFresh(undefined);
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useTurnstile(ref, true));
    expect(result.current.required).toBe(false);
    expect(result.current.blocking).toBe(false);
    expect(result.current.failed).toBe(false);
    expect(document.querySelector('script[data-wejhaty-turnstile]')).toBeNull();
  });

  it('renders the widget and clears blocking once the callback reports a token', async () => {
    const { useTurnstile } = await importFresh('test-site-key');
    const container = document.createElement('div');
    const ref = { current: container };
    const render = vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      (options.callback as (value: string) => void)('a-real-token');
      return 'widget-1';
    });
    (window as unknown as { turnstile: unknown }).turnstile = { render, remove: vi.fn() };

    const { result } = renderHook(() => useTurnstile(ref, true));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.required).toBe(true);
    expect(result.current.token).toBe('a-real-token');
    expect(result.current.blocking).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it('the exact reported bug: a blocked/failed script leaves failed=true (not a silent permanent hang) while still blocking submission', async () => {
    const { useTurnstile } = await importFresh('test-site-key');
    const container = document.createElement('div');
    const ref = { current: container };
    const { result } = renderHook(() => useTurnstile(ref, true));

    expect(result.current.failed).toBe(false);
    expect(result.current.blocking).toBe(true);

    await act(async () => {
      scriptTag().dispatchEvent(new Event('error'));
      await Promise.resolve();
    });

    expect(result.current.failed).toBe(true);
    // Failing to load must never waive the challenge — it stays blocking.
    expect(result.current.blocking).toBe(true);
    expect(result.current.token).toBeUndefined();
  });

  it('falls back to failed=true on a silent hang past the load timeout, even with no error event', async () => {
    vi.useFakeTimers();
    const { useTurnstile } = await importFresh('test-site-key');
    const container = document.createElement('div');
    const ref = { current: container };
    const { result } = renderHook(() => useTurnstile(ref, true));

    expect(result.current.failed).toBe(false);
    act(() => { vi.advanceTimersByTime(8000); });

    expect(result.current.failed).toBe(true);
    expect(result.current.blocking).toBe(true);
  });

  it('retry() reloads the widget and can recover from a prior failure', async () => {
    const { useTurnstile } = await importFresh('test-site-key');
    const container = document.createElement('div');
    const ref = { current: container };
    const { result } = renderHook(() => useTurnstile(ref, true));

    await act(async () => {
      scriptTag().dispatchEvent(new Event('error'));
      await Promise.resolve();
    });
    expect(result.current.failed).toBe(true);

    // Simulate the retry succeeding: install window.turnstile before the
    // next attempt so loadTurnstile's short-circuit resolves immediately.
    const render = vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      (options.callback as (value: string) => void)('recovered-token');
      return 'widget-2';
    });
    (window as unknown as { turnstile: unknown }).turnstile = { render, remove: vi.fn() };

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.failed).toBe(false);
    expect(result.current.token).toBe('recovered-token');
    expect(result.current.blocking).toBe(false);
  });

  it('the widget-level error-callback also surfaces as failed, still blocking', async () => {
    const { useTurnstile } = await importFresh('test-site-key');
    const container = document.createElement('div');
    const ref = { current: container };
    let errorCallback: (() => void) | undefined;
    const render = vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      errorCallback = options['error-callback'] as () => void;
      return 'widget-3';
    });
    (window as unknown as { turnstile: unknown }).turnstile = { render, remove: vi.fn() };

    const { result } = renderHook(() => useTurnstile(ref, true));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.failed).toBe(false);

    act(() => errorCallback?.());

    expect(result.current.failed).toBe(true);
    expect(result.current.blocking).toBe(true);
  });
});
