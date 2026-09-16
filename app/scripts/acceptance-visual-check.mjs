// Visual QA for the acceptance-fix round. Ephemeral: playwright is installed
// with --no-save and this script is not part of the shipped app.
//
// Covers every combination the brief names: Arabic RTL and English LTR, on a
// narrow phone viewport and on desktop, in light and dark, with the dropdown
// OPEN, with keyboard focus visible, and on each screen the round changed —
// the hero arrows, Surprise Me's compass, the passport selector, the city
// expansion, the destination feedback form and the results feedback form.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.VISUAL_OUT ?? '/tmp/visual';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://localhost:5178/wej';

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
};

const findings = [];

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** Fails loudly on the things this round is specifically about. */
async function audit(page, name) {
  const report = await page.evaluate(() => {
    const problems = [];

    // Any horizontal overflow at all — the brief calls it out explicitly.
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) {
      problems.push(`horizontal overflow: scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth}`);
    }

    // Arabic-Indic or Persian digits anywhere visible.
    const nonLatin = /[٠-٩۰-۹]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (nonLatin.test(text)) problems.push(`non-Latin digit: ${text.trim().slice(0, 60)}`);
    }

    // A native <select> surviving anywhere is the exact item #1 regression.
    if (document.querySelector('select')) problems.push('a native <select> is still in the DOM');

    // Touch targets on the controls this round added.
    for (const selector of ['.hero-nav', '.wj-select-trigger', '.rating-stars button']) {
      for (const element of document.querySelectorAll(selector)) {
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height && (rect.width < 24 || rect.height < 24)) {
          problems.push(`small target ${selector}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        }
      }
    }
    return problems;
  });
  for (const problem of report) findings.push(`${name}: ${problem}`);
  return report;
}

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    localStorage.setItem('wejhaty.theme', value);
  }, theme);
  await page.reload();
  await page.waitForTimeout(250);
}

async function setLanguage(page, lang) {
  const label = lang === 'en' ? 'EN' : 'AR';
  const button = page.locator(`.lang-switch button:has-text("${label}")`);
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(250);
  }
}

/** Navigate AND re-apply the language.
 *
 *  page.goto() is a full document load, which resets the app's React state —
 *  including the chosen language — back to its default (Arabic). Without
 *  re-applying it after every navigation, an "English" sweep silently
 *  captures Arabic on every page after the first, which is exactly what the
 *  first run of this script did. */
async function visit(page, path, lang, settle = 500) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(settle);
  await setLanguage(page, lang);
  const actual = await page.evaluate(() => document.documentElement.lang);
  const expected = lang === 'en' ? 'en' : 'ar';
  if (!actual.startsWith(expected)) {
    findings.push(`language did not apply on ${path}: wanted ${expected}, got ${actual}`);
  }
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    for (const lang of ['ar', 'en']) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const tag = `${device}-${lang}-${theme}`;

        await page.goto(`${BASE}/`);
        await page.waitForTimeout(400);
        await setTheme(page, theme);
        await setLanguage(page, lang);
        await shot(page, `01-home-${tag}`);
        await audit(page, `home ${tag}`);

        // --- Explore: filters, the OPEN dropdown, and the compass ---------
        await visit(page, '/explore', lang);
        await shot(page, `02-explore-${tag}`);
        await audit(page, `explore ${tag}`);

        const sort = page.locator('#exSort');
        if (await sort.count()) {
          await sort.click();
          await page.waitForTimeout(250);
          await shot(page, `03-dropdown-open-${tag}`);
          await audit(page, `dropdown open ${tag}`);
          await page.keyboard.press('Escape');
        }

        // Keyboard focus ring on the same control.
        await sort.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await shot(page, `04-keyboard-focus-${tag}`);

        const spin = page.locator('.surprise-card button.btn-gold');
        if (await spin.count()) {
          await spin.click();
          await page.waitForTimeout(300);
          await shot(page, `05-surprise-spinning-${tag}`);
          await page.waitForTimeout(1200);
          await shot(page, `06-surprise-result-${tag}`);
          await audit(page, `surprise ${tag}`);
        }

        // --- Destination: hero arrows, cities, feedback -------------------
        await visit(page, '/destination/japan', lang, 600);
        await shot(page, `07-destination-hero-${tag}`);
        await audit(page, `destination ${tag}`);

        const heroNav = page.locator('.hero-nav').first();
        if (await heroNav.count()) {
          await heroNav.hover();
          await page.waitForTimeout(350);
          await shot(page, `08-hero-arrow-hover-${tag}`);
        }

        const cities = page.locator('.featured-cities-card > summary');
        if (await cities.count()) {
          await cities.click();
          await page.waitForTimeout(500);
          const firstCity = page.locator('.featured-city > summary').first();
          if (await firstCity.count()) {
            await firstCity.click();
            await page.waitForTimeout(250);
          }
          await shot(page, `09-cities-expanded-${tag}`);
          await audit(page, `cities ${tag}`);
        }

        const destinationRating = page.locator('.destination-rating');
        if (await destinationRating.count()) {
          await destinationRating.scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          await shot(page, `10-destination-feedback-${tag}`);
          await audit(page, `destination feedback ${tag}`);
        }

        // --- Questionnaire through to the passport step and results -------
        await visit(page, '/quiz/tourism', lang, 400);
        await shot(page, `11-quiz-${tag}`);
        await audit(page, `quiz ${tag}`);

        for (let step = 0; step < 12; step += 1) {
          if (await page.locator('.quiz-passport').count()) break;
          const checkpoint = page.locator('.quiz-checkpoint-actions .btn-primary');
          if (await checkpoint.count()) {
            await checkpoint.click();
            await page.waitForTimeout(300);
            continue;
          }
          const option = page.locator('.q-option').first();
          if (!(await option.count())) break;
          await option.click();
          await page.waitForTimeout(260);
        }

        if (await page.locator('.quiz-passport').count()) {
          await shot(page, `12-passport-step-${tag}`);
          await audit(page, `passport step ${tag}`);
          const passport = page.locator('#passport-select');
          if (await passport.count()) {
            await passport.click();
            await page.waitForTimeout(300);
            await shot(page, `13-passport-open-${tag}`);
            await audit(page, `passport open ${tag}`);
            await page.keyboard.press('Escape');
          }
          await page.locator('.quiz-passport .btn-primary').click();
          await page.waitForTimeout(700);
          await shot(page, `14-results-${tag}`);
          await audit(page, `results ${tag}`);

          const resultRating = page.locator('.result-rating');
          if (await resultRating.count()) {
            await resultRating.scrollIntoViewIfNeeded();
            await page.waitForTimeout(250);
            await shot(page, `15-results-feedback-${tag}`);
            await audit(page, `results feedback ${tag}`);
          }
        }

        await context.close();
        console.log(`captured ${tag}`);
      }
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'findings.txt'), findings.join('\n') || 'none');
  console.log(`\n=== ${findings.length} finding(s) ===`);
  for (const finding of [...new Set(findings)]) console.log('-', finding);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
