import type { Lang } from '../data/types';

const WORKER_BASE_URL: string | undefined = import.meta.env.VITE_TRAVEL_WORKER_URL;
const SESSION_KEY = 'wejhaty.analytics.session';
const FORBIDDEN_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'ip', 'ipaddress', 'fingerprint', 'devicefingerprint']);

/** Fallback when sessionStorage cannot be used at all (Safari private
 *  browsing, blocked site data, an embedded webview). The identifier is
 *  still random and still anonymous — it just does not survive a reload. */
let memorySessionId: string | null = null;

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    // Reading threw — fall through to the in-memory identifier.
  }
  if (!memorySessionId) memorySessionId = crypto.randomUUID();
  try {
    sessionStorage.setItem(SESSION_KEY, memorySessionId);
  } catch {
    // Writing threw. A blocked sessionStorage must never throw out of a
    // click handler: analytics is the least important thing on the page.
  }
  return memorySessionId;
}

function deviceClass(): string {
  if (window.innerWidth < 640) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function browserFamily(): string {
  const agent = navigator.userAgent;
  if (/Edg\//.test(agent)) return 'Edge';
  if (/Firefox\//.test(agent)) return 'Firefox';
  if (/Chrome\//.test(agent)) return 'Chrome';
  if (/Safari\//.test(agent)) return 'Safari';
  return 'Other';
}

function referrerOrigin(): string | null {
  if (!document.referrer) return null;
  try { return new URL(document.referrer).origin; } catch { return null; }
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, '')) || hasForbiddenKey(child));
}

interface ProductContext { path: string; locale: Lang; countryCode?: string }

async function post(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: Record<string, unknown> }> {
  if (!WORKER_BASE_URL) return { ok: false };
  try {
    const result = await fetch(`${WORKER_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: path === '/api/events',
    });
    const data = await result.json().catch(() => undefined) as Record<string, unknown> | undefined;
    return { ok: result.ok, data };
  } catch {
    return { ok: false };
  }
}

function common(context: ProductContext) {
  return {
    sessionId: sessionId(),
    path: context.path,
    locale: context.locale,
    countryCode: context.countryCode,
    device: deviceClass(),
    browser: browserFamily(),
    referrerOrigin: referrerOrigin(),
  };
}

export async function sendProductEvent(name: string, properties: Record<string, unknown>, context: ProductContext): Promise<boolean> {
  if (hasForbiddenKey(properties)) return false;
  return (await post('/api/events', { ...common(context), name, properties })).ok;
}

export function trackEvent(name: string, properties: Record<string, unknown>, context: ProductContext) {
  void sendProductEvent(name, properties, context);
}

/** Item #13 — two rating levels share one endpoint. 'results' rates a whole
 *  recommendation set; 'destination' rates one country page and carries the
 *  country plus the coarse route the traveller arrived by. The per-country
 *  "useful / not useful" votes the results form used to send are gone. */
export async function submitRating(payload: {
  kind: 'results' | 'destination';
  overallScore: number;
  comment?: string;
  countryCode?: string;
  origin?: 'results' | 'explore' | 'surprise' | 'direct';
  resultContext?: { countryCode: string; score: number }[];
  /** Present only when Turnstile is configured — a rating carries free text
   *  and is challenged like a report. See telemetry/turnstile.ts. */
  turnstileToken?: string;
}, context: ProductContext) {
  return post('/api/ratings', { ...common(context), ...payload });
}

export async function submitFeedback(payload: {
  type: string;
  message: string;
  email?: string;
  screenshotDataUrl?: string;
  turnstileToken?: string;
}, context: ProductContext) {
  return post('/api/feedback', {
    ...common(context),
    ...payload,
    deviceContext: { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, theme: document.documentElement.dataset.theme ?? 'light' },
  });
}
