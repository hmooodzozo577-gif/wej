// Delivery-critical behaviour, checked against the PRODUCTION BUNDLE.
//
// Unit tests prove the components behave; this proves the shipped build
// behaves, against a Worker stubbed to return exactly what production
// returns TODAY — no D1, no visa provider, no Turnstile, no city
// description available. Those are the three states the user actually meets,
// and each of them has to fail honestly rather than silently or fatally.
//
// Usage:
//   VITE_TRAVEL_WORKER_URL=http://127.0.0.1:5180 npm run build
//   node scripts/delivery-behaviour-check.mjs
//
// The script serves app/dist itself, so nothing else needs to be running.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const APP_PORT = Number(process.env.APP_PORT ?? 5181);
const WORKER_PORT = Number(process.env.WORKER_PORT ?? 5180);
const BASE = `http://127.0.0.1:${APP_PORT}/wej`;

const failures = [];
const workerCalls = [];
function check(name, condition, detail) {
  if (condition) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const appServer = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  let file = path.join(root, url.pathname.replace(/^\/wej/, '') || '/');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

/** Production today: the Worker is deployed, but it has no D1 binding, no
 *  visa provider and no Turnstile secret. */
const workerServer = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  const send = (status, body) => {
    response.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'OPTIONS') { send(204, {}); return; }
  workerCalls.push({ method: request.method, path: url.pathname });

  if (url.pathname === '/api/visa/status') return send(200, { providerConfigured: false, provider: null });
  if (url.pathname === '/api/visa/requirements') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      send(200, {
        requirement: {
          passportCode: parsed.passportCode, destinationCode: parsed.destinationCode,
          category: 'unknown', provider: 'unavailable', checkedAt: new Date().toISOString(),
          details: 'No entry-requirement provider is configured for this deployment.',
        },
        providerConfigured: false,
      });
    });
    return undefined;
  }
  if (url.pathname === '/api/cities/descriptions') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      send(200, {
        descriptions: (parsed.cities ?? []).map((city) => ({
          cityName: city.name, countryCode: parsed.countryCode, lang: parsed.lang,
          status: 'unavailable', summary: null, source: null, sourceUrl: null,
          license: null, licenseUrl: null, fetchedAt: null,
        })),
        attribution: { source: 'Wikipedia', license: 'CC BY-SA 4.0' },
      });
    });
    return undefined;
  }
  // Everything that needs D1 is unavailable, exactly as today.
  return send(503, { error: 'product_data_unavailable' });
});

async function visit(page, route, lang, settle = 600) {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(settle);
  if (lang === 'en') {
    const button = page.locator('.lang-switch button:has-text("EN")');
    if (await button.count()) { await button.first().click(); await page.waitForTimeout(250); }
  }
}

