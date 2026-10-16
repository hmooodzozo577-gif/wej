import { describe, expect, it } from 'vitest';
import {
  basePathFromManifest,
  normalizeTarget,
  notFoundDocument,
  redirectDocument,
  redirectSiteFiles,
  routeOfDocument,
} from './redirectSite.mjs';

describe('redirect build', () => {
  it('reads the base path from the manifest', () => {
    expect(basePathFromManifest('{"start_url":"/wej/"}')).toBe('/wej/');
    expect(basePathFromManifest('{"start_url":"/"}')).toBe('/');
    expect(() => basePathFromManifest('{"start_url":"wej"}')).toThrow();
  });

  it('accepts only a bare https origin as the target', () => {
    expect(normalizeTarget('https://tilqaa.pages.dev/')).toBe('https://tilqaa.pages.dev');
    for (const bad of ['http://tilqaa.pages.dev', 'https://tilqaa.pages.dev/wej/', 'https://tilqaa.pages.dev/?a=1', 'tilqaa.pages.dev', '']) {
      expect(() => normalizeTarget(bad), bad).toThrow();
    }
  });

  it('maps each page document to its route', () => {
    expect(routeOfDocument('index.html')).toBe('');
    expect(routeOfDocument('destination/japan/index.html')).toBe('destination/japan/');
    expect(() => routeOfDocument('other.html')).toThrow();
  });

  it('writes a redirect document per page, keeping the path', () => {
    const files = redirectSiteFiles({
      target: 'https://tilqaa.pages.dev',
      basePath: '/wej/',
      documents: ['index.html', 'destination/japan/index.html', 'explore/index.html', '404.html'],
    });
    expect([...files.keys()].sort()).toEqual(['404.html', 'destination/japan/index.html', 'explore/index.html', 'index.html', 'robots.txt']);
    const japan = files.get('destination/japan/index.html');
    expect(japan).toContain('<link rel="canonical" href="https://tilqaa.pages.dev/destination/japan/">');
    expect(japan).toContain('<meta http-equiv="refresh" content="0; url=https://tilqaa.pages.dev/destination/japan/">');
    expect(japan).toContain('location.replace("https://tilqaa.pages.dev/destination/japan/" + location.search + location.hash)');
    expect(japan).not.toContain('noindex');
    expect(files.get('index.html')).toContain('href="https://tilqaa.pages.dev/"');
    expect(files.get('robots.txt')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://tilqaa.pages.dev/sitemap.xml\n');
  });

  it('refuses to redirect a deployment to its own host, and allows the old project', () => {
    const build = (deployUrl) => redirectSiteFiles({ target: 'https://tilqaa.pages.dev', basePath: '/', deployUrl, documents: ['index.html'] });
    expect(() => build('https://abc123.tilqaa.pages.dev')).toThrow(/itself/);
    expect(() => build('https://tilqaa.pages.dev')).toThrow(/itself/);
    expect(build('https://abc123.wej.pages.dev').get('index.html')).toContain('url=https://tilqaa.pages.dev/');
    expect(build(undefined).has('index.html')).toBe(true);
  });

  it('404.html moves any path under the base to the same path on the target', () => {
    const html = notFoundDocument('https://tilqaa.pages.dev', '/wej/');
    expect(html).toContain('noindex');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const run = (pathname, search = '', hash = '') => {
      let moved;
      new Function('location', script)({ pathname, search, hash, replace: (url) => { moved = url; } });
      return moved;
    };
    expect(run('/wej/favorites', '?x=1', '#a')).toBe('https://tilqaa.pages.dev/favorites?x=1#a');
    expect(run('/wej/')).toBe('https://tilqaa.pages.dev/');
    expect(run('/elsewhere')).toBe('https://tilqaa.pages.dev/elsewhere');
  });

  it('escapes the target in attributes', () => {
    expect(redirectDocument('https://a.example/"x')).toContain('href="https://a.example/&quot;x"');
  });
});
