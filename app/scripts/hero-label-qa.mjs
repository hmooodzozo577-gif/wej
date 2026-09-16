// Acceptance item #2 — measure, do not guess.
// Hovers and keyboard-focuses each hero control at a spread of widths, in
// both directions and both themes, and reports every geometric problem the
// brief names: collision with the country title, collision with the other
// control, horizontal overflow, and a sub-44px touch target.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5178/wej';
const OUT = process.env.OUT ?? '/tmp/hero-qa';
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 360, 390, 430, 540, 640, 768, 820, 900, 1024, 1280, 1440];
const findings = [];

function overlaps(a, b) {
  if (!a || !b) return false;
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

async function measure(page, width, lang, theme, state) {
  const report = await page.evaluate(() => {
    const box = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const hero = document.querySelector('.detail-hero');
    return {
      doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
      hero: box(hero),
      title: box(document.querySelector('.detail-hero-inner h1')),
      sub: box(document.querySelector('.detail-hero-inner .sub')),
      match: box(document.querySelector('.detail-hero-inner .detail-match')),
      previous: box(document.querySelector('.hero-nav-previous')),
      next: box(document.querySelector('.hero-nav-next')),
      // The floating caption is only a real object when it is actually
      // painted: display:none below 900px, opacity:0 until revealed.
      previousCaption: (() => {
        const label = document.querySelector('.hero-nav-previous .hero-nav-name');
        if (!label) return null;
        const style = getComputedStyle(label);
        if (style.display === 'none' || Number(style.opacity) < 0.5) return null;
        return box(label);
      })(),
      nextCaption: (() => {
        const label = document.querySelector('.hero-nav-next .hero-nav-name');
        if (!label) return null;
        const style = getComputedStyle(label);
        if (style.display === 'none' || Number(style.opacity) < 0.5) return null;
        return box(label);
      })(),
      previousLabelVisible: (() => {
        const label = document.querySelector('.hero-nav-previous .hero-nav-name');
        if (!label) return false;
        const r = label.getBoundingClientRect();
        return r.width > 1 && getComputedStyle(label).display !== 'none';
      })(),
    };
  });

  const tag = `${width}-${lang}-${theme}-${state}`;
  if (report.doc.scrollWidth > report.doc.clientWidth + 1) {
    findings.push(`${tag}: horizontal overflow ${report.doc.scrollWidth} > ${report.doc.clientWidth}`);
  }
  for (const control of ['previous', 'next']) {
    const rect = report[control];
    if (!rect) continue;
    if (rect.height < 44 - 0.5) findings.push(`${tag}: ${control} height ${rect.height.toFixed(1)} < 44`);
    for (const target of ['title', 'sub', 'match']) {
      if (overlaps(rect, report[target])) {
        findings.push(`${tag}: ${control} OVERLAPS ${target} (${JSON.stringify(rect)} vs ${JSON.stringify(report[target])})`);
      }
    }
    if (report.hero && (rect.x < report.hero.x - 0.5 || rect.x + rect.width > report.hero.x + report.hero.width + 0.5)) {
      findings.push(`${tag}: ${control} escapes the hero box`);
    }
  }
  if (overlaps(report.previous, report.next)) findings.push(`${tag}: the two controls overlap each other`);

  // The caption is the whole point of item #2: if it collides with anything,
  // the visible label is worse than the arrow alone and must not ship.
  for (const caption of ['previousCaption', 'nextCaption']) {
    const rect = report[caption];
    if (!rect) continue;
    for (const target of ['title', 'sub', 'match']) {
      if (overlaps(rect, report[target])) {
        findings.push(`${tag}: ${caption} OVERLAPS ${target} (${JSON.stringify(rect)} vs ${JSON.stringify(report[target])})`);
      }
    }
    if (report.hero && (rect.x < report.hero.x - 0.5 || rect.x + rect.width > report.hero.x + report.hero.width + 0.5)) {
      findings.push(`${tag}: ${caption} escapes the hero box`);
    }
    if (report.hero && (rect.y < report.hero.y - 0.5 || rect.y + rect.height > report.hero.y + report.hero.height + 0.5)) {
      findings.push(`${tag}: ${caption} escapes the hero vertically`);
    }
  }
  if (overlaps(report.previousCaption, report.nextCaption)) {
    findings.push(`${tag}: the two captions overlap each other`);
  }
  return report;
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const summary = [];

  for (const lang of ['ar', 'en']) {
    for (const theme of ['light', 'dark']) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/`);
        await page.evaluate((value) => localStorage.setItem('wejhaty.theme', value), theme);
        await page.goto(`${BASE}/destination/japan`);
        await page.waitForTimeout(400);
        if (lang === 'en') {
          const button = page.locator('.lang-switch button:has-text("EN")');
          if (await button.count()) { await button.first().click(); await page.waitForTimeout(250); }
        }
        const actualLang = await page.evaluate(() => document.documentElement.lang);
        if (!actualLang.startsWith(lang)) findings.push(`${width}-${lang}: language did not apply (got ${actualLang})`);

        const rest = await measure(page, width, lang, theme, 'rest');

        // Hover reveal.
        const previous = page.locator('.hero-nav-previous');
        if (await previous.count()) {
          await previous.hover();
          await page.waitForTimeout(350);
        }
        const hovered = await measure(page, width, lang, theme, 'hover-previous');
        if (width >= 900 && !hovered.previousCaption) {
          findings.push(`${width}-${lang}-${theme}: the caption did not appear on hover at a width that should show it`);
        }
        if (width < 900 && hovered.previousCaption) {
          findings.push(`${width}-${lang}-${theme}: the caption appeared below the 900px cutoff`);
        }

        const next = page.locator('.hero-nav-next');
        if (await next.count()) {
          await next.hover();
          await page.waitForTimeout(350);
        }
        await measure(page, width, lang, theme, 'hover-next');

        // Keyboard focus reveal on the same control.
        await page.evaluate(() => {
          const link = document.querySelector('.hero-nav-previous');
          if (link) link.focus();
        });
        await page.waitForTimeout(300);
        await measure(page, width, lang, theme, 'focus-previous');

        if (width === 390 || width === 1280) {
          await page.screenshot({ path: `${OUT}/hero-${width}-${lang}-${theme}.png`, clip: rest.hero ?? undefined });
        }

        summary.push({
          width, lang, theme,
          labelVisibleOnHover: !!hovered.previousCaption,
        captionWidth: hovered.previousCaption ? Math.round(hovered.previousCaption.width) : null,
        captionTop: hovered.previousCaption ? Math.round(hovered.previousCaption.y - (hovered.hero?.y ?? 0)) : null,
        captionBottom: hovered.previousCaption ? Math.round(hovered.previousCaption.y + hovered.previousCaption.height - (hovered.hero?.y ?? 0)) : null,
          restWidth: rest.previous ? Math.round(rest.previous.width) : null,
          hoverWidth: hovered.previous ? Math.round(hovered.previous.width) : null,
          titleTop: rest.title ? Math.round(rest.title.y - (rest.hero?.y ?? 0)) : null,
          controlTop: rest.previous ? Math.round(rest.previous.y - (rest.hero?.y ?? 0)) : null,
        });

        await context.close();
      }
    }
  }
  await browser.close();

  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log('width lang theme | label | caption w/top/bottom | titleTop controlTop');
  for (const row of summary.filter((r) => r.theme === 'light')) {
    console.log(`${String(row.width).padStart(5)} ${row.lang} ${row.theme} | ${row.labelVisibleOnHover ? 'YES' : ' no'} | ${row.captionWidth}w ${row.captionTop}..${row.captionBottom} | ${row.titleTop} ${row.controlTop}`);
  }
  console.log(`\n=== ${findings.length} finding(s) ===`);
  for (const finding of [...new Set(findings)]) console.log('-', finding);
}

run().catch((error) => { console.error(error); process.exit(1); });
