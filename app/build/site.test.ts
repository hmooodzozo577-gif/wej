import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_PATH, DEFAULT_SITE_ORIGIN, normalizeBasePath, resolveSite } from './site.ts';

describe('resolveSite', () => {
  it('defaults to the GitHub Pages project site', () => {
    expect(resolveSite({})).toEqual({
      origin: DEFAULT_SITE_ORIGIN,
      basePath: DEFAULT_BASE_PATH,
      url: 'https://hmooodzozo577-gif.github.io/wej/',
    });
  });

  it('supports a custom root domain', () => {
    expect(resolveSite({ WEJHATY_SITE_ORIGIN: 'https://wejhaty.eu.org', WEJHATY_BASE_PATH: '/' })).toEqual({
      origin: 'https://wejhaty.eu.org',
      basePath: '/',
      url: 'https://wejhaty.eu.org/',
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
