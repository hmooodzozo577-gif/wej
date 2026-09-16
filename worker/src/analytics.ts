// The private product-analytics layer behind /admin.
//
// Everything here reads the anonymous product data the app already sends —
// an opaque random session id, an event name, a path, a country code, a
// coarse device class, a browser family, a locale. There is no identity
// layer to join against and none is built here.
//
// PRIVACY, enforced rather than promised:
//   * no query in this file reads, aggregates or returns a coordinate. The
//     schema has no coordinate column, the ingestion path rejects one (see
//     product.ts FORBIDDEN_KEYS), and analytics.privacy.test.ts asserts that
//     no SQL text here mentions one.
//   * `edge_country` is the coarse country Cloudflare attaches at the edge.
//     It is the ONLY geography in this file, it is country-level, and it is
//     never combined with anything that could narrow it.
//   * no raw IP, no fingerprint, no passport, no inferred trait.
//   * free text (a rating comment, a report message) is shown to the
//     operator because they asked for it; it is never mined or classified.
import type { D1DatabaseLike } from './product';

export interface AnalyticsFilters {
  from: string | null;
  to: string | null;
  locale: 'ar' | 'en' | null;
  device: string | null;
  purpose: string | null;
  country: string | null;
  minRating: number | null;
  maxRating: number | null;
}

