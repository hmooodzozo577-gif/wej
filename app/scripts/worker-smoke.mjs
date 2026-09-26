// Security Pass 2 — production check of the deployed Worker's hardening.
//
// Runs on a GitHub-hosted runner (see .github/workflows/production-smoke.yml)
// because the development sandbox cannot reach workers.dev. It writes NO
// data: every request is a read, a CORS preflight, a refused city title, or
// a deliberately invalid write body that the Worker rejects before touching
// D1 — which is exactly what lets it observe the edge rate limiter (the
// limiter runs before the body is read).
//
// Usage: node scripts/worker-smoke.mjs [workerUrl]
// Exit status 0 only when every check passes.
import { PRODUCTION_WORKER_URL, PRODUCTION_SITE_ORIGIN } from './lib/productionUrls.mjs';
const WORKER = (process.argv[2] || PRODUCTION_WORKER_URL).replace(/\/$/, '');
const SITE_ORIGIN = PRODUCTION_SITE_ORIGIN;
let checks = 0;
let failures = 0;
const check = (ok, label, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const call = (path, init = {}) => fetch(`${WORKER}${path}`, { ...init, headers: { 'User-Agent': 'WejhatyWorkerSmoke/1.0', ...(init.headers ?? {}) } });

// Intelligence detail: a normal read works; a malformed escape is a 400 (E2).
{
  const ok = await call('/api/intelligence/SA/tourism');
  check(ok.status === 200, 'intelligence detail answers 200', String(ok.status));
  const bad = await call('/api/intelligence/%E0%A4%A/tourism');
  check(bad.status === 400, 'malformed path encoding answers 400, not 500', String(bad.status));
}

// CORS: only the Pages origin is allowed (D1).
{
  const allowed = await call('/api/events', { method: 'OPTIONS', headers: { Origin: SITE_ORIGIN } });
  check(allowed.headers.get('access-control-allow-origin') === SITE_ORIGIN, 'CORS allows the site origin');
  const other = await call('/api/events', { method: 'OPTIONS', headers: { Origin: 'https://example.com' } });
  check(!other.headers.get('access-control-allow-origin'), 'CORS refuses another origin');
}

// City descriptions: a title outside the trusted list is refused without a
// lookup (S2). Refused requests are never cached.
{
  const response = await call('/api/cities/descriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN },
    body: JSON.stringify({ lang: 'en', countryCode: 'JP', cities: [{ name: 'Tokyo', title: 'Tokyo Tower' }] }),
  });
  const body = await response.json().catch(() => ({}));
  check(response.status === 200 && body.descriptions?.[0]?.status === 'no_article', 'untrusted city title is refused', `${response.status} ${body.descriptions?.[0]?.status}`);
}

// Body ceilings (Phase 20): an oversized body is refused with 413 before it
// is read, whether its length is declared or it arrives chunked. The flights
// endpoint stores nothing, so these two requests write no data.
{
  const oversized = 'x'.repeat(8 * 1024);
  const declared = await call('/api/travel/flights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN },
    body: oversized,
  });
  check(declared.status === 413, 'declared oversized body answers 413', String(declared.status));
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(oversized)); controller.close(); } });
  const chunked = await call('/api/travel/flights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN },
    body: stream,
    duplex: 'half',
  });
  check(chunked.status === 413, 'chunked oversized body (no Content-Length) answers 413', String(chunked.status));
}

// Edge rate limits (S1): invalid bodies are refused with 400 before any
// write, until the address is over the endpoint's budget and gets 429. The
// Rate Limiting API counts per Cloudflare location and is eventually
// consistent, so the check allows generous headroom past the budget.
for (const [path, budget] of [['/api/feedback', 5], ['/api/ratings', 10], ['/api/events', 120]]) {
  const statuses = new Map();
  let limited = null;
  for (let i = 0; i < budget * 2 + 20 && !limited; i += 1) {
    const response = await call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN }, body: '{}' });
    statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
    if (response.status === 429) limited = response;
    else await response.arrayBuffer();
  }
  const summary = [...statuses].map(([status, count]) => `${status}×${count}`).join(' ');
  check(!!limited, `${path} answers 429 past its per-address budget (${budget}/min)`, summary);
  if (limited) {
    check(limited.headers.get('retry-after') === '60', `${path} 429 carries Retry-After: 60`, String(limited.headers.get('retry-after')));
    check((await limited.json().catch(() => ({}))).error === 'rate_limited', `${path} 429 body says rate_limited`);
  }
  check(![...statuses.keys()].some((status) => status >= 200 && status < 300), `${path} stored nothing (no 2xx)`, summary);
}

console.log(`Worker smoke: ${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
