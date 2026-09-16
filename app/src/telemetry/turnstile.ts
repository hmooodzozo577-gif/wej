// Turnstile, shared by every form that accepts free text from the public.
//
// WHERE IT IS USED, AND WHY ONLY THERE
// A form that lets anyone write text into the product database is an abuse
// surface: the report dialog, the results rating and the destination rating.
// Those three get a challenge.
//
// Analytics events do NOT. They carry no free text, they are automatic
// rather than submitted, and challenging them would mean challenging every
// page view — which would be a worse product for every real traveller and
// would not stop anyone determined. The Worker enforces the same split (see
// worker/src/product.ts).
//
// WHEN IT IS ACTIVE
// Only when VITE_TURNSTILE_SITE_KEY is configured at build time. With no
// site key the widget is never rendered, no script is loaded, and the forms
// behave exactly as they do today — which is the current production state.
// The Worker independently skips verification when it has no secret, so the
// two halves can be switched on in either order without a broken window
// where submissions are rejected.
import { useEffect, useState, type RefObject } from 'react';

export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

// Root cause of "the submit button stays disabled forever": this used to
// listen for the script's `load` event only. A blocked or failed load (an
// ad blocker, a corporate/regional firewall, or any network policy that
// refuses challenges.cloudflare.com — all common in the real world, not
// hypothetical) never fires `load`, so the returned promise never settled
// and every caller waiting on it hung indefinitely with no token, no
// error, and no way out. Listening for `error` too, and resolving
// `undefined` on it, turns that silent hang into a state callers can
// actually detect and surface (see useTurnstile's `failed`).
export function loadTurnstile(): Promise<TurnstileApi | undefined> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
  if (typeof window === 'undefined') return Promise.resolve(undefined);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wejhaty-turnstile]');
    const script = existing ?? document.createElement('script');
    const done = () => resolve(window.turnstile);
    const failed = () => resolve(undefined);
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.wejhatyTurnstile = 'true';
      document.head.append(script);
    }
  });
}

/** Belt-and-braces backstop behind the `error` listener above: some
 *  network policies drop the request without ever firing a DOM `error`
 *  event (a silently stalled connection, some proxy behaviours). Without
 *  this, that specific failure mode would still hang forever. */
const TURNSTILE_LOAD_TIMEOUT_MS = 8000;

/** Renders a challenge into `container` while `active`, and reports the
 *  current token. Returns `required: false` when no site key is configured,
 *  which is how every caller knows not to block its submit button.
 *
 *  The caller owns the ref and passes it in, rather than receiving one back:
 *  a ref that is created here and read through a returned object is the
 *  "ref accessed during render" pattern the lint rule warns about. */
export function useTurnstile(
  container: RefObject<HTMLDivElement | null>,
  active: boolean,
  theme: 'auto' | 'light' | 'dark' = 'auto',
) {
  const [token, setToken] = useState<string | undefined>();
  // True once the challenge is known NOT to be coming — the script failed
  // to load, timed out, or the widget itself reported an error. Distinct
  // from "still loading": a caller uses this to show an honest message and
  // a retry instead of a submit button that is disabled with no
  // explanation forever. Submission stays blocked either way — a Turnstile
  // failure must never silently waive the challenge, or blocking the
  // script client-side would be a trivial way to bypass it entirely.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !active) return;
    let widgetId: string | undefined;
    let cancelled = false;
    // Deliberate, not derivable at render time: this effect can re-run
    // with a stale `failed`/`token` left over from a PREVIOUS attempt (a
    // retry, or the challenge becoming active again after being inactive)
    // and must clear them before starting a new one, or a past failure
    // would keep showing after this attempt has already succeeded.
    // oxlint-disable-next-line react/set-state-in-effect
    setFailed(false);
    setToken(undefined);
    const timer = window.setTimeout(() => {
      if (!cancelled) setFailed(true);
    }, TURNSTILE_LOAD_TIMEOUT_MS);
    void loadTurnstile().then((api) => {
      if (cancelled) return;
      if (!api || !container.current) {
        window.clearTimeout(timer);
        setFailed(true);
        return;
      }
      try {
        widgetId = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          callback: (value: string) => { window.clearTimeout(timer); setToken(value); },
          'expired-callback': () => setToken(undefined),
          'error-callback': () => { window.clearTimeout(timer); setFailed(true); },
        });
        window.clearTimeout(timer);
      } catch {
        window.clearTimeout(timer);
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [active, theme, container, attempt]);

  return {
    token,
    required: !!TURNSTILE_SITE_KEY,
    /** True when a challenge is required and has not been solved yet. */
    blocking: !!TURNSTILE_SITE_KEY && active && !token,
    /** True when the challenge is required but could not load or render. */
    failed,
    /** Reloads the widget from scratch — offered to the traveller next to
     *  the failure message rather than leaving them stuck. */
    retry: () => setAttempt((value) => value + 1),
  };
}
