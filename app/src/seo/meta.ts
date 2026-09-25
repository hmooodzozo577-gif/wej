// v1.1 — the one authoritative source of page metadata.
//
// The build writes a real HTML document for every indexable route from
// these values (build/seoPages.ts), and the running app applies the same
// values when the route or the language changes (useDocumentMeta.ts), so
// the two can never disagree.
//
// Every description is assembled from data the site already shows: the
// editorial one-line descriptions of the 30 full destinations, and the
// region and capital of the others (the same wording DestinationCard
// uses). Nothing here claims a price, a visa rule, a safety level or a
// ranking.
//
// Pure: no DOM, no import.meta.env — the build loads this in Node.
import { WORLD_CATALOG, continentOf } from '../data/worldCatalog';
import { I18N } from '../data/i18n';
import type { CatalogEntry, Lang, PurposeId } from '../data/types';

export type RouteKind = 'home' | 'explore' | 'destination' | 'purpose' | 'quiz' | 'results' | 'favorites' | 'compare' | 'notFound';

export interface PageMeta {
  kind: RouteKind;
  /** Site-relative path of the static document, e.g. "destination/japan/";
   *  "" for the home page. null for pages that have no document of their
   *  own (the not-found page is served by 404.html). */
  path: string | null;
  /** Only real, stable content is indexed; personal and transient
   *  application states never are. */
  index: boolean;
  /** The page name without the brand, e.g. "اليابان للسفر". */
  heading: Record<Lang, string>;
  /** The browser title in each language. */
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  /** Set for destination pages. */
  destinationId?: string;
  /** The destination's own name, for structured data. */
  names?: Record<Lang, string>;
}

export const BRAND: Record<Lang, string> = { ar: 'وجهتي', en: 'Wejhaty' };

/** Every purpose the questionnaire accepts at /quiz/:purpose. */
export const QUIZ_PURPOSES: readonly PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];

const HOME_DESCRIPTION: Record<Lang, string> = {
  ar: I18N.ar.hero.lead,
  en: I18N.en.hero.lead,
};

function withBrand(lang: Lang, page: string): string {
  return `${page} | ${BRAND[lang]}`;
}

function destinationDescription(entry: CatalogEntry, lang: Lang): string {
  const region = I18N[lang].regionLabels[continentOf(entry)];
  if (lang === 'ar') {
    const lead = entry.recommendationReady
      ? entry.descAr.trim()
      : `${entry.nameAr}: وجهة في ${region}${entry.capitalEn ? `، وعاصمتها ${entry.capitalEn}` : ''}.`;
    return `${lead} اطّلع على معلومات الدولة ومدى ملاءمتها لكل غرض من أغراض السفر في وجهتي.`;
  }
  const lead = entry.recommendationReady
    ? entry.descEn.trim()
    : `${entry.nameEn}: a destination in ${region}${entry.capitalEn ? `, with ${entry.capitalEn} as its capital` : ''}.`;
  return `${lead} See its country facts and how it fits each travel purpose on Wejhaty.`;
}

export function destinationMeta(entry: CatalogEntry): PageMeta {
  return {
    kind: 'destination',
    path: `destination/${entry.id}/`,
    index: true,
    heading: { ar: `${entry.nameAr} للسفر`, en: `${entry.nameEn} travel` },
    title: {
      ar: withBrand('ar', `${entry.nameAr} للسفر`),
      en: withBrand('en', `${entry.nameEn} travel`),
    },
    description: { ar: destinationDescription(entry, 'ar'), en: destinationDescription(entry, 'en') },
    destinationId: entry.id,
    names: { ar: entry.nameAr, en: entry.nameEn },
  };
}

function utility(kind: RouteKind, path: string | null, ar: string, en: string): PageMeta {
  return {
    kind,
    path,
    index: false,
    heading: { ar, en },
    title: { ar: withBrand('ar', ar), en: withBrand('en', en) },
    description: HOME_DESCRIPTION,
  };
}

export const HOME_META: PageMeta = {
  kind: 'home',
  path: '',
  index: true,
  heading: { ar: 'وِجهتي', en: 'Wejhaty' },
  // The accepted v1.0 home titles, unchanged.
  title: { ar: 'وِجهتي — Wejhaty', en: 'Wejhaty — Find Your Destination' },
  description: HOME_DESCRIPTION,
};

export const EXPLORE_META: PageMeta = {
  kind: 'explore',
  path: 'explore/',
  index: true,
  heading: { ar: I18N.ar.explore.title, en: I18N.en.explore.title },
  title: { ar: withBrand('ar', I18N.ar.explore.title), en: withBrand('en', I18N.en.explore.title) },
  description: { ar: I18N.ar.explore.sub, en: I18N.en.explore.sub },
};

export const NOT_FOUND_META: PageMeta = utility('notFound', null, 'الصفحة غير موجودة', 'Page not found');

const PURPOSE_META = utility('purpose', 'purpose/', 'اختر غرض السفر', 'Choose your travel purpose');
const RESULTS_META = utility('results', 'results/', 'نتائجك', 'Your results');
const FAVORITES_META = utility('favorites', 'favorites/', 'المفضلة', 'Favorites');
const COMPARE_META = utility('compare', 'compare/', 'مقارنة الوجهات', 'Compare destinations');

function quizMeta(purpose: PurposeId): PageMeta {
  return utility('quiz', `quiz/${purpose}/`, 'أسئلة التوافق', 'Match questions');
}

const DESTINATION_BY_ID = new Map(WORLD_CATALOG.map((entry) => [entry.id, entry]));

/** Every page that gets a static document at build time: the indexable
 *  pages (home, Explore, each canonical destination) and the application
 *  pages that must still answer HTTP 200 on a direct visit (noindex). */
export function staticPages(): PageMeta[] {
  return [
    HOME_META,
    EXPLORE_META,
    ...WORLD_CATALOG.map(destinationMeta),
    PURPOSE_META,
    ...QUIZ_PURPOSES.map(quizMeta),
    RESULTS_META,
    FAVORITES_META,
    COMPARE_META,
  ];
}

/** The metadata for a router path (basename already removed). Unknown
 *  paths and unknown destination ids resolve to the not-found page. */
export function metaForPath(pathname: string): PageMeta {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return HOME_META;
  const [head, second] = parts;
  if (parts.length === 1) {
    if (head === 'explore') return EXPLORE_META;
    if (head === 'purpose') return PURPOSE_META;
    if (head === 'results') return RESULTS_META;
    if (head === 'favorites') return FAVORITES_META;
    if (head === 'compare') return COMPARE_META;
  }
  if (parts.length === 2 && head === 'destination') {
    const entry = DESTINATION_BY_ID.get(decodeURIComponent(second!));
    return entry ? destinationMeta(entry) : NOT_FOUND_META;
  }
  if (parts.length === 2 && head === 'quiz' && (QUIZ_PURPOSES as readonly string[]).includes(second!)) {
    return quizMeta(second as PurposeId);
  }
  return NOT_FOUND_META;
}
