// v1.1 — static route documents for GitHub Pages.
//
// Pages cannot rewrite URLs, so before v1.1 a direct visit to
// /destination/japan was answered by 404.html (HTTP 404) and every page
// carried the same title. After Vite writes dist/, this plugin writes one
// real document per page — dist/destination/japan/index.html and so on —
// from the built index.html, with that page's title, description,
// canonical link, robots rule, Open Graph/Twitter tags and structured data.
// The page's own scripts and CSP are untouched, so React boots exactly as
// before; only the <head> differs. It also writes sitemap.xml, robots.txt,
// manifest.webmanifest and a noindex 404.html.
//
// The metadata lives in src/seo (one source for the build and the running
// app). It is loaded through Vite's own module loader so the app's
// TypeScript and JSON imports resolve exactly as they do in the app.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createServer, type Plugin } from 'vite';
import type { SiteConfig } from './site.ts';

interface PageLike {
  kind: string;
  path: string | null;
  index: boolean;
}

interface SeoModules {
  meta: {
    staticPages(): PageLike[];
    NOT_FOUND_META: PageLike;
  };
  document: {
    renderDocument(template: string, meta: PageLike, site: SiteConfig): string;
    sitemapXml(pages: PageLike[], site: SiteConfig): string;
    robotsTxt(site: SiteConfig): string;
    webManifest(site: SiteConfig): string;
  };
}

async function loadSeoModules(root: string): Promise<SeoModules> {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const meta = (await server.ssrLoadModule('/src/seo/meta.ts')) as SeoModules['meta'];
    const document = (await server.ssrLoadModule('/src/seo/document.ts')) as SeoModules['document'];
    return { meta, document };
  } finally {
    await server.close();
  }
}

function write(outDir: string, relativePath: string, content: string) {
  const file = join(outDir, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export function seoPages(site: SiteConfig): Plugin {
  let root = process.cwd();
  let outDir = resolve(root, 'dist');
  return {
    name: 'wejhaty-seo-pages',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      const { meta, document } = await loadSeoModules(root);
      const pages = meta.staticPages();
      for (const page of pages) {
        write(outDir, `${page.path}index.html`, document.renderDocument(template, page, site));
      }
      // GitHub Pages answers unknown paths with 404.html (status 404). The
      // app still routes there (an unknown destination shows "not found"),
      // and the document itself says noindex.
      write(outDir, '404.html', document.renderDocument(template, meta.NOT_FOUND_META, site));
      write(outDir, 'sitemap.xml', document.sitemapXml(pages, site));
      write(outDir, 'robots.txt', document.robotsTxt(site));
      write(outDir, 'manifest.webmanifest', document.webManifest(site));
      this.info?.(`wrote ${pages.length} page documents, 404.html, sitemap.xml, robots.txt, manifest.webmanifest`);
    },
  };
}
