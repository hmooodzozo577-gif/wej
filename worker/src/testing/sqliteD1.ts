// Test-only: a D1DatabaseLike over Node's built-in SQLite, with every
// migration in ../../migrations applied, so admin analytics SQL is checked
// against the real schema instead of a hand-written fake. Never imported by
// the Worker itself (index.ts), so it is not part of the deployed bundle.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1DatabaseLike, D1Statement } from '../product';

type SqlValue = string | number | bigint | null | Uint8Array;

export interface SqliteD1 {
  db: D1DatabaseLike;
  raw: DatabaseSync;
}

export function createSqliteD1(): SqliteD1 {
  const raw = new DatabaseSync(':memory:');
  const dir = new URL('../../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    raw.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  const db: D1DatabaseLike = {
    prepare(sql: string): D1Statement {
      const statement = raw.prepare(sql);
      let params: SqlValue[] = [];
      const api: D1Statement = {
        bind(...values: unknown[]) {
          params = values.map((value) => (value === undefined ? null : typeof value === 'boolean' ? Number(value) : value)) as SqlValue[];
          return api;
        },
        async run() {
          return statement.run(...params);
        },
        async first<T>() {
          return (statement.get(...params) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: statement.all(...params) as T[], success: true };
        },
      };
      return api;
    },
  };
  return { db, raw };
}

let sequence = 0;
const nextId = () => `t-${(sequence += 1)}`;

/** Seeds one anonymous session and returns helpers that add its events. */
export function seedSession(
  raw: DatabaseSync,
  sessionId: string,
  options: { at?: string; locale?: 'ar' | 'en'; device?: string; browser?: string; edgeCountry?: string | null } = {},
) {
  const at = options.at ?? '2026-09-20T10:00:00.000Z';
  raw.prepare(`INSERT INTO sessions (session_id, first_seen_at, last_seen_at, locale, device_class, browser_family, referrer_origin, edge_country)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`).run(sessionId, at, at, options.locale ?? 'ar', options.device ?? 'mobile', options.browser ?? 'chrome', options.edgeCountry ?? 'SA');
  let clock = Date.parse(at);
  const event = (name: string, properties: Record<string, unknown> = {}, extra: { path?: string; country?: string | null } = {}) => {
    clock += 1000;
    const occurredAt = new Date(clock).toISOString();
    raw.prepare(`INSERT INTO events (id, session_id, occurred_at, name, path, country_code, properties_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nextId(), sessionId, occurredAt, name, extra.path ?? '/', extra.country ?? null, JSON.stringify(properties));
    raw.prepare('UPDATE sessions SET last_seen_at = ? WHERE session_id = ?').run(occurredAt, sessionId);
    return occurredAt;
  };
  return { event };
}
