// The product's public name and tagline: the one source for every
// user-facing brand string (interface copy, page titles, social metadata,
// structured data, sharing text and the web manifest).
//
// The previous name, وجهتي / Wejhaty, survives only in technical identifiers
// that must keep working for returning visitors and deployments: the
// browser-storage keys (`wejhaty.theme`, `wejhaty.favorites.v1`, …), the
// stylesheet's filename, the WEJHATY_* build variables and the data tools'
// User-Agent strings. The repository name and the GitHub Pages path /wej/ are
// deployment addresses, not the brand.
import type { Lang } from '../data/types';

/** The Arabic name keeps its kasra under the ت (تِلقاء). */
export const BRAND = { ar: 'تِلقاء', en: 'TILQAA' } as const satisfies Record<Lang, string>;

export const BRAND_TAGLINE = {
  ar: 'العالم في اتجاهك.',
  en: 'The World Within Your Reach.',
} as const satisfies Record<Lang, string>;

/** Both scripts together, for places that serve both languages at once
 *  (the static page titles, the web manifest, the sharing image). */
export const BRAND_BILINGUAL = `${BRAND.ar} ${BRAND.en}`;

/** The header's home button: its visible text is the name, so the
 *  accessible name starts with it too (WCAG 2.5.3, label in name). */
export const BRAND_HOME_LABEL = {
  ar: `${BRAND.ar} — الصفحة الرئيسية`,
  en: `${BRAND.en} — Home`,
} as const satisfies Record<Lang, string>;
