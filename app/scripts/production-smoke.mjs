// Phase 20 — read-only production smoke test for the deployed site.
//
// Runs on a GitHub-hosted runner (see .github/workflows/production-smoke.yml)
// because the development sandbox cannot reach github.io. It only READS the
// public site: every request to the Worker is blocked inside the browser so
// the check writes no analytics event, rating, feedback or cache row.
//
// Usage: node scripts/production-smoke.mjs [siteUrl] [engines]
// engines: comma-separated chromium,firefox,webkit,msedge (default: the
// first three). msedge is the real Microsoft Edge installed on the runner.
// WebKit here is Playwright's Linux WebKit build — the Safari engine, not
// Safari itself — so it never stands in for a real Safari/iOS check (see
// safari-smoke.mjs for real Safari on macOS).
// Exit status 0 only when every check passes.
import { chromium, firefox, webkit } from 'playwright';

const SITE = (process.argv[2] || 'https://hmooodzozo577-gif.github.io/wej').replace(/\/$/, '');
const ENGINES = { chromium, firefox, webkit, msedge: { launch: () => chromium.launch({ channel: 'msedge' }) } };
const engineNames = (process.argv[3] || 'chromium,firefox,webkit').split(',').filter((name) => name in ENGINES);
const WORKER_HOST = 'wejhaty-travel-worker.hmooodzozo577.workers.dev';
let checks = 0;
let failures = 0;
const check = (ok, label, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function text(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'WejhatyProductionSmoke/1.0' } });
  return { status: response.status, body: await response.text() };
}

// 1. The deployed bundle is the current one.
const home = await text(`${SITE}/`);
check(home.status === 200, 'home page responds 200', String(home.status));
const script = /assets\/index-[\w-]+\.js/.exec(home.body)?.[0];
const style = /assets\/index-[\w-]+\.css/.exec(home.body)?.[0];
console.log(`deployed bundle: ${script} ${style}`);
const js = script ? await text(`${SITE}/${script}`) : { status: 0, body: '' };
const css = style ? await text(`${SITE}/${style}`) : { status: 0, body: '' };
check(css.body.includes('#c0532c') || css.body.includes('#C0532C'), 'CSS carries the accessible CTA orange');
check(css.body.includes('.entry-row'), 'CSS carries the entry-requirements styles');
// The main chunk imports it relatively ("./entryRequirements-<hash>.js").
const entryChunk = /entryRequirements-[\w-]+\.js/.exec(js.body)?.[0];
check(!!entryChunk, 'entry-requirements snapshot is a separate lazy chunk', entryChunk ?? 'missing');
if (entryChunk) {
  const chunk = await text(`${SITE}/assets/${entryChunk}`);
  check(chunk.status === 200 && chunk.body.includes('entry-sources-1.0'), 'snapshot chunk is served');
  check(!/"IL"\s*:/.test(chunk.body), 'snapshot has no IL entry');
}

