import { isAllowedOrigin, isExcludedCountry } from './shared';

export interface D1Result<T = unknown> { results?: T[]; success?: boolean }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
export interface D1DatabaseLike { prepare(sql: string): D1Statement }
export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: unknown): Promise<unknown>;
  delete(keys: string | string[]): Promise<unknown>;
}

/** The Workers Rate Limiting API binding (wrangler.toml `[[ratelimits]]`). */
export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ProductEnv {
  PRODUCT_DB?: D1DatabaseLike;
  FEEDBACK_SCREENSHOTS?: R2BucketLike;
  TURNSTILE_SECRET_KEY?: string;
  // Security Pass 2 (S1) — one limiter per public write endpoint, each with
  // its own budget in wrangler.toml.
  EVENTS_RATE_LIMITER?: RateLimiterLike;
  RATINGS_RATE_LIMITER?: RateLimiterLike;
  FEEDBACK_RATE_LIMITER?: RateLimiterLike;
  // ADMIN_TOKEN is not read here: the admin surface and its credentials
  // belong to AdminEnv in admin.ts (Security Pass 2, I10).
}

const SESSION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const EVENT_RE = /^[a-z][a-z0-9_]{1,63}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const FORBIDDEN_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'ip', 'ipaddress', 'fingerprint', 'devicefingerprint']);
const FEEDBACK_TYPES = new Set(['wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other']);
const RATING_REASONS = new Set(['relevant', 'easy_to_understand', 'unexpected', 'missing_info', 'other']);

function response(body: unknown, status: number, origin: string | null, extraHeaders: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

// ---------------------------------------------------------------------------
// Security Pass 2 (S1) — abuse control that does not trust the client.
//
// Each public write endpoint has its own Workers Rate Limiting binding,
// keyed on the connecting IP address Cloudflare reports (CF-Connecting-IP),
// never on the client-generated sessionId (a client can mint a new one per
// request). The IP is only the limiter's in-memory key at Cloudflare's edge:
// it is not stored in D1, not logged and not returned. The older
// per-session D1 caps stay as a second, finer layer.
//
// A missing binding (local runs, tests) means no edge limit; a limiter that
// throws lets the request through rather than taking analytics, ratings and
// reports down with it — the per-session caps still apply behind it.
// ---------------------------------------------------------------------------
type WritePath = '/api/events' | '/api/ratings' | '/api/feedback';
const LIMITER_FOR: Record<WritePath, 'EVENTS_RATE_LIMITER' | 'RATINGS_RATE_LIMITER' | 'FEEDBACK_RATE_LIMITER'> = {
  '/api/events': 'EVENTS_RATE_LIMITER',
  '/api/ratings': 'RATINGS_RATE_LIMITER',
  '/api/feedback': 'FEEDBACK_RATE_LIMITER',
};
/** Seconds a limited client is told to wait: the limiters' 60-second window. */
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/** The address Cloudflare saw the request come from. Clients cannot set
 *  this header through Cloudflare; when it is absent (a local runtime) every
 *  such request shares one bucket. */
export function clientAddressOf(request: Request): string {
  const address = request.headers.get('CF-Connecting-IP')?.trim();
  return address && address.length <= 64 ? address : 'unknown';
}

export async function withinRateLimit(env: ProductEnv, path: WritePath, request: Request): Promise<boolean> {
  const limiter = env[LIMITER_FOR[path]];
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key: `${path}|${clientAddressOf(request)}` });
    return success !== false;
  } catch {
    return true;
  }
}

/** Analytics events are small (an event name, a path and a handful of
 *  properties). Anything larger is refused before it is parsed. */
export const MAX_EVENT_BODY_BYTES = 16 * 1024;
const MAX_EVENT_PROPERTIES_LENGTH = 4_000;

async function boundedBodyOf(request: Request, maxBytes: number): Promise<Record<string, unknown> | null | 'too_large'> {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) return 'too_large';
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return 'too_large';
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  return text(value, max) ?? undefined;
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, '')) || hasForbiddenKey(child));
}

