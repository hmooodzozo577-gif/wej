// Visual QA for the private admin dashboard (worker/src/adminPage.ts).
//
// The dashboard is served by the Worker, so QA'ing it does not need a
// deployment — it needs the page's HTML and a stubbed API. Both are local:
//
//   1. Write the page out. From worker/, with a throwaway test:
//        src/__dump.test.ts:
//          import { it } from 'vitest';
//          import fs from 'node:fs';
//          import { adminPage } from './adminPage';
//          it('dump', async () => { fs.writeFileSync('/tmp/admin.html', await adminPage().text()); });
//        npx vitest run src/__dump.test.ts && rm src/__dump.test.ts
//   2. Serve it:  (cd /tmp && python3 -m http.server 5179 --bind 127.0.0.1)
//   3. Run this:  (cd app && node scripts/admin-visual-check.mjs)
//
// Every /api/admin/* call is intercepted and answered with realistic shapes,
// so no real product data is involved and no credential is needed. It fails
// on a page error, a console error, horizontal overflow, an empty panel, or
// a report detail view that will not open.
// Visual QA for the admin dashboard, against a stubbed API so the panels
// render with realistic shapes without needing a live D1.
import { chromium } from 'playwright';
import fs from 'node:fs';

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const series = (n, scale) => Array.from({ length: n }, (_, i) => ({ day: day(n - i), value: Math.round(scale * (0.5 + Math.random())) }));

const ANALYTICS = {
  authenticatedVia: 'token',
  filters: {},
  overview: { sessions: 1284, visits: 5310, questionnaireStarts: 612, questionnaireCompletions: 388, completionRate: 63.4, resultsViewed: 401, feedbackCount: 37, ratingCount: 143, averageRating: 4.12 },
  trend: { sessionsPerDay: series(14, 90), completionsPerDay: series(14, 30), ratingsPerDay: series(14, 12) },
  funnel: {
    byQuestion: [1,2,3,4,5,6,7,8,9].map((q) => ({ questionNumber: q, sessions: Math.round(600 / (1 + q * 0.16)) })),
    abandonedAtQuestion: [{ lastQuestion: 2, sessions: 71 }, { lastQuestion: 4, sessions: 44 }, { lastQuestion: 6, sessions: 22 }],
    checkpointChoice: [{ choice: 'continue', count: 240 }, { choice: 'results', count: 148 }],
    purposeDistribution: [{ purpose: 'tourism', count: 301 }, { purpose: 'education', count: 118 }, { purpose: 'work', count: 96 }, { purpose: 'medical', count: 41 }],
    averageQuestionsAnswered: 6.4,
  },
  quality: {
    distribution: [1,2,3,4,5].map((s) => ({ score: s, count: [6, 11, 24, 47, 55][s - 1] })),
    byKind: [{ kind: 'results', count: 88, average: 4.02 }, { kind: 'destination', count: 55, average: 4.29 }],
    negativeComments: [
      { created_at: '2026-09-14T10:11:00Z', kind: 'results', score: 2, country_code: null, origin: null, comment: 'Everything it suggested was far too expensive for the budget I picked.' },
      { created_at: '2026-09-13T08:02:00Z', kind: 'destination', score: 1, country_code: 'JP', origin: 'results', comment: 'The city list is missing the one I actually wanted.' },
    ],
    countryRatings: [{ country_code: 'TR', count: 9, average: 2.9 }, { country_code: 'JP', count: 21, average: 4.6 }, { country_code: 'FR', count: 14, average: 4.1 }],
    poorResultSets: [{ created_at: '2026-09-14T10:11:00Z', score: 2, result_context_json: JSON.stringify([{ countryCode: 'CH', score: 88 }, { countryCode: 'NO', score: 86 }]), comment: 'Too expensive' }],
    pathContext: [
      { score: 2, purpose: 'tourism', answers: 4 }, { score: 5, purpose: 'tourism', answers: 9 },
      { score: 3, purpose: 'education', answers: 6 }, { score: 4, purpose: 'work', answers: 8 },
    ],
  },
  countries: {
    mostRecommended: [{ country_code: 'JP', count: 180 }, { country_code: 'CH', count: 150 }, { country_code: 'PT', count: 96 }],
    leastRecommended: [{ country_code: 'LV', count: 2 }, { country_code: 'BT', count: 3 }],
    recommendedCountryCount: 71,
    mostOpened: [{ country_code: 'JP', count: 92 }, { country_code: 'IT', count: 61 }],
    openedBySource: [{ source: 'results', count: 210 }, { source: 'explore', count: 122 }, { source: 'surprise', count: 48 }, { source: 'direct', count: 9 }],
    surpriseShown: [{ country_code: 'ET', count: 14 }, { country_code: 'NZ', count: 11 }],
    surpriseOpened: 48,
    countryFeedback: [{ country_code: 'JP', count: 6 }],
  },
  discovery: {
    searchEvents: 410, searchWithText: 233, filterResets: 38, surpriseSpins: 129, surpriseSessions: 74,
    filtersUsed: [{ filter: 'sort', count: 190 }, { filter: 'region', count: 140 }, { filter: 'purpose', count: 62 }],
    sortUsed: [{ value: 'nearest', count: 88 }, { value: 'costAsc', count: 54 }, { value: 'farthest', count: 21 }],
    regionUsed: [{ value: 'Asia', count: 61 }, { value: 'Europe', count: 55 }],
    distanceSortUsed: [{ value: 'nearest', count: 88 }, { value: 'farthest', count: 21 }],
  },
  location: {
    permission: [{ outcome: 'ready', count: 310 }, { outcome: 'denied', count: 140 }],
    requestOutcomes: [{ outcome: 'ok', count: 298, averageMs: 2410 }, { outcome: 'timeout', count: 33, averageMs: 20100 }, { outcome: 'denied', count: 140, averageMs: 900 }],
    stageOutcomes: [{ outcome: 'ok', highAccuracy: 0, count: 240 }, { outcome: 'timeout', highAccuracy: 0, count: 91 }, { outcome: 'ok', highAccuracy: 1, count: 58 }],
    edgeCountries: [{ country: 'SA', count: 640 }, { country: 'AE', count: 121 }, { country: 'EG', count: 88 }],
    sessionsThatAsked: 471, sessionsThatGranted: 298,
  },
  technical: {
    errors: [{ kind: 'TypeError', script: 'index-2iCF.js', count: 4 }],
    performance: { samples: 4100, ttfbMs: 142, domReadyMs: 810, loadMs: 1240 },
    browsers: [{ browser: 'Chrome', count: 780 }, { browser: 'Safari', count: 380 }, { browser: 'Firefox', count: 124 }],
    devices: [{ device: 'mobile', count: 900 }, { device: 'desktop', count: 310 }, { device: 'tablet', count: 74 }],
    locales: [{ locale: 'ar', count: 980 }, { locale: 'en', count: 304 }],
    themes: [{ theme: 'light', count: 3100 }, { theme: 'dark', count: 2210 }],
    referrers: [{ referrer: 'https://www.google.com', count: 210 }],
  },
  content: {
    available: true,
    byStatus: [{ status: 'ok', count: 612 }, { status: 'wrong_place', count: 94 }, { status: 'no_article', count: 71 }, { status: 'ambiguous', count: 33 }],
    byLang: [{ lang: 'en', count: 810, verified: 612 }, { lang: 'ar', count: 410, verified: 268 }],
    countriesSeen: 188,
  },
};

