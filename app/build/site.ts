// v1.1 — the one authoritative site origin and base path.
//
// Everything that needs an absolute or base-relative address derives from
// this: Vite's `base`, the router basename, canonical links, the sitemap,
// robots.txt, Open Graph URLs, share links, the web manifest and the
// structured data. Today the site is a GitHub Pages project site under
// /wej/; a free custom domain would be served from the root. Both are a
// build setting, never a runtime string replacement:
//
//   (default)                                   https://hmooodzozo577-gif.github.io/wej/
//   WEJHATY_SITE_ORIGIN=https://example.org \
//   WEJHATY_BASE_PATH=/  npm run build          https://example.org/

export const DEFAULT_SITE_ORIGIN = 'https://hmooodzozo577-gif.github.io';
export const DEFAULT_BASE_PATH = '/wej/';

export interface SiteConfig {
  /** Scheme + host, no path, no trailing slash. */
  origin: string;
  /** Leading and trailing slash; "/" for a root domain. */
  basePath: string;
  /** origin + basePath — the absolute address of the home page. */
  url: string;
}

export function normalizeBasePath(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (trimmed && !/^[a-z0-9][a-z0-9._~-]*(\/[a-z0-9][a-z0-9._~-]*)*$/i.test(trimmed)) {
    throw new Error(`Invalid base path: ${value}`);
  }
  return trimmed ? `/${trimmed}/` : '/';
}

export function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Invalid site origin: ${value}`);
  }
  if (url.protocol !== 'https:') throw new Error(`The site origin must use https: ${value}`);
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash || url.username || url.password) {
    throw new Error(`The site origin must be a bare origin (put paths in WEJHATY_BASE_PATH): ${value}`);
  }
  return url.origin;
}

export function resolveSite(env: Record<string, string | undefined>): SiteConfig {
  const origin = normalizeOrigin(env.WEJHATY_SITE_ORIGIN || DEFAULT_SITE_ORIGIN);
  const basePath = normalizeBasePath(env.WEJHATY_BASE_PATH ?? DEFAULT_BASE_PATH);
  return { origin, basePath, url: `${origin}${basePath}` };
}
