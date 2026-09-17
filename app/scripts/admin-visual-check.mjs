// Visual QA for the private admin dashboard (worker/src/adminPage.ts),
// including the AR/EN language switcher added on top of it.
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
// on a page error, a console error, horizontal overflow, an empty panel, a
// report detail view that will not open, OR — the language feature's own
// checks — a dir/lang mismatch, a language that fails to persist across a
// reload, or ANY visible text shaped like a raw "section.key" translation
// key (a walk of every text node on the page, not just known labels).
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
  intelligence: {
    generatedAt: '2026-09-16T22:45:20.565Z',
    totalCountries: 194,
    purposes: [
      { purpose: 'tourism', modelVersion: 'tourism-v1', totalCountries: 194, sufficientDataCount: 190, insufficientDataCount: 4, averageCoverage: 92, confidenceHighCount: 120 },
      { purpose: 'work', modelVersion: 'work-v1', totalCountries: 194, sufficientDataCount: 186, insufficientDataCount: 8, averageCoverage: 91, confidenceHighCount: 124 },
      { purpose: 'education', modelVersion: 'education-v1', totalCountries: 194, sufficientDataCount: 186, insufficientDataCount: 8, averageCoverage: 88, confidenceHighCount: 101 },
      { purpose: 'medical', modelVersion: 'medical-v1', totalCountries: 194, sufficientDataCount: 188, insufficientDataCount: 6, averageCoverage: 92, confidenceHighCount: 130 },
      { purpose: 'immigration', modelVersion: 'immigration-v1', totalCountries: 194, sufficientDataCount: 183, insufficientDataCount: 11, averageCoverage: 88, confidenceHighCount: 99 },
      { purpose: 'investment', modelVersion: 'investment-v1', totalCountries: 194, sufficientDataCount: 185, insufficientDataCount: 9, averageCoverage: 91, confidenceHighCount: 112 },
      { purpose: 'wellness', modelVersion: 'wellness-v1', totalCountries: 194, sufficientDataCount: 192, insufficientDataCount: 2, averageCoverage: 92, confidenceHighCount: 128 },
    ],
  },
  // Phase 16 workstream H — AI operational metrics stub. Kept realistic
  // (a mix of success/fallback/timeout, not all-zero) so the sweep actually
  // renders the breakdown table, not just the empty/not-configured state.
  ai: {
    configured: true,
    provider: 'anthropic',
    requestCount: 412,
    successCount: 358,
    fallbackCount: 54,
    timeoutCount: 12,
    providerErrorCount: 9,
    invalidResponseCount: 24,
    rateLimitedCount: 9,
    cacheHitCount: 96,
    successRatePct: 87,
    fallbackRatePct: 13,
    cacheHitRatePct: 19,
    averageDurationMs: 1180,
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

const TAB_LABELS = {
  en: ['Overview', 'Funnel', 'Recommendation quality', 'Countries', 'Discovery', 'Location', 'Reports', 'Technical', 'Content'],
  ar: ['نظرة عامة', 'مسار الاستبيان', 'جودة التوصيات', 'الدول', 'الاستكشاف', 'الموقع', 'البلاغات', 'تقني', 'المحتوى'],
};
const OPEN_LABEL = { en: 'Open', ar: 'فتح' };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const findings = [];

async function stubApi(page) {
  await page.route('**/api/admin/analytics*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANALYTICS) }));
  await page.route('**/api/admin/feedback*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEEDBACK) }));
}

/** Every visible text node on the page. Used both for the raw-key check and
 *  for spot-checking that known labels actually changed language. */
async function visibleText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** The invariant the whole feature rests on: no text node anywhere may look
 *  like a dot-path translation key (e.g. "overview.sessions") — the exact
 *  shape a missing/broken lookup would produce if it ever fell back to
 *  returning its own key instead of an empty string. */
async function assertNoRawKeys(page, tag) {
  const offenders = await page.evaluate(() => {
    const pattern = /^[a-z][a-zA-Z]*(\.[a-zA-Z_]+)+$/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent || '').trim();
      if (text && pattern.test(text)) hits.push(text);
    }
    return hits;
  });
  for (const offender of offenders) findings.push(`${tag}: raw translation key visible: "${offender}"`);
}

// --- 1. Functional language-switch check: clicking, dir/lang, persistence -
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => findings.push('lang-switch: page error ' + error.message));
  await stubApi(page);
  await page.goto('http://127.0.0.1:5179/admin.html');
  await page.waitForTimeout(500);

  const dirLang = () => page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }));

  const initial = await dirLang();
  if (initial.lang !== 'en' || initial.dir !== 'ltr') findings.push(`lang-switch: default should be en/ltr, got ${initial.lang}/${initial.dir}`);

  await page.click('#langAr');
  await page.waitForTimeout(200);
  const afterAr = await dirLang();
  if (afterAr.lang !== 'ar' || afterAr.dir !== 'rtl') findings.push(`lang-switch: clicking AR should set ar/rtl, got ${afterAr.lang}/${afterAr.dir}`);
  const arPressed = await page.getAttribute('#langAr', 'aria-pressed');
  const enPressed = await page.getAttribute('#langEn', 'aria-pressed');
  if (arPressed !== 'true' || enPressed !== 'false') findings.push(`lang-switch: aria-pressed should reflect AR active, got ar=${arPressed} en=${enPressed}`);
  // The stub answers /api/admin/analytics unconditionally, so load()
  // succeeds immediately and the dashboard (not the login form) is what is
  // actually on screen from here on — check chrome that is really visible,
  // not the now-hidden sign-in form.
  const arText = await visibleText(page);
  if (!arText.includes('وجهتي')) findings.push('lang-switch: header did not switch to Arabic brand text');
  if (!arText.includes('عوامل التصفية')) findings.push('lang-switch: filters panel title did not switch to Arabic');
  if (arText.includes('Filters') || arText.includes('Overview')) findings.push('lang-switch: English chrome text survived the switch to Arabic');
  await assertNoRawKeys(page, 'lang-switch (ar, no auth)');

  await page.click('#langEn');
  await page.waitForTimeout(200);
  const afterEn = await dirLang();
  if (afterEn.lang !== 'en' || afterEn.dir !== 'ltr') findings.push(`lang-switch: clicking EN should revert to en/ltr, got ${afterEn.lang}/${afterEn.dir}`);
  const enText = await visibleText(page);
  if (!enText.includes('Filters')) findings.push('lang-switch: English chrome text did not return after switching back');
  if (enText.includes('عوامل التصفية')) findings.push('lang-switch: Arabic chrome text survived the switch back to English');

  // Persistence: switch to Arabic, reload, and confirm it survives without
  // re-clicking — this is the localStorage round-trip, not the button.
  await page.click('#langAr');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(500);
  const afterReload = await dirLang();
  if (afterReload.lang !== 'ar' || afterReload.dir !== 'rtl') findings.push(`lang-switch: Arabic choice did not survive a reload, got ${afterReload.lang}/${afterReload.dir}`);
  const arPressedAfterReload = await page.getAttribute('#langAr', 'aria-pressed');
  if (arPressedAfterReload !== 'true') findings.push('lang-switch: switcher UI did not reflect the persisted language after reload');

  // Reset to English and confirm THAT persists too, both directions covered.
  await page.click('#langEn');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(500);
  const backToEn = await dirLang();
  if (backToEn.lang !== 'en' || backToEn.dir !== 'ltr') findings.push(`lang-switch: English choice did not survive a reload, got ${backToEn.lang}/${backToEn.dir}`);

  await ctx.close();
}

