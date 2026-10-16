// Security Pass 2 (D1/D2) — values more than one Worker module must agree
// on, kept in one place so they cannot drift apart.

/** The browser origins allowed to call this Worker cross-origin: the
 *  GitHub Pages site and the Cloudflare Pages site. Compared exactly
 *  (scheme, host, no path, no slash). */
export const ALLOWED_ORIGINS = ['https://hmooodzozo577-gif.github.io', 'https://tilqaa.pages.dev'] as const;
export type AllowedOrigin = (typeof ALLOWED_ORIGINS)[number];

export function isAllowedOrigin(origin: string | null | undefined): origin is AllowedOrigin {
  return (ALLOWED_ORIGINS as readonly (string | null | undefined)[]).includes(origin);
}

/** Countries excluded from every effective path of the product (the
 *  catalog, analytics, ratings, feedback, city descriptions, intelligence
 *  and visa lookups). ISO 3166-1 alpha-2 and alpha-3 forms. */
const EXCLUDED_ISO2 = new Set(['IL']);
const EXCLUDED_ISO3 = new Set(['ISR']);

/** True for an excluded country code in either ISO form, in any letter
 *  case, ignoring surrounding whitespace. Anything that is not a string is
 *  not an excluded code (callers validate the shape separately). */
export function isExcludedCountry(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  const normalized = code.trim().toUpperCase();
  return EXCLUDED_ISO2.has(normalized) || EXCLUDED_ISO3.has(normalized);
}
