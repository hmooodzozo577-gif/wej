import { describe, expect, it } from 'vitest';
import { absoluteUrl, APP_VERSION, BASE_PATH, destinationUrl, normalizeTrailingSlash, ROUTER_BASENAME, routerPath, SITE_ORIGIN } from './site';
import pkg from '../../package.json';

function fakeWindow(href: string) {
  const url = new URL(href);
  const calls: string[] = [];
  return {
    calls,
    win: {
      location: { pathname: url.pathname, search: url.search, hash: url.hash } as Location,
      history: { state: { keep: true }, replaceState: (_state: unknown, _title: string, next: string) => { calls.push(next); } } as unknown as History,
    },
  };
}

describe('site configuration', () => {
  // Vitest serves from "/" whatever the build base is, so these follow
  // BASE_PATH instead of assuming "/wej/".
  it('comes from the build', () => {
    expect(SITE_ORIGIN).toBe('https://hmooodzozo577-gif.github.io');
    expect(BASE_PATH).toMatch(/^\/(.+\/)?$/);
    expect(ROUTER_BASENAME).toBe(BASE_PATH.replace(/\/$/, '') || '/');
  });

  it('builds absolute and canonical destination URLs from one origin', () => {
    const root = `https://hmooodzozo577-gif.github.io${BASE_PATH}`;
    expect(absoluteUrl()).toBe(root);
    expect(absoluteUrl('/explore/')).toBe(`${root}explore/`);
    expect(destinationUrl('japan')).toBe(`${root}destination/japan/`);
    expect(destinationUrl('a/b?c')).toBe(`${root}destination/a%2Fb%3Fc/`);
  });

  it('reports the release from package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('turns a browser path into a router path', () => {
    expect(routerPath('/wej/', '/wej')).toBe('/');
    expect(routerPath('/wej', '/wej')).toBe('/');
    expect(routerPath('/wej/destination/japan', '/wej')).toBe('/destination/japan');
    expect(routerPath('/other', '/wej')).toBe('/other');
    expect(routerPath('/destination/japan', '/')).toBe('/destination/japan');
  });

  it('drops the trailing slash of a static page address, keeping query and hash', () => {
    const page = fakeWindow('https://x.test/wej/destination/japan/?a=1#b');
    normalizeTrailingSlash(page.win, '/wej/');
    expect(page.calls).toEqual(['/wej/destination/japan?a=1#b']);
  });

  it('leaves the home page and slash-less paths alone', () => {
    for (const href of ['https://x.test/wej/', 'https://x.test/wej/explore']) {
      const page = fakeWindow(href);
      normalizeTrailingSlash(page.win, '/wej/');
      expect(page.calls, href).toEqual([]);
    }
  });
});
