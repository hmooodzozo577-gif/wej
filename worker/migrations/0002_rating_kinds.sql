-- Item #13 — two levels of rating feedback.
--
-- Before this, `ratings` held exactly one shape: an overall 1-5 score for a
-- results page, plus per-country "useful / not useful" votes. The acceptance
-- round replaced that model:
--   * the results page keeps the 1-5 score and gains an optional free-text
--     comment; the useful/not-useful votes are gone
--   * every destination page gains its own 1-5 score and optional comment
--
-- Additive only: existing rows keep their meaning and default to
-- kind = 'results'. country_votes_json is left in place rather than dropped,
-- so historical rows stay readable; nothing writes to it any more.
ALTER TABLE ratings ADD COLUMN kind TEXT NOT NULL DEFAULT 'results';
ALTER TABLE ratings ADD COLUMN comment TEXT;
ALTER TABLE ratings ADD COLUMN country_code TEXT;
-- How the traveller reached the destination page they are rating
-- ('results', 'explore', 'surprise', 'direct'). Context only — never a
-- precise location, never anything identifying.
ALTER TABLE ratings ADD COLUMN origin TEXT;

CREATE INDEX IF NOT EXISTS ratings_kind_idx ON ratings(kind);
CREATE INDEX IF NOT EXISTS ratings_country_idx ON ratings(country_code);
