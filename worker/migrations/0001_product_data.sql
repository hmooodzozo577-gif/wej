PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  device_class TEXT,
  browser_family TEXT,
  referrer_origin TEXT,
  edge_country TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  country_code TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS events_name_idx ON events(name, occurred_at);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  reasons_json TEXT NOT NULL DEFAULT '[]',
  country_votes_json TEXT NOT NULL DEFAULT '[]',
  result_context_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS ratings_created_idx ON ratings(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  country_code TEXT,
  path TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  device_json TEXT NOT NULL DEFAULT '{}',
  screenshot_key TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS feedback_session_idx ON feedback(session_id, created_at);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback(status, created_at);

CREATE TABLE IF NOT EXISTS daily_metrics (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  dimension TEXT NOT NULL DEFAULT '',
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, metric, dimension)
);
