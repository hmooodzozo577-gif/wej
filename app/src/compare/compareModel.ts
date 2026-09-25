// v1.1 — Compare: two or three destinations side by side, from data the
// site already has. Informational only: there is no winner, no "best", no
// combined score, and each existing score keeps its own meaning (Country
// Suitability is general per purpose; Personal Match is this traveller's).
// Missing data says "Not available" — nothing is estimated to fill a gap.
// Passport/entry information and budgets are not part of a comparison.
//
// The only thing a Compare URL carries is destination ids: ?ids=japan,af.
import { WORLD_CATALOG, continentOf, countryInfoOf, resolvedBordersOf } from '../data/worldCatalog';
import { getCountrySuitability } from '../data/countryIntelligence';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import { haversineKm, type Coords } from '../data/geo';
import { formatNumber } from '../data/format';
import { nameOf } from '../data/destinationText';
import { SUITABLE_PURPOSES } from '../intelligence/types';
import { computePersonalMatch } from '../personalization/personalMatch';
import { PERSONAL_COPY } from '../personalization/copy';
import type { NormalizedPreferences } from '../personalization/types';
import type { CatalogEntry, I18nDict, Lang } from '../data/types';

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 3;

const BY_ID = new Map(WORLD_CATALOG.map((entry) => [entry.id, entry]));

/** Reads ?ids= — only canonical catalog ids, once each, at most three. */
export function parseCompareIds(search: string): { ids: string[]; truncated: boolean } {
  const raw = new URLSearchParams(search).get('ids') ?? '';
  const ids: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (BY_ID.has(id) && !ids.includes(id)) ids.push(id);
  }
  return { ids: ids.slice(0, COMPARE_MAX), truncated: ids.length > COMPARE_MAX };
}

export function compareSearch(ids: readonly string[]): string {
  const clean = ids.filter((id) => BY_ID.has(id)).slice(0, COMPARE_MAX);
  return clean.length ? `?ids=${clean.map(encodeURIComponent).join(',')}` : '';
}

export function compareEntries(ids: readonly string[]): CatalogEntry[] {
  return ids.map((id) => BY_ID.get(id)).filter((entry): entry is CatalogEntry => Boolean(entry));
}

export interface CompareCell {
  text: string;
  /** A secondary line (confidence, coverage, a caveat). */
  note?: string;
  missing?: boolean;
}

export interface CompareRow {
  id: string;
  label: string;
  cells: CompareCell[];
}

export interface CompareSection {
  id: 'facts' | 'suitability' | 'personal' | 'distance';
  title: string;
  rows: CompareRow[];
}

export const COMPARE_COPY = {
  ar: {
    title: 'مقارنة الوجهات',
    lead: 'مقارنة معلوماتية من البيانات المتاحة في وجهتي. لا تُحدد فائزًا ولا تجمع الأرقام في درجة واحدة.',
    notAvailable: 'غير متوفر',
    facts: 'معلومات الدولة',
    suitability: 'الملاءمة العامة لكل غرض',
    suitabilityNote: 'ملاءمة الدولة العامة من مؤشرات دولية، وليست توافقًا شخصيًا.',
    insufficient: 'بيانات غير كافية',
    coverage: (pct: number) => `تغطية البيانات ${pct}%`,
    personal: 'التوافق معك',
    personalNoProfile: 'أكمل أسئلة التوافق لترى توافقك مع كل وجهة.',
    personalCta: 'ابدأ أسئلة التوافق',
    distance: 'المسافة من موقعك',
    distanceRow: 'مسافة تقريبية إلى وسط الدولة',
    distanceUnavailable: 'شارك موقعك في هذه الجلسة لعرض المسافة.',
    km: (value: string) => `≈ ${value} كم`,
    dataCoverage: 'تغطية البيانات المباشرة',
    landBorders: 'الحدود البرية',
    noLandBorder: 'لا توجد حدود برية',
    add: 'أضف وجهة للمقارنة',
    addPlaceholder: 'اختر وجهة',
    search: 'ابحث عن دولة',
    noMatch: 'لا توجد نتائج',
    remove: (name: string) => `أزل ${name} من المقارنة`,
    needMore: 'اختر وجهة أخرى على الأقل للمقارنة.',
    limit: 'يمكن مقارنة ثلاث وجهات كحد أقصى؛ عُرضت أول ثلاث.',
    empty: 'اختر وجهتين أو ثلاثًا للمقارنة من المفضلة أو من صفحة أي وجهة.',
    toFavorites: 'اذهب إلى المفضلة',
    open: 'افتح الوجهة',
    caption: 'مقارنة الوجهات المختارة',
    compareFrom: 'قارن',
  },
  en: {
    title: 'Compare destinations',
    lead: 'An informational comparison from the data Wejhaty has. It names no winner and never adds the numbers into one score.',
    notAvailable: 'Not available',
    facts: 'Country facts',
    suitability: 'General suitability by purpose',
    suitabilityNote: 'A country\'s general suitability from international indicators, not a personal match.',
    insufficient: 'Insufficient data',
    coverage: (pct: number) => `Data coverage ${pct}%`,
    personal: 'Your match',
    personalNoProfile: 'Answer the match questions to see how each destination fits you.',
    personalCta: 'Start the match questions',
    distance: 'Distance from you',
    distanceRow: 'Approximate distance to the country\'s centre',
    distanceUnavailable: 'Share your location in this session to see the distance.',
    km: (value: string) => `≈ ${value} km`,
    dataCoverage: 'Direct data coverage',
    landBorders: 'Land borders',
    noLandBorder: 'No land border',
    add: 'Add a destination to compare',
    addPlaceholder: 'Choose a destination',
    search: 'Search for a country',
    noMatch: 'No results',
    remove: (name: string) => `Remove ${name} from the comparison`,
    needMore: 'Choose at least one more destination to compare.',
    limit: 'Up to three destinations can be compared; the first three are shown.',
    empty: 'Choose two or three destinations to compare from Favorites or from any destination page.',
    toFavorites: 'Go to Favorites',
    open: 'Open destination',
    caption: 'Comparison of the selected destinations',
    compareFrom: 'Compare',
  },
} satisfies Record<Lang, Record<string, unknown>>;

