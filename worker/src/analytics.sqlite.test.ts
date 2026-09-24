// Phase 21 — the admin metrics, run as real SQL against the real schema
// (every migration applied to Node's SQLite; see testing/sqliteD1.ts). The
// fake D1 in admin.test.ts proves what the SQL may ASK for; these tests prove
// what it ANSWERS, for the questionnaire journeys the dashboard has to tell
// apart: finished, stopped, still answering, never answered, retaken,
// purpose changed, answer changed.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDiscovery, buildFunnel, buildLocation, buildOverview, listFeedback, listRatings, parseFeedbackQuery, parseFilters, type AnalyticsFilters } from './analytics';
import { createSqliteD1, seedSession, type SqliteD1 } from './testing/sqliteD1';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const noFilters = (query = ''): AnalyticsFilters => parseFilters(new URL(`https://w.dev/api/admin/analytics${query}`));
const TOURISM = ['tourism-proximity', 'tourism-climate', 'tourism-cost', 'tourism-urbanity', 'tourism-coastal', 'tourism-size', 'tourism-island', 'tourism-popularity'];

let d1: SqliteD1;

function answer(session: ReturnType<typeof seedSession>, purpose: string, questionId: string, questionNumber: number) {
  session.event('quiz_answer', { purpose, questionId, value: 1, questionNumber }, { path: `/quiz/${purpose}` });
}

function complete(session: ReturnType<typeof seedSession>, purpose: string) {
  session.event('quiz_results_generated', { purpose, answerCount: 5, results: [{ countryCode: 'JP', score: 80 }] }, { path: `/quiz/${purpose}` });
}

beforeEach(() => {
  d1 = createSqliteD1();
  const { raw } = d1;

  // finished: 8 answers with the checkpoint in between, then results.
  const finished = seedSession(raw, 'finished');
  finished.event('quiz_started', { purpose: 'tourism' });
  TOURISM.slice(0, 5).forEach((id, index) => answer(finished, 'tourism', id, index + 1));
  finished.event('quiz_checkpoint_choice', { choice: 'continue', answerCount: 5 });
  TOURISM.slice(5, 8).forEach((id, index) => answer(finished, 'tourism', id, index + 6));
  complete(finished, 'tourism');

  // stopped after the third question, idle for hours.
  const stopped = seedSession(raw, 'stopped', { locale: 'en', device: 'desktop' });
  stopped.event('quiz_started', { purpose: 'tourism' });
  TOURISM.slice(0, 3).forEach((id, index) => answer(stopped, 'tourism', id, index + 1));

  // still answering: same shape, but active ten minutes before NOW.
  const live = seedSession(raw, 'live', { at: '2026-09-20T11:50:00.000Z' });
  live.event('quiz_started', { purpose: 'tourism' });
  TOURISM.slice(0, 2).forEach((id, index) => answer(live, 'tourism', id, index + 1));

  // picked a purpose and answered nothing.
  seedSession(raw, 'never').event('quiz_started', { purpose: 'work' });

  // completed tourism, then switched to work and stopped after one answer:
  // its LATEST attempt stopped, and it restarted with a different purpose.
  const switched = seedSession(raw, 'switched');
  switched.event('quiz_started', { purpose: 'tourism' });
  TOURISM.slice(0, 5).forEach((id, index) => answer(switched, 'tourism', id, index + 1));
  complete(switched, 'tourism');
  switched.event('quiz_started', { purpose: 'work' });
  answer(switched, 'work', 'work-climate', 1);

  // "Edit my preferences": no second quiz_started, a second completion.
  const edited = seedSession(raw, 'edited');
  edited.event('quiz_started', { purpose: 'tourism' });
  TOURISM.slice(0, 5).forEach((id, index) => answer(edited, 'tourism', id, index + 1));
  complete(edited, 'tourism');
  TOURISM.slice(0, 5).forEach((id, index) => answer(edited, 'tourism', id, index + 1));
  complete(edited, 'tourism');

  // changed an answer: the same question answered twice, then results.
  const changed = seedSession(raw, 'changed');
  changed.event('quiz_started', { purpose: 'tourism' });
  answer(changed, 'tourism', TOURISM[0]!, 1);
  answer(changed, 'tourism', TOURISM[0]!, 1);
  TOURISM.slice(1, 5).forEach((id, index) => answer(changed, 'tourism', id, index + 2));
  complete(changed, 'tourism');

  // a session outside the questionnaire entirely.
  seedSession(raw, 'browser').event('page_view', { theme: 'dark' }, { path: '/explore' });
});

