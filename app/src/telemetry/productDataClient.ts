import type { Lang } from '../data/types';

const WORKER_BASE_URL: string | undefined = import.meta.env.VITE_TRAVEL_WORKER_URL;
const SESSION_KEY = 'wejhaty.analytics.session';
const FORBIDDEN_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'ip', 'ipaddress', 'fingerprint', 'devicefingerprint']);

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
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

export async function submitRating(payload: {
  overallScore: number;
  reasons: string[];
  countryVotes: { countryCode: string; useful: boolean }[];
  resultContext: { countryCode: string; score: number }[];
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