const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const PURPOSES = new Set(['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
export const FEEDBACK_STATUSES = ['new', 'triaged', 'in_progress', 'resolved', 'declined'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Whitelist-parses the query string. Anything unrecognised becomes null, so
 *  no caller-supplied text ever reaches SQL as anything but a bound value. */
export function parseFilters(url: URL): AnalyticsFilters {
  const raw = (key: string) => url.searchParams.get(key)?.trim() || null;
  const rating = (key: string) => {
    const value = Number(raw(key));
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  };
  const from = raw('from');
  const to = raw('to');
  const locale = raw('locale');
  const device = raw('device');
  const purpose = raw('purpose');
  const country = raw('country');
  return {
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
    locale: locale === 'ar' || locale === 'en' ? locale : null,
    device: device && DEVICES.has(device) ? device : null,
    purpose: purpose && PURPOSES.has(purpose) ? purpose : null,
    country: country && COUNTRY_RE.test(country) && country !== 'IL' ? country : null,
    minRating: rating('minRating'),
    maxRating: rating('maxRating'),
  };
}

/** The set of sessions the current filters select, as a bindable subquery.
 *  Every panel scopes to it, so one filter bar means the same thing
 *  everywhere instead of each panel inventing its own definition. */
function sessionScope(filters: AnalyticsFilters): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.from) { where.push('s.last_seen_at >= ?'); params.push(`${filters.from}T00:00:00.000Z`); }
  if (filters.to) { where.push('s.first_seen_at <= ?'); params.push(`${filters.to}T23:59:59.999Z`); }
  if (filters.locale) { where.push('s.locale = ?'); params.push(filters.locale); }
  if (filters.device) { where.push('s.device_class = ?'); params.push(filters.device); }
  if (filters.purpose) {
    where.push("EXISTS (SELECT 1 FROM events e WHERE e.session_id = s.session_id AND e.name = 'quiz_started' AND json_extract(e.properties_json, '$.purpose') = ?)");
    params.push(filters.purpose);
  }
  if (filters.country) {
    where.push('EXISTS (SELECT 1 FROM events e WHERE e.session_id = s.session_id AND e.country_code = ?)');
    params.push(filters.country);
  }
  if (filters.minRating !== null) {
    where.push('EXISTS (SELECT 1 FROM ratings r WHERE r.session_id = s.session_id AND r.overall_score >= ?)');
    params.push(filters.minRating);
  }
  if (filters.maxRating !== null) {
    where.push('EXISTS (SELECT 1 FROM ratings r WHERE r.session_id = s.session_id AND r.overall_score <= ?)');
    params.push(filters.maxRating);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  return { sql: `SELECT s.session_id FROM sessions s${clause}`, params };
}

/** A time window on a table's own timestamp column, on top of the session
 *  scope — so "last 7 days" means the events in those days, not every event
 *  a session that was active in those days ever produced. */
function timeWindow(column: string, filters: AnalyticsFilters): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (filters.from) { parts.push(`${column} >= ?`); params.push(`${filters.from}T00:00:00.000Z`); }
  if (filters.to) { parts.push(`${column} <= ?`); params.push(`${filters.to}T23:59:59.999Z`); }
  return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', params };
}

interface Scoped { scope: string; scopeParams: unknown[]; window: string; windowParams: unknown[] }

function scopedFor(column: string, filters: AnalyticsFilters): Scoped {
  const scope = sessionScope(filters);
  const window = timeWindow(column, filters);
  return { scope: scope.sql, scopeParams: scope.params, window: window.sql, windowParams: window.params };
}

async function rows<T = Record<string, unknown>>(db: D1DatabaseLike, sql: string, params: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

async function one<T = Record<string, unknown>>(db: D1DatabaseLike, sql: string, params: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ---------------------------------------------------------------- overview

export async function buildOverview(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const r = scopedFor('created_at', filters);
  const eventCount = async (name: string) => number((await one<{ count: number }>(db,
    `SELECT COUNT(*) AS count FROM events WHERE name = ? AND session_id IN (${e.scope})${e.window}`,
    [name, ...e.scopeParams, ...e.windowParams]))?.count);
  const sessionsWith = async (name: string) => number((await one<{ count: number }>(db,
    `SELECT COUNT(DISTINCT session_id) AS count FROM events WHERE name = ? AND session_id IN (${e.scope})${e.window}`,
    [name, ...e.scopeParams, ...e.windowParams]))?.count);

  const [sessions, visits, starts, completions, resultsViewed, feedbackCount, rating] = await Promise.all([
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM (${scopedFor('last_seen_at', filters).scope})`, sessionScope(filters).params),
    eventCount('page_view'),
    sessionsWith('quiz_started'),
    sessionsWith('quiz_results_generated'),
    one<{ count: number }>(db,
      `SELECT COUNT(*) AS count FROM events WHERE name = 'page_view' AND path = '/results' AND session_id IN (${e.scope})${e.window}`,
      [...e.scopeParams, ...e.windowParams]),
    one<{ count: number }>(db,
      `SELECT COUNT(*) AS count FROM feedback WHERE session_id IN (${r.scope})${r.window}`,
      [...r.scopeParams, ...r.windowParams]),
    one<{ count: number; average: number }>(db,
      `SELECT COUNT(*) AS count, ROUND(AVG(overall_score), 2) AS average FROM ratings WHERE session_id IN (${r.scope})${r.window}`,
      [...r.scopeParams, ...r.windowParams]),
  ]);

  const startCount = starts;
  return {
    sessions: number(sessions?.count),
    visits,
    questionnaireStarts: startCount,
    questionnaireCompletions: completions,
    completionRate: startCount > 0 ? Math.round((completions / startCount) * 1000) / 10 : null,
    resultsViewed: number(resultsViewed?.count),
    feedbackCount: number(feedbackCount?.count),
    ratingCount: number(rating?.count),
    averageRating: rating?.average ?? null,
  };
}

// ------------------------------------------------------------------ funnel

export async function buildFunnel(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  const [byQuestion, lastQuestion, checkpoint, purposes, answered] = await Promise.all([
    rows(db, `SELECT json_extract(properties_json, '$.questionNumber') AS questionNumber,
        COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
      GROUP BY questionNumber ORDER BY questionNumber`, base),
    rows(db, `SELECT lastQuestion, COUNT(*) AS sessions FROM (
        SELECT session_id, MAX(CAST(json_extract(properties_json, '$.questionNumber') AS INTEGER)) AS lastQuestion
        FROM events WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
        GROUP BY session_id
      ) WHERE session_id NOT IN (
        SELECT session_id FROM events WHERE name = 'quiz_results_generated'
      ) GROUP BY lastQuestion ORDER BY lastQuestion`, base),
    rows(db, `SELECT json_extract(properties_json, '$.choice') AS choice, COUNT(*) AS count
      FROM events WHERE name = 'quiz_checkpoint_choice' AND session_id IN (${e.scope})${e.window}
      GROUP BY choice ORDER BY count DESC`, base),
    rows(db, `SELECT json_extract(properties_json, '$.purpose') AS purpose, COUNT(*) AS count
      FROM events WHERE name = 'quiz_started' AND session_id IN (${e.scope})${e.window}
      GROUP BY purpose ORDER BY count DESC`, base),
    one<{ average: number }>(db, `SELECT ROUND(AVG(answers), 1) AS average FROM (
        SELECT session_id, COUNT(*) AS answers FROM events
        WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
        GROUP BY session_id)`, base),
  ]);

  return {
    byQuestion,
    abandonedAtQuestion: lastQuestion,
    checkpointChoice: checkpoint,
    purposeDistribution: purposes,
    averageQuestionsAnswered: answered?.average ?? null,
  };
}

// --------------------------------------------------------------- quality

export async function buildQuality(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const r = scopedFor('created_at', filters);
  const base = [...r.scopeParams, ...r.windowParams];

  const [distribution, byKind, negativeComments, countryRatings, poorSets, pathContext] = await Promise.all([
    rows(db, `SELECT overall_score AS score, COUNT(*) AS count FROM ratings
      WHERE session_id IN (${r.scope})${r.window} GROUP BY overall_score ORDER BY overall_score`, base),
    rows(db, `SELECT kind, COUNT(*) AS count, ROUND(AVG(overall_score), 2) AS average FROM ratings
      WHERE session_id IN (${r.scope})${r.window} GROUP BY kind`, base),
    rows(db, `SELECT created_at, kind, overall_score AS score, country_code, origin, comment, reasons_json
      FROM ratings WHERE overall_score <= 2 AND comment IS NOT NULL AND comment <> ''
        AND session_id IN (${r.scope})${r.window}
      ORDER BY created_at DESC LIMIT 100`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count, ROUND(AVG(overall_score), 2) AS average
      FROM ratings WHERE kind = 'destination' AND country_code IS NOT NULL
        AND session_id IN (${r.scope})${r.window}
      GROUP BY country_code ORDER BY average ASC, count DESC LIMIT 40`, base),
    rows(db, `SELECT created_at, overall_score AS score, result_context_json, comment
      FROM ratings WHERE kind = 'results' AND overall_score <= 2
        AND session_id IN (${r.scope})${r.window}
      ORDER BY created_at DESC LIMIT 50`, base),
    // The questionnaire path behind a poor rating, WITHOUT identifying
    // anyone: the purpose and how many questions were answered, nothing else.
    rows(db, `SELECT rating.overall_score AS score,
        (SELECT json_extract(e.properties_json, '$.purpose') FROM events e
          WHERE e.session_id = rating.session_id AND e.name = 'quiz_started' LIMIT 1) AS purpose,
        (SELECT COUNT(*) FROM events e WHERE e.session_id = rating.session_id AND e.name = 'quiz_answer') AS answers
      FROM ratings rating WHERE rating.kind = 'results'
        AND rating.session_id IN (${r.scope})${r.window}`, base),
  ]);

  return { distribution, byKind, negativeComments, countryRatings, poorResultSets: poorSets, pathContext };
}

// --------------------------------------------------------------- countries

export async function buildCountries(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  const [recommended, opened, bySource, surpriseShown, surpriseOpened, countryFeedback] = await Promise.all([
    // json_each over the top-5 recommendation set each completion produced.
    rows(db, `SELECT json_extract(item.value, '$.countryCode') AS country_code, COUNT(*) AS count
      FROM events, json_each(json_extract(events.properties_json, '$.results')) AS item
      WHERE events.name = 'quiz_results_generated' AND events.session_id IN (${e.scope})${e.window.replaceAll('occurred_at', 'events.occurred_at')}
      GROUP BY country_code ORDER BY count DESC`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM events
      WHERE name = 'destination_opened' AND country_code IS NOT NULL AND session_id IN (${e.scope})${e.window}
      GROUP BY country_code ORDER BY count DESC LIMIT 60`, base),
    rows(db, `SELECT json_extract(properties_json, '$.source') AS source, COUNT(*) AS count FROM events
      WHERE name = 'destination_opened' AND session_id IN (${e.scope})${e.window}
      GROUP BY source ORDER BY count DESC`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM events
      WHERE name = 'surprise_result' AND country_code IS NOT NULL AND session_id IN (${e.scope})${e.window}
      GROUP BY country_code ORDER BY count DESC LIMIT 60`, base),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM events
      WHERE name = 'destination_opened' AND json_extract(properties_json, '$.source') = 'surprise'
        AND session_id IN (${e.scope})${e.window}`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM feedback
      WHERE country_code IS NOT NULL AND session_id IN (${scopedFor('created_at', filters).scope})
      GROUP BY country_code ORDER BY count DESC LIMIT 40`, sessionScope(filters).params),
  ]);

  return {
    mostRecommended: recommended.slice(0, 30),
    // "Least recommended" among countries that WERE recommended at least
    // once. Countries that never appear at all are the `neverRecommended`
    // count the dashboard shows separately, computed client-side against
    // the catalog size, because this table only knows what happened.
    leastRecommended: [...recommended].reverse().slice(0, 30),
    recommendedCountryCount: recommended.length,
    mostOpened: opened,
    openedBySource: bySource,
    surpriseShown,
    surpriseOpened: number(surpriseOpened?.count),
    countryFeedback,
  };
}

// --------------------------------------------------------------- discovery

export async function buildDiscovery(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  const [search, filtersUsed, sortUsed, regionUsed, resets, surpriseSpins] = await Promise.all([
    one<{ total: number; used: number }>(db, `SELECT COUNT(*) AS total,
        SUM(CASE WHEN json_extract(properties_json, '$.used') IN (1, 'true') THEN 1 ELSE 0 END) AS used
      FROM events WHERE name = 'explore_search' AND session_id IN (${e.scope})${e.window}`, base),
    rows(db, `SELECT json_extract(properties_json, '$.filter') AS filter, COUNT(*) AS count
      FROM events WHERE name = 'explore_filter_changed' AND session_id IN (${e.scope})${e.window}
      GROUP BY filter ORDER BY count DESC`, base),
    rows(db, `SELECT json_extract(properties_json, '$.value') AS value, COUNT(*) AS count
      FROM events WHERE name = 'explore_filter_changed' AND json_extract(properties_json, '$.filter') = 'sort'
        AND session_id IN (${e.scope})${e.window}
      GROUP BY value ORDER BY count DESC`, base),
    rows(db, `SELECT json_extract(properties_json, '$.value') AS value, COUNT(*) AS count
      FROM events WHERE name = 'explore_filter_changed' AND json_extract(properties_json, '$.filter') = 'region'
        AND session_id IN (${e.scope})${e.window}
      GROUP BY value ORDER BY count DESC`, base),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM events
      WHERE name = 'explore_filters_reset' AND session_id IN (${e.scope})${e.window}`, base),
    one<{ count: number; sessions: number }>(db, `SELECT COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'surprise_spin' AND session_id IN (${e.scope})${e.window}`, base),
  ]);

  const distanceSorts = sortUsed.filter((row) => row.value === 'nearest' || row.value === 'farthest');
  return {
    searchEvents: number(search?.total),
    searchWithText: number(search?.used),
    filtersUsed,
    sortUsed,
    regionUsed,
    distanceSortUsed: distanceSorts,
    filterResets: number(resets?.count),
    surpriseSpins: number(surpriseSpins?.count),
    surpriseSessions: number(surpriseSpins?.sessions),
  };
}

// ---------------------------------------------------------------- location

export async function buildLocation(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  // Nothing here is finer than a country, and nothing here is a coordinate.
  const [permission, outcomes, stageOutcomes, edgeCountries, enabled] = await Promise.all([
    rows(db, `SELECT json_extract(properties_json, '$.outcome') AS outcome, COUNT(*) AS count
      FROM events WHERE name = 'location_permission' AND session_id IN (${e.scope})${e.window}
      GROUP BY outcome ORDER BY count DESC`, base),
    rows(db, `SELECT json_extract(properties_json, '$.outcome') AS outcome, COUNT(*) AS count,
        ROUND(AVG(CAST(json_extract(properties_json, '$.totalMs') AS INTEGER))) AS averageMs
      FROM events WHERE name = 'location_request_outcome' AND session_id IN (${e.scope})${e.window}
      GROUP BY outcome ORDER BY count DESC`, base),
    rows(db, `SELECT json_extract(stage.value, '$.outcome') AS outcome,
        json_extract(stage.value, '$.highAccuracy') AS highAccuracy, COUNT(*) AS count
      FROM events, json_each(json_extract(events.properties_json, '$.stages')) AS stage
      WHERE events.name = 'location_request_outcome' AND events.session_id IN (${e.scope})${e.window.replaceAll('occurred_at', 'events.occurred_at')}
      GROUP BY outcome, highAccuracy ORDER BY count DESC`, base),
    rows(db, `SELECT edge_country AS country, COUNT(*) AS count FROM sessions
      WHERE edge_country IS NOT NULL AND session_id IN (${e.scope})
      GROUP BY edge_country ORDER BY count DESC LIMIT 40`, e.scopeParams),
    one<{ granted: number; total: number }>(db, `SELECT
        COUNT(DISTINCT CASE WHEN json_extract(properties_json, '$.outcome') = 'ok' THEN session_id END) AS granted,
        COUNT(DISTINCT session_id) AS total
      FROM events WHERE name = 'location_request_outcome' AND session_id IN (${e.scope})${e.window}`, base),
  ]);

  return {
    permission,
    requestOutcomes: outcomes,
    stageOutcomes,
    edgeCountries,
    sessionsThatAsked: number(enabled?.total),
    sessionsThatGranted: number(enabled?.granted),
  };
}

// --------------------------------------------------------------- technical

export async function buildTechnical(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];
  const scope = sessionScope(filters);

  const [errors, performance, browsers, devices, locales, themes, referrers] = await Promise.all([
    rows(db, `SELECT json_extract(properties_json, '$.kind') AS kind,
        json_extract(properties_json, '$.script') AS script, COUNT(*) AS count
      FROM events WHERE name = 'client_error' AND session_id IN (${e.scope})${e.window}
      GROUP BY kind, script ORDER BY count DESC LIMIT 40`, base),
    one(db, `SELECT COUNT(*) AS samples,
        ROUND(AVG(CAST(json_extract(properties_json, '$.ttfbMs') AS INTEGER))) AS ttfbMs,
        ROUND(AVG(CAST(json_extract(properties_json, '$.domReadyMs') AS INTEGER))) AS domReadyMs,
        ROUND(AVG(CAST(json_extract(properties_json, '$.loadMs') AS INTEGER))) AS loadMs
      FROM events WHERE name = 'page_performance' AND session_id IN (${e.scope})${e.window}`, base),
    rows(db, `SELECT browser_family AS browser, COUNT(*) AS count FROM sessions
      WHERE session_id IN (${scope.sql}) GROUP BY browser_family ORDER BY count DESC`, scope.params),
    rows(db, `SELECT device_class AS device, COUNT(*) AS count FROM sessions
      WHERE session_id IN (${scope.sql}) GROUP BY device_class ORDER BY count DESC`, scope.params),
    rows(db, `SELECT locale, COUNT(*) AS count FROM sessions
      WHERE session_id IN (${scope.sql}) GROUP BY locale ORDER BY count DESC`, scope.params),
    rows(db, `SELECT json_extract(properties_json, '$.theme') AS theme, COUNT(*) AS count
      FROM events WHERE name = 'page_view' AND session_id IN (${e.scope})${e.window}
      GROUP BY theme ORDER BY count DESC`, base),
    rows(db, `SELECT referrer_origin AS referrer, COUNT(*) AS count FROM sessions
      WHERE referrer_origin IS NOT NULL AND session_id IN (${scope.sql})
      GROUP BY referrer_origin ORDER BY count DESC LIMIT 20`, scope.params),
  ]);

  return { errors, performance, browsers, devices, locales, themes, referrers };
}

// ----------------------------------------------------------------- content

/** Acceptance item #3 — real city-description coverage, straight from the
 *  cache table, so the dashboard reports what exists instead of a claim. */
export async function buildContent(db: D1DatabaseLike) {
  try {
    const [byStatus, byLang, countries] = await Promise.all([
      rows(db, 'SELECT status, COUNT(*) AS count FROM city_descriptions GROUP BY status ORDER BY count DESC', []),
      rows(db, `SELECT lang, COUNT(*) AS count,
          SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS verified
        FROM city_descriptions GROUP BY lang`, []),
      one<{ countries: number }>(db, 'SELECT COUNT(DISTINCT country_code) AS countries FROM city_descriptions', []),
    ]);
    return { byStatus, byLang, countriesSeen: number(countries?.countries), available: true };
  } catch {
    // The table arrives with migration 0003; an older database simply has
    // no coverage to report yet.
    return { byStatus: [], byLang: [], countriesSeen: 0, available: false };
  }
}

// ---------------------------------------------------------------- feedback

export interface FeedbackQuery { q: string | null; status: string | null; type: string | null; limit: number; offset: number }

export function parseFeedbackQuery(url: URL): FeedbackQuery {
  const raw = (key: string) => url.searchParams.get(key)?.trim() || null;
  const limit = Number(url.searchParams.get('limit'));
  const offset = Number(url.searchParams.get('offset'));
  const status = raw('status');
  return {
    q: raw('q')?.slice(0, 120) ?? null,
    status: status && (FEEDBACK_STATUSES as readonly string[]).includes(status) ? status : null,
    type: raw('type')?.slice(0, 32) ?? null,
    limit: Number.isInteger(limit) && limit > 0 && limit <= 200 ? limit : 50,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  };
}

export async function listFeedback(db: D1DatabaseLike, filters: AnalyticsFilters, query: FeedbackQuery) {
  const scope = sessionScope(filters);
  const window = timeWindow('created_at', filters);
  const where: string[] = [`(session_id IN (${scope.sql}) OR session_id IS NULL)`];
  const params: unknown[] = [...scope.params];
  if (window.sql) { where.push(window.sql.replace(/^ AND /, '')); params.push(...window.params); }
  if (query.status) { where.push('status = ?'); params.push(query.status); }
  if (query.type) { where.push('type = ?'); params.push(query.type); }
  if (query.q) {
    where.push('(message LIKE ? OR reference_id LIKE ? OR country_code LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  if (filters.country) { where.push('(country_code = ? OR country_code IS NULL)'); params.push(filters.country); }

  const clause = where.join(' AND ');
  const [items, total, byStatus, byType] = await Promise.all([
    rows(db, `SELECT id, reference_id, created_at, type, message, email, country_code, path, locale,
        screenshot_key, status, admin_note, status_changed_at
      FROM feedback WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, query.limit, query.offset]),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM feedback WHERE ${clause}`, params),
    rows(db, `SELECT status, COUNT(*) AS count FROM feedback WHERE ${clause} GROUP BY status`, params),
    rows(db, `SELECT type, COUNT(*) AS count FROM feedback WHERE ${clause} GROUP BY type ORDER BY count DESC`, params),
  ]);
  return { items, total: number(total?.count), byStatus, byType, limit: query.limit, offset: query.offset };
}

export async function updateFeedbackStatus(
  db: D1DatabaseLike,
  referenceId: string,
  status: string,
  note: string | null,
): Promise<boolean> {
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) return false;
  const existing = await one<{ id: string }>(db, 'SELECT id FROM feedback WHERE reference_id = ?', [referenceId]);
  if (!existing) return false;
  await db.prepare('UPDATE feedback SET status = ?, admin_note = ?, status_changed_at = ? WHERE reference_id = ?')
    .bind(status, note, new Date().toISOString(), referenceId).run();
  return true;
}

export async function listRatings(db: D1DatabaseLike, filters: AnalyticsFilters, limit = 100) {
  const r = scopedFor('created_at', filters);
  return rows(db, `SELECT created_at, kind, overall_score AS score, country_code, origin, comment
    FROM ratings WHERE session_id IN (${r.scope})${r.window}
    ORDER BY created_at DESC LIMIT ?`, [...r.scopeParams, ...r.windowParams, limit]);
}

/** Daily series for the overview chart. */
export async function buildTrend(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];
  const [sessionsPerDay, completionsPerDay, ratingsPerDay] = await Promise.all([
    rows(db, `SELECT substr(first_seen_at, 1, 10) AS day, COUNT(*) AS value FROM sessions
      WHERE session_id IN (${sessionScope(filters).sql}) GROUP BY day ORDER BY day`, sessionScope(filters).params),
    rows(db, `SELECT substr(occurred_at, 1, 10) AS day, COUNT(*) AS value FROM events
      WHERE name = 'quiz_results_generated' AND session_id IN (${e.scope})${e.window}
      GROUP BY day ORDER BY day`, base),
    rows(db, `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS value,
        ROUND(AVG(overall_score), 2) AS average FROM ratings
      WHERE session_id IN (${scopedFor('created_at', filters).scope})${scopedFor('created_at', filters).window}
      GROUP BY day ORDER BY day`, [...scopedFor('created_at', filters).scopeParams, ...scopedFor('created_at', filters).windowParams]),
  ]);
  return { sessionsPerDay, completionsPerDay, ratingsPerDay };
}

export async function buildAnalytics(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const [overview, trend, funnel, quality, countries, discovery, location, technical, content] = await Promise.all([
    buildOverview(db, filters),
    buildTrend(db, filters),
    buildFunnel(db, filters),
    buildQuality(db, filters),
    buildCountries(db, filters),
    buildDiscovery(db, filters),
    buildLocation(db, filters),
    buildTechnical(db, filters),
    buildContent(db),
  ]);
  return { filters, overview, trend, funnel, quality, countries, discovery, location, technical, content };
}
