// The private admin surface. What these tests exist to stop:
//   * an admin path reachable without credentials
//   * a bearer token bypassing Cloudflare Access once Access is configured
//   * an unverified Access JWT being trusted
//   * a filter value reaching SQL as anything other than a bound parameter
//   * any coordinate, IP or fingerprint appearing anywhere in analytics
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_KEYS_REFRESH_MIN_MS, ACCESS_KEYS_TTL_MS, authenticateAdmin, constantTimeEqual, handleAdminRequest, resetAccessKeyCache, verifyAccessJwt, type AdminEnv } from './admin';
import { FEEDBACK_STATUSES, parseFeedbackQuery, parseFilters } from './analytics';

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class FakeStatement {
  constructor(private db: FakeDb, private sql: string, private values: unknown[] = []) {}
  bind(...values: unknown[]) { return new FakeStatement(this.db, this.sql, values); }
  async run() { this.db.calls.push({ sql: this.sql, values: this.values }); return { success: true }; }
  async first<T>() { this.db.calls.push({ sql: this.sql, values: this.values }); return (this.db.firstRow ?? null) as T | null; }
  async all<T>() { this.db.calls.push({ sql: this.sql, values: this.values }); return { results: [] as T[] }; }
}
class FakeDb {
  calls: { sql: string; values: unknown[] }[] = [];
  firstRow: Record<string, unknown> | null = { count: 3, average: 4.2, id: 'row-1' };
  prepare(sql: string) { return new FakeStatement(this, sql); }
}

function env(overrides: Partial<AdminEnv> = {}): AdminEnv {
  return { PRODUCT_DB: new FakeDb() as never, ADMIN_TOKEN: 'fixture-admin-secret', ...overrides };
}

