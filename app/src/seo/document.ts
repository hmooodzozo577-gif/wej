// v1.1 — turns PageMeta into what a crawler or a link preview reads without
// running JavaScript: the static <head> of each page, sitemap.xml,
// robots.txt, the web manifest and schema.org structured data.
//
// Pure string work, shared by the build (build/seoPages.ts) and the tests.
// Every value that reaches HTML or XML is escaped here.
import type { PageMeta } from './meta';
import { THEME_COLOR } from '../site/theme';

export interface SiteInfo {
  /** Scheme + host, no trailing slash. */
  origin: string;
  /** Leading and trailing slash. */
  basePath: string;
  /** origin + basePath. */
  url: string;
}

/** The one sharing image: the Wejhaty mark and name, no personal data. The
 *  destination photos are not used here because most of them are licensed
 *  CC BY / CC BY-SA and a link preview cannot show their attribution. */
export const SHARE_IMAGE = {
  path: 'og/wejhaty-share.png',
  width: 1200,
  height: 630,
  alt: 'وجهتي — Wejhaty',
} as const;

const SITE_NAME = 'وجهتي Wejhaty';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for a <script type="application/ld+json"> block: "<" is escaped so
 *  no value can close the script element. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function pageUrl(site: SiteInfo, path: string): string {
  return `${site.url}${path}`;
}

/** The static document is Arabic-first (the site's default language) but
 *  one URL serves both languages, so its title and description carry the
 *  English too. */
export function documentTitle(meta: PageMeta): string {
  if (meta.kind === 'home') return meta.title.ar;
  return `${meta.heading.ar} — ${meta.heading.en} | ${SITE_NAME}`;
}

export function documentDescription(meta: PageMeta): string {
  return `${meta.description.ar} ${meta.description.en}`;
}

export function structuredData(meta: PageMeta, site: SiteInfo): object[] {
  if (meta.kind === 'home') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'وجهتي',
      alternateName: 'Wejhaty',
      url: site.url,
      inLanguage: ['ar', 'en'],
      description: documentDescription(meta),
    }];
  }
  if (meta.kind === 'destination' && meta.path && meta.names) {
    const url = pageUrl(site, meta.path);
    const name = meta.names.ar;
    const nameEn = meta.names.en;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'TouristDestination',
        name,
        alternateName: nameEn,
        description: documentDescription(meta),
        url,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'وجهتي', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'استكشف الوجهات', item: pageUrl(site, 'explore/') },
          { '@type': 'ListItem', position: 3, name, item: url },
        ],
      },
    ];
  }
  return [];
}

/** The tags inserted into <head>. Indexable pages get a canonical link and
 *  full social metadata; the others say noindex and nothing else. */
export function headTags(meta: PageMeta, site: SiteInfo): string {
  const description = escapeHtml(documentDescription(meta));
  const tags = [`<meta name="description" content="${description}" />`];
  if (!meta.index || meta.path === null) {
    tags.push('<meta name="robots" content="noindex, follow" />');
    return tags.join('\n    ');
  }
  const url = escapeHtml(pageUrl(site, meta.path));
  const title = escapeHtml(documentTitle(meta));
  const image = escapeHtml(pageUrl(site, SHARE_IMAGE.path));
  tags.push(
    '<meta name="robots" content="index, follow" />',
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="ar_AR" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${SHARE_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${SHARE_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(SHARE_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  );
  for (const data of structuredData(meta, site)) {
    tags.push(`<script type="application/ld+json">${jsonForScript(data)}</script>`);
  }
  return tags.join('\n    ');
}

/** Tags every page gets: icons and the manifest, resolved against the base. */
export function identityTags(site: SiteInfo): string {
  const base = site.basePath;
  return [
    `<link rel="icon" href="${base}favicon.ico" sizes="32x32" />`,
    `<link rel="icon" href="${base}icons/icon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png" />`,
    `<link rel="manifest" href="${base}manifest.webmanifest" />`,
  ].join('\n    ');
}

/** Writes one page's document from the built index.html. */
export function renderDocument(template: string, meta: PageMeta, site: SiteInfo): string {
  if (!/<title>[^<]*<\/title>/.test(template) || !/\n[ \t]*<\/head>/.test(template)) {
    throw new Error('The built index.html has no <title> or </head> to fill.');
  }
  return template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(documentTitle(meta))}</title>`)
    .replace(/\n[ \t]*<\/head>/, () => `\n    ${identityTags(site)}\n    ${headTags(meta, site)}\n  </head>`);
}

export function sitemapXml(pages: PageMeta[], site: SiteInfo): string {
  const urls = pages
    .filter((page) => page.index && page.path !== null)
    .map((page) => `  <url><loc>${escapeHtml(pageUrl(site, page.path!))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(site: SiteInfo): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl(site, 'sitemap.xml')}\n`;
}

export function webManifest(site: SiteInfo): string {
  const base = site.basePath;
  return `${JSON.stringify({
    name: 'وجهتي — Wejhaty',
    short_name: 'وجهتي',
    description: 'Wejhaty — find your next destination.',
    lang: 'ar',
    dir: 'rtl',
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}icons/icon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
  }, null, 2)}\n`;
}