describe('questionnaire outcomes', () => {
  it('sorts every questionnaire session into exactly one final outcome', async () => {
    const funnel = await buildFunnel(d1.db, noFilters(), NOW);
    const { entered, finished, stopped, inProgress, neverAnswered } = funnel.outcomes;
    expect(entered).toBe(7);
    expect({ finished, stopped, inProgress, neverAnswered }).toEqual({ finished: 3, stopped: 2, inProgress: 1, neverAnswered: 1 });
    expect(finished + stopped + inProgress + neverAnswered).toBe(entered);
  });

  it('counts completion, retakes, restarts and purpose changes separately', async () => {
    const { outcomes } = await buildFunnel(d1.db, noFilters(), NOW);
    expect(outcomes.completed).toBe(4);
    expect(outcomes.completedMoreThanOnce).toBe(1);
    expect(outcomes.restarted).toBe(1);
    expect(outcomes.changedPurpose).toBe(1);
  });

  it('never reports a live session as a drop-off — it moves to "stopped" only once idle', async () => {
    const later = await buildFunnel(d1.db, noFilters(), NOW + 60 * 60 * 1000);
    expect(later.outcomes.inProgress).toBe(0);
    expect(later.outcomes.stopped).toBe(3);
  });

  it('keeps the overview base identical to the funnel base, so completion stays ≤ 100%', async () => {
    const overview = await buildOverview(d1.db, noFilters());
    const funnel = await buildFunnel(d1.db, noFilters(), NOW);
    expect(overview.questionnaireSessions).toBe(funnel.outcomes.entered);
    expect(overview.questionnaireCompletions).toBe(funnel.outcomes.completed);
    expect(overview.completionRate).toBe(57.1);
    expect(overview.sessions).toBe(8);
  });
});

describe('questions', () => {
  it('attributes a stop to the last question answered, with its drop-off rate', async () => {
    const { questions } = await buildFunnel(d1.db, noFilters(), NOW);
    const third = questions.find((row) => row.questionId === 'tourism-cost')!;
    expect(third.stoppedHere).toBe(1);
    expect(third.sessions).toBe(5);
    expect(third.dropOffRate).toBe(20);
    const second = questions.find((row) => row.questionId === 'tourism-climate')!;
    expect(second.stoppedHere).toBe(0);
    expect(second.stillAnswering).toBe(1);
    const work = questions.find((row) => row.questionId === 'work-climate')!;
    expect(work.stoppedHere).toBe(1);
  });

  it('separates answer events from sessions when an answer is changed or retaken', async () => {
    const { questions } = await buildFunnel(d1.db, noFilters(), NOW);
    const first = questions.find((row) => row.questionId === 'tourism-proximity')!;
    expect(first.sessions).toBe(6);
    expect(first.answers).toBe(8);
    expect(first.completedAfter).toBe(4);
    expect(first.averagePosition).toBe(1);
  });

  it('names each question with its live wording and keeps unreached questions as zero rows', async () => {
    const { questions } = await buildFunnel(d1.db, noFilters(), NOW);
    const first = questions.find((row) => row.questionId === 'tourism-proximity')!;
    expect(first.text!.ar).toMatch(/[؀-ۿ]/);
    expect(first.text!.en.length).toBeGreaterThan(10);
    expect(first.inCatalog).toBe(true);
    const unreached = questions.find((row) => row.questionId === 'tourism-health')!;
    expect(unreached.sessions).toBe(0);
    expect(unreached.dropOffRate).toBeNull();
    // Catalog order is kept within a purpose.
    const tourism = questions.filter((row) => row.purpose === 'tourism').map((row) => row.catalogOrder);
    expect(tourism).toEqual([...tourism].sort((a, b) => Number(a) - Number(b)));
  });

  it('keeps an answered question id the current catalog no longer has, flagged', async () => {
    const legacy = seedSession(d1.raw, 'legacy');
    answer(legacy, 'tourism', 'tourism-retired-question', 1);
    const { questions } = await buildFunnel(d1.db, noFilters(), NOW);
    const row = questions.find((item) => item.questionId === 'tourism-retired-question')!;
    expect(row.inCatalog).toBe(false);
    expect(row.text).toBeNull();
  });

  it('reports sessions per position and the stops at each position', async () => {
    const { byPosition } = await buildFunnel(d1.db, noFilters(), NOW);
    expect(byPosition[0]).toEqual({ position: 1, sessions: 6, stoppedAfter: 1 });
    expect(byPosition.find((row) => row.position === 3)).toEqual({ position: 3, sessions: 5, stoppedAfter: 1 });
  });

  it('reports completion per purpose against the sessions that answered in it', async () => {
    const { byPurpose } = await buildFunnel(d1.db, noFilters(), NOW);
    const tourism = byPurpose.find((row) => row.purpose === 'tourism')!;
    expect(tourism).toMatchObject({ picked: 6, reached: 6, completed: 4 });
    expect(tourism.completionRate).toBe(66.7);
    const work = byPurpose.find((row) => row.purpose === 'work')!;
    expect(work).toMatchObject({ picked: 2, reached: 1, completed: 0, completionRate: 0 });
  });

  it('counts the checkpoint by sessions as well as events', async () => {
    const { checkpointChoice, averageQuestionsAnswered } = await buildFunnel(d1.db, noFilters(), NOW);
    expect(checkpointChoice).toEqual([{ choice: 'continue', events: 1, sessions: 1 }]);
    // finished 8, stopped 3, live 2, switched 6, edited 5, changed 5 distinct questions.
    expect(averageQuestionsAnswered).toBe(4.8);
  });

  it('respects the purpose filter', async () => {
    const funnel = await buildFunnel(d1.db, noFilters('?purpose=work'), NOW);
    expect(funnel.outcomes.entered).toBe(2);
    expect(new Set(funnel.questions.map((row) => row.purpose))).toEqual(new Set(['work']));
  });
});

