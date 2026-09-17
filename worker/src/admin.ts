// The private admin surface: authentication, the analytics API, and the
// report workflow. The dashboard HTML lives in adminPage.ts.
//
// AUTHENTICATION — two independent mechanisms, strongest first:
//
//   1. Cloudflare Access. When ADMIN_ACCESS_AUD is set, the Worker requires
//      a Cloudflare Access JWT on every admin request and verifies its
//      signature against the team's public keys. Access does the identity
//      work (SSO, device posture, IP rules) in front of the Worker; this is
//      the "is it really Access, and really for this application" check that
//      stops someone pointing the Worker's hostname at their own tunnel.
//   2. ADMIN_TOKEN. A shared secret compared in constant time. Simpler, and
//      the only mechanism that works without a Cloudflare Zero Trust
//      account, so it stays supported.
//
// If NEITHER is configured the admin surface returns 503 and serves nothing.
// It never falls open.
//
// The token is a Worker secret. It is never in the frontend bundle, never in
// this repository, and never printed.
import type { D1DatabaseLike } from './product';
import {
  buildAnalytics,
  listFeedback,
  listRatings,
  parseFeedbackQuery,
  parseFilters,
  updateFeedbackStatus,
  FEEDBACK_STATUSES,
} from './analytics';
import { adminPage } from './adminPage';
import type { AIEnv } from './ai';

export interface AdminEnv extends AIEnv {
  PRODUCT_DB?: D1DatabaseLike;
  ADMIN_TOKEN?: string;
  /** Cloudflare Access application audience (AUD) tag. Setting it turns on
   *  Access enforcement. */
  ADMIN_ACCESS_AUD?: string;
  /** The Zero Trust team domain, e.g. "example.cloudflareaccess.com". */
  ADMIN_ACCESS_TEAM_DOMAIN?: string;
}

export type AdminAuth =
  | { ok: true; via: 'access' | 'token'; subject: string | null }
  | { ok: false; status: 401 | 503; error: string };

function constantTimeEqual(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function base64UrlToBytes(value: string): ArrayBuffer {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function decodeSegment(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    return null;
  }
}

interface AccessKey { kid?: unknown; kty?: unknown; alg?: unknown; n?: unknown; e?: unknown; use?: unknown }

/** Verifies a Cloudflare Access JWT: RS256 signature against the team's
 *  published keys, plus audience and expiry. A token that fails ANY of these
 *  is rejected — an unverified JWT is just an attacker-supplied string. */
export async function verifyAccessJwt(
  jwt: string | null,
  teamDomain: string,
  audience: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<{ ok: true; subject: string | null } | { ok: false; reason: string }> {
  if (!jwt) return { ok: false, reason: 'missing' };
  const parts = jwt.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const header = decodeSegment(parts[0]!);
  const payload = decodeSegment(parts[1]!);
  if (!header || !payload) return { ok: false, reason: 'malformed' };
  if (header.alg !== 'RS256') return { ok: false, reason: 'unsupported_alg' };

  const audiences = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === 'string' ? [payload.aud] : [];
  if (!audiences.includes(audience)) return { ok: false, reason: 'audience' };
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return { ok: false, reason: 'expired' };
  if (typeof payload.nbf === 'number' && payload.nbf * 1000 > now + 60_000) return { ok: false, reason: 'not_yet_valid' };

  let keys: AccessKey[];
  try {
    const response = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
    if (!response.ok) return { ok: false, reason: 'certs_unavailable' };
    const body = await response.json() as { keys?: AccessKey[] };
    keys = body.keys ?? [];
  } catch {
    return { ok: false, reason: 'certs_unavailable' };
  }

  const key = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!key || typeof key.n !== 'string' || typeof key.e !== 'string') return { ok: false, reason: 'unknown_key' };

  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, base64UrlToBytes(parts[2]!), signed);
    if (!valid) return { ok: false, reason: 'signature' };
  } catch {
    return { ok: false, reason: 'signature' };
  }

  const subject = typeof payload.email === 'string' ? payload.email : typeof payload.sub === 'string' ? payload.sub : null;
  return { ok: true, subject };
}

export async function authenticateAdmin(
  request: Request,
  env: AdminEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<AdminAuth> {
  const accessConfigured = !!env.ADMIN_ACCESS_AUD && !!env.ADMIN_ACCESS_TEAM_DOMAIN;
  if (!accessConfigured && !env.ADMIN_TOKEN) {
    return { ok: false, status: 503, error: 'admin_not_configured' };
  }

  if (accessConfigured) {
    // Access is in front, so Access decides. A bearer token must NOT be able
    // to bypass it — otherwise adding Access would weaken the surface.
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion')
      ?? request.headers.get('Cookie')?.match(/CF_Authorization=([^;]+)/)?.[1]
      ?? null;
    const verified = await verifyAccessJwt(jwt, env.ADMIN_ACCESS_TEAM_DOMAIN!, env.ADMIN_ACCESS_AUD!, fetchImpl);
    if (!verified.ok) return { ok: false, status: 401, error: `access_${verified.reason}` };
    return { ok: true, via: 'access', subject: verified.subject };
  }

  // The Bearer scheme is REQUIRED, not stripped-if-present: a bare secret in
  // the Authorization header is not a credential this endpoint accepts.
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1] ?? null;
  if (!constantTimeEqual(bearer, env.ADMIN_TOKEN!)) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true, via: 'token', subject: null };
}

const ADMIN_PATHS = new Set([
  '/api/admin/summary',
  '/api/admin/analytics',
  '/api/admin/feedback',
  '/api/admin/feedback/status',
  '/api/admin/ratings',
]);

export async function handleAdminRequest(
  request: Request,
  env: AdminEnv,
  json: (body: unknown, status: number) => Response,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === '/admin') {
    // The page itself carries no data and no secret; it asks for credentials
    // and then calls the API below. Serving it unauthenticated is what lets
    // a token holder log in at all.
    return request.method === 'GET' ? adminPage() : json({ error: 'method_not_allowed' }, 405);
  }
  if (!ADMIN_PATHS.has(url.pathname)) return null;

  const auth = await authenticateAdmin(request, env, fetchImpl);
  if (!auth.ok) {
    const response = json({ error: auth.error }, auth.status);
    if (auth.status === 401) response.headers.set('WWW-Authenticate', 'Bearer realm="wejhaty-admin"');
    return response;
  }
  if (!env.PRODUCT_DB) return json({ error: 'product_data_unavailable' }, 503);
  const db = env.PRODUCT_DB;
  const filters = parseFilters(url);

  if (url.pathname === '/api/admin/feedback/status') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }
    const referenceId = typeof body.referenceId === 'string' ? body.referenceId.slice(0, 64) : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : null;
    if (!referenceId || !(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
      return json({ error: 'invalid_request', allowed: FEEDBACK_STATUSES }, 400);
    }
    const updated = await updateFeedbackStatus(db, referenceId, status, note);
    return updated ? json({ updated: true, referenceId, status }, 200) : json({ error: 'not_found' }, 404);
  }

  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  if (url.pathname === '/api/admin/feedback') {
    return json(await listFeedback(db, filters, parseFeedbackQuery(url)), 200);
  }
  if (url.pathname === '/api/admin/ratings') {
    return json({ ratings: await listRatings(db, filters) }, 200);
  }

  // '/api/admin/summary' is kept as an alias of '/api/admin/analytics' so an
  // older bookmark or script does not break.
  const analytics = await buildAnalytics(db, filters, env);
  return json({ ...analytics, authenticatedVia: auth.via }, 200);
}
