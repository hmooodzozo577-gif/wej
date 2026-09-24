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
import countryIntelligenceSnapshot from './generated/countryIntelligenceDetail.json';
import adminCatalog from './generated/adminCatalog.json';
import { STOP_IDLE_MINUTES } from './adminMetrics';
import { isExcludedCountry } from './shared';

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
    country: country && COUNTRY_RE.test(country) && !isExcludedCountry(country) ? country : null,
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

/** Events that mean a session is inside the questionnaire. The overview's
 *  "questionnaire sessions" and the funnel's outcome breakdown both use this
 *  one definition, so their totals match and completion can never exceed
 *  100% (see adminMetrics.ts, overview.questionnaireSessions). */
const QUESTIONNAIRE_EVENTS = "('quiz_started', 'quiz_answer', 'quiz_results_generated')";

export async function buildOverview(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const r = scopedFor('created_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];
  const eventCount = async (name: string) => number((await one<{ count: number }>(db,
    `SELECT COUNT(*) AS count FROM events WHERE name = ? AND session_id IN (${e.scope})${e.window}`,
    [name, ...base]))?.count);
  const sessionsWith = async (names: string) => number((await one<{ count: number }>(db,
    `SELECT COUNT(DISTINCT session_id) AS count FROM events WHERE name IN ${names} AND session_id IN (${e.scope})${e.window}`,
    base))?.count);

  const [sessions, pageViews, questionnaireSessions, completions, resultsViewed, feedbackCount, rating] = await Promise.all([
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM (${scopedFor('last_seen_at', filters).scope})`, sessionScope(filters).params),
    eventCount('page_view'),
    sessionsWith(QUESTIONNAIRE_EVENTS),
    sessionsWith("('quiz_results_generated')"),
    one<{ count: number }>(db,
      `SELECT COUNT(*) AS count FROM events WHERE name = 'page_view' AND path = '/results' AND session_id IN (${e.scope})${e.window}`,
      base),
    one<{ count: number }>(db,
      `SELECT COUNT(*) AS count FROM feedback WHERE session_id IN (${r.scope})${r.window}`,
      [...r.scopeParams, ...r.windowParams]),
    one<{ count: number; average: number }>(db,
      `SELECT COUNT(*) AS count, ROUND(AVG(overall_score), 2) AS average FROM ratings WHERE session_id IN (${r.scope})${r.window}`,
      [...r.scopeParams, ...r.windowParams]),
  ]);

  return {
    sessions: number(sessions?.count),
    pageViews,
    questionnaireSessions,
    questionnaireCompletions: completions,
    completionRate: rate(completions, questionnaireSessions),
    resultsViewed: number(resultsViewed?.count),
    feedbackCount: number(feedbackCount?.count),
    ratingCount: number(rating?.count),
    averageRating: rating?.average ?? null,
  };
}

/** A percentage with one decimal, or null when there is no denominator. */
function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

// ------------------------------------------------------------------ funnel

interface CatalogQuestion { id: string; kind: string; ar: string; en: string }
const QUESTION_CATALOG = (adminCatalog as { questions: Record<string, CatalogQuestion[]> }).questions;

/** The questionnaire CTEs every funnel query shares. Each answer is one
 *  quiz_answer event; `last_answers` is each session's most recent answer
 *  (a window function, so no self-join); `open_ends` are the sessions whose
 *  most recent answer has no completion after it — split by `idle` into
 *  "stopped" (no activity for STOP_IDLE_MINUTES) and "still answering". */
function questionnaireCtes(e: Scoped, idleCutoff: string) {
  const base = [...e.scopeParams, ...e.windowParams];
  return {
    sql: `answers AS (
        SELECT session_id, occurred_at,
          json_extract(properties_json, '$.purpose') AS purpose,
          json_extract(properties_json, '$.questionId') AS question_id,
          CAST(json_extract(properties_json, '$.questionNumber') AS INTEGER) AS position
        FROM events WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
      ),
      completions AS (
        SELECT session_id, MAX(occurred_at) AS last_completed_at, COUNT(*) AS completions
        FROM events WHERE name = 'quiz_results_generated' AND session_id IN (${e.scope})${e.window}
        GROUP BY session_id
      ),
      last_answers AS (
        SELECT session_id, purpose, question_id, position, occurred_at FROM (
          SELECT answers.*, ROW_NUMBER() OVER (
            PARTITION BY session_id ORDER BY occurred_at DESC, position DESC) AS recency
          FROM answers
        ) WHERE recency = 1
      ),
      open_ends AS (
        SELECT last_answers.*, CASE WHEN sessions.last_seen_at < ? THEN 1 ELSE 0 END AS idle
        FROM last_answers
        JOIN sessions ON sessions.session_id = last_answers.session_id
        LEFT JOIN completions ON completions.session_id = last_answers.session_id
        WHERE completions.last_completed_at IS NULL OR completions.last_completed_at < last_answers.occurred_at
      )`,
    params: [...base, ...base, idleCutoff],
  };
}

export async function buildFunnel(db: D1DatabaseLike, filters: AnalyticsFilters, now = Date.now()) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];
  const idleCutoff = new Date(now - STOP_IDLE_MINUTES * 60_000).toISOString();
  const ctes = questionnaireCtes(e, idleCutoff);

  const [questionRows, openEnds, outcomes, byPosition, purposes, checkpoint, distinctAnswered] = await Promise.all([
    rows<{ purpose: string; questionId: string; answers: number; sessions: number; averagePosition: number; firstPosition: number; lastPosition: number; completedAfter: number }>(db,
      `WITH ${ctes.sql}
      SELECT answers.purpose AS purpose, answers.question_id AS questionId,
        COUNT(*) AS answers,
        COUNT(DISTINCT answers.session_id) AS sessions,
        ROUND(AVG(answers.position), 1) AS averagePosition,
        MIN(answers.position) AS firstPosition,
        MAX(answers.position) AS lastPosition,
        COUNT(DISTINCT CASE WHEN completions.last_completed_at > answers.occurred_at THEN answers.session_id END) AS completedAfter
      FROM answers LEFT JOIN completions ON completions.session_id = answers.session_id
      GROUP BY answers.purpose, answers.question_id`, ctes.params),
    rows<{ purpose: string; questionId: string; position: number; stopped: number; inProgress: number }>(db,
      `WITH ${ctes.sql}
      SELECT purpose, question_id AS questionId, position,
        SUM(idle) AS stopped, SUM(1 - idle) AS inProgress
      FROM open_ends GROUP BY purpose, question_id, position`, ctes.params),
    one<Record<string, number>>(db,
      `WITH ${ctes.sql},
      starts AS (
        SELECT session_id, COUNT(*) AS starts, COUNT(DISTINCT json_extract(properties_json, '$.purpose')) AS purposes
        FROM events WHERE name = 'quiz_started' AND session_id IN (${e.scope})${e.window}
        GROUP BY session_id
      ),
      entered AS (
        SELECT session_id FROM starts UNION SELECT session_id FROM answers UNION SELECT session_id FROM completions
      )
      SELECT COUNT(*) AS entered,
        SUM(CASE WHEN open_ends.session_id IS NULL AND completions.session_id IS NOT NULL THEN 1 ELSE 0 END) AS finished,
        SUM(CASE WHEN open_ends.idle = 1 THEN 1 ELSE 0 END) AS stopped,
        SUM(CASE WHEN open_ends.idle = 0 THEN 1 ELSE 0 END) AS inProgress,
        SUM(CASE WHEN open_ends.session_id IS NULL AND completions.session_id IS NULL THEN 1 ELSE 0 END) AS neverAnswered,
        SUM(CASE WHEN completions.session_id IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN completions.completions >= 2 THEN 1 ELSE 0 END) AS completedMoreThanOnce,
        SUM(CASE WHEN starts.starts >= 2 THEN 1 ELSE 0 END) AS restarted,
        SUM(CASE WHEN starts.purposes >= 2 THEN 1 ELSE 0 END) AS changedPurpose
      FROM entered
      LEFT JOIN open_ends ON open_ends.session_id = entered.session_id
      LEFT JOIN completions ON completions.session_id = entered.session_id
      LEFT JOIN starts ON starts.session_id = entered.session_id`, [...ctes.params, ...base]),
    rows<{ position: number; sessions: number }>(db,
      `SELECT CAST(json_extract(properties_json, '$.questionNumber') AS INTEGER) AS position,
        COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
      GROUP BY position ORDER BY position`, base),
    rows<{ purpose: string; picked: number; reached: number; completed: number }>(db,
      `SELECT purpose,
        COUNT(DISTINCT CASE WHEN name = 'quiz_started' THEN session_id END) AS picked,
        COUNT(DISTINCT CASE WHEN name <> 'quiz_started' THEN session_id END) AS reached,
        COUNT(DISTINCT CASE WHEN name = 'quiz_results_generated' THEN session_id END) AS completed
      FROM (
        SELECT session_id, name, json_extract(properties_json, '$.purpose') AS purpose
        FROM events WHERE name IN ${QUESTIONNAIRE_EVENTS} AND session_id IN (${e.scope})${e.window}
      ) GROUP BY purpose ORDER BY reached DESC, picked DESC`, base),
    rows<{ choice: string; events: number; sessions: number }>(db,
      `SELECT json_extract(properties_json, '$.choice') AS choice, COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'quiz_checkpoint_choice' AND session_id IN (${e.scope})${e.window}
      GROUP BY choice ORDER BY sessions DESC`, base),
    one<{ average: number }>(db, `SELECT ROUND(AVG(questions), 1) AS average FROM (
        SELECT session_id, COUNT(DISTINCT json_extract(properties_json, '$.questionId')) AS questions FROM events
        WHERE name = 'quiz_answer' AND session_id IN (${e.scope})${e.window}
        GROUP BY session_id)`, base),
  ]);

  // Stops keyed by question, and by the position the last answer was given
  // at (for the position table).
  const stopKey = (purpose: unknown, questionId: unknown) => `${String(purpose)}\u0000${String(questionId)}`;
  const stops = new Map<string, { stopped: number; inProgress: number }>();
  const stopsByPosition = new Map<number, number>();
  for (const row of openEnds) {
    const key = stopKey(row.purpose, row.questionId);
    const entry = stops.get(key) ?? { stopped: 0, inProgress: 0 };
    entry.stopped += number(row.stopped);
    entry.inProgress += number(row.inProgress);
    stops.set(key, entry);
    const position = number(row.position);
    stopsByPosition.set(position, (stopsByPosition.get(position) ?? 0) + number(row.stopped));
  }

  // One row per question of every purpose that saw questionnaire activity,
  // in catalog order, joined to the live wording — so a question nobody
  // reached shows as zero instead of silently disappearing. An id the
  // current catalog no longer has (an older question) is kept, flagged.
  const measured = new Map(questionRows.map((row) => [stopKey(row.purpose, row.questionId), row]));
  const activePurposes = new Set<string>([
    ...purposes.map((row) => String(row.purpose)),
    ...questionRows.map((row) => String(row.purpose)),
  ].filter((purpose) => filters.purpose === null || purpose === filters.purpose));
  const questions: ReturnType<typeof questionRow>[] = [];
  const seen = new Set<string>();
  for (const purpose of activePurposes) {
    (QUESTION_CATALOG[purpose] ?? []).forEach((question, order) => {
      const key = stopKey(purpose, question.id);
      seen.add(key);
      questions.push(questionRow(purpose, question.id, question, order + 1, measured.get(key), stops.get(key)));
    });
  }
  for (const [key, row] of measured) {
    if (seen.has(key) || !activePurposes.has(String(row.purpose))) continue;
    questions.push(questionRow(String(row.purpose), String(row.questionId), null, null, row, stops.get(key)));
  }

  return {
    idleMinutes: STOP_IDLE_MINUTES,
    outcomes: {
      entered: number(outcomes?.entered),
      finished: number(outcomes?.finished),
      stopped: number(outcomes?.stopped),
      inProgress: number(outcomes?.inProgress),
      neverAnswered: number(outcomes?.neverAnswered),
      completed: number(outcomes?.completed),
      completedMoreThanOnce: number(outcomes?.completedMoreThanOnce),
      restarted: number(outcomes?.restarted),
      changedPurpose: number(outcomes?.changedPurpose),
    },
    questions,
    byPosition: byPosition.map((row) => ({
      position: number(row.position),
      sessions: number(row.sessions),
      stoppedAfter: stopsByPosition.get(number(row.position)) ?? 0,
    })),
    byPurpose: purposes.map((row) => ({
      purpose: row.purpose,
      picked: number(row.picked),
      reached: number(row.reached),
      completed: number(row.completed),
      completionRate: rate(number(row.completed), number(row.reached)),
    })),
    checkpointChoice: checkpoint.map((row) => ({ choice: row.choice, events: number(row.events), sessions: number(row.sessions) })),
    averageQuestionsAnswered: distinctAnswered?.average ?? null,
  };
}

function questionRow(
  purpose: string,
  questionId: string,
  catalog: CatalogQuestion | null,
  catalogOrder: number | null,
  measured: { answers: number; sessions: number; averagePosition: number; firstPosition: number; lastPosition: number; completedAfter: number } | undefined,
  stop: { stopped: number; inProgress: number } | undefined,
) {
  const sessions = number(measured?.sessions);
  const stopped = stop?.stopped ?? 0;
  return {
    purpose,
    questionId,
    kind: catalog?.kind ?? null,
    text: catalog ? { ar: catalog.ar, en: catalog.en } : null,
    inCatalog: catalog !== null,
    catalogOrder,
    sessions,
    answers: number(measured?.answers),
    averagePosition: measured?.averagePosition ?? null,
    firstPosition: measured?.firstPosition ?? null,
    lastPosition: measured?.lastPosition ?? null,
    completedAfter: number(measured?.completedAfter),
    stoppedHere: stopped,
    stillAnswering: stop?.inProgress ?? 0,
    dropOffRate: rate(stopped, sessions),
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
  const r = scopedFor('created_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  const [recommended, opened, surpriseShown, surpriseOpened, countryFeedback] = await Promise.all([
    // json_each over the top-5 recommendation set each completion produced.
    rows(db, `SELECT json_extract(item.value, '$.countryCode') AS country_code, COUNT(*) AS count
      FROM events, json_each(json_extract(events.properties_json, '$.results')) AS item
      WHERE events.name = 'quiz_results_generated' AND events.session_id IN (${e.scope})${e.window.replaceAll('occurred_at', 'events.occurred_at')}
      GROUP BY country_code ORDER BY count DESC`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM events
      WHERE name = 'destination_opened' AND country_code IS NOT NULL AND session_id IN (${e.scope})${e.window}
      GROUP BY country_code ORDER BY count DESC LIMIT 60`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM events
      WHERE name = 'surprise_result' AND country_code IS NOT NULL AND session_id IN (${e.scope})${e.window}
      GROUP BY country_code ORDER BY count DESC LIMIT 60`, base),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM events
      WHERE name = 'destination_opened' AND json_extract(properties_json, '$.source') = 'surprise'
        AND session_id IN (${e.scope})${e.window}`, base),
    rows(db, `SELECT country_code, COUNT(*) AS count FROM feedback
      WHERE country_code IS NOT NULL AND session_id IN (${r.scope})${r.window}
      GROUP BY country_code ORDER BY count DESC LIMIT 40`, [...r.scopeParams, ...r.windowParams]),
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
    surpriseShown,
    surpriseOpened: number(surpriseOpened?.count),
    countryFeedback,
  };
}

// --------------------------------------------------------------- discovery

export async function buildDiscovery(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  const [search, filterValues, resets, surpriseSpins, bySource] = await Promise.all([
    one<{ total: number; used: number }>(db, `SELECT COUNT(*) AS total,
        SUM(CASE WHEN json_extract(properties_json, '$.used') IN (1, 'true') THEN 1 ELSE 0 END) AS used
      FROM events WHERE name = 'explore_search' AND session_id IN (${e.scope})${e.window}`, base),
    rows<{ filter: string; value: string; count: number }>(db, `SELECT json_extract(properties_json, '$.filter') AS filter,
        json_extract(properties_json, '$.value') AS value, COUNT(*) AS count
      FROM events WHERE name = 'explore_filter_changed' AND session_id IN (${e.scope})${e.window}
      GROUP BY filter, value ORDER BY count DESC`, base),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM events
      WHERE name = 'explore_filters_reset' AND session_id IN (${e.scope})${e.window}`, base),
    one<{ count: number; sessions: number }>(db, `SELECT COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'surprise_spin' AND session_id IN (${e.scope})${e.window}`, base),
    rows<{ source: string; count: number; sessions: number }>(db, `SELECT json_extract(properties_json, '$.source') AS source,
        COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'destination_opened' AND session_id IN (${e.scope})${e.window}
      GROUP BY source ORDER BY count DESC`, base),
  ]);

  // One query, split per control: which control was changed, and to what.
  const byFilter = new Map<string, number>();
  const valuesOf = (filter: string) => filterValues
    .filter((row) => row.filter === filter)
    .map((row) => ({ value: row.value, count: number(row.count) }));
  for (const row of filterValues) byFilter.set(String(row.filter), (byFilter.get(String(row.filter)) ?? 0) + number(row.count));
  const sortUsed = valuesOf('sort');
  return {
    searchEvents: number(search?.total),
    searchWithText: number(search?.used),
    filtersUsed: [...byFilter.entries()].map(([filter, count]) => ({ filter, count })).sort((a, b) => b.count - a.count),
    sortUsed,
    regionUsed: valuesOf('region'),
    costUsed: valuesOf('cost'),
    purposeUsed: valuesOf('purpose'),
    distanceSortUsed: sortUsed.filter((row) => row.value === 'nearest' || row.value === 'farthest'),
    filterResets: number(resets?.count),
    surpriseSpins: number(surpriseSpins?.count),
    surpriseSessions: number(surpriseSpins?.sessions),
    openedBySource: bySource.map((row) => ({ source: row.source, count: number(row.count), sessions: number(row.sessions) })),
  };
}

// ---------------------------------------------------------------- location

export async function buildLocation(db: D1DatabaseLike, filters: AnalyticsFilters) {
  const e = scopedFor('occurred_at', filters);
  const base = [...e.scopeParams, ...e.windowParams];

  // Nothing here is finer than a country, and nothing here is a coordinate.
  // Every table reports its unit explicitly: `events` (each state change or
  // request), `sessions` (distinct sessions), `attempts` (stage attempts).
  const [permission, outcomes, stageOutcomes, edgeCountries, enabled] = await Promise.all([
    rows<{ outcome: string; events: number; sessions: number }>(db, `SELECT json_extract(properties_json, '$.outcome') AS outcome,
        COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
      FROM events WHERE name = 'location_permission' AND session_id IN (${e.scope})${e.window}
      GROUP BY outcome ORDER BY events DESC`, base),
    rows<{ outcome: string; events: number; sessions: number; averageMs: number }>(db, `SELECT json_extract(properties_json, '$.outcome') AS outcome,
        COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions,
        ROUND(AVG(CAST(json_extract(properties_json, '$.totalMs') AS INTEGER))) AS averageMs
      FROM events WHERE name = 'location_request_outcome' AND session_id IN (${e.scope})${e.window}
      GROUP BY outcome ORDER BY events DESC`, base),
    rows<{ stage: number; outcome: string; highAccuracy: unknown; attempts: number }>(db, `SELECT json_extract(stage.value, '$.stage') AS stage,
        json_extract(stage.value, '$.outcome') AS outcome,
        json_extract(stage.value, '$.highAccuracy') AS highAccuracy, COUNT(*) AS attempts
      FROM events, json_each(json_extract(events.properties_json, '$.stages')) AS stage
      WHERE events.name = 'location_request_outcome' AND events.session_id IN (${e.scope})${e.window.replaceAll('occurred_at', 'events.occurred_at')}
      GROUP BY stage, outcome, highAccuracy ORDER BY stage, attempts DESC`, base),
    rows(db, `SELECT edge_country AS country, COUNT(*) AS count FROM sessions
      WHERE edge_country IS NOT NULL AND session_id IN (${e.scope})
      GROUP BY edge_country ORDER BY count DESC LIMIT 40`, e.scopeParams),
    one<{ granted: number; total: number; requests: number }>(db, `SELECT
        COUNT(DISTINCT CASE WHEN json_extract(properties_json, '$.outcome') = 'ok' THEN session_id END) AS granted,
        COUNT(DISTINCT session_id) AS total, COUNT(*) AS requests
      FROM events WHERE name = 'location_request_outcome' AND session_id IN (${e.scope})${e.window}`, base),
  ]);

  const asked = number(enabled?.total);
  const granted = number(enabled?.granted);
  return {
    permission: permission.map((row) => ({ outcome: row.outcome, events: number(row.events), sessions: number(row.sessions) })),
    requestOutcomes: outcomes.map((row) => ({ outcome: row.outcome, events: number(row.events), sessions: number(row.sessions), averageMs: row.averageMs ?? null })),
    stageOutcomes: stageOutcomes.map((row) => ({
      stage: row.stage ?? null,
      outcome: row.outcome,
      highAccuracy: row.highAccuracy === 1 || row.highAccuracy === true || row.highAccuracy === 'true',
      attempts: number(row.attempts),
    })),
    edgeCountries,
    sessionsThatAsked: asked,
    sessionsThatGranted: granted,
    grantRate: rate(granted, asked),
    requests: number(enabled?.requests),
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

// ------------------------------------------------------- country intelligence

/** Country Intelligence + Purpose Suitability admin observability (task
 *  3.23). Deliberately NOT a D1 query — this is a static, versioned,
 *  build-time-computed dataset (see app/scripts/generate-country-
 *  intelligence.mjs), bundled with the Worker exactly like
 *  generated/countryIntelligenceDetail.json already is for the "Why this
 *  score?" endpoint (intelligence.ts). Reusing that same bundled data here
 *  means one source of truth for both the public detail API and this
 *  admin panel, and no live query is needed for reference data that only
 *  changes when the pipeline re-runs. Takes no `db` because there is
 *  nothing to query — kept `async` only so it drops into buildAnalytics()'s
 *  existing Promise.all alongside the D1-backed builders without a
 *  special case. */
export async function buildIntelligenceHealth() {
  const { generatedAt, entries } = countryIntelligenceSnapshot as {
    generatedAt: string;
    entries: { countryCode: string; purpose: string; modelVersion: string; insufficientData: boolean; coverage: number; confidence: string | null }[];
  };
  const byPurpose = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byPurpose.get(entry.purpose);
    if (list) list.push(entry);
    else byPurpose.set(entry.purpose, [entry]);
  }
  const purposes = [...byPurpose.entries()].map(([purpose, purposeEntries]) => {
    const sufficient = purposeEntries.filter((entry) => !entry.insufficientData);
    return {
      purpose,
      modelVersion: purposeEntries[0]?.modelVersion ?? '',
      totalCountries: purposeEntries.length,
      sufficientDataCount: sufficient.length,
      insufficientDataCount: purposeEntries.length - sufficient.length,
      averageCoverage: purposeEntries.length
        ? Math.round(purposeEntries.reduce((sum, entry) => sum + entry.coverage, 0) / purposeEntries.length)
        : 0,
      confidenceHighCount: purposeEntries.filter((entry) => entry.confidence === 'high').length,
    };
  });
  return {
    generatedAt,
    totalCountries: new Set(entries.map((entry) => entry.countryCode)).size,
    purposes,
  };
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

export interface FeedbackQuery {
  q: string | null; status: string | null; type: string | null;
  /** 'yes' = only reports with a screenshot, 'no' = only without. */
  screenshot: 'yes' | 'no' | null;
  limit: number; offset: number;
}

export function parseFeedbackQuery(url: URL): FeedbackQuery {
  const raw = (key: string) => url.searchParams.get(key)?.trim() || null;
  const limit = Number(url.searchParams.get('limit'));
  const offset = Number(url.searchParams.get('offset'));
  const status = raw('status');
  const screenshot = raw('screenshot');
  return {
    q: raw('q')?.slice(0, 120) ?? null,
    status: status && (FEEDBACK_STATUSES as readonly string[]).includes(status) ? status : null,
    type: raw('type')?.slice(0, 32) ?? null,
    screenshot: screenshot === 'yes' || screenshot === 'no' ? screenshot : null,
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
  if (query.screenshot === 'yes') where.push('screenshot_key IS NOT NULL');
  if (query.screenshot === 'no') where.push('screenshot_key IS NULL');
  if (query.q) {
    where.push('(message LIKE ? OR reference_id LIKE ? OR country_code LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  if (filters.country) { where.push('(country_code = ? OR country_code IS NULL)'); params.push(filters.country); }

  const clause = where.join(' AND ');
  const [items, total, byStatus, byType] = await Promise.all([
    rows<{ reference_id: string; screenshot_key: string | null } & Record<string, unknown>>(db, `SELECT id, reference_id, created_at, type, message, email, country_code, path, locale,
        screenshot_key, status, admin_note, status_changed_at
      FROM feedback WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, query.limit, query.offset]),
    one<{ count: number; withScreenshot: number }>(db, `SELECT COUNT(*) AS count,
        SUM(CASE WHEN screenshot_key IS NOT NULL THEN 1 ELSE 0 END) AS withScreenshot
      FROM feedback WHERE ${clause}`, params),
    rows(db, `SELECT status, COUNT(*) AS count FROM feedback WHERE ${clause} GROUP BY status`, params),
    rows(db, `SELECT type, COUNT(*) AS count FROM feedback WHERE ${clause} GROUP BY type ORDER BY count DESC`, params),
  ]);
  return {
    // The storage key itself never leaves the Worker: the dashboard only
    // needs to know whether a screenshot exists.
    items: items.map(({ screenshot_key: screenshotKey, ...rest }) => ({ ...rest, has_screenshot: Boolean(screenshotKey) })),
    total: number(total?.count),
    withScreenshot: number(total?.withScreenshot),
    byStatus, byType, limit: query.limit, offset: query.offset,
  };
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

