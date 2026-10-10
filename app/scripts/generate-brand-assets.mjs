// v1.2 — publishes the approved TILQAA brand assets (logo package v2, in
// brand/tilqaa-v2) and renders the sharing image from them. The approved
// icons are copied byte for byte, never redrawn; the logo is never retyped.
//
//   node scripts/generate-brand-assets.mjs            (from app/)
//
// Copies brand/tilqaa-v2/favicon/* to public/ (the paths the pages and the
// manifest already use):
//   favicon.ico                   16 + 32 + 48 px          <- favicon.ico
//   icons/icon.svg                small-size symbol cut    <- favicon.svg
//   icons/apple-touch-icon.png    180 px                   <- apple-touch-icon.png
//   icons/icon-192.png                                     <- favicon-192.png
//   icons/icon-512.png                                     <- app-icon-512.png
//   icons/icon-maskable-512.png   maskable safe zone       <- app-icon-maskable-512.png
// Renders:
//   og/tilqaa-share.png           1200 x 630: the approved horizontal logo
//                                 (on-dark) on Night Oasis, with the tagline
//
// The sharing image is rendered by Chromium with the site's own fonts
// (Cairo for Arabic, Fraunces for Latin) from Google Fonts for the tagline.
// Optional: PLAYWRIGHT_MODULE, CHROMIUM_PATH. Behind a proxy, run with
// NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(APP, 'public');
const BRAND = join(APP, 'brand', 'tilqaa-v2');

// The approved palette (brand/tilqaa-v2/README.md).
const SAND = '#F5EFE4';
const NIGHT_OASIS = '#072523';

function write(relativePath, data) {
  const file = join(PUBLIC, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote public/${relativePath} (${data.length} bytes)`);
}

const ICONS = {
  'favicon.ico': 'favicon.ico',
  'icons/icon.svg': 'favicon.svg',
  'icons/apple-touch-icon.png': 'apple-touch-icon.png',
  'icons/icon-192.png': 'favicon-192.png',
  'icons/icon-512.png': 'app-icon-512.png',
  'icons/icon-maskable-512.png': 'app-icon-maskable-512.png',
};
for (const [target, source] of Object.entries(ICONS)) {
  copyFileSync(join(BRAND, 'favicon', source), join(PUBLIC, target));
  console.log(`copied brand/tilqaa-v2/favicon/${source} -> public/${target}`);
}

/** The approved on-dark horizontal logo, sized by CSS (its viewBox keeps
 *  the proportions). */
const LOGO = readFileSync(join(BRAND, 'svg', 'tilqaa-horizontal--color-on-dark.svg'), 'utf8')
  .replace(/ width="[^"]+" height="[^"]+"/, ' class="logo"');

// --- Sharing image ------------------------------------------------------
// The font CSS and files are fetched here and inlined, so the browser
// itself needs no network access (and nothing is written to the repo).
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Fraunces:opsz,wght@9..144,600&display=block';
const WOFF2_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

async function inlineFontCss() {
  const response = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': WOFF2_UA } });
  if (!response.ok) throw new Error(`Font CSS request failed: ${response.status}`);
  let css = await response.text();
  for (const url of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) ?? [])) {
    const font = await fetch(url);
    if (!font.ok) throw new Error(`Font request failed: ${font.status} ${url}`);
    const data = Buffer.from(await font.arrayBuffer()).toString('base64');
    css = css.replaceAll(url, `data:font/woff2;base64,${data}`);
  }
  return css;
}

const fontCss = await inlineFontCss();
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const chromium = playwright.chromium ?? playwright.default.chromium;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><head>
<style>${fontCss}</style>
<style>
  html, body { margin: 0; width: 1200px; height: 630px; }
  body {
    display: grid; place-items: center;
    background: ${NIGHT_OASIS};
    color: ${SAND}; font-family: Cairo, sans-serif;
  }
  .card { display: grid; justify-items: center; gap: 46px; }
  .logo { display: block; width: 780px; height: auto; }
  .lines { display: grid; justify-items: center; gap: 10px; opacity: 0.86; }
  .ar { font-size: 44px; font-weight: 600; line-height: 1.4; }
  .en { font-family: Fraunces, serif; font-size: 30px; font-weight: 600; direction: ltr; }
</style></head><body>
  <div class="card">
    ${LOGO}
    <div class="lines">
      <div class="ar">العالم في اتجاهك.</div>
      <div class="en">The World Within Your Reach.</div>
    </div>
  </div>
</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family));
  if (!fonts.some((family) => family.includes('Cairo')) || !fonts.some((family) => family.includes('Fraunces'))) {
    throw new Error(`The site fonts did not load (${fonts.join(', ') || 'none'}); refusing to render the sharing image with fallback fonts.`);
  }
  const shot = await page.screenshot({ type: 'png' });
  write('og/tilqaa-share.png', await sharp(shot).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer());
} finally {
  await browser.close();
}
