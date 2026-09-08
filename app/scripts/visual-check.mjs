// Phase 8 visual verification — ephemeral script, not part of the shipped
// app (playwright itself is installed with --no-save and removed after).
// Drives the real running dev server with a real browser and captures
// screenshots for a practical AR/EN/RTL/LTR/mobile comparison against the
// original wejhaty.html.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-wej/99f0f427-eb64-5c30-abe6-26f7b3a8f05c/scratchpad/visual-check';
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name);
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---- Desktop, Arabic (default) ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + '/');
    await page.waitForTimeout(300);
    const dir = await page.evaluate(() => document.documentElement.dir);
    const lang = await page.evaluate(() => document.documentElement.lang);
    console.log('Home AR: dir=', dir, 'lang=', lang);
    await shot(page, '01-home-ar-desktop');

    await page.click('button:has-text("ابدأ الاختبار")');
    await page.waitForTimeout(200);
    await shot(page, '02-purpose-select-ar-desktop');

    // Pick "Tourism & Vacation" (first purpose card)
    await page.click('.purpose-card >> nth=0');
    await page.waitForTimeout(200);
    await shot(page, '03-quiz-q1-ar-desktop');

    // Answer through the whole tourism quiz (7 questions) by always picking
    // the first option, then clicking Next, ending on "See results".
    for (let i = 0; i < 8; i++) {
      const opt = page.locator('.q-option').first();
      if (await opt.count()) await opt.click();
      const nextBtn = page.locator('.quiz-nav .btn-primary');
      const text = await nextBtn.textContent();
      await nextBtn.click();
      await page.waitForTimeout(150);
      if (text && text.includes('النتائج')) break;
    }
    await page.waitForTimeout(600); // let the match% count-up settle
    await shot(page, '04-results-ar-desktop');

    // Open the top pick's detail
    await page.click('.top-pick');
    await page.waitForTimeout(200);
    await shot(page, '05-destination-detail-ar-desktop');

    await page.goto(BASE + '/explore');
    await page.waitForTimeout(300);
    await shot(page, '06-explore-ar-desktop');

    // Switch to English mid-session, verify LTR flips
    await page.click('.lang-switch >> text=EN');
    await page.waitForTimeout(300);
    const dirEn = await page.evaluate(() => document.documentElement.dir);
    console.log('After switching to EN: dir=', dirEn);
    await shot(page, '07-explore-en-desktop-after-switch');

    await page.close();
  }

  // ---- Mobile viewport, English default this run (fresh context) ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(BASE + '/');
    await page.waitForTimeout(300);
    await shot(page, '08-home-ar-mobile');
    // open mobile menu
    await page.click('.hamburger');
    await page.waitForTimeout(200);
    await shot(page, '09-mobile-menu-open');
    await page.close();
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
