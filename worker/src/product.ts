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

export interface ProductEnv {
  PRODUCT_DB?: D1DatabaseLike;
  FEEDBACK_SCREENSHOTS?: R2BucketLike;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_TOKEN?: string;
}

const SESSION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const EVENT_RE = /^[a-z][a-z0-9_]{1,63}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const FORBIDDEN_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'ip', 'ipaddress', 'fingerprint', 'devicefingerprint']);
const FEEDBACK_TYPES = new Set(['wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other']);
const RATING_REASONS = new Set(['relevant', 'easy_to_understand', 'unexpected', 'missing_info', 'other']);

function response(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin === 'https://hmooodzozo577-gif.github.io') headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
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

function safeProperties(value: unknown): string | null {
  if (value === undefined) return '{}';
  if (!value || typeof value !== 'object' || hasForbiddenKey(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= 12_000 ? serialized : null;
  } catch {
    return null;
  }
}

function sessionIdOf(body: Record<string, unknown>) {
  return typeof body.sessionId === 'string' && SESSION_RE.test(body.sessionId) ? body.sessionId : null;
}

function edgeCountryOf(request: Request): string | null {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === 'string' && COUNTRY_RE.test(country) && country !== 'IL' ? country : null;
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
  const body = await bodyOf(request);
  const sessionId = body && sessionIdOf(body);
  const name = body && text(body.name, 64);
  const path = body && text(body.path, 240);
  const properties = body && safeProperties(body.properties);
  if (!body || !sessionId || !name || !EVENT_RE.test(name) || !path || !path.startsWith('/') || properties === null) {
    return response({ error: 'invalid_request' }, 400, origin);
  }
  const countryCode = body.countryCode === undefined || body.countryCode === null
    ? null
    : typeof body.countryCode === 'string' && COUNTRY_RE.test(body.countryCode) && body.countryCode !== 'IL' ? body.countryCode : undefined;
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
    if (typeof record.countryCode !== 'string' || !COUNTRY_RE.test(record.countryCode) || record.countryCode === 'IL') return false;
    return withUseful ? typeof record.useful === 'boolean' : typeof record.score === 'number' && record.score >= 0 && record.score <= 100;
  });
}