describe('admin authentication', () => {
  it('serves nothing at all when neither mechanism is configured — it never falls open', async () => {
    const result = await authenticateAdmin(new Request('https://w.dev/api/admin/analytics'), { PRODUCT_DB: new FakeDb() as never });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 503, error: 'admin_not_configured' });
  });

  it('rejects a missing, wrong or truncated bearer token', async () => {
    for (const header of [undefined, 'Bearer wrong', 'Bearer fixture-admin-secre', 'Bearer fixture-admin-secret-extra', 'fixture-admin-secret']) {
      const request = new Request('https://w.dev/api/admin/analytics', header ? { headers: { Authorization: header } } : undefined);
      const result = await authenticateAdmin(request, env());
      expect(result.ok, String(header)).toBe(false);
    }
  });

  it('accepts the exact token', async () => {
    const result = await authenticateAdmin(
      new Request('https://w.dev/api/admin/analytics', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      env(),
    );
    expect(result).toMatchObject({ ok: true, via: 'token' });
  });

  it('once Cloudflare Access is configured, a bearer token can no longer get in', async () => {
    const withAccess = env({ ADMIN_ACCESS_AUD: 'aud-tag', ADMIN_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com' });
    const result = await authenticateAdmin(
      new Request('https://w.dev/api/admin/analytics', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      withAccess,
      (async () => new Response('{}', { status: 200 })) as typeof fetch,
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('access_missing');
  });
});

describe('Cloudflare Access JWT verification', () => {
  beforeEach(() => resetAccessKeyCache());
  const teamDomain = 'team.cloudflareaccess.com';
  const audience = 'aud-tag';
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

  const certs = (async () => new Response(JSON.stringify({ keys: [] }), { status: 200 })) as typeof fetch;

  it('refuses a token that is absent or malformed', async () => {
    expect(await verifyAccessJwt(null, teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'missing' });
    expect(await verifyAccessJwt('not.a', teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('refuses an algorithm it cannot verify — including "none"', async () => {
    const jwt = `${encode({ alg: 'none', kid: 'k' })}.${encode({ aud: [audience], exp: 4102444800 })}.`;
    expect(await verifyAccessJwt(jwt, teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'unsupported_alg' });
  });

  it('refuses a token issued for a different application', async () => {
    const jwt = `${encode({ alg: 'RS256', kid: 'k' })}.${encode({ aud: ['someone-elses-app'], exp: 4102444800 })}.sig`;
    expect(await verifyAccessJwt(jwt, teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'audience' });
  });

  it('refuses an expired token', async () => {
    const jwt = `${encode({ alg: 'RS256', kid: 'k' })}.${encode({ aud: [audience], exp: 1000 })}.sig`;
    expect(await verifyAccessJwt(jwt, teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('refuses a well-formed token whose signing key is unknown — a decoded JWT is not a verified one', async () => {
    const jwt = `${encode({ alg: 'RS256', kid: 'unknown-key' })}.${encode({ aud: [audience], exp: 4102444800 })}.sig`;
    expect(await verifyAccessJwt(jwt, teamDomain, audience, certs)).toMatchObject({ ok: false, reason: 'unknown_key' });
  });

  it('refuses everything when the certificate endpoint cannot be reached', async () => {
    const failing = (async () => { throw new Error('offline'); }) as typeof fetch;
    const jwt = `${encode({ alg: 'RS256', kid: 'k' })}.${encode({ aud: [audience], exp: 4102444800 })}.sig`;
    expect(await verifyAccessJwt(jwt, teamDomain, audience, failing)).toMatchObject({ ok: false, reason: 'certs_unavailable' });
  });
});

describe('admin routing', () => {
  it('serves the dashboard shell unauthenticated, because it carries no data', async () => {
    const response = await handleAdminRequest(new Request('https://w.dev/admin'), env(), json);
    expect(response!.status).toBe(200);
    const html = await response!.text();
    expect(html).toContain('Wejhaty');
    // The shell must never embed data or a credential.
    expect(html).not.toContain('fixture-admin-secret');
    expect(response!.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response!.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(response!.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses every data path without credentials', async () => {
    for (const path of ['/api/admin/analytics', '/api/admin/summary', '/api/admin/feedback', '/api/admin/ratings']) {
      const response = await handleAdminRequest(new Request(`https://w.dev${path}`), env(), json);
      expect(response!.status, path).toBe(401);
    }
    const post = await handleAdminRequest(new Request('https://w.dev/api/admin/feedback/status', { method: 'POST', body: '{}' }), env(), json);
    expect(post!.status).toBe(401);
  });

  it('ignores paths that are not its own', async () => {
    expect(await handleAdminRequest(new Request('https://w.dev/api/events'), env(), json)).toBeNull();
    expect(await handleAdminRequest(new Request('https://w.dev/api/admin'), env(), json)).toBeNull();
  });

  it('answers the analytics path with every panel once authenticated', async () => {
    const response = await handleAdminRequest(
      new Request('https://w.dev/api/admin/analytics', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      env(), json,
    );
    expect(response!.status).toBe(200);
    const body = await response!.json() as Record<string, unknown>;
    for (const section of ['overview', 'trend', 'funnel', 'quality', 'countries', 'discovery', 'location', 'technical', 'content']) {
      expect(body, section).toHaveProperty(section);
    }
    expect(body.authenticatedVia).toBe('token');
  });

  it('keeps /api/admin/summary working as an alias so an old bookmark does not break', async () => {
    const response = await handleAdminRequest(
      new Request('https://w.dev/api/admin/summary', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      env(), json,
    );
    expect(response!.status).toBe(200);
    expect(await response!.json()).toHaveProperty('overview');
  });

  it('reports the database as unavailable rather than crashing', async () => {
    const response = await handleAdminRequest(
      new Request('https://w.dev/api/admin/analytics', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      { ADMIN_TOKEN: 'fixture-admin-secret' }, json,
    );
    expect(response!.status).toBe(503);
  });

  it('requires a JSON content type on the status update (Security Pass 2, S3)', async () => {
    const send = (headers: Record<string, string>, body = JSON.stringify({ referenceId: 'WJH-1', status: 'resolved' })) =>
      handleAdminRequest(new Request('https://w.dev/api/admin/feedback/status', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-admin-secret', ...headers },
        body,
      }), env(), json);

    // A cross-site form post arrives as a "simple" request without a
    // preflight; none of these may reach the update.
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonp']) {
      const response = await send({ 'Content-Type': contentType });
      expect(response!.status, contentType).toBe(415);
      expect(await response!.json()).toEqual({ error: 'unsupported_media_type' });
    }
    expect((await send({}))!.status).toBe(415);
    // Parameters and letter case do not matter; the media type does.
    expect([200, 404]).toContain((await send({ 'Content-Type': 'Application/JSON; charset=utf-8' }))!.status);
    // A JSON body that is not an object is a bad request, not a crash.
    for (const body of ['null', '[]', '"x"', '{bad']) {
      expect((await send({ 'Content-Type': 'application/json' }, body))!.status, body).toBe(400);
    }
  });

  it('only accepts a status from the allowed set', async () => {
    const post = (body: unknown) => handleAdminRequest(new Request('https://w.dev/api/admin/feedback/status', {
      method: 'POST',
      headers: { Authorization: 'Bearer fixture-admin-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), env(), json);

    expect((await post({ referenceId: 'WJH-1', status: 'deleted' }))!.status).toBe(400);
    expect((await post({ referenceId: '', status: 'resolved' }))!.status).toBe(400);
    for (const status of FEEDBACK_STATUSES) {
      const response = await post({ referenceId: 'WJH-1', status });
      expect([200, 404], status).toContain(response!.status);
    }
  });
});

describe('filter parsing — nothing arbitrary ever reaches SQL', () => {
  const parse = (query: string) => parseFilters(new URL(`https://w.dev/api/admin/analytics?${query}`));

  it('keeps well-formed values', () => {
    const filters = parse('from=2026-01-01&to=2026-02-01&locale=ar&device=mobile&purpose=tourism&country=JP&minRating=2&maxRating=4');
    expect(filters).toEqual({
      from: '2026-01-01', to: '2026-02-01', locale: 'ar', device: 'mobile',
      purpose: 'tourism', country: 'JP', minRating: 2, maxRating: 4,
    });
  });

  it('drops anything that is not on the whitelist, including injection attempts', () => {
    const filters = parse("from=' OR 1=1 --&locale=xx&device=watch&purpose=hacking&country=ZZZ&minRating=9");
    expect(filters).toEqual({
      from: null, to: null, locale: null, device: null,
      purpose: null, country: null, minRating: null, maxRating: null,
    });
  });

  it('still refuses the excluded country code here, like everywhere else', () => {
    expect(parse('country=IL').country).toBeNull();
  });

  it('bounds the feedback page size and offset', () => {
    const query = parseFeedbackQuery(new URL('https://w.dev/api/admin/feedback?limit=99999&offset=-5'));
    expect(query.limit).toBe(50);
    expect(query.offset).toBe(0);
  });

  it('only accepts a known feedback status as a filter', () => {
    expect(parseFeedbackQuery(new URL('https://w.dev/api/admin/feedback?status=nonsense')).status).toBeNull();
    expect(parseFeedbackQuery(new URL('https://w.dev/api/admin/feedback?status=resolved')).status).toBe('resolved');
  });
});

describe('privacy — enforced by what the SQL can even ask for', () => {
  it('never mentions a coordinate, an IP or a fingerprint in any analytics query', async () => {
    const db = new FakeDb();
    await handleAdminRequest(
      new Request('https://w.dev/api/admin/analytics', { headers: { Authorization: 'Bearer fixture-admin-secret' } }),
      env({ PRODUCT_DB: db as never }), json,
    );
    expect(db.calls.length).toBeGreaterThan(10);
    const forbidden = ['lat', 'lng', 'latitude', 'longitude', 'coordinate', 'ip_address', 'ipaddress', 'fingerprint', 'passport'];
    for (const call of db.calls) {
      const sql = call.sql.toLowerCase();
      for (const term of forbidden) {
        expect(sql.includes(term), `${term} in: ${call.sql.slice(0, 120)}`).toBe(false);
      }
    }
  });

  it('passes every filter value as a bound parameter, never as SQL text', async () => {
    const db = new FakeDb();
    await handleAdminRequest(
      new Request("https://w.dev/api/admin/analytics?country=JP&locale=ar&purpose=tourism&minRating=2", {
        headers: { Authorization: 'Bearer fixture-admin-secret' },
      }),
      env({ PRODUCT_DB: db as never }), json,
    );
    const bound = db.calls.some((call) => call.values.includes('JP') && call.values.includes('ar'));
    expect(bound).toBe(true);
    for (const call of db.calls) {
      expect(call.sql).not.toContain("'JP'");
      expect(call.sql).not.toContain("'tourism'");
    }
  });

  it('passes a search term as a bound LIKE parameter', async () => {
    const db = new FakeDb();
    await handleAdminRequest(
      new Request("https://w.dev/api/admin/feedback?q=%27%20OR%201%3D1%20--", {
        headers: { Authorization: 'Bearer fixture-admin-secret' },
      }),
      env({ PRODUCT_DB: db as never }), json,
    );
    const injected = db.calls.some((call) => call.sql.includes('OR 1=1'));
    expect(injected).toBe(false);
    const boundAsValue = db.calls.some((call) => call.values.some((value) => String(value).includes('OR 1=1')));
    expect(boundAsValue).toBe(true);
  });
});

describe('constant-time token comparison (Phase 20 security backlog)', () => {
  it('accepts only the exact secret and never throws on odd input', async () => {
    expect(await constantTimeEqual('fixture-admin-secret', 'fixture-admin-secret')).toBe(true);
    for (const presented of ['fixture-admin-secreT', 'fixture-admin-secret ', 'f', 'x'.repeat(4096), '', null]) {
      expect(await constantTimeEqual(presented, 'fixture-admin-secret'), String(presented)).toBe(false);
    }
    expect(await constantTimeEqual('anything', '')).toBe(false);
  });

  it('compares fixed-size digests, so a wrong-length token takes the same path as a wrong token', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest');
    await constantTimeEqual('short', 'fixture-admin-secret');
    await constantTimeEqual('fixture-admin-secreX', 'fixture-admin-secret');
    expect(digest).toHaveBeenCalledTimes(4);
    digest.mockRestore();
  });
});

describe('Access signing-key cache (Phase 20 security backlog)', () => {
  const teamDomain = 'cache.cloudflareaccess.com';
  const audience = 'aud-tag';
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const b64url = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

  async function signedToken(kid: string, now: number) {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify'],
    ) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey) as JsonWebKey;
    const header = encode({ alg: 'RS256', kid });
    const payload = encode({ aud: [audience], exp: Math.floor(now / 1000) + 3600, email: 'admin@example.com' });
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return { token: `${header}.${payload}.${b64url(signature)}`, key: { kid, kty: 'RSA', n: jwk.n, e: jwk.e } };
  }

  beforeEach(() => resetAccessKeyCache());

  it('verifies a genuine token and reuses the fetched keys within the TTL', async () => {
    const now = Date.now();
    const { token, key } = await signedToken('k1', now);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ keys: [key] }), { status: 200 })) as unknown as typeof fetch;
    expect(await verifyAccessJwt(token, teamDomain, audience, fetchImpl, now)).toEqual({ ok: true, subject: 'admin@example.com' });
    expect(await verifyAccessJwt(token, teamDomain, audience, fetchImpl, now + 5_000)).toEqual({ ok: true, subject: 'admin@example.com' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // After the TTL the keys are fetched again.
    await verifyAccessJwt(token, teamDomain, audience, fetchImpl, now + ACCESS_KEYS_TTL_MS + 1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refreshes once for a rotated key, but not faster than the minimum interval', async () => {
    const now = Date.now();
    const old = await signedToken('old', now);
    const rotated = await signedToken('new', now);
    let served = [old.key];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ keys: served }), { status: 200 })) as unknown as typeof fetch;
    expect((await verifyAccessJwt(old.token, teamDomain, audience, fetchImpl, now)).ok).toBe(true);
    served = [old.key, rotated.key];
    // Within the minimum interval an unknown key id does not reach upstream.
    expect(await verifyAccessJwt(rotated.token, teamDomain, audience, fetchImpl, now + 1_000)).toMatchObject({ ok: false, reason: 'unknown_key' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // After it, one refresh picks up the rotated key.
    expect((await verifyAccessJwt(rotated.token, teamDomain, audience, fetchImpl, now + ACCESS_KEYS_REFRESH_MIN_MS + 1)).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed key fetch', async () => {
    const now = Date.now();
    const { token, key } = await signedToken('k1', now);
    let fail = true;
    const fetchImpl = vi.fn(async () => (fail ? new Response('', { status: 500 }) : new Response(JSON.stringify({ keys: [key] }), { status: 200 }))) as unknown as typeof fetch;
    expect(await verifyAccessJwt(token, teamDomain, audience, fetchImpl, now)).toMatchObject({ ok: false, reason: 'certs_unavailable' });
    fail = false;
    expect((await verifyAccessJwt(token, teamDomain, audience, fetchImpl, now + 1)).ok).toBe(true);
  });
});