describe('location, discovery and the feedback center', () => {
  it('reports location state changes as events AND distinct sessions', async () => {
    const session = seedSession(d1.raw, 'geo');
    session.event('location_permission', { outcome: 'requesting' });
    session.event('location_permission', { outcome: 'denied' });
    session.event('location_permission', { outcome: 'requesting' });
    session.event('location_request_outcome', { outcome: 'denied', totalMs: 120, stages: [{ stage: 1, highAccuracy: false, timeoutMs: 8000, durationMs: 120, outcome: 'denied' }] });
    const location = await buildLocation(d1.db, noFilters());
    expect(location.permission.find((row) => row.outcome === 'requesting')).toEqual({ outcome: 'requesting', events: 2, sessions: 1 });
    expect(location.stageOutcomes).toEqual([{ stage: 1, outcome: 'denied', highAccuracy: false, attempts: 1 }]);
    expect(location.sessionsThatAsked).toBe(1);
    expect(location.grantRate).toBe(0);
    expect(JSON.stringify(location)).not.toMatch(/"(lat|lng|latitude|longitude)"/);
  });

  it('splits filter changes per control and reports how destinations were opened', async () => {
    const session = seedSession(d1.raw, 'explorer');
    session.event('explore_filter_changed', { filter: 'sort', value: 'nearest' });
    session.event('explore_filter_changed', { filter: 'region', value: 'Asia' });
    session.event('explore_filter_changed', { filter: 'cost', value: '2' });
    session.event('destination_opened', { source: 'explore' }, { country: 'JP' });
    const discovery = await buildDiscovery(d1.db, noFilters());
    expect(discovery.distanceSortUsed).toEqual([{ value: 'nearest', count: 1 }]);
    expect(discovery.costUsed).toEqual([{ value: '2', count: 1 }]);
    expect(discovery.filtersUsed.map((row) => row.filter).sort()).toEqual(['cost', 'region', 'sort']);
    expect(discovery.openedBySource).toEqual([{ source: 'explore', count: 1, sessions: 1 }]);
  });

  it('filters reports by screenshot and never returns the storage key', async () => {
    const insert = d1.raw.prepare(`INSERT INTO feedback (id, reference_id, session_id, created_at, type, message, path, locale, screenshot_key)
      VALUES (?, ?, 'finished', '2026-09-20T10:30:00.000Z', 'bug', 'Button overlaps', '/', 'en', ?)`);
    insert.run('f1', 'WJ-1', 'screenshots/secret-key.png');
    insert.run('f2', 'WJ-2', null);
    const all = await listFeedback(d1.db, noFilters(), parseFeedbackQuery(new URL('https://w.dev/?')));
    expect(all.total).toBe(2);
    expect(all.withScreenshot).toBe(1);
    expect(JSON.stringify(all)).not.toContain('secret-key');
    const withShot = await listFeedback(d1.db, noFilters(), parseFeedbackQuery(new URL('https://w.dev/?screenshot=yes')));
    expect(withShot.items.map((row) => row.reference_id)).toEqual(['WJ-1']);
    expect(withShot.items[0]!.has_screenshot).toBe(true);
    const injected = parseFeedbackQuery(new URL("https://w.dev/?screenshot=yes'%20OR%201=1"));
    expect(injected.screenshot).toBeNull();
  });

  it('lists only rating comments when asked', async () => {
    const insert = d1.raw.prepare(`INSERT INTO ratings (id, session_id, created_at, overall_score, kind, comment, country_code, origin)
      VALUES (?, 'finished', '2026-09-20T10:40:00.000Z', ?, ?, ?, ?, ?)`);
    insert.run('r1', 2, 'destination', 'Photos are of another city', 'JP', 'explore');
    insert.run('r2', 5, 'results', null, null, null);
    insert.run('r3', 4, 'results', '', null, null);
    const comments = await listRatings(d1.db, noFilters(), { withComment: true, kind: null, limit: 50 });
    expect(comments.total).toBe(1);
    expect(comments.items).toHaveLength(1);
    const results = await listRatings(d1.db, noFilters(), { withComment: false, kind: 'results', limit: 50 });
    expect(results.total).toBe(2);
  });
});
