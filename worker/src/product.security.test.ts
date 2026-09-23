// Security Pass 2 (S1) — abuse controls on the public write endpoints:
// per-endpoint edge rate limits keyed on the connecting address (never the
// client's sessionId), the optional Turnstile check failing closed once
// configured, and the analytics payload cap.
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_EVENT_BODY_BYTES,
  RATE_LIMIT_RETRY_AFTER_SECONDS,
  clientAddressOf,
  handleProductRequest,
  verifyTurnstile,
  type ProductEnv,
  type RateLimiterLike,
} from './product';

class FakeStatement {
  constructor(private db: FakeDb, private sql: string, private values: unknown[] = []) {}
  bind(...values: unknown[]) { return new FakeStatement(this.db, this.sql, values); }
  async run() { this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true }; }
  async first<T>() { return (this.sql.includes('COUNT(*)') ? { count: 0 } : null) as T; }
  async all<T>() { return { results: [] as T[] }; }
}
class FakeDb {
  writes: { sql: string; values: unknown[] }[] = [];
  prepare(sql: string) { return new FakeStatement(this, sql); }
}

/** A limiter that allows `limit` calls per key, like the edge binding. */
function countingLimiter(limit: number) {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const limiter: RateLimiterLike = {
    limit: vi.fn(async ({ key }: { key: string }) => {
      keys.push(key);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= limit };
    }),
  };
  return { limiter, keys };
}

const ORIGIN = 'https://hmooodzozo577-gif.github.io';
const IP = '203.0.113.7';
let sessionCounter = 0;
const freshSession = () => `session_${String(sessionCounter++).padStart(16, '0')}`;

const BODIES: Record<string, () => Record<string, unknown>> = {
  '/api/events': () => ({ sessionId: freshSession(), name: 'page_view', path: '/explore', locale: 'ar' }),
  '/api/ratings': () => ({ sessionId: freshSession(), kind: 'results', overallScore: 4, locale: 'en' }),
  '/api/feedback': () => ({ sessionId: freshSession(), type: 'bug', message: 'Something is off here.', path: '/explore', locale: 'en' }),
};

