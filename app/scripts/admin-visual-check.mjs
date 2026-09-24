// Visual and functional QA for the private admin dashboard
// (worker/src/adminPage.ts), Phase 21 edition.
//
// Earlier rounds answered every /api/admin/* call with hand-written JSON. That
// could not catch a query that returns the wrong thing, so this version runs
// against the REAL Worker in wrangler's local mode, over a local D1 file
// filled with synthetic data — never production. Set it up with
// worker/scripts/admin-qa-seed.mjs (its header lists the four commands), then:
//
//   ADMIN_QA_URL=http://127.0.0.1:8799 ADMIN_QA_TOKEN=<token> node scripts/admin-visual-check.mjs [matrix|flows|all]
//
// Optional: PLAYWRIGHT_MODULE (where playwright or playwright-core lives),
// CHROMIUM_PATH (a Chromium binary), AXE_PATH (axe-core's axe.min.js — when
// set, every tab is also checked with axe in both languages, with the metric
// definitions closed and open), ADMIN_QA_SHOTS (screenshot folder).
//
// matrix: Arabic and English × 1440/1280/1024/390 px × all nine tabs. Fails on
// a page or console error, horizontal overflow, a dir/lang mismatch, an empty
// label or table header, any text shaped like a raw "section.key" translation
// key, or — in Arabic — any Latin word outside code, ISO codes, question IDs
// and traveller-written text (the "no raw English enums in the Arabic UI"
// rule), with the definitions both closed and open.
// flows: keyboard definition toggle and drill-down focus, the questionnaire
// purpose selector, the country filter action, the report screenshot filter,
// a failed status save (dialog stays open, error shown, Save re-enabled) and a
// successful one (announced in the live region, focus restored).
import fs from 'node:fs';

const BASE = process.env.ADMIN_QA_URL ?? 'http://127.0.0.1:8799';
const TOKEN = process.env.ADMIN_QA_TOKEN;
if (!TOKEN) { console.error('Set ADMIN_QA_TOKEN (printed by worker/scripts/admin-qa-seed.mjs).'); process.exit(2); }
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('ADMIN_QA_URL must be a local wrangler dev address.'); process.exit(2); }
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const chromium = playwright.chromium ?? playwright.default.chromium;
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const SHOTS = process.env.ADMIN_QA_SHOTS ?? null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const TABS = ['overview', 'funnel', 'quality', 'countries', 'discovery', 'location', 'reports', 'technical', 'content'];
const VIEWPORTS = [[1440, 900, 'desktop'], [1280, 800, 'laptop'], [1024, 768, 'tablet'], [390, 844, 'narrow']];
// Proper nouns and standard abbreviations that stay Latin in Arabic prose.
const ALLOWED_LATIN = ['UTC', 'GPS', 'ISO', 'IP', 'Cloudflare', 'Access', 'AR', 'EN', 'JP'];
const failures = [];
const fail = (message) => { failures.push(message); console.log(`FAIL ${message}`); };

async function open(browser, lang, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((value) => { try { localStorage.setItem('wejhaty.admin.lang', value); } catch { /* ignore */ } }, lang);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
  // The first load is refused (no token yet) before the sign-in form shows.
  page.on('console', (message) => { if (message.type() === 'error' && !/401/.test(message.text())) errors.push(`console ${message.text()}`); });
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('#loginForm:not([hidden])');
  await page.fill('#token', TOKEN);
  await page.click('#loginForm button[type=submit]');
  await page.waitForSelector('#dashboard:not([hidden])');
  await page.waitForSelector('#body .panel');
  return { context, page, errors };
}

async function gotoTab(page, index) {
  await page.locator('#tabs button').nth(index).click();
  await page.waitForTimeout(150);
  if (TABS[index] === 'reports') {
    await page.waitForFunction(() => document.querySelector('#reportList table, #reportList .empty')
      && !/…/.test(document.querySelector('#reportList').textContent.slice(0, 40)));
  }
}

function inspect(page, lang) {
  return page.evaluate(({ lang, allowed }) => {
    const issues = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) issues.push(`overflow ${root.scrollWidth}>${root.clientWidth}`);
    if (root.dir !== (lang === 'ar' ? 'rtl' : 'ltr') || root.lang !== lang) issues.push(`dir/lang ${root.dir}/${root.lang}`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      const value = text.nodeValue.trim();
      const parent = text.parentElement;
      if (!value || !parent || parent.closest('script,style,svg,[hidden],dialog:not([open])')) continue;
      if (!parent.closest('.code') && /^[a-z][a-zA-Z]*(\.[a-zA-Z_]+)+$/.test(value)) issues.push(`raw key ${value}`);
      if (lang === 'ar' && !parent.closest('.code,.iso,.qid,[dir=auto],[dir=ltr],#token,.lang-switch')) {
        const words = (value.match(/[A-Za-z][A-Za-z_]+/g) ?? []).filter((word) => !allowed.includes(word));
        if (words.length) issues.push(`latin "${words.join(' ')}" in <${parent.tagName.toLowerCase()}>: ${value.slice(0, 60)}`);
      }
    }
    document.querySelectorAll('.kpi .label').forEach((label) => { if (!label.textContent.trim()) issues.push('empty kpi label'); });
    document.querySelectorAll('th').forEach((th) => { if (!th.textContent.trim()) issues.push('empty th'); });
    return issues;
  }, { lang, allowed: ALLOWED_LATIN });
}

async function axe(page, label) {
  if (!AXE) return;
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return result.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  violations.forEach((violation) => fail(`axe ${label} ${violation}`));
}

const openDefinitions = (page) => page.evaluate(() => document.querySelectorAll('details.def').forEach((details) => { details.open = true; }));