const FEEDBACK = {
  total: 37, limit: 50, offset: 0,
  byStatus: [{ status: 'new', count: 12 }, { status: 'triaged', count: 9 }, { status: 'resolved', count: 16 }],
  byType: [{ type: 'wrong_info', count: 14 }, { type: 'bug', count: 9 }],
  items: [
    { id: '1', reference_id: 'WJH-20260914-A1B2C3', created_at: '2026-09-14T09:40:00Z', type: 'wrong_info', message: 'The population figure for this city looks out of date by several years.', email: 'traveller@example.com', country_code: 'JP', path: '/destination/japan', locale: 'en', screenshot_key: null, status: 'new', admin_note: null, status_changed_at: null },
    { id: '2', reference_id: 'WJH-20260913-D4E5F6', created_at: '2026-09-13T17:02:00Z', type: 'bug', message: 'The sort dropdown closes as soon as I touch it on my phone.', email: null, country_code: null, path: '/explore', locale: 'ar', screenshot_key: '2026-09-13/abc.png', status: 'triaged', admin_note: 'Reproduced on iOS Safari.', status_changed_at: '2026-09-13T18:00:00Z' },
  ],
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const findings = [];
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => findings.push(name + ': page error ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') findings.push(name + ': console error ' + message.text()); });
  await page.route('**/api/admin/analytics*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANALYTICS) }));
  await page.route('**/api/admin/feedback*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEEDBACK) }));
  await page.goto('http://127.0.0.1:5179/admin.html');
  await page.waitForTimeout(700);

  for (const tab of ['Overview', 'Funnel', 'Recommendation quality', 'Countries', 'Discovery', 'Location', 'Reports', 'Technical', 'Content']) {
    const button = page.locator('nav.tabs button', { hasText: tab });
    if (!(await button.count())) { findings.push(name + ': missing tab ' + tab); continue; }
    await button.first().click();
    await page.waitForTimeout(450);
    const slug = tab.toLowerCase().replace(/[^a-z]+/g, '-');
    await page.screenshot({ path: '/tmp/admin-' + name + '-' + slug + '.png', fullPage: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) findings.push(name + ': horizontal overflow on ' + tab);
    const empty = await page.locator('#body').evaluate((node) => node.textContent.trim().length);
    if (empty < 40) findings.push(name + ': ' + tab + ' rendered essentially nothing');
  }

  // Report detail + status workflow.
  await page.locator('nav.tabs button', { hasText: 'Reports' }).first().click();
  await page.waitForTimeout(500);
  const open = page.locator('#reportList button', { hasText: 'Open' });
  if (await open.count()) {
    await open.first().click();
    await page.waitForTimeout(400);
    const visible = await page.locator('#reportDialog').evaluate((node) => node.open === true);
    if (!visible) findings.push(name + ': the report detail dialog did not open');
    await page.screenshot({ path: '/tmp/admin-' + name + '-report-detail.png' });
  } else {
    findings.push(name + ': no report row to open');
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync('/tmp/admin-findings.txt', findings.join('\n') || 'none');
console.log('=== ' + findings.length + ' finding(s) ===');
for (const finding of [...new Set(findings)]) console.log('-', finding);
