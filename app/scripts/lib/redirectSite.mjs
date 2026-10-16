// A build that only sends visitors to the primary site.
//
// The same source builds for three hosts. Only one of them is the site
// (https://tilqaa.pages.dev); the others — the GitHub Pages project site
// and the first Cloudflare Pages project (wej.pages.dev) — are built with
// WEJHATY_REDIRECT_TO=<primary origin>, and scripts/redirect-site.mjs then
// replaces their output with redirect documents:
//
//   - every page the build wrote (…/index.html) becomes a small document
//     at the same path that moves to the same page on the primary site
//     (meta refresh, which search engines treat as a permanent redirect,
//     plus location.replace so the query and hash are kept, plus a link);
//   - 404.html moves any other path to the same path on the primary site;
//   - robots.txt allows crawling, so the redirects can be followed.
//
// Nothing else is kept: no app bundle, no data, no sitemap.

/** The base path the build used, read from its web manifest ("/wej/" or "/"). */
export function basePathFromManifest(manifestText) {
  const manifest = JSON.parse(manifestText);
  const start = manifest.start_url;
  if (typeof start !== 'string' || !start.startsWith('/') || !start.endsWith('/')) {
    throw new Error(`Unexpected manifest start_url: ${String(start)}`);
  }
  return start;
}

/** A bare https origin, e.g. "https://tilqaa.pages.dev". */
export function normalizeTarget(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error(`Invalid redirect target: ${value}`);
  }
  if (url.protocol !== 'https:' || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash || url.username || url.password) {
    throw new Error(`The redirect target must be a bare https origin: ${value}`);
  }
  return url.origin;
}

/** "destination/japan/index.html" -> "destination/japan/"; "index.html" -> "". */
export function routeOfDocument(relativePath) {
  const path = relativePath.split('\\').join('/');
  if (path === 'index.html') return '';
  if (!path.endsWith('/index.html')) throw new Error(`Not a page document: ${relativePath}`);
  return path.slice(0, -'index.html'.length);
}

const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The document left at a page's path. */
export function redirectDocument(targetUrl) {
  const href = escapeAttr(targetUrl);
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تِلقاء — TILQAA</title>
<link rel="canonical" href="${href}">
<meta http-equiv="refresh" content="0; url=${href}">
<script>location.replace(${JSON.stringify(targetUrl)} + location.search + location.hash);</script>
</head>
<body>
<p><a href="${href}">تِلقاء — TILQAA</a></p>
</body>
</html>
`;
}

/** 404.html: any other path under the base moves to the same path there. */
export function notFoundDocument(target, basePath) {
  const home = `${target}/`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تِلقاء — TILQAA</title>
<meta name="robots" content="noindex">
<script>(function () {
  var base = ${JSON.stringify(basePath)};
  var path = location.pathname;
  var rest = path.indexOf(base) === 0 ? path.slice(base.length) : path.replace(/^\\/+/, '');
  location.replace(${JSON.stringify(home)} + rest + location.search + location.hash);
})();</script>
<meta http-equiv="refresh" content="0; url=${escapeAttr(home)}">
</head>
<body>
<p><a href="${escapeAttr(home)}">تِلقاء — TILQAA</a></p>
</body>
</html>
`;
}

export function robotsText(target) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${target}/sitemap.xml\n`;
}

/**
 * The files of the redirect build, from the list of documents the normal
 * build wrote. Refuses to build when the deployment itself is on the
 * target host (Cloudflare's CF_PAGES_URL, e.g. https://abc123.tilqaa.pages.dev):
 * that would be a redirect loop. The canonical links cannot tell, because
 * every Cloudflare build already declares the primary site as canonical.
 */
export function redirectSiteFiles({ target, basePath, deployUrl, documents }) {
  const origin = normalizeTarget(target);
  if (deployUrl) {
    const host = new URL(deployUrl).host;
    const targetHost = new URL(origin).host;
    if (host === targetHost || host.endsWith(`.${targetHost}`)) {
      throw new Error(`Refusing to redirect ${deployUrl} to itself (${origin})`);
    }
  }
  const files = new Map();
  for (const document of documents) {
    if (document === '404.html') continue;
    files.set(document, redirectDocument(`${origin}/${routeOfDocument(document)}`));
  }
  files.set('404.html', notFoundDocument(origin, basePath));
  files.set('robots.txt', robotsText(origin));
  return files;
}
