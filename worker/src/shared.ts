// Security Pass 2 (D1/D2) — values more than one Worker module must agree
// on, kept in one place so they cannot drift apart.

/** The only browser origin allowed to call this Worker cross-origin: the
 *  GitHub Pages site. Compared exactly (scheme, host, no path, no slash). */
export const ALLOWED_ORIGIN = 'https://hmooodzozo577-gif.github.io';

export function isAllowedOrigin(origin: string | null | undefined): origin is typeof ALLOWED_ORIGIN {
  return origin === ALLOWED_ORIGIN;
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