// --- 2. Safe-storage fallback: localStorage blocked must not break the page
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => findings.push('storage-blocked: page error ' + error.message));
  await stubApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('blocked, as in Safari private browsing'); },
    });
  });
  await page.goto('http://127.0.0.1:5179/admin.html');
  await page.waitForTimeout(500);
  const stillDefaultsCorrectly = await page.evaluate(() => document.documentElement.lang === 'en');
  if (!stillDefaultsCorrectly) findings.push('storage-blocked: default language was not applied when localStorage throws');
  await page.click('#langAr');
  await page.waitForTimeout(200);
  const stillSwitches = await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl');
  if (!stillSwitches) findings.push('storage-blocked: switching language still failed to apply even though it cannot persist');
  await ctx.close();
}

// --- 3. Per-language, per-viewport sweep: screenshots + panel/report checks
for (const lang of ['en', 'ar']) {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 900 }]]) {
    const tag = `${name}-${lang}`;
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', (error) => findings.push(tag + ': page error ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') findings.push(tag + ': console error ' + message.text()); });
    // Pre-seed the persisted language before the page's own script runs, so
    // this sweep also exercises "arrives with a stored preference already
    // set" — the cold-start half of persistence, distinct from the
    // click-then-reload check above.
    await page.addInitScript((value) => { try { localStorage.setItem('wejhaty.admin.lang', value); } catch { /* ignore */ } }, lang);
    await stubApi(page);
    await page.goto('http://127.0.0.1:5179/admin.html');
    await page.waitForTimeout(600);

    const dirLang = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }));
    const expectedDir = lang === 'ar' ? 'rtl' : 'ltr';
    if (dirLang.lang !== lang || dirLang.dir !== expectedDir) findings.push(`${tag}: expected ${lang}/${expectedDir}, got ${dirLang.lang}/${dirLang.dir}`);

    const overflowAtLogin = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflowAtLogin) findings.push(`${tag}: horizontal overflow on the sign-in screen`);
    await page.screenshot({ path: `/tmp/admin-${tag}-login.png`, fullPage: false });
    await assertNoRawKeys(page, `${tag} (login)`);

    for (const label of TAB_LABELS[lang]) {
      const button = page.locator('nav.tabs button', { hasText: label });
      if (!(await button.count())) { findings.push(`${tag}: missing tab "${label}"`); continue; }
      await button.first().click();
      await page.waitForTimeout(450);
      const slug = label.replace(/[^\p{L}\p{N}]+/gu, '-');
      await page.screenshot({ path: `/tmp/admin-${tag}-${slug}.png`, fullPage: false });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`${tag}: horizontal overflow on ${label}`);
      const empty = await page.locator('#body').evaluate((node) => node.textContent.trim().length);
      if (empty < 20) findings.push(`${tag}: ${label} rendered essentially nothing`);
      await assertNoRawKeys(page, `${tag} (${label})`);
    }

    // Report detail + status workflow, in this language.
    await page.locator('nav.tabs button', { hasText: TAB_LABELS[lang][6] }).first().click();
    await page.waitForTimeout(500);
    const open = page.locator('#reportList button', { hasText: OPEN_LABEL[lang] });
    if (await open.count()) {
      await open.first().click();
      await page.waitForTimeout(400);
      const isOpen = await page.locator('#reportDialog').evaluate((node) => node.open === true);
      if (!isOpen) findings.push(`${tag}: the report detail dialog did not open`);
      const dialogOverflow = await page.evaluate(() => {
        const dialog = document.getElementById('reportDialog');
        return dialog ? dialog.scrollWidth > dialog.clientWidth + 4 : false;
      });
      if (dialogOverflow) findings.push(`${tag}: report detail dialog overflows horizontally`);
      await assertNoRawKeys(page, `${tag} (report detail)`);
      await page.screenshot({ path: `/tmp/admin-${tag}-report-detail.png` });

      // Exercise the status workflow itself, in this language: change status
      // and save. The PATCH is stubbed to a generic 200 so this proves the
      // UI round-trip, not the Worker's own persistence logic (covered by
      // admin.test.ts).
      await page.route('**/api/admin/feedback/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: true }) }));
      const statusSelect = page.locator('#reportStatus');
      await statusSelect.selectOption('resolved');
      await page.click('#reportSave');
      await page.waitForTimeout(400);
      const dialogClosed = await page.locator('#reportDialog').evaluate((node) => node.open === false);
      if (!dialogClosed) findings.push(`${tag}: saving a report status did not close the dialog`);
    } else {
      findings.push(`${tag}: no report row to open`);
    }

    await ctx.close();
  }
}

await browser.close();
fs.writeFileSync('/tmp/admin-findings.txt', findings.join('\n') || 'none');
console.log('=== ' + findings.length + ' finding(s) ===');
for (const finding of [...new Set(findings)]) console.log('-', finding);
process.exit(findings.length ? 1 : 0);