async function matrix(browser) {
  for (const lang of ['en', 'ar']) {
    for (const [width, height, name] of VIEWPORTS) {
      const { context, page, errors } = await open(browser, lang, width, height);
      for (let index = 0; index < TABS.length; index += 1) {
        await gotoTab(page, index);
        (await inspect(page, lang)).forEach((issue) => fail(`${lang} ${name} ${TABS[index]} ${issue}`));
        if (SHOTS && (name === 'desktop' || name === 'narrow')) await page.screenshot({ path: `${SHOTS}/${lang}-${name}-${TABS[index]}.png`, fullPage: true });
        if (name === 'desktop' || (name === 'narrow' && index === 0)) {
          await axe(page, `${lang} ${name} ${TABS[index]}`);
          await openDefinitions(page);
          (await inspect(page, lang)).forEach((issue) => fail(`${lang} ${name} ${TABS[index]} [definitions open] ${issue}`));
          await axe(page, `${lang} ${name} ${TABS[index]} [definitions open]`);
        }
      }
      errors.forEach((error) => fail(`${lang} ${name} ${error}`));
      console.log(`matrix ${lang} ${name} done`);
      await context.close();
    }
  }
}

async function flows(browser) {
  for (const lang of ['en', 'ar']) {
    const { context, page, errors } = await open(browser, lang, 1440, 900);
    // Keyboard: open a definition, then drill down; focus lands on the tab's heading.
    await page.locator('.kpi details.def summary').first().focus();
    await page.keyboard.press('Enter');
    if (!(await page.locator('.kpi details.def').first().evaluate((details) => details.open))) fail(`${lang} Enter did not open the definition`);
    await page.keyboard.press('Tab');
    if (!/drill/.test(await page.evaluate(() => document.activeElement?.className ?? ''))) fail(`${lang} Tab did not reach the drill-down button`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    if ((await page.evaluate(() => document.activeElement?.tagName)) !== 'H2') fail(`${lang} drill-down did not move focus to the panel heading`);
    // Questionnaire: the purpose selector swaps the question table and keeps focus.
    await gotoTab(page, 1);
    const purposes = await page.locator('#funnelPurpose option').evaluateAll((options) => options.map((option) => option.value));
    await page.selectOption('#funnelPurpose', purposes[purposes.length - 1]);
    await page.waitForTimeout(100);
    const rows = await page.locator('#questionsPanel tbody tr').count();
    const firstQuestion = await page.locator('#questionsPanel tbody tr td:nth-child(2)').first().innerText();
    if (rows < 5) fail(`${lang} question table has ${rows} rows`);
    if (lang === 'ar' && !/[؀-ۿ]/.test(firstQuestion)) fail('ar question wording is not Arabic');
    if ((await page.evaluate(() => document.activeElement?.id)) !== 'funnelPurpose') fail(`${lang} purpose selector lost focus`);
    // Countries: the row action narrows the whole dashboard to that country.
    await gotoTab(page, 3);
    await page.locator('#body tbody button').first().click();
    await page.waitForSelector('#body .panel');
    if (!/^[A-Z]{2}$/.test(await page.inputValue('#f_country'))) fail(`${lang} country filter action did not apply`);
    await page.click('#clearFilters');
    await page.waitForSelector('#body .panel');
    // Reports: screenshot filter, then a failed and a successful status save.
    await gotoTab(page, 6);
    await page.selectOption('#r_screenshot', 'yes');
    await page.click('#body .actions button.primary');
    await page.waitForFunction(() => (document.querySelector('#reportList table') || document.querySelector('#reportList .empty'))
      && !/…/.test(document.querySelector('#reportList').textContent.slice(0, 40)));
    const shots = await page.locator('#reportList tbody tr td:nth-child(6)').allInnerTexts();
    if (shots.some((value) => value !== (lang === 'ar' ? 'نعم' : 'Yes'))) fail(`${lang} screenshot filter returned ${shots.join(',')}`);
    if (!shots.length) { fail(`${lang} no report with a screenshot to test the workflow on`); await context.close(); continue; }
    await page.locator('#reportList tbody tr button').first().click();
    await page.waitForSelector('#reportDialog[open]');
    if (/screenshots\//.test(await page.locator('#reportBody').innerText())) fail(`${lang} the report dialog shows the screenshot storage key`);
    await page.route('**/api/admin/feedback/status', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"qa"}' }));
    await page.selectOption('#reportStatus', 'resolved');
    await page.click('#reportSave');
    await page.waitForFunction(() => document.querySelector('#reportError').textContent.length > 0);
    if (!(await page.locator('#reportDialog').evaluate((dialog) => dialog.open)) || !(await page.locator('#reportSave').isEnabled())) fail(`${lang} a failed save closed the dialog or left Save disabled`);
    await page.unroute('**/api/admin/feedback/status');
    const reference = await page.inputValue('#reportReference');
    await page.click('#reportSave');
    await page.waitForFunction(() => !document.querySelector('#reportDialog').open);
    await page.waitForFunction(() => document.querySelector('#liveStatus').textContent.length > 0);
    if (!(await page.locator('#liveStatus').innerText()).includes(reference)) fail(`${lang} the save was not announced`);
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => document.activeElement?.dataset?.reference)) !== reference) fail(`${lang} focus did not return to the saved report`);
    errors.filter((error) => !/500/.test(error)).forEach((error) => fail(`${lang} flows ${error}`));
    console.log(`flows ${lang} done`);
    await context.close();
  }
}

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  if (mode === 'all' || mode === 'matrix') await matrix(browser);
  if (mode === 'all' || mode === 'flows') await flows(browser);
} finally {
  await browser.close();
}
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nadmin visual check: clean');
process.exit(failures.length ? 1 : 0);
