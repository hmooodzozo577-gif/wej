// Phase 20 — read-only check of the deployed site in REAL Safari (macOS),
// driven through Apple's safaridriver (WebDriver). Runs only on a
// GitHub-hosted macOS runner (see .github/workflows/production-smoke.yml),
// which first maps the Worker's hostname to 127.0.0.1 in /etc/hosts, so the
// browser cannot reach the Worker and the run writes no production data.
// With IOS_UDID set, the same checks drive Mobile Safari in an iOS
// Simulator on that runner (the real Safari app on simulated iOS — not a
// physical device).
//
// Usage: node scripts/safari-smoke.mjs [siteUrl]
import { Builder } from 'selenium-webdriver';

const SITE = (process.argv[2] || 'https://hmooodzozo577-gif.github.io/wej').replace(/\/$/, '');
const WORKER = 'https://wejhaty-travel-worker.hmooodzozo577.workers.dev';
const IOS_UDID = process.env.IOS_UDID || '';
const NAME = IOS_UDID ? 'ios-safari' : 'safari';
let checks = 0;
let failures = 0;
const check = (ok, label, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${NAME} ${label}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const driver = IOS_UDID
  ? await new Builder().withCapabilities({ browserName: 'safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceUDID': IOS_UDID }).build()
  : await new Builder().forBrowser('safari').build();
const js = (script, ...args) => driver.executeScript(script, ...args);
async function waitFor(predicate, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await js(`return (${predicate})();`)) return true;
    await sleep(250);
  }
  return false;
}

// Answers each question with option `pick` (or the last one) until the
// questionnaire ends, then skips the optional passport step.
async function answerQuestionnaire(pick) {
  for (let step = 0; step < 25; step += 1) {
    if (await js('return !!document.querySelector(".quiz-passport")')) break;
    const clicked = await js(`
      const now = document.querySelector('.quiz-checkpoint .btn-primary');
      if (now) { now.click(); return true; }
      const options = document.querySelectorAll('.q-option');
      if (options.length) { options[Math.min(${Number(pick)}, options.length - 1)].click(); return true; }
      return false;`);
    if (!clicked) break;
    await sleep(500);
  }
  await js('document.querySelector(".quiz-passport .btn-ghost:last-child")?.click()');
}

try {
  if (!IOS_UDID) await driver.manage().window().setRect({ width: 1280, height: 900 });
  const capabilities = await driver.getCapabilities();
  console.log(`${NAME} ${capabilities.get('browserVersion')} on ${capabilities.get('platformName')}`);

  await driver.get(`${SITE}/`);
  check(await waitFor('() => !!document.querySelector(".hero-stat b")'), 'home renders');
  // The questionnaire below would send anonymous events: only continue
  // when this browser cannot reach the Worker (blocked in /etc/hosts).
  const worker = await driver.executeAsyncScript(
    `const done = arguments[arguments.length - 1];
     fetch(arguments[0] + '/api/intelligence/SA/tourism').then(() => done('reachable'), () => done('blocked'));`,
    WORKER,
  );
  check(worker === 'blocked', 'Worker blocked, so the run writes no production data', worker);
  if (worker !== 'blocked') throw new Error('Worker reachable: interactive checks skipped');
  check((await js('return document.querySelector(".hero-stat b")?.textContent.trim()')) === '194', 'hero stat reads 194');
  const cta = await js('return getComputedStyle(document.querySelector(".home-hero-frame .btn-gold")).backgroundColor');
  check(cta === 'rgb(192, 83, 44)', 'CTA background', cta);
  const overflow = await js('return document.documentElement.scrollWidth - document.documentElement.clientWidth');
  check(overflow <= 0, 'no horizontal overflow', String(overflow));
  check((await js('return document.documentElement.dir')) === 'rtl', 'Arabic is right-to-left');

  await driver.get(`${SITE}/explore`);
  check(await waitFor('() => document.querySelectorAll(".explore-grid > *").length === 194'), 'explore lists 194 destinations');

  // Destination match: Japan → questionnaire → back on Japan with its match.
  await driver.get(`${SITE}/destination/japan`);
  check(await waitFor('() => !!document.querySelector(".personal-match-card.is-empty a.btn")'), 'destination offers the match questionnaire');
  await js('document.querySelector(".personal-match-card.is-empty a.btn").click()');
  check(await waitFor('() => location.pathname.endsWith("/purpose")'), 'purpose screen reached');
  await js('document.querySelector(".purpose-card").click()');
  await waitFor('() => location.pathname.includes("/quiz/")');
  await answerQuestionnaire(0);
  check(await waitFor('() => location.pathname.endsWith("/destination/japan")'), 'returns to Japan after the questionnaire');
  const score = await waitFor('() => /^\\d+%$/.test(document.querySelector(".personal-match-card:not(.is-empty) .personal-match-value b")?.textContent ?? "")');
  check(score, "shows Japan's Personal Match");

  // "Edit my preferences" on the same page also returns to Japan.
  await js('document.querySelector(".personal-match-actions .btn").click()');
  check(await waitFor('() => location.pathname.includes("/quiz/")'), 'edit preferences opens the questionnaire');
  await answerQuestionnaire(2);
  check(await waitFor('() => location.pathname.endsWith("/destination/japan")'), 'edit preferences returns to Japan');
  const edited = await waitFor('() => /^\\d+%$/.test(document.querySelector(".personal-match-card:not(.is-empty) .personal-match-value b")?.textContent ?? "")');
  check(edited, "shows Japan's updated match");
  const stored = await js('return JSON.stringify(Object.keys(localStorage)) + JSON.stringify(Object.keys(sessionStorage))');
  check(!/passport/i.test(stored), 'no passport data in browser storage');
} catch (error) {
  check(false, 'run completed', String(error?.message ?? error).split('\n')[0]);
} finally {
  await driver.quit();
}

console.log(`${NAME} smoke: ${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
