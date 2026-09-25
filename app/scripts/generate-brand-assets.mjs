// v1.1 — generates the icon set and the sharing image from the existing
// Wejhaty mark (the compass in the header's .brand-mark: an ink disc, a
// cream ring and a gold needle). The mark is not redesigned; it is only
// drawn at the sizes browsers and home screens ask for.
//
//   node scripts/generate-brand-assets.mjs            (from app/)
//
// Writes, under public/:
//   favicon.ico                   16 + 32 px (PNG-in-ICO)
//   icons/icon.svg                scalable favicon
//   icons/apple-touch-icon.png    180 px, full-bleed (iOS rounds it)
//   icons/icon-192.png, icon-512.png
//   icons/icon-maskable-512.png   mark inside the maskable safe zone
//   og/wejhaty-share.png          1200 x 630 link-preview image
//
// The sharing image is rendered by Chromium with the site's own fonts
// (Cairo for Arabic, Fraunces for the Latin wordmark) from Google Fonts.
// Optional: PLAYWRIGHT_MODULE, CHROMIUM_PATH. Behind a proxy, run with
// NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// The exact colours of the header mark (Header.tsx, .brand-mark in the
// light theme where --ink is #17243a).
const INK = '#17243a';
const RING = '#EBE7DC';
const NEEDLE = '#D9A85C';

/** The header's 24-unit compass glyph. */
const GLYPH = `<circle cx="12" cy="12" r="9.5" stroke="${RING}" stroke-width="1.4" fill="none"/><path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" fill="${NEEDLE}"/>`;

/** The mark on a background. `glyphShare` is the glyph's width as a share of
 *  the canvas (the header uses 20 px inside a 34 px disc, about 0.59). */
function markSvg({ size, shape, glyphShare }) {
  const glyph = size * glyphShare;
  const offset = (size - glyph) / 2;
  const scale = glyph / 24;
  const background = shape === 'disc'
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${INK}"/>`
    : `<rect width="${size}" height="${size}" fill="${INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background}<g transform="translate(${offset} ${offset}) scale(${scale})">${GLYPH}</g></svg>`;
}

function write(relativePath, data) {
  const file = join(PUBLIC, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote public/${relativePath} (${data.length} bytes)`);
}

async function png(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/** An ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const favicon = markSvg({ size: 64, shape: 'disc', glyphShare: 0.62 });
write('icons/icon.svg', Buffer.from(`${favicon}\n`));
write('favicon.ico', ico([
  { size: 16, data: await png(favicon, 16) },
  { size: 32, data: await png(favicon, 32) },
]));
write('icons/icon-192.png', await png(markSvg({ size: 512, shape: 'disc', glyphShare: 0.62 }), 192));
write('icons/icon-512.png', await png(markSvg({ size: 512, shape: 'disc', glyphShare: 0.62 }), 512));
// Maskable: full-bleed square; the glyph stays well inside the 80% safe circle.
write('icons/icon-maskable-512.png', await png(markSvg({ size: 512, shape: 'square', glyphShare: 0.46 }), 512));
write('icons/apple-touch-icon.png', await png(markSvg({ size: 512, shape: 'square', glyphShare: 0.56 }), 180));

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
    background: linear-gradient(145deg, #07101c 0%, #17334a 100%);
    color: #f3f6f8; font-family: Cairo, sans-serif;
    border-bottom: 10px solid #C0532C; box-sizing: border-box;
  }
  .card { display: flex; align-items: center; gap: 56px; }
  .mark { width: 220px; height: 220px; }
  .words { display: grid; gap: 18px; }
  .ar { font-size: 118px; font-weight: 800; line-height: 1.3; }
  .en { font-family: Fraunces, serif; font-size: 52px; font-weight: 600; color: ${RING}; direction: ltr; text-align: right; }
  .line { font-size: 34px; font-weight: 600; color: ${NEEDLE}; margin-top: 14px; }
</style></head><body>
  <div class="card">
    <div class="words">
      <div class="ar">وِجهتي</div>
      <div class="en">Wejhaty</div>
      <div class="line">اكتشف وجهتك القادمة</div>
    </div>
    ${markSvg({ size: 220, shape: 'disc', glyphShare: 0.62 }).replace('<svg ', '<svg class="mark" ')}
  </div>
</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family));
  if (!fonts.some((family) => family.includes('Cairo')) || !fonts.some((family) => family.includes('Fraunces'))) {
    throw new Error(`The site fonts did not load (${fonts.join(', ') || 'none'}); refusing to render the sharing image with fallback fonts.`);
  }
  const shot = await page.screenshot({ type: 'png' });
  write('og/wejhaty-share.png', await sharp(shot).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer());
} finally {
  await browser.close();
}