function post(path: string, body: unknown, headers: Record<string, string> = { 'CF-Connecting-IP': IP }) {
  return new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('per-endpoint edge rate limits (S1)', () => {
  for (const path of Object.keys(BODIES)) {
    it(`${path}: answers 429 with Retry-After once the address is over its budget`, async () => {
      const { limiter } = countingLimiter(2);
      const env = {
        PRODUCT_DB: new FakeDb(),
        EVENTS_RATE_LIMITER: limiter, RATINGS_RATE_LIMITER: limiter, FEEDBACK_RATE_LIMITER: limiter,
      } as unknown as ProductEnv;
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await handleProductRequest(post(path, BODIES[path]!()), env, ORIGIN))!.status);
      expect(statuses.slice(0, 2).every((status) => status >= 200 && status < 300)).toBe(true);
      expect(statuses.slice(2)).toEqual([429, 429]);
      const limited = await handleProductRequest(post(path, BODIES[path]!()), env, ORIGIN);
      expect(limited!.headers.get('Retry-After')).toBe(String(RATE_LIMIT_RETRY_AFTER_SECONDS));
      expect(limited!.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(await limited!.json()).toEqual({ error: 'rate_limited' });
    });
  }

  it('does not trust the sessionId: a new session per request does not reset the budget', async () => {
    const { limiter, keys } = countingLimiter(3);
    const env = { PRODUCT_DB: new FakeDb(), EVENTS_RATE_LIMITER: limiter } as unknown as ProductEnv;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await handleProductRequest(post('/api/events', BODIES['/api/events']!()), env, ORIGIN))!.status);
    expect(statuses).toEqual([202, 202, 202, 429, 429]);
    expect(new Set(keys)).toEqual(new Set([`/api/events|${IP}`]));
    expect(keys.some((key) => key.includes('session_'))).toBe(false);
  });

  it('keeps separate budgets per address and per endpoint', async () => {
    const events = countingLimiter(1);
    const ratings = countingLimiter(1);
    const env = { PRODUCT_DB: new FakeDb(), EVENTS_RATE_LIMITER: events.limiter, RATINGS_RATE_LIMITER: ratings.limiter } as unknown as ProductEnv;
    expect((await handleProductRequest(post('/api/events', BODIES['/api/events']!()), env, ORIGIN))!.status).toBe(202);
    // Another address is not affected by the first one's budget.
    expect((await handleProductRequest(post('/api/events', BODIES['/api/events']!(), { 'CF-Connecting-IP': '198.51.100.4' }), env, ORIGIN))!.status).toBe(202);
    // Another endpoint uses its own limiter.
    expect((await handleProductRequest(post('/api/ratings', BODIES['/api/ratings']!()), env, ORIGIN))!.status).toBe(201);
    expect(events.limiter.limit).toHaveBeenCalledTimes(2);
    expect(ratings.limiter.limit).toHaveBeenCalledTimes(1);
  });

  it('never stores the address it limits on', async () => {
    const db = new FakeDb();
    const { limiter } = countingLimiter(10);
    const env = { PRODUCT_DB: db, EVENTS_RATE_LIMITER: limiter, RATINGS_RATE_LIMITER: limiter, FEEDBACK_RATE_LIMITER: limiter } as unknown as ProductEnv;
    for (const path of Object.keys(BODIES)) await handleProductRequest(post(path, BODIES[path]!()), env, ORIGIN);
    expect(db.writes.length).toBeGreaterThan(0);
    expect(JSON.stringify(db.writes)).not.toContain(IP);
  });

  it('shares one bucket for requests without a connecting address, and ignores an oversized header', () => {
    expect(clientAddressOf(new Request('https://w.example/'))).toBe('unknown');
    expect(clientAddressOf(new Request('https://w.example/', { headers: { 'CF-Connecting-IP': ` ${IP} ` } }))).toBe(IP);
    expect(clientAddressOf(new Request('https://w.example/', { headers: { 'CF-Connecting-IP': 'x'.repeat(65) } }))).toBe('unknown');
  });

  it('limits before the database check, so the budget holds without storage', async () => {
    const { limiter } = countingLimiter(1);
    const env = { EVENTS_RATE_LIMITER: limiter } as unknown as ProductEnv;
    expect((await handleProductRequest(post('/api/events', BODIES['/api/events']!()), env, ORIGIN))!.status).toBe(503);
    expect((await handleProductRequest(post('/api/events', BODIES['/api/events']!()), env, ORIGIN))!.status).toBe(429);
  });

  it('lets requests through when no limiter is bound or the limiter itself fails', async () => {
    const failing: RateLimiterLike = { limit: vi.fn(async () => { throw new Error('limiter down'); }) };
    for (const env of [
      { PRODUCT_DB: new FakeDb() },
      { PRODUCT_DB: new FakeDb(), EVENTS_RATE_LIMITER: failing },
    ]) {
      expect((await handleProductRequest(post('/api/events', BODIES['/api/events']!()), env as unknown as ProductEnv, ORIGIN))!.status).toBe(202);
    }
    expect(failing.limit).toHaveBeenCalledTimes(1);
  });

  it('is declared in wrangler.toml for all three endpoints', async () => {
    const { readFileSync } = await import('node:fs');
    const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    for (const name of ['EVENTS_RATE_LIMITER', 'RATINGS_RATE_LIMITER', 'FEEDBACK_RATE_LIMITER']) {
      expect(config).toMatch(new RegExp(`\\[\\[ratelimits\\]\\]\\s*\\nname = "${name}"`));
    }
  });
});

