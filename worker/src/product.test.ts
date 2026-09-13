import { describe, expect, it } from 'vitest';
import { handleProductRequest, runProductRetention, type ProductEnv } from './product';

class FakeStatement {
  constructor(private db: FakeDb, private sql: string, private values: unknown[] = []) {}
  bind(...values: unknown[]) { return new FakeStatement(this.db, this.sql, values); }
  async run() { this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true }; }
  async first<T>() {
    if (this.sql.includes('COUNT(*)')) return { count: this.db.feedbackCount } as T;
    return null;
  }
  async all<T>() { return { results: [] as T[] }; }
}

class FakeDb {
  writes: { sql: string; values: unknown[] }[] = [];
  feedbackCount = 0;
  prepare(sql: string) { return new FakeStatement(this, sql); }
}

const allowedOrigin = 'https://hmooodzozo577-gif.github.io';
const sessionId = 'session_1234567890abcdef';

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: allowedOrigin, ...headers },
    body: JSON.stringify(body),
  });
}

describe('anonymous product data endpoints', () => {
  it('stores an allow-listed event without exact location or fingerprint data', async () => {
    const db = new FakeDb();
    const env = { PRODUCT_DB: db } as unknown as ProductEnv;
    const response = await handleProductRequest(request('/api/events', {
      sessionId,
      name: 'page_view',
      path: '/explore',
      locale: 'ar',
      device: 'mobile',
      browser: 'Edge',
      referrerOrigin: 'https://example.com',
      properties: { theme: 'dark' },
    }), env, allowedOrigin);

    expect(response?.status).toBe(202);
    expect(db.writes.some((write) => write.sql.includes('INSERT INTO events'))).toBe(true);
  });

  it('rejects event properties containing precise coordinates or fingerprint fields', async () => {
    const env = { PRODUCT_DB: new FakeDb() } as unknown as ProductEnv;
    const response = await handleProductRequest(request('/api/events', {
      sessionId,
      name: 'location_permission',
      path: '/',
      locale: 'ar',
      properties: { latitude: 24.7, longitude: 46.6 },
    }), env, allowedOrigin);
    expect(response?.status).toBe(400);
  });

  it('validates ratings before persistence', async () => {
    const env = { PRODUCT_DB: new FakeDb() } as unknown as ProductEnv;
    const response = await handleProductRequest(request('/api/ratings', {
      sessionId,
      overallScore: 9,
      reasons: [],
      countryVotes: [],
      resultContext: [],
    }), env, allowedOrigin);
    expect(response?.status).toBe(400);
  });

  it('accepts a valid anonymous result rating', async () => {
    const db = new FakeDb();
    const env = { PRODUCT_DB: db } as unknown as ProductEnv;
    const response = await handleProductRequest(request('/api/ratings', {
      sessionId,
      overallScore: 4,
      reasons: ['relevant'],
      countryVotes: [{ countryCode: 'JP', useful: true }],
      resultContext: [{ countryCode: 'JP', score: 91 }],
    }), env, allowedOrigin);
    expect(response?.status).toBe(201);
    expect(db.writes.some((write) => write.sql.includes('INSERT INTO ratings'))).toBe(true);
  });

  it('rate-limits feedback by anonymous session and validates optional email', async () => {
    const db = new FakeDb();
    db.feedbackCount = 5;
    const env = { PRODUCT_DB: db } as unknown as ProductEnv;
    const response = await handleProductRequest(request('/api/feedback', {
      sessionId,
      type: 'bug',
      message: 'There is a problem on this page.',
      email: 'person@example.com',
      path: '/explore',
      locale: 'en',
    }), env, allowedOrigin);
    expect(response?.status).toBe(429);
  });

  it('keeps admin summaries private behind the configured bearer secret', async () => {
    const env = { PRODUCT_DB: new FakeDb(), ADMIN_TOKEN: 'fixture-admin-secret' } as unknown as ProductEnv;
    const denied = await handleProductRequest(new Request('https://worker.example/api/admin/summary'), env, null);
    expect(denied?.status).toBe(401);
    const allowed = await handleProductRequest(new Request('https://worker.example/api/admin/summary', {
      headers: { Authorization: 'Bearer fixture-admin-secret' },
    }), env, null);
    expect(allowed?.status).toBe(200);
  });

  it('aggregates before deleting raw data older than 90 days', async () => {
    const db = new FakeDb();
    const deleted: string[] = [];
    const screenshots = { delete: async (keys: string | string[]) => { deleted.push(...(Array.isArray(keys) ? keys : [keys])); } };
    await runProductRetention({ PRODUCT_DB: db, FEEDBACK_SCREENSHOTS: screenshots } as unknown as ProductEnv);
    expect(db.writes[0]!.sql).toContain('INSERT INTO daily_metrics');
    expect(db.writes.some((write) => write.sql.includes("DELETE FROM events") && write.sql.includes("-90 days"))).toBe(true);
    expect(db.writes.some((write) => write.sql.includes('email = NULL') && write.sql.includes("device_json = '{}'"))).toBe(true);
    expect(deleted).toEqual([]);
  });
});