export interface RatingsQuery { withComment: boolean; kind: 'results' | 'destination' | null; limit: number }

export function parseRatingsQuery(url: URL): RatingsQuery {
  const kind = url.searchParams.get('kind');
  const limit = Number(url.searchParams.get('limit'));
  return {
    withComment: url.searchParams.get('comments') === '1',
    kind: kind === 'results' || kind === 'destination' ? kind : null,
    limit: Number.isInteger(limit) && limit > 0 && limit <= 200 ? limit : 100,
  };
}

export async function listRatings(db: D1DatabaseLike, filters: AnalyticsFilters, query: RatingsQuery = { withComment: false, kind: null, limit: 100 }) {
  const r = scopedFor('created_at', filters);
  const where = [`session_id IN (${r.scope})${r.window}`];
  const params: unknown[] = [...r.scopeParams, ...r.windowParams];
  if (query.withComment) where.push("comment IS NOT NULL AND comment <> ''");
  if (query.kind) { where.push('kind = ?'); params.push(query.kind); }
  const clause = where.join(' AND ');
  const [items, total] = await Promise.all([
    rows(db, `SELECT created_at, kind, overall_score AS score, country_code, origin, comment
      FROM ratings WHERE ${clause} ORDER BY created_at DESC LIMIT ?`, [...params, query.limit]),
    one<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ratings WHERE ${clause}`, params),
  ]);
  return { items, total: number(total?.count), limit: query.limit };
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
  const [overview, trend, funnel, quality, countries, discovery, location, technical, content, intelligence] = await Promise.all([
    buildOverview(db, filters),
    buildTrend(db, filters),
    buildFunnel(db, filters),
    buildQuality(db, filters),
    buildCountries(db, filters),
    buildDiscovery(db, filters),
    buildLocation(db, filters),
    buildTechnical(db, filters),
    buildContent(db),
    buildIntelligenceHealth(),
  ]);
  return { filters, overview, trend, funnel, quality, countries, discovery, location, technical, content, intelligence };
}