describe('analytics payload cap (S1 hardening)', () => {
  it('refuses a declared body over the cap before reading it', async () => {
    const env = { PRODUCT_DB: new FakeDb() } as unknown as ProductEnv;
    const request = post('/api/events', BODIES['/api/events']!(), { 'Content-Length': String(MAX_EVENT_BODY_BYTES + 1) });
    const response = await handleProductRequest(request, env, ORIGIN);
    expect(response!.status).toBe(413);
    expect(await response!.json()).toEqual({ error: 'payload_too_large' });
  });

  it('refuses an actual body over the cap and oversized properties', async () => {
    const db = new FakeDb();
    const env = { PRODUCT_DB: db } as unknown as ProductEnv;
    const huge = { ...BODIES['/api/events']!(), properties: { note: 'x'.repeat(MAX_EVENT_BODY_BYTES) } };
    expect((await handleProductRequest(post('/api/events', huge), env, ORIGIN))!.status).toBe(413);
    const large = { ...BODIES['/api/events']!(), properties: { note: 'x'.repeat(5_000) } };
    expect((await handleProductRequest(post('/api/events', large), env, ORIGIN))!.status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });

  it('still accepts a normal event and malformed JSON stays a 400', async () => {
    const env = { PRODUCT_DB: new FakeDb() } as unknown as ProductEnv;
    const normal = { ...BODIES['/api/events']!(), properties: { results: Array.from({ length: 5 }, (_, i) => ({ countryCode: 'FR', score: 80 - i })) } };
    expect((await handleProductRequest(post('/api/events', normal), env, ORIGIN))!.status).toBe(202);
    expect((await handleProductRequest(post('/api/events', '{bad'), env, ORIGIN))!.status).toBe(400);
  });
});

describe('verifyTurnstile (optional, fails closed once configured)', () => {
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('is skipped entirely while no secret is configured (today\'s state)', async () => {
    const fetchImpl = answer({ success: false });
    expect(await verifyTurnstile(null, undefined, fetchImpl)).toBe(true);
    expect(await verifyTurnstile('token', '', fetchImpl)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an absent token without calling the verifier', async () => {
    const fetchImpl = answer({ success: true });
    expect(await verifyTurnstile(null, 'secret', fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes only on success: true', async () => {
    expect(await verifyTurnstile('token', 'secret', answer({ success: true }))).toBe(true);
    expect(await verifyTurnstile('token', 'secret', answer({ success: false, 'error-codes': ['invalid-input-response'] }))).toBe(false);
    expect(await verifyTurnstile('token', 'secret', answer({ success: 'true' }))).toBe(false);
    expect(await verifyTurnstile('token', 'secret', answer({}))).toBe(false);
  });

  it('fails closed on a malformed answer, a non-2xx status and a network failure', async () => {
    expect(await verifyTurnstile('token', 'secret', answer('<html>not json</html>'))).toBe(false);
    expect(await verifyTurnstile('token', 'secret', answer('null'))).toBe(false);
    expect(await verifyTurnstile('token', 'secret', answer({ success: true }, 500))).toBe(false);
    const offline = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await verifyTurnstile('token', 'secret', offline)).toBe(false);
  });

  it('fails closed when the verifier does not answer in time', async () => {
    const hanging = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    })) as unknown as typeof fetch;
    const started = Date.now();
    expect(await verifyTurnstile('token', 'secret', hanging, 30)).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
    const init = (hanging as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('turns a failed challenge into 403 on ratings and feedback', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = answer({ success: false });
    try {
      const env = { PRODUCT_DB: new FakeDb(), TURNSTILE_SECRET_KEY: 'secret' } as unknown as ProductEnv;
      for (const path of ['/api/ratings', '/api/feedback']) {
        const response = await handleProductRequest(post(path, { ...BODIES[path]!(), turnstileToken: 'token' }), env, ORIGIN);
        expect(response!.status, path).toBe(403);
      }
    } finally {
      globalThis.fetch = original;
    }
  });
});
