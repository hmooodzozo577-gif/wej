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

export function loadTurnstile(): Promise<TurnstileApi | undefined> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
  if (typeof window === 'undefined') return Promise.resolve(undefined);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wejhaty-turnstile]');
    const script = existing ?? document.createElement('script');
    const done = () => resolve(window.turnstile);
    script.addEventListener('load', done, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.wejhatyTurnstile = 'true';
      document.head.append(script);
    }
  });
}

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

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !active) return;
    let widgetId: string | undefined;
    let cancelled = false;
    void loadTurnstile().then((api) => {
      if (cancelled || !api || !container.current) return;
      widgetId = api.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        callback: (value: string) => setToken(value),
        'expired-callback': () => setToken(undefined),
        'error-callback': () => setToken(undefined),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [active, theme, container]);

  return {
    token,
    required: !!TURNSTILE_SITE_KEY,
    /** True when a challenge is required and has not been solved yet. */
    blocking: !!TURNSTILE_SITE_KEY && active && !token,
  };
}
