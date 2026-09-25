// v1.1 — the site's own address and release, as the build configured them
// (see build/site.ts). Nothing here hard-codes a host or a path: a custom
// domain or a different base path is a build setting.

/** Scheme + host, e.g. "https://hmooodzozo577-gif.github.io". */
export const SITE_ORIGIN: string = import.meta.env.VITE_SITE_ORIGIN;

/** Leading and trailing slash, e.g. "/wej/" (or "/" on a root domain). */
export const BASE_PATH: string = import.meta.env.BASE_URL;

/** React Router's basename: the base path without its trailing slash. */
export const ROUTER_BASENAME: string = BASE_PATH.replace(/\/$/, '') || '/';

/** The public release, from app/package.json's "version" (injected at build). */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION;

/** Absolute URL of a site path such as "destination/japan/". */
export function absoluteUrl(path = ''): string {
  return `${SITE_ORIGIN}${BASE_PATH}${path.replace(/^\/+/, '')}`;
}

/** The canonical address of a destination page — the static document the
 *  build writes for it, which answers HTTP 200 directly. */
export function destinationUrl(id: string): string {
  return absoluteUrl(`destination/${encodeURIComponent(id)}/`);
}

/** A browser pathname relative to the router, e.g. "/wej/explore" → "/explore". */
export function routerPath(pathname: string, basename: string = ROUTER_BASENAME): string {
  if (basename === '/') return pathname || '/';
  if (pathname === basename) return '/';
  return pathname.startsWith(`${basename}/`) ? pathname.slice(basename.length) : pathname;
}

/** The static page documents live at ".../destination/japan/" (the form
 *  GitHub Pages answers with HTTP 200), while the app's own links have no
 *  trailing slash. Drop the slash once, before React starts, so every route
 *  comparison in the app keeps seeing the v1.0 form. */
export function normalizeTrailingSlash(win: Pick<Window, 'location' | 'history'> = window, basePath: string = BASE_PATH): void {
  const { pathname, search, hash } = win.location;
  if (pathname.length > 1 && pathname.endsWith('/') && pathname !== basePath) {
    win.history.replaceState(win.history.state, '', `${pathname.replace(/\/+$/, '')}${search}${hash}`);
  }
}
