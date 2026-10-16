import { describe, expect, it } from 'vitest';
import {
  CLOUDFLARE_PAGES_BASE_PATH,
  CLOUDFLARE_PAGES_SITE_ORIGIN,
  DEFAULT_BASE_PATH,
  DEFAULT_SITE_ORIGIN,
  normalizeBasePath,
  resolveSite,
} from './site.ts';

describe('resolveSite', () => {
  it('defaults to the GitHub Pages project site', () => {
    expect(resolveSite({})).toEqual({
      origin: DEFAULT_SITE_ORIGIN,
      basePath: DEFAULT_BASE_PATH,
      url: 'https://hmooodzozo577-gif.github.io/wej/',
    });
  });

  it('treats empty values (unset repository variables) as not set', () => {
    expect(resolveSite({ WEJHATY_SITE_ORIGIN: '', WEJHATY_BASE_PATH: '' })).toEqual(resolveSite({}));
  });

  it('supports a custom root domain', () => {
    expect(resolveSite({ WEJHATY_SITE_ORIGIN: 'https://wejhaty.eu.org', WEJHATY_BASE_PATH: '/' })).toEqual({
      origin: 'https://wejhaty.eu.org',
      basePath: '/',
      url: 'https://wejhaty.eu.org/',
    });
  });

  it('serves Cloudflare Pages builds (CF_PAGES=1) from the domain root', () => {
    expect(resolveSite({ CF_PAGES: '1' })).toEqual({
      origin: CLOUDFLARE_PAGES_SITE_ORIGIN,
      basePath: CLOUDFLARE_PAGES_BASE_PATH,
      url: 'https://tilqaa.pages.dev/',
    });
    expect(resolveSite({ CF_PAGES: '1', WEJHATY_SITE_ORIGIN: '', WEJHATY_BASE_PATH: '' })).toEqual(resolveSite({ CF_PAGES: '1' }));
    expect(resolveSite({ CF_PAGES: '0' })).toEqual(resolveSite({}));
  });

  it('lets the WEJHATY_* variables override the Cloudflare Pages defaults', () => {
    expect(resolveSite({ CF_PAGES: '1', WEJHATY_SITE_ORIGIN: 'https://wejhaty.eu.org', WEJHATY_BASE_PATH: '/wej/' })).toEqual({
      origin: 'https://wejhaty.eu.org',
      basePath: '/wej/',
      url: 'https://wejhaty.eu.org/wej/',
    });
  });

  it('normalises base paths', () => {
    expect(normalizeBasePath('wej')).toBe('/wej/');
    expect(normalizeBasePath('/wej')).toBe('/wej/');
    expect(normalizeBasePath('')).toBe('/');
    expect(() => normalizeBasePath('/a b/')).toThrow();
    expect(() => normalizeBasePath('/../x/')).toThrow();
  });

  it('refuses an origin that is not a bare https origin', () => {
    for (const bad of ['http://example.org', 'https://example.org/wej', 'https://example.org/?x=1', 'not a url', 'javascript:alert(1)']) {
      expect(() => resolveSite({ WEJHATY_SITE_ORIGIN: bad }), bad).toThrow();
    }
    expect(resolveSite({ WEJHATY_SITE_ORIGIN: 'https://example.org/' }).origin).toBe('https://example.org');
  });
});
