// Phase 20 security backlog — behavior-neutral hardening: declared body-size
// ceilings, screenshot magic bytes, and the city-descriptions limiter.
import { describe, expect, it, vi } from 'vitest';
import { declaredBodyTooLarge, handleRequest, MAX_DECLARED_BODY_BYTES, type Env } from './index';
import { detectImageType, handleProductRequest, type ProductEnv, type RateLimiterLike } from './product';
import { handleCityDescriptionRequest } from './cityDescriptions';

const ORIGIN = 'https://hmooodzozo577-gif.github.io';
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('declared body-size ceilings', () => {
  it('refuses a declared body over each endpoint ceiling with 413, before any handler runs', async () => {
    for (const [path, ceiling] of Object.entries(MAX_DECLARED_BODY_BYTES)) {
      const request = new Request(`https://w.example${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'Content-Length': String(ceiling + 1) },
        body: '{}',
      });
      const response = await handleRequest(request, {} as Env);
      expect(response.status, path).toBe(413);
      expect(await response.json()).toEqual({ error: 'payload_too_large' });
      expect(response.headers.get('Access-Control-Allow-Origin'), path).toBe(path.startsWith('/api/admin/') ? null : ORIGIN);
    }
  });

  it('lets bodies at or under the ceiling, and paths without one, through', () => {
    const at = (path: string, length: number) => new Request(`https://w.example${path}`, { method: 'POST', headers: { 'Content-Length': String(length) }, body: '{}' });
    expect(declaredBodyTooLarge(at('/api/ratings', 32 * 1024), '/api/ratings')).toBe(false);
    expect(declaredBodyTooLarge(at('/api/ratings', 32 * 1024 + 1), '/api/ratings')).toBe(true);
    expect(declaredBodyTooLarge(at('/api/intelligence/SA/tourism', 10_000_000), '/api/intelligence/SA/tourism')).toBe(false);
    // The feedback ceiling fits the largest screenshot the form accepts.
    expect(MAX_DECLARED_BODY_BYTES['/api/feedback']).toBeGreaterThan(2_800_000 + 20_000);
  });
});

describe('screenshot magic bytes', () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 16];
  const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
  const dataUrl = (type: string, bytes: number[]) => `data:${type};base64,${btoa(String.fromCharCode(...bytes))}`;

  it('recognises only real PNG, JPEG and WebP signatures', () => {
    expect(detectImageType(new Uint8Array(png))).toBe('image/png');
    expect(detectImageType(new Uint8Array(jpeg))).toBe('image/jpeg');
    expect(detectImageType(new Uint8Array(webp))).toBe('image/webp');
    for (const bytes of [[0x3c, 0x73, 0x76, 0x67], [0x47, 0x49, 0x46, 0x38], [0x25, 0x50, 0x44, 0x46], [], [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]]) {
      expect(detectImageType(new Uint8Array(bytes))).toBeNull();
    }
  });

  async function submit(screenshotDataUrl: string) {
    const puts: { key: string; type: string }[] = [];
    const db = { prepare: () => ({ bind: () => ({ run: async () => ({}), first: async () => ({ count: 0 }), all: async () => ({ results: [] }) }) }) };
    const bucket = { put: vi.fn(async (key: string, _v: unknown, options: { httpMetadata: { contentType: string } }) => { puts.push({ key, type: options.httpMetadata.contentType }); }), delete: vi.fn() };
    const env = { PRODUCT_DB: db, FEEDBACK_SCREENSHOTS: bucket } as unknown as ProductEnv;
    const response = await handleProductRequest(new Request('https://w.example/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ sessionId: 'session_1234567890abcdef', type: 'bug', message: 'Screenshot attached.', path: '/explore', locale: 'en', screenshotDataUrl }),
    }), env, ORIGIN);
    return { status: response!.status, puts };
  }

  it('stores a real image under the type its bytes prove, and refuses a disguised non-image', async () => {
    expect(await submit(dataUrl('image/png', png))).toMatchObject({ status: 201, puts: [{ type: 'image/png' }] });
    // A PNG saved with a .jpg name is still accepted, as before — stored truthfully.
    const relabelled = await submit(dataUrl('image/jpeg', png));
    expect(relabelled.status).toBe(201);
    expect(relabelled.puts[0]).toMatchObject({ type: 'image/png' });
    expect(relabelled.puts[0]!.key).toMatch(/\.png$/);
    // Markup or any other file dressed up as an image is refused and never stored.
    const disguised = await submit(dataUrl('image/png', [...new TextEncoder().encode('<svg onload=alert(1)>')]));
    expect(disguised).toEqual({ status: 400, puts: [] });
  });
});

describe('city-descriptions limiter', () => {
  const post = () => new Request('https://w.example/api/cities/descriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
    body: JSON.stringify({ lang: 'en', countryCode: 'JP', cities: [{ name: 'Tokyo', title: 'Tokyo Tower' }] }),
  });

  it('answers 429 with Retry-After once the address is over budget, keyed on the address', async () => {
    const keys: string[] = [];
    let calls = 0;
    const limiter: RateLimiterLike = { limit: async ({ key }) => { keys.push(key); calls += 1; return { success: calls <= 1 }; } };
    expect((await handleCityDescriptionRequest(post(), { CITY_DESCRIPTIONS_RATE_LIMITER: limiter }, json))!.status).toBe(200);
    const limited = await handleCityDescriptionRequest(post(), { CITY_DESCRIPTIONS_RATE_LIMITER: limiter }, json);
    expect(limited!.status).toBe(429);
    expect(limited!.headers.get('Retry-After')).toBe('60');
    expect(keys).toEqual(['/api/cities/descriptions|203.0.113.9', '/api/cities/descriptions|203.0.113.9']);
  });

  it('lets requests through without a binding or when the limiter fails', async () => {
    expect((await handleCityDescriptionRequest(post(), {}, json))!.status).toBe(200);
    const failing: RateLimiterLike = { limit: async () => { throw new Error('down'); } };
    expect((await handleCityDescriptionRequest(post(), { CITY_DESCRIPTIONS_RATE_LIMITER: failing }, json))!.status).toBe(200);
  });

  it('is declared in wrangler.toml', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')).toMatch(/\[\[ratelimits\]\]\s*\nname = "CITY_DESCRIPTIONS_RATE_LIMITER"/);
  });
});
