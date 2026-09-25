// v1.1 — checks a finished build for the SEO guarantees before it ships.
//
//   node scripts/verify-seo-build.mjs [dist] [site-url]
//     site-url defaults to https://hmooodzozo577-gif.github.io/wej/
//
// Reads only the files the build wrote: no network, no browser. Exits 1 on
// the first class of failure, listing every offending file.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const siteUrl = process.argv[3] ?? 'https://hmooodzozo577-gif.github.io/wej/';
const site = new URL(siteUrl);
const basePath = site.pathname;

const failures = [];
let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'assets' ? [] : htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const read = (path) => readFileSync(path, 'utf8');
const attr = (html, pattern) => html.match(pattern)?.[1];
const canonicalOf = (html) => attr(html, /<link rel="canonical" href="([^"]+)"/);
const robotsOf = (html) => attr(html, /<meta name="robots" content="([^"]+)"/);
const titleOf = (html) => attr(html, /<title>([^<]*)<\/title>/);
// Structured data may describe; it may never assert a rating, a review, an
// offer or a price. (Checked on keys: an editorial description may mention
// prices in words.)
const FORBIDDEN_KEYS = /^(aggregateRating|review|reviews|offers|price|priceRange|ratingValue)$/i;
const keysOf = (value) => (value && typeof value === 'object'
  ? Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)])
  : []);

// --- Pages -------------------------------------------------------------
const files = htmlFiles(dist);
const destinationFiles = files.filter((file) => /destination[\\/][^\\/]+[\\/]index\.html$/.test(file));
check(destinationFiles.length >= 190, `expected about 194 destination documents, found ${destinationFiles.length}`);

const titles = new Map();
for (const file of files) {
  const html = read(file);
  const rel = relative(dist, file).replaceAll('\\', '/');
  check(!/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(html), `${rel}: mentions a local address`);
  check(/<meta name="description" content="[^"]{20,}"/.test(html), `${rel}: no description`);
  check(/<meta http-equiv="Content-Security-Policy"/.test(html), `${rel}: lost its CSP`);
  check(/<script type="module"[^>]+src="[^"]+"/.test(html), `${rel}: lost the app script`);
  check(html.includes(`href="${basePath}manifest.webmanifest"`), `${rel}: no manifest link`);
  const robots = robotsOf(html);
  const expectIndexed = rel === 'index.html' || rel === 'explore/index.html' || rel.startsWith('destination/');
  if (expectIndexed) {
    const expected = new URL(rel.replace(/index\.html$/, ''), siteUrl).href;
    check(robots === 'index, follow', `${rel}: should be indexable, robots=${robots}`);
    check(canonicalOf(html) === expected, `${rel}: canonical ${canonicalOf(html)} ≠ ${expected}`);
    check(html.includes(`property="og:url" content="${expected}"`), `${rel}: og:url missing or wrong`);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) check(html.includes(`property="${tag}"`), `${rel}: no ${tag}`);
    check(html.includes('name="twitter:card"'), `${rel}: no twitter:card`);
    for (const match of html.matchAll(/(?:href|content)="(https?:\/\/[^"]+)"/g)) {
      const url = new URL(match[1]);
      const allowedExternal = ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.host);
      check(allowedExternal || url.href.startsWith(siteUrl), `${rel}: absolute URL outside the site origin: ${url.href}`);
    }
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let data = null;
      try { data = JSON.parse(match[1]); } catch { check(false, `${rel}: invalid JSON-LD`); }
      if (data) check(!keysOf(data).some((key) => FORBIDDEN_KEYS.test(key)), `${rel}: JSON-LD claims ratings, reviews or prices`);
    }
    if (rel.startsWith('destination/')) {
      const title = titleOf(html);
      check(!titles.has(title), `${rel}: duplicate title "${title}" (also ${titles.get(title)})`);
      titles.set(title, rel);
    }
  } else {
    check(robots === 'noindex, follow', `${rel}: should be noindex, robots=${robots}`);
    check(!canonicalOf(html), `${rel}: noindex page has a canonical link`);
  }
}
check(!files.some((file) => /destination[\\/](il|israel|isr)[\\/]/i.test(file)), 'an Israel destination document exists');
check(existsSync(join(dist, '404.html')), 'no 404.html');

// --- Sitemap, robots, manifest ------------------------------------------
const sitemap = read(join(dist, 'sitemap.xml'));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check(locs.length === destinationFiles.length + 2, `sitemap has ${locs.length} URLs, expected ${destinationFiles.length + 2}`);
for (const file of destinationFiles) {
  const expected = new URL(relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, ''), siteUrl).href;
  check(locs.includes(expected), `sitemap is missing ${expected}`);
}
check(locs.every((loc) => loc.startsWith(siteUrl)), 'sitemap contains a URL outside the site');
check(!/quiz|results|favorites|compare|purpose|admin|\/il\/|lastmod/.test(sitemap), 'sitemap lists a private route or an invented lastmod');
check(read(join(dist, 'robots.txt')).includes(`Sitemap: ${new URL('sitemap.xml', siteUrl).href}`), 'robots.txt does not point to the sitemap');
const manifest = JSON.parse(read(join(dist, 'manifest.webmanifest')));
check(manifest.start_url === basePath && manifest.scope === basePath, 'manifest start_url/scope do not match the base path');
for (const icon of manifest.icons) {
  const path = join(dist, icon.src.slice(basePath.length));
  check(existsSync(path), `manifest icon missing: ${icon.src}`);
}
for (const asset of ['favicon.ico', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'og/wejhaty-share.png']) {
  check(existsSync(join(dist, asset)), `missing ${asset}`);
}

if (failures.length) {
  console.error(`SEO build check: ${failures.length} of ${checks} checks failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`SEO build check: ${checks} checks passed (${files.length} documents, ${destinationFiles.length} destinations, ${locs.length} sitemap URLs).`);