async function handleRating(request: Request, env: ProductEnv, origin: string | null) {
  const body = await bodyOf(request);
  const sessionId = body && sessionIdOf(body);
  const score = body?.overallScore;
  const reasons = body?.reasons;
  if (!body || !sessionId || typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5 ||
      !Array.isArray(reasons) || reasons.length > 5 || !reasons.every((reason) => typeof reason === 'string' && RATING_REASONS.has(reason)) ||
      !validCountryItems(body.countryVotes, true) || !validCountryItems(body.resultContext, false)) {
    return response({ error: 'invalid_request' }, 400, origin);
  }
  await upsertSession(env.PRODUCT_DB!, body, request);
  await env.PRODUCT_DB!.prepare(`INSERT INTO ratings
    (id, session_id, created_at, overall_score, reasons_json, country_votes_json, result_context_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), sessionId, new Date().toISOString(), score, JSON.stringify(reasons), JSON.stringify(body.countryVotes), JSON.stringify(body.resultContext)).run();
  return response({ saved: true }, 201, origin);
}

async function verifyTurnstile(token: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await result.json() as { success?: boolean };
    return data.success === true;
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
    return { bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)), contentType: match[1]! };
  } catch {
    return undefined;
  }
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
    : typeof body.countryCode === 'string' && COUNTRY_RE.test(body.countryCode) && body.countryCode !== 'IL' ? body.countryCode : undefined;
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

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function handleAdmin(request: Request, env: ProductEnv) {
  if (!env.ADMIN_TOKEN) return response({ error: 'admin_not_configured' }, 503, null);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (!secureEqual(bearer, env.ADMIN_TOKEN)) return response({ error: 'unauthorized' }, 401, null);
  const db = env.PRODUCT_DB!;
  const [sessions, events, ratings, feedback, topEvents, topCountries, topPages, dailySessions, ratingDistribution, recentFeedback, recentRatings] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM sessions').first(),
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE occurred_at >= datetime('now', '-7 days')").first(),
    db.prepare('SELECT COUNT(*) AS count, ROUND(AVG(overall_score), 2) AS average FROM ratings').first(),
    db.prepare("SELECT COUNT(*) AS count FROM feedback WHERE status = 'new'").first(),
    db.prepare("SELECT name, COUNT(*) AS count FROM events WHERE occurred_at >= datetime('now', '-30 days') GROUP BY name ORDER BY count DESC LIMIT 20").all(),
    db.prepare("SELECT edge_country AS country, COUNT(*) AS count FROM sessions WHERE edge_country IS NOT NULL GROUP BY edge_country ORDER BY count DESC LIMIT 20").all(),
    db.prepare("SELECT path, COUNT(*) AS count FROM events WHERE name = 'page_view' AND occurred_at >= datetime('now', '-30 days') GROUP BY path ORDER BY count DESC LIMIT 20").all(),
    db.prepare("SELECT substr(first_seen_at, 1, 10) AS day, COUNT(*) AS sessions FROM sessions WHERE first_seen_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day").all(),
    db.prepare('SELECT overall_score AS score, COUNT(*) AS count FROM ratings GROUP BY overall_score ORDER BY overall_score').all(),
    db.prepare("SELECT reference_id, created_at, type, message, email, country_code, path, locale, screenshot_key, status FROM feedback ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT created_at, overall_score, reasons_json, country_votes_json, result_context_json FROM ratings ORDER BY created_at DESC LIMIT 100").all(),
  ]);
  return response({
    sessions,
    eventsLast7Days: events,
    ratings,
    newFeedback: feedback,
    topEvents: topEvents.results ?? [],
    topCountries: topCountries.results ?? [],
    topPages: topPages.results ?? [],
    dailySessions: dailySessions.results ?? [],
    ratingDistribution: ratingDistribution.results ?? [],
    recentFeedback: recentFeedback.results ?? [],
    recentRatings: recentRatings.results ?? [],
  }, 200, null);
}

function adminPage(): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wejhaty Product Data</title><style>
  :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#101722;color:#edf2f7}body{margin:0;padding:32px}.wrap{max-width:1200px;margin:auto}h1{margin-top:0}.login,.panel{background:#172231;border:1px solid #344255;border-radius:18px;padding:20px;margin:18px 0}.row{display:flex;gap:10px;flex-wrap:wrap}input,button{font:inherit;padding:10px 13px;border-radius:10px;border:1px solid #526176;background:#101722;color:#fff}button{background:#d9a85c;color:#101722;font-weight:800;cursor:pointer}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{background:#1d2a39;padding:16px;border-radius:14px}.metric b{display:block;font-size:1.8rem;margin-top:6px}pre{white-space:pre-wrap;word-break:break-word;max-height:65vh;overflow:auto;background:#0b111a;padding:16px;border-radius:12px}small{color:#afbac7}.error{color:#ff9b8e}</style></head><body><main class="wrap"><h1>Wejhaty Product Data</h1><p><small>Anonymous product analytics, ratings, and feedback. Protected API access is required.</small></p><form id="login" class="login"><label>Admin token <input id="token" type="password" autocomplete="current-password" required></label> <button>Load dashboard</button><span id="error" class="error"></span></form><section id="content" hidden><div class="metrics" id="metrics"></div><div class="panel"><h2>Complete data snapshot</h2><pre id="raw"></pre></div></section></main><script>
  const login=document.getElementById('login'),error=document.getElementById('error'),content=document.getElementById('content'),metrics=document.getElementById('metrics'),raw=document.getElementById('raw');
  const card=(label,value)=>{const el=document.createElement('div');el.className='metric';const s=document.createElement('span');s.textContent=label;const b=document.createElement('b');b.textContent=String(value??0);el.append(s,b);return el};
  login.addEventListener('submit',async(e)=>{e.preventDefault();error.textContent='';const token=document.getElementById('token').value;try{const r=await fetch('/api/admin/summary',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error(r.status===401?'Invalid token':'Dashboard unavailable');const d=await r.json();metrics.replaceChildren(card('Sessions',d.sessions?.count),card('Events · 7 days',d.eventsLast7Days?.count),card('Ratings',d.ratings?.count),card('Average rating',d.ratings?.average),card('New feedback',d.newFeedback?.count));raw.textContent=JSON.stringify(d,null,2);content.hidden=false}catch(err){error.textContent=err.message||'Unable to load'}});
  </script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'" } });
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
  if (path === '/admin') return request.method === 'GET' ? adminPage() : response({ error: 'method_not_allowed' }, 405, origin);
  if (!['/api/events', '/api/ratings', '/api/feedback', '/api/admin/summary'].includes(path)) return null;
  if (!env.PRODUCT_DB) return response({ error: 'product_data_unavailable' }, 503, origin);
  if (path === '/api/admin/summary') {
    if (request.method !== 'GET') return response({ error: 'method_not_allowed' }, 405, origin);
    return handleAdmin(request, env);
  }
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405, origin);
  if (path === '/api/events') return handleEvent(request, env, origin);
  if (path === '/api/ratings') return handleRating(request, env, origin);
  return handleFeedback(request, env, origin);
}