// 2. The live product in real browser engines.
for (const engine of engineNames) {
  const browser = await ENGINES[engine].launch();
  try {
  async function page(viewport, theme, lang) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript((value) => localStorage.setItem('wejhaty.theme', value), theme);
    await context.route(`https://${WORKER_HOST}/**`, (route) => route.abort());
    const tab = await context.newPage();
    const errors = [];
    const passportLeaks = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    // A leak is any request to a visa/passport route, or any body carrying a
    // passport/nationality field with a text value. The anonymous
    // "quiz_passport_choice" event only ever carries { chosen: true|false }.
    tab.on('request', (request) => {
      const body = request.postData() ?? '';
      if (/passport|\/api\/visa/i.test(request.url()) || /"[\w-]*(passport|nationality)[\w-]*"\s*:\s*"/i.test(body)) passportLeaks.push(request.url());
    });
    await tab.goto(`${SITE}/`, { waitUntil: 'networkidle' });
    if (lang === 'en') {
      await tab.evaluate(() => [...document.querySelectorAll('.lang-switch button')].find((b) => b.textContent.trim() === 'EN')?.click());
      await tab.waitForTimeout(300);
    }
    return { context, tab, errors, passportLeaks };
  }

  for (const [viewport, theme, lang] of [
    [{ width: 390, height: 844 }, 'light', 'ar'],
    [{ width: 1440, height: 900 }, 'light', 'en'],
    [{ width: 390, height: 844 }, 'dark', 'en'],
    [{ width: 1440, height: 900 }, 'dark', 'ar'],
  ]) {
    const where = `${engine} ${lang}/${theme}/${viewport.width}`;
    const { context, tab, errors } = await page(viewport, theme, lang);
    check((await tab.textContent('.hero-stat b'))?.trim() === '194', `${where} hero stat reads 194`);
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${where} no horizontal overflow`, String(overflow));
    const cta = await tab.evaluate(() => getComputedStyle(document.querySelector('.home-hero-frame .btn-gold')).backgroundColor);
    check(cta === 'rgb(192, 83, 44)', `${where} CTA background`, cta);
    check(errors.length === 0, `${where} no page errors`, errors.join(' | '));
    await context.close();
  }

  // Theme menu stays on screen on a phone.
  {
    const { context, tab } = await page({ width: 360, height: 800 }, 'light', 'en');
    await tab.click('.hamburger');
    await tab.click('.mobile-menu-controls .theme-switch .wj-select-trigger');
    const box = await tab.evaluate(() => { const r = document.querySelector('.mobile-menu-controls .wj-select-popover').getBoundingClientRect(); return [r.left, r.right, document.documentElement.clientWidth]; });
    check(box[0] >= 0 && box[1] <= box[2], `${engine} phone theme menu inside the viewport`, box.map(Math.round).join(','));
    await context.close();
  }

  // Passport flow: information only, session-only, never sent anywhere.
  {
    const { context, tab, errors, passportLeaks } = await page({ width: 1280, height: 900 }, 'light', 'ar');
    await tab.goto(`${SITE}/quiz/tourism`, { waitUntil: 'networkidle' });
    for (let i = 0; i < 20 && !(await tab.$('.quiz-passport')); i += 1) {
      const now = await tab.$('.quiz-checkpoint .btn-primary');
      if (now) { await now.click(); await tab.waitForTimeout(300); continue; }
      const option = await tab.$('.q-option');
      if (option) { await option.click(); await tab.waitForTimeout(450); }
    }
    check(!!(await tab.$('.quiz-passport')), `${engine} passport step reached`);
    // The coverage line appears once the lazily loaded snapshot arrives.
    await tab.waitForFunction(() => /التغطية جزئية/.test(document.querySelector('.quiz-passport')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
    check(/التغطية جزئية: \d+ وجهة/.test((await tab.textContent('.quiz-passport')) ?? ''), `${engine} passport step states partial coverage`);
    await tab.click('#passport-select');
    await tab.fill('.wj-select-search input', 'السعودية');
    await tab.click('.wj-select-option');
    await tab.click('.quiz-passport .btn-primary');
    await tab.waitForURL(/\/results$/);
    await tab.waitForSelector('.entry-list', { timeout: 15000 });
    check((await tab.$$('.entry-row')).length === 5, `${engine} results show five entry rows`);
    await tab.goto(`${SITE}/destination/france`, { waitUntil: 'networkidle' });
    // A full navigation clears the in-memory passport, by design.
    check(!(await tab.$('.entry-card')), `${engine} passport does not survive a full page load`);
    const stored = await tab.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    check(!/passport/i.test(stored), `${engine} passport not stored in the browser`);
    check(passportLeaks.length === 0, `${engine} passport never sent over the network`, passportLeaks.join(' '));
    check(errors.length === 0, `${engine} passport flow without page errors`, errors.join(' | '));
    await context.close();
  }

  // Destination match: a destination's "how well does it match me" flow
  // returns to that destination with its Personal Match (Phase 20).
  {
    const { context, tab, errors } = await page({ width: 390, height: 844 }, 'light', 'ar');
    const answerQuestionnaire = async (pick) => {
      for (let i = 0; i < 25 && !(await tab.$('.quiz-passport')); i += 1) {
        const now = await tab.$('.quiz-checkpoint .btn-primary');
        if (now) { await now.click(); await tab.waitForTimeout(300); continue; }
        const options = await tab.$$('.q-option');
        if (options.length) { await options[Math.min(pick, options.length - 1)].click(); await tab.waitForTimeout(450); }
      }
      await tab.click('.quiz-passport .btn-ghost:last-child');
    };
    await tab.goto(`${SITE}/destination/japan`, { waitUntil: 'networkidle' });
    await tab.click('.personal-match-card.is-empty a.btn');
    await tab.waitForURL(/\/purpose$/);
    await tab.click('.purpose-card');
    await tab.waitForURL(/\/quiz\//);
    await answerQuestionnaire(0);
    await tab.waitForURL(/\/destination\/japan$/, { timeout: 15000 }).catch(() => {});
    check(/\/destination\/japan$/.test(tab.url()), `${engine} destination match returns to Japan`, tab.url());
    const score = await tab.textContent('.personal-match-card:not(.is-empty) .personal-match-value b').catch(() => null);
    check(/^\d+%$/.test(score ?? ''), `${engine} destination match shows Japan's Personal Match`, String(score));
    // "Edit my preferences" on the same page also returns to Japan.
    await tab.click('.personal-match-actions .btn');
    await tab.waitForURL(/\/quiz\//);
    await answerQuestionnaire(2);
    await tab.waitForURL(/\/destination\/japan$/, { timeout: 15000 }).catch(() => {});
    check(/\/destination\/japan$/.test(tab.url()), `${engine} edit preferences returns to Japan`, tab.url());
    const edited = await tab.textContent('.personal-match-card:not(.is-empty) .personal-match-value b').catch(() => null);
    check(/^\d+%$/.test(edited ?? ''), `${engine} edit preferences shows Japan's updated match`, `${score} -> ${edited}`);
    check(errors.length === 0, `${engine} destination match without page errors`, errors.join(' | '));
    await context.close();
  }
  } catch (error) {
    // One engine failing must not hide the others' results.
    check(false, `${engine} run completed`, error.message.split('\n')[0]);
  }
  await browser.close();
}

console.log(`Production smoke: ${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
