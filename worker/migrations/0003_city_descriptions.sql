-- Acceptance item #3 — cache for city descriptions fetched from Wikipedia's
-- public REST summary API by the Worker (see src/cityDescriptions.ts).
--
-- This is a CACHE of third-party content, not product data about anyone. It
-- holds no session, no traveller, and no coordinate: the coordinate check
-- that proves an article is about the right city happens in the Worker
-- against a generated table, and only its verdict is stored.
--
-- `status` records WHY a city has no description, so the admin dashboard can
-- report real coverage instead of a blank, and so a miss is not re-fetched
-- on every page view.
CREATE TABLE IF NOT EXISTS city_descriptions (
  city_key TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('ar', 'en')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'no_article', 'ambiguous', 'wrong_place', 'too_short', 'unavailable')),
  summary TEXT,
  source TEXT,
  source_url TEXT,
  license TEXT,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS city_descriptions_country_idx ON city_descriptions(country_code, lang);
CREATE INDEX IF NOT EXISTS city_descriptions_status_idx ON city_descriptions(status);
