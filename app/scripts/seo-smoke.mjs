// v1.1 — production SEO check: what a crawler or a link preview gets from
// the live site WITHOUT running JavaScript. Plain HTTP GETs (no browser),
// so it writes nothing anywhere.
//
//   node scripts/seo-smoke.mjs [site]   (default https://hmooodzozo577-gif.github.io/wej)
const SITE = `${(process.argv[2] || 'https://hmooodzozo577-gif.github.io/wej').replace(/\/$/, '')}/`;
const UA = 'WejhatySeoSmoke/1.1 (+read-only release check)';

let passed = 0;
const failures = [];
function check(condition, label, detail = '') {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

async function get(url, { follow = true } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: follow ? 'follow' : 'manual', headers: { 'User-Agent': UA } });
      const body = response.status >= 300 && response.status < 400 ? '' : await response.text();
      return { status: response.status, headers: response.headers, body, url: response.url };
    } catch (error) {
      // Network blips only; an HTTP status is never retried.
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

const meta = (html, pattern) => html.match(pattern)?.[1];
const canonical = (html) => meta(html, /<link rel="canonical" href="([^"]+)"/);
const robots = (html) => meta(html, /<meta name="robots" content="([^"]+)"/);
const title = (html) => meta(html, /<title>([^<]*)<\/title>/);

function checkIndexable(label, page, expectedUrl) {
  check(page.status === 200, `${label}: HTTP 200`, String(page.status));
  check(robots(page.body) === 'index, follow', `${label}: robots index`, robots(page.body));
  check(canonical(page.body) === expectedUrl, `${label}: canonical`, canonical(page.body));
  check(page.body.includes(`property="og:url" content="${expectedUrl}"`), `${label}: og:url`);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) check(page.body.includes(`property="${tag}"`), `${label}: ${tag}`);
  check(/<meta name="description" content="[^"]{20,}"/.test(page.body), `${label}: description`);
  check(!/localhost|127\.0\.0\.1/.test(page.body), `${label}: no local address`);
}

// Home and Explore.
checkIndexable('home', await get(SITE), SITE);
checkIndexable('explore', await get(`${SITE}explore/`), `${SITE}explore/`);

// Sitemap and robots.
const sitemap = await get(`${SITE}sitemap.xml`);
check(sitemap.status === 200, 'sitemap.xml: HTTP 200', String(sitemap.status));
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check(locs.length >= 190, 'sitemap.xml: all destinations listed', String(locs.length));
check(locs.every((loc) => loc.startsWith(SITE)), 'sitemap.xml: only this site');
check(!/quiz|results|favorites|compare|purpose|\/il\//.test(sitemap.body), 'sitemap.xml: no private routes, no Israel');
const robotsTxt = await get(`${SITE}robots.txt`);
check(robotsTxt.status === 200 && robotsTxt.body.includes(`Sitemap: ${SITE}sitemap.xml`), 'robots.txt: points to the sitemap');

// Every destination in the sitemap, as a crawler sees it.
const destinationLocs = locs.filter((loc) => loc.includes('/destination/'));
const titles = new Map();
for (let index = 0; index < destinationLocs.length; index += 8) {
  const batch = destinationLocs.slice(index, index + 8);
  const pages = await Promise.all(batch.map((loc) => get(loc)));
  batch.forEach((loc, offset) => {
    const page = pages[offset];
    const label = loc.slice(SITE.length);
    checkIndexable(label, page, loc);
    const pageTitle = title(page.body);
    check(!titles.has(pageTitle), `${label}: unique title`, pageTitle);
    titles.set(pageTitle, label);
  });
}
console.log(`destinations checked: ${destinationLocs.length}`);

// The slash-less form redirects to the canonical document.
const bare = await get(`${SITE}destination/japan`, { follow: false });
check(bare.status === 301 && (bare.headers.get('location') ?? '').endsWith('/destination/japan/'), 'destination/japan: 301 to the canonical form', `${bare.status} ${bare.headers.get('location')}`);

// Unknown destinations are real 404s and never indexable.
const missing = await get(`${SITE}destination/not-a-country/`);
check(missing.status === 404, 'unknown destination: HTTP 404', String(missing.status));
check(robots(missing.body) === 'noindex, follow' && !canonical(missing.body), 'unknown destination: noindex, no canonical');

// Application pages answer 200 but are never indexed.
for (const path of ['purpose/', 'quiz/tourism/', 'results/', 'favorites/', 'compare/']) {
  const page = await get(`${SITE}${path}`);
  check(page.status === 200, `${path}: HTTP 200`, String(page.status));
  check(robots(page.body) === 'noindex, follow' && !canonical(page.body), `${path}: noindex, no canonical`);
}
const compareWithIds = await get(`${SITE}compare/?ids=%3Cscript%3E,japan`);
check(compareWithIds.status === 200 && !compareWithIds.body.includes('<script>alert') && robots(compareWithIds.body) === 'noindex, follow', 'compare with a hostile query: static, noindex');

// Identity files.
const manifestResponse = await get(`${SITE}manifest.webmanifest`);
let manifest = null;
try { manifest = JSON.parse(manifestResponse.body); } catch { /* reported below */ }
check(manifestResponse.status === 200 && manifest, 'manifest.webmanifest: valid JSON');
if (manifest) {
  check(manifest.start_url === new URL(SITE).pathname && manifest.scope === new URL(SITE).pathname, 'manifest: start_url and scope');
  for (const icon of manifest.icons ?? []) {
    const response = await get(new URL(icon.src, SITE).href);
    check(response.status === 200, `manifest icon ${icon.src}: HTTP 200`, String(response.status));
  }
}
for (const asset of ['favicon.ico', 'icons/apple-touch-icon.png', 'og/wejhaty-share.png']) {
  const response = await get(`${SITE}${asset}`);
  check(response.status === 200, `${asset}: HTTP 200`, String(response.status));
}

if (failures.length) {
  console.error(`SEO smoke: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`SEO smoke: ${passed} checks, 0 failed.`);