export interface CompareContext {
  lang: Lang;
  t: I18nDict;
  preferences: NormalizedPreferences | null;
  origin: Coords | null;
}

function cell(text: string | null | undefined, missing: string, note?: string): CompareCell {
  return text ? { text, note } : { text: missing, missing: true };
}

export function buildComparison(entries: readonly CatalogEntry[], ctx: CompareContext): CompareSection[] {
  const { lang, t, preferences, origin } = ctx;
  const copy = COMPARE_COPY[lang];
  const na = copy.notAvailable;
  const infos = entries.map((entry) => countryInfoOf(entry.id));

  const facts: CompareRow[] = [
    { id: 'region', label: t.detail.region, cells: entries.map((entry) => cell(t.regionLabels[continentOf(entry)], na)) },
    { id: 'languages', label: t.detail.languages, cells: infos.map((info) => cell(info?.languagesEn.join(' · '), na)) },
    {
      id: 'currency',
      label: t.detail.currency,
      cells: infos.map((info) => cell(info?.currencies.map((c) => (c.symbol ? `${c.name} (${c.symbol})` : c.name)).join(' · '), na)),
    },
    { id: 'area', label: t.detail.area, cells: infos.map((info) => cell(info ? `${formatNumber(info.areaKm2)} ${t.detail.areaUnit}` : null, na)) },
    {
      id: 'borders',
      label: copy.landBorders,
      cells: entries.map((entry, index) => {
        if (!infos[index]) return cell(null, na);
        const borders = resolvedBordersOf(entry.id);
        return { text: borders.length ? borders.map((b) => nameOf(b, lang)).join(' · ') : copy.noLandBorder };
      }),
    },
    {
      id: 'dataCoverage',
      label: copy.dataCoverage,
      cells: entries.map((entry) => {
        const profile = RECOMMENDATION_PROFILE_BY_CODE.get(entry.countryCode);
        return cell(profile ? `${formatNumber(profile.dataCoverage)}%` : null, na);
      }),
    },
  ];

  const confidenceLabel = {
    high: t.countrySuitability.confidenceHigh,
    medium: t.countrySuitability.confidenceMedium,
    low: t.countrySuitability.confidenceLow,
  } as const;
  const suitability: CompareRow[] = SUITABLE_PURPOSES.map((purpose) => ({
    id: `suitability-${purpose}`,
    label: t.purposes[purpose]?.n ?? purpose,
    cells: entries.map((entry) => {
      const found = getCountrySuitability(entry.countryCode).find((item) => item.purpose === purpose);
      if (!found) return cell(null, na);
      if (found.insufficientData || found.score === null) {
        return { text: copy.insufficient, note: copy.coverage(Math.round(found.coverage)), missing: true };
      }
      return {
        text: `${formatNumber(Math.round(found.score))}/100`,
        note: [found.confidence ? confidenceLabel[found.confidence] : null, copy.coverage(Math.round(found.coverage))].filter(Boolean).join(' · '),
      };
    }),
  }));

  const sections: CompareSection[] = [
    { id: 'facts', title: copy.facts, rows: facts },
    { id: 'suitability', title: copy.suitability, rows: suitability },
  ];

  if (preferences) {
    const pc = PERSONAL_COPY[lang];
    sections.push({
      id: 'personal',
      title: copy.personal,
      rows: [{
        id: 'personal-match',
        label: pc.personalMatch,
        // Computed for each compared country directly — it does not have to
        // be in the questionnaire's top ten, and no global order changes.
        cells: entries.map((entry) => {
          const match = computePersonalMatch(entry, preferences, { origin: origin ?? undefined });
          if (match.score === null) return cell(null, na);
          const notes = [match.confidence ? pc.confidence[match.confidence] : null, match.eligible ? null : pc.constraintFailed].filter(Boolean);
          return { text: `${formatNumber(match.score)}%`, note: notes.join(' · ') || undefined };
        }),
      }],
    });
  }

  if (origin) {
    sections.push({
      id: 'distance',
      title: copy.distance,
      rows: [{
        id: 'distance-km',
        label: copy.distanceRow,
        cells: infos.map((info) => {
          if (!info) return cell(null, na);
          const km = Math.round(haversineKm(origin, info.latlng) / 10) * 10;
          return { text: copy.km(formatNumber(km)) };
        }),
      }],
    });
  }

  return sections;
}