async function run() {
  await new Promise((resolve) => appServer.listen(APP_PORT, '127.0.0.1', resolve));
  await new Promise((resolve) => workerServer.listen(WORKER_PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // --- A. The passport step with NO provider -----------------------------
  console.log('\nA. Passport step, no visa provider configured');
  await visit(page, '/quiz/tourism', 'en');
  for (let step = 0; step < 14; step += 1) {
    if (await page.locator('.quiz-passport').count()) break;
    const checkpoint = page.locator('.quiz-checkpoint-actions .btn-primary');
    if (await checkpoint.count()) { await checkpoint.click(); await page.waitForTimeout(300); continue; }
    const option = page.locator('.q-option').first();
    if (!(await option.count())) break;
    await option.click();
    await page.waitForTimeout(260);
  }
  const onPassport = await page.locator('.quiz-passport').count();
  check('the passport step is reached', onPassport > 0);
  if (onPassport) {
    const text = await page.locator('.quiz-passport').innerText();
    check('it says live entry-requirement data is NOT switched on', /not switched on yet/i.test(text), text.slice(0, 120));
    check('it does NOT claim the choice changes recommendations today', /does not change your recommendations/i.test(text));
    check('it says no passport number is ever asked for', /never ask for, see, or store a passport number/i.test(text));
    check('it says the passport country is not the traveller\'s location', /not your location/i.test(text));
    check('it offers a real skip', await page.locator('.quiz-passport .btn-ghost').count() > 0);
    check('the provider status endpoint was actually consulted', workerCalls.some((call) => call.path === '/api/visa/status'));
  }

  // --- B. Results with a passport but an 'unknown' answer ----------------
  console.log('\nB. Results with a passport, provider answering "unknown"');
  if (onPassport) {
    const trigger = page.locator('#passport-select');
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(250);
      const search = page.locator('.wj-select-search input, input[type="search"]').first();
      if (await search.count()) { await search.fill('Saudi'); await page.waitForTimeout(250); }
      const option = page.locator('[role="option"]').first();
      if (await option.count()) await option.click();
      await page.waitForTimeout(250);
    }
    await page.locator('.quiz-passport .btn-primary').click();
    await page.waitForTimeout(1200);
  }
  const results = await page.locator('.result-card, .results-list, [class*="result"]').count();
  check('results render with a passport chosen', results > 0);
  check('no uncaught page error on the results path', pageErrors.length === 0, pageErrors.join(' | '));
  const bodyText = await page.locator('body').innerText();
  check('no fabricated visa category is shown', !/visa[- ]free|visa on arrival/i.test(bodyText), 'found a visa claim with no provider');

  // --- C. Rating submission with NO D1 -----------------------------------
  console.log('\nC. Rating submission with no product database');
  const rating = page.locator('.result-rating');
  if (await rating.count()) {
    await rating.scrollIntoViewIfNeeded();
    const stars = page.locator('.result-rating .rating-stars button, .result-rating [role="radio"]');
    check('the star control is present', await stars.count() > 0);
    if (await stars.count()) {
      await stars.nth(3).click();
      await page.waitForTimeout(200);
      const submit = page.locator('.result-rating .btn-primary');
      check('submit becomes enabled once a score is chosen', !(await submit.isDisabled()));
      await submit.click();
      await page.waitForTimeout(900);
      const alert = page.locator('.result-rating .form-error');
      check('the failure is shown, not swallowed', await alert.count() > 0);
      check('the failure is announced to assistive tech', await alert.first().getAttribute('role') === 'alert');
      const label = await submit.innerText();
      check('the button offers a retry that keeps what was typed', /retry|try again|إعادة/i.test(label), label);
      check('the rating request really was attempted', workerCalls.some((call) => call.path === '/api/ratings'));
      check('no success message is shown', !/thank/i.test(await page.locator('.result-rating').innerText()));
    }
  } else {
    check('the results rating form is present', false);
  }

  // --- D. City cards with no description available -----------------------
  console.log('\nD. City cards when no description can be verified');
  await visit(page, '/destination/japan', 'en', 800);
  const citiesSummary = page.locator('.featured-cities-card > summary');
  if (await citiesSummary.count()) {
    await citiesSummary.click();
    await page.waitForTimeout(600);
    const firstCity = page.locator('.featured-city > summary').first();
    if (await firstCity.count()) { await firstCity.click(); await page.waitForTimeout(700); }
    check('the structured facts still render', await page.locator('.city-facts').count() > 0);
    check('no description block is rendered when nothing was verified', await page.locator('.city-description').count() === 0);
    check('no invented sentence appears in its place',
      !/is one of the major cities|is a major city of/i.test(await page.locator('.featured-cities-card').innerText()));
  } else {
    check('the featured cities card is present', false);
  }

  // --- E. Location gating ------------------------------------------------
  console.log('\nE. Location-dependent behaviour without a granted location');
  await visit(page, '/explore', 'en', 700);
  const exploreText = await page.locator('body').innerText();
  check('distance sorts are explained rather than silently missing',
    /share your location to enable sorting by nearest and farthest/i.test(exploreText));

  check('no uncaught page error anywhere in this run', pageErrors.length === 0, pageErrors.join(' | '));

  await browser.close();
  appServer.close();
  workerServer.close();

  console.log(`\n=== ${failures.length} failure(s) ===`);
  for (const failure of failures) console.log('-', failure);
  process.exit(failures.length ? 1 : 0);
}

run().catch((error) => { console.error(error); process.exit(1); });
