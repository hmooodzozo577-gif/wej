import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { THEME_COLOR } from '../site/theme';
import { destinationMeta, EXPLORE_META, HOME_META, metaForPath, NOT_FOUND_META, staticPages } from './meta';
import {
  documentTitle, escapeHtml, headTags, jsonForScript, renderDocument, robotsTxt, sitemapXml, structuredData, webManifest,
  type SiteInfo,
} from './document';

const PAGES_SITE: SiteInfo = { origin: 'https://hmooodzozo577-gif.github.io', basePath: '/wej/', url: 'https://hmooodzozo577-gif.github.io/wej/' };
const ROOT_SITE: SiteInfo = { origin: 'https://wejhaty.example', basePath: '/', url: 'https://wejhaty.example/' };
const TEMPLATE = '<!doctype html>\n<html lang="ar" dir="rtl">\n  <head>\n    <title>وِجهتي — Wejhaty</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n';

describe('page metadata', () => {
  const pages = staticPages();
  const destinations = pages.filter((page) => page.kind === 'destination');

  it('gives every canonical destination its own indexable page', () => {
    expect(destinations).toHaveLength(WORLD_CATALOG.length);
    expect(new Set(destinations.map((page) => page.path)).size).toBe(WORLD_CATALOG.length);
    for (const page of destinations) {
      expect(page.index).toBe(true);
      expect(page.path).toMatch(/^destination\/[a-z0-9-]+\/$/);
    }
  });

  it('never includes Israel', () => {
    expect(destinations.some((page) => /(^|\/)(il|israel|isr)\//i.test(page.path ?? ''))).toBe(false);
    expect(WORLD_CATALOG.some((entry) => entry.countryCode === 'IL')).toBe(false);
  });

  it('gives destinations unique titles and non-empty descriptions in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const titles = destinations.map((page) => page.title[lang]);
      expect(new Set(titles).size).toBe(titles.length);
      for (const page of destinations) expect(page.description[lang].trim().length).toBeGreaterThan(40);
    }
    expect(new Set(destinations.map(documentTitle)).size).toBe(destinations.length);
  });

  it('describes destinations only with data the site already shows', () => {
    const japan = destinationMeta(WORLD_CATALOG.find((entry) => entry.id === 'japan')!);
    expect(japan.title.ar).toBe('اليابان للسفر | وجهتي');
    expect(japan.title.en).toBe('Japan travel | Wejhaty');
    const afghanistan = destinationMeta(WORLD_CATALOG.find((entry) => entry.id === 'af')!);
    expect(afghanistan.description.en).toContain('with Kabul as its capital');
    // Each description is the destination's existing editorial line (the 30
    // full destinations) or its region and capital, plus one fixed sentence
    // about the page. That added text makes no claim of its own.
    for (const entry of WORLD_CATALOG) {
      const page = destinationMeta(entry);
      const leadAr = entry.recommendationReady ? entry.descAr.trim() : `${entry.nameAr}: وجهة في `;
      const leadEn = entry.recommendationReady ? entry.descEn.trim() : `${entry.nameEn}: a destination in `;
      expect(page.description.ar.startsWith(leadAr), entry.id).toBe(true);
      expect(page.description.en.startsWith(leadEn), entry.id).toBe(true);
      const added = `${page.description.ar.slice(leadAr.length)} ${page.description.en.slice(leadEn.length)}`.toLowerCase();
      expect(added, entry.id).not.toMatch(/visa|تأشيرة|price|سعر|safe|آمن|best|أفضل|#\d|ranked/);
    }
  });

  it('marks personal and transient application pages noindex', () => {
    for (const path of ['/purpose', '/quiz/tourism', '/results', '/favorites', '/compare']) {
      expect(metaForPath(path).index, path).toBe(false);
    }
    expect(metaForPath('/').index).toBe(true);
    expect(metaForPath('/explore').index).toBe(true);
    expect(metaForPath('/destination/japan').index).toBe(true);
  });

  it('resolves unknown paths and unknown destinations to the noindex not-found page', () => {
    for (const path of ['/destination/atlantis', '/destination/il', '/nope', '/quiz/space', '/destination/japan/extra', '/admin']) {
      expect(metaForPath(path), path).toBe(NOT_FOUND_META);
    }
    expect(NOT_FOUND_META.index).toBe(false);
    expect(NOT_FOUND_META.path).toBeNull();
  });

  it('tolerates the trailing-slash form of every static page', () => {
    for (const page of pages) {
      expect(metaForPath(`/${page.path}`).kind, page.path ?? '').toBe(page.kind);
    }
  });

  it('keeps the accepted v1.0 home titles', () => {
    expect(HOME_META.title).toEqual({ ar: 'وِجهتي — Wejhaty', en: 'Wejhaty — Find Your Destination' });
  });
});

describe('static documents', () => {
  const japan = destinationMeta(WORLD_CATALOG.find((entry) => entry.id === 'japan')!);

  it('escapes every value that reaches HTML', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    const hostile = { ...japan, heading: { ar: '</title><script>alert(1)</script>', en: '"><img src=x>' }, description: { ar: '$& $1 <b>', en: '</script>' } };
    const html = renderDocument(TEMPLATE, hostile, PAGES_SITE);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('$&amp; $1');
    expect(jsonForScript({ a: '</script><x>' })).not.toContain('</script>');
  });

  it('writes a canonical link, robots rule and social tags from the configured origin', () => {
    const html = renderDocument(TEMPLATE, japan, PAGES_SITE);
    expect(html).toContain('<title>اليابان للسفر — Japan travel | وجهتي Wejhaty</title>');
    expect(html).toContain('<link rel="canonical" href="https://hmooodzozo577-gif.github.io/wej/destination/japan/" />');
    expect(html).toContain('<meta name="robots" content="index, follow" />');
    for (const property of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image']) expect(html).toContain(`property="${property}"`);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('href="/wej/manifest.webmanifest"');
    expect(html).not.toMatch(/localhost|127\.0\.0\.1/);
    const root = renderDocument(TEMPLATE, japan, ROOT_SITE);
    expect(root).toContain('href="https://wejhaty.example/destination/japan/"');
    expect(root).toContain('href="/manifest.webmanifest"');
    expect(root).not.toContain('github.io');
    expect(root).not.toContain('/wej/');
  });

  it('gives noindex pages no canonical link and no social card', () => {
    const tags = headTags(NOT_FOUND_META, PAGES_SITE);
    expect(tags).toContain('noindex');
    expect(tags).not.toContain('canonical');
    expect(tags).not.toContain('og:');
  });

  it('emits structured data that is valid JSON with no invented ratings, reviews or prices', () => {
    for (const meta of [HOME_META, japan]) {
      const html = headTags(meta, PAGES_SITE);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]!));
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block['@context']).toBe('https://schema.org');
        const keys = JSON.stringify(block).match(/"[A-Za-z@]+":/g) ?? [];
        expect(keys.join(' ')).not.toMatch(/aggregateRating|review|offers|price|ratingValue/i);
      }
    }
    expect(structuredData(EXPLORE_META, PAGES_SITE)).toEqual([]);
  });

  it('lists only indexable canonical pages in the sitemap', () => {
    const xml = sitemapXml(staticPages(), PAGES_SITE);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(locs).toHaveLength(WORLD_CATALOG.length + 2);
    expect(locs).toContain('https://hmooodzozo577-gif.github.io/wej/');
    expect(locs).toContain('https://hmooodzozo577-gif.github.io/wej/destination/japan/');
    expect(locs.every((loc) => loc.startsWith('https://hmooodzozo577-gif.github.io/wej/'))).toBe(true);
    expect(xml).not.toMatch(/quiz|results|favorites|compare|purpose|admin|\/il\/|lastmod/);
  });

  it('points robots.txt at the sitemap', () => {
    expect(robotsTxt(PAGES_SITE)).toContain('Sitemap: https://hmooodzozo577-gif.github.io/wej/sitemap.xml');
    expect(robotsTxt(ROOT_SITE)).toContain('Sitemap: https://wejhaty.example/sitemap.xml');
  });

  it('writes a manifest scoped to the base path', () => {
    const manifest = JSON.parse(webManifest(PAGES_SITE));
    expect(manifest).toMatchObject({ start_url: '/wej/', scope: '/wej/', display: 'standalone', theme_color: THEME_COLOR.light });
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
    expect(JSON.parse(webManifest(ROOT_SITE)).start_url).toBe('/');
  });
});

describe('theme colour', () => {
  it('is the same in the inline bootstrap as everywhere else', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLOR.light}" />`);
    expect(html).toContain(`theme === 'dark' ? '${THEME_COLOR.dark}' : '${THEME_COLOR.light}'`);
  });
});