function safeProperties(value: unknown, maxLength = 12_000): string | null {
  if (value === undefined) return '{}';
  if (!value || typeof value !== 'object' || hasForbiddenKey(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= maxLength ? serialized : null;
  } catch {
    return null;
  }
}

function sessionIdOf(body: Record<string, unknown>) {
  return typeof body.sessionId === 'string' && SESSION_RE.test(body.sessionId) ? body.sessionId : null;
}

function edgeCountryOf(request: Request): string | null {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === 'string' && COUNTRY_RE.test(country) && !isExcludedCountry(country) ? country : null;
}

async function upsertSession(db: D1DatabaseLike, body: Record<string, unknown>, request: Request) {
  const sessionId = sessionIdOf(body)!;
  const now = new Date().toISOString();
  const locale = body.locale === 'en' ? 'en' : 'ar';
  const device = optionalText(body.device, 32) ?? null;
  const browser = optionalText(body.browser, 48) ?? null;
  let referrer = optionalText(body.referrerOrigin, 180) ?? null;
  if (referrer) {
    try { referrer = new URL(referrer).origin; } catch { referrer = null; }
  }
  await db.prepare(`INSERT INTO sessions
    (session_id, first_seen_at, last_seen_at, locale, device_class, browser_family, referrer_origin, edge_country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET last_seen_at=excluded.last_seen_at, locale=excluded.locale,
    device_class=COALESCE(excluded.device_class, sessions.device_class),
    browser_family=COALESCE(excluded.browser_family, sessions.browser_family),
    edge_country=COALESCE(excluded.edge_country, sessions.edge_country)`)
    .bind(sessionId, now, now, locale, device, browser, referrer, edgeCountryOf(request)).run();
}

async function handleEvent(request: Request, env: ProductEnv, origin: string | null) {
  const parsed = await boundedBodyOf(request, MAX_EVENT_BODY_BYTES);
  if (parsed === 'too_large') return response({ error: 'payload_too_large' }, 413, origin);
  const body = parsed;
  const sessionId = body && sessionIdOf(body);
  const name = body && text(body.name, 64);
  const path = body && text(body.path, 240);
  const properties = body && safeProperties(body.properties, MAX_EVENT_PROPERTIES_LENGTH);
  if (!body || !sessionId || !name || !EVENT_RE.test(name) || !path || !path.startsWith('/') || properties === null) {
    return response({ error: 'invalid_request' }, 400, origin);
  }
  const countryCode = body.countryCode === undefined || body.countryCode === null
    ? null
    : typeof body.countryCode === 'string' && COUNTRY_RE.test(body.countryCode) && !isExcludedCountry(body.countryCode) ? body.countryCode : undefined;
  if (countryCode === undefined) return response({ error: 'invalid_request' }, 400, origin);
  await upsertSession(env.PRODUCT_DB!, body, request);
  await env.PRODUCT_DB!.prepare(`INSERT INTO events
    (id, session_id, occurred_at, name, path, country_code, properties_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), sessionId, new Date().toISOString(), name, path, countryCode, properties).run();
  return response({ accepted: true }, 202, origin);
}

function validCountryItems(value: unknown, withUseful: boolean) {
  if (!Array.isArray(value) || value.length > 5) return false;
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    if (typeof record.countryCode !== 'string' || !COUNTRY_RE.test(record.countryCode) || isExcludedCountry(record.countryCode)) return false;
    return withUseful ? typeof record.useful === 'boolean' : typeof record.score === 'number' && record.score >= 0 && record.score <= 100;
  });
}

// Item #13 — two rating levels. 'results' rates a whole recommendation set;
// 'destination' rates one country page, whichever route the traveller
// reached it by. Both are a 1-5 score plus an optional free-text comment.
const RATING_KINDS = new Set(['results', 'destination']);
// Where the traveller came from. Context only: never a precise location,
// never anything identifying.
const RATING_ORIGINS = new Set(['results', 'explore', 'surprise', 'direct']);
const MAX_RATING_COMMENT = 2000;

async function handleRating(request: Request, env: ProductEnv, origin: string | null) {
  const body = await bodyOf(request);
  const sessionId = body && sessionIdOf(body);
  const score = body?.overallScore;
  // Absent reasons are valid: the results form no longer collects reason
  // tags, and older clients that still send them stay accepted.
  const reasons = body?.reasons ?? [];
  const kind = typeof body?.kind === 'string' ? body.kind : 'results';
  // optionalText, not text: an over-long comment must be REJECTED, not
  // silently discarded as if the traveller had written nothing.
  const comment = body ? optionalText(body.comment, MAX_RATING_COMMENT) : null;
  const countryCode = body?.countryCode;
  const ratingOrigin = body?.origin;

  if (!body || !sessionId || typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5 ||
      !RATING_KINDS.has(kind) ||
      comment === undefined ||
      !Array.isArray(reasons) || reasons.length > 5 || !reasons.every((reason) => typeof reason === 'string' && RATING_REASONS.has(reason)) ||
      (body.countryVotes !== undefined && !validCountryItems(body.countryVotes, true)) ||
      (body.resultContext !== undefined && !validCountryItems(body.resultContext, false)) ||
      (ratingOrigin !== undefined && (typeof ratingOrigin !== 'string' || !RATING_ORIGINS.has(ratingOrigin)))) {
    return response({ error: 'invalid_request' }, 400, origin);
  }

  // A destination rating is about exactly one country, and the IL exclusion
  // is absolute here as on every other path.
  if (kind === 'destination') {
    if (typeof countryCode !== 'string' || !COUNTRY_RE.test(countryCode) || isExcludedCountry(countryCode)) {
      return response({ error: 'invalid_request' }, 400, origin);
    }
  } else if (countryCode !== undefined) {
    return response({ error: 'invalid_request' }, 400, origin);
  }

  // A rating carries free text, so it is an abuse surface in the same class
  // as a report and gets the same challenge. Analytics events do NOT — they
  // are automatic, they carry no free text, and challenging them would mean
  // challenging every page view.
  const turnstileToken = optionalText(body.turnstileToken, 2048) ?? null;
  if (!await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY)) {
    return response({ error: 'challenge_failed' }, 403, origin);
  }

  // One traveller cannot flood the table from a single session.
  const recent = await env.PRODUCT_DB!.prepare(`SELECT COUNT(*) AS count FROM ratings
    WHERE session_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(sessionId).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 20) return response({ error: 'rate_limited' }, 429, origin);

  await upsertSession(env.PRODUCT_DB!, body, request);
  await env.PRODUCT_DB!.prepare(`INSERT INTO ratings
    (id, session_id, created_at, overall_score, reasons_json, country_votes_json, result_context_json, kind, comment, country_code, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      sessionId,
      new Date().toISOString(),
      score,
      JSON.stringify(reasons),
      JSON.stringify(body.countryVotes ?? []),
      JSON.stringify(body.resultContext ?? []),
      kind,
      comment,
      kind === 'destination' ? countryCode : null,
      typeof ratingOrigin === 'string' ? ratingOrigin : null,
    ).run();
  return response({ saved: true }, 201, origin);
}

/** Outbound limit for the Turnstile check, so a slow verifier cannot hold
 *  a request open. */
export const TURNSTILE_TIMEOUT_MS = 5000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Turnstile stays OPTIONAL: with no secret configured (today's state) the
 *  check is skipped. Once a secret exists it fails closed — a missing token,
 *  a rejected token, a non-2xx answer, a malformed body, a network error and
 *  a timeout are all "not verified". Only `success: true` passes. */
export async function verifyTurnstile(
  token: string | null,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TURNSTILE_TIMEOUT_MS,
): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  try {
    const result = await fetchImpl(TURNSTILE_VERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
    if (!result.ok) return false;
    const data: unknown = await result.json();
    return !!data && typeof data === 'object' && (data as { success?: unknown }).success === true;
  } catch {
    return false;
  }
}

function decodeScreenshot(value: unknown): { bytes: Uint8Array; contentType: string } | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2_800_000) return undefined;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return undefined;
  try {
    const binary = atob(match[2]!);
    if (binary.length > 2_000_000) return undefined;
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    // Phase 20 security backlog — the bytes must actually BE one of the
    // accepted image types; the stored content type is the one the bytes
    // prove, not the one the data URL claims (a PNG saved as ".jpg" is still
    // accepted, as before, but stored as image/png; a non-image is refused).
    const detected = detectImageType(bytes);
    if (!detected) return undefined;
    return { bytes, contentType: detected };
  } catch {
    return undefined;
  }
}

/** The accepted screenshot type the bytes' signature proves, or null. */
export function detectImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

async function handleFeedback(request: Request, env: ProductEnv, origin: string | null) {
  const body = await bodyOf(request);
  const sessionId = body && sessionIdOf(body);
  const type = body && text(body.type, 32);
  const message = body && text(body.message, 4000);
  const path = body && text(body.path, 240);
  const email = body ? optionalText(body.email, 254) : undefined;
  const screenshot = body ? decodeScreenshot(body.screenshotDataUrl) : undefined;
  const countryCode = body?.countryCode === undefined || body?.countryCode === null || body?.countryCode === ''
    ? null
    : typeof body.countryCode === 'string' && COUNTRY_RE.test(body.countryCode) && !isExcludedCountry(body.countryCode) ? body.countryCode : undefined;
  if (!body || !sessionId || !type || !FEEDBACK_TYPES.has(type) || !message || !path || !path.startsWith('/') ||
      email === undefined || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || countryCode === undefined || screenshot === undefined) {
    return response({ error: 'invalid_request' }, 400, origin);
  }
  const count = await env.PRODUCT_DB!.prepare(`SELECT COUNT(*) AS count FROM feedback
    WHERE session_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(sessionId).first<{ count: number }>();
  if ((count?.count ?? 0) >= 5) return response({ error: 'rate_limited' }, 429, origin);
  const turnstileToken = optionalText(body.turnstileToken, 2048) ?? null;
  if (!await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY)) return response({ error: 'challenge_failed' }, 403, origin);

  await upsertSession(env.PRODUCT_DB!, body, request);
  const id = crypto.randomUUID();
  const referenceId = `WJH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}`;
  let screenshotKey: string | null = null;
  if (screenshot) {
    if (!env.FEEDBACK_SCREENSHOTS) return response({ error: 'screenshot_unavailable' }, 503, origin);
    const extension = screenshot.contentType === 'image/jpeg' ? 'jpg' : screenshot.contentType.split('/')[1]!;
    screenshotKey = `${new Date().toISOString().slice(0, 10)}/${id}.${extension}`;
    await env.FEEDBACK_SCREENSHOTS.put(screenshotKey, screenshot.bytes, { httpMetadata: { contentType: screenshot.contentType } });
  }
  const device = safeProperties(body.deviceContext) ?? '{}';
  await env.PRODUCT_DB!.prepare(`INSERT INTO feedback
    (id, reference_id, session_id, created_at, type, message, email, country_code, path, locale, device_json, screenshot_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, referenceId, sessionId, new Date().toISOString(), type, message, email, countryCode, path, body.locale === 'en' ? 'en' : 'ar', device, screenshotKey).run();
  return response({ saved: true, referenceId }, 201, origin);
}

export async function runProductRetention(env: ProductEnv): Promise<void> {
  if (!env.PRODUCT_DB) return;
  const db = env.PRODUCT_DB;
  await db.prepare(`INSERT INTO daily_metrics(day, metric, dimension, value)
    SELECT substr(occurred_at, 1, 10), 'event', name, COUNT(*) FROM events
    WHERE occurred_at >= datetime('now', '-2 days') AND occurred_at < datetime('now')
    GROUP BY substr(occurred_at, 1, 10), name
    ON CONFLICT(day, metric, dimension) DO UPDATE SET value=excluded.value`).run();
  await db.prepare(`INSERT INTO daily_metrics(day, metric, dimension, value)
    SELECT substr(created_at, 1, 10), 'rating', CAST(overall_score AS TEXT), COUNT(*) FROM ratings
    WHERE created_at >= datetime('now', '-2 days') AND created_at < datetime('now')
    GROUP BY substr(created_at, 1, 10), overall_score
    ON CONFLICT(day, metric, dimension) DO UPDATE SET value=excluded.value`).run();
  const expiredScreenshots = await db.prepare(`SELECT screenshot_key FROM feedback
    WHERE created_at < datetime('now', '-90 days') AND screenshot_key IS NOT NULL`).all<{ screenshot_key: string }>();
  if (env.FEEDBACK_SCREENSHOTS) {
    const keys = (expiredScreenshots.results ?? []).map((item) => item.screenshot_key).filter(Boolean);
    if (keys.length > 0) await env.FEEDBACK_SCREENSHOTS.delete(keys);
  }
  await db.prepare(`UPDATE feedback SET session_id = NULL, email = NULL, device_json = '{}', screenshot_key = NULL
    WHERE created_at < datetime('now', '-90 days')`).run();
  await db.prepare("DELETE FROM ratings WHERE created_at < datetime('now', '-90 days')").run();
  await db.prepare("DELETE FROM events WHERE occurred_at < datetime('now', '-90 days')").run();
  await db.prepare("DELETE FROM sessions WHERE last_seen_at < datetime('now', '-90 days')").run();
}

export async function handleProductRequest(request: Request, env: ProductEnv, origin: string | null): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  // /admin and /api/admin/* are served by admin.ts, which owns
  // authentication for the whole private surface.
  if (!['/api/events', '/api/ratings', '/api/feedback'].includes(path)) return null;
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405, origin);
  // Limited before anything else is done for the request — including the
  // database check, so the budget holds whatever the storage state.
  if (!await withinRateLimit(env, path as WritePath, request)) {
    return response({ error: 'rate_limited' }, 429, origin, { 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
  }
  if (!env.PRODUCT_DB) return response({ error: 'product_data_unavailable' }, 503, origin);
  if (path === '/api/events') return handleEvent(request, env, origin);
  if (path === '/api/ratings') return handleRating(request, env, origin);
  return handleFeedback(request, env, origin);
}
