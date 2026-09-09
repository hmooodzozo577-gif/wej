// Typed shapes for the data ported verbatim from wejhaty.html. Field names
// and semantics match the original `DK` schema / QUESTION_BANKS / I18N
// exactly — this file adds compile-time safety, it does not change meaning.

export type Region = 'Asia' | 'Europe' | 'MiddleEast' | 'NAmerica' | 'Oceania';
export type ClimateKind = 'tropical' | 'mediterranean' | 'temperate' | 'cold' | 'desert';
export type VisaDifficulty = 'easy' | 'moderate' | 'hard';

// --- Phase 10: worldwide country catalog -----------------------------------
// `Region` (above) is the original 5-value display/gradient category used by
// the 30 recommendation-ready destinations — unchanged, still exactly what
// it was. `Continent` is a strict superset, adding the two buckets needed to
// place the other 165 UN-recognized countries somewhere sensible (every
// existing `Region` value remains a valid `Continent` value, so nothing that
// already types against `Region` needs to change).
export type Continent = Region | 'Africa' | 'SouthAmerica';

/** The minimal shape shared by EVERY catalog entry — the 30 original
 *  destinations (which predate iso2/iso3/continent and never gained them,
 *  to avoid touching their verbatim-extracted data) and the 165 basic
 *  countries alike. Components that only ever needed a name and a flag
 *  (FlagChip, FlagBanner, nameOf) are typed against this, not the richer
 *  CountryBase below, so they work for both without widening Destination. */
export interface FlagSubject {
  id: string;
  nameEn: string;
  nameAr: string;
  /** ISO 3166-1 alpha-2, uppercase (e.g. "JP") — keys the flag map (lowercased). */
  countryCode: string;
}

/** Fields every Phase 10 basic-country entry has. (Not retrofitted onto the
 *  30 original destinations — see FlagSubject above for why.) */
export interface CountryBase extends FlagSubject {
  /** ISO 3166-1 alpha-2, uppercase — same value as `countryCode` here. */
  iso2: string;
  /** ISO 3166-1 alpha-3, uppercase (e.g. "EGY"). */
  iso3: string;
  continent: Continent;
  /** Free-text subregion, e.g. "Northern Africa" — informational only, not used for filtering. */
  subregion?: string;
  capitalEn?: string;
}

export interface Destination {
  id: string;
  nameEn: string;
  nameAr: string;
  region: Region;
  citiesEn: string[];
  citiesAr: string[];
  descEn: string;
  descAr: string;
  costLevel: number;
  safety: number;
  climate: ClimateKind;
  nature: number;
  urban: number;
  beaches: number;
  adventure: number;
  culture: number;
  nightlife: number;
  salary: number;
  jobMarket: number;
  careerGrowth: number;
  english: number;
  tuition: number;
  uniRank: number;
  healthcare: number;
  waiting: number;
  immiFriendly: number;
  qol: number;
  bizEase: number;
  growth: number;
  stability: number;
  spa: number;
  quiet: number;
  visaDiff: VisaDifficulty;
  livingCostEn: string;
  livingCostAr: string;
  pTourism: number;
  pWork: number;
  pEdu: number;
  pMed: number;
  pImmi: number;
  pInvest: number;
  pWellness: number;
  strengthsEn: string[];
  strengthsAr: string[];
  weaknessesEn: string[];
  weaknessesAr: string[];
  langEn: string;
  langAr: string;
  /** ISO 3166-1 alpha-2, uppercase (e.g. "JP") — assigned via ISO_CODES in the original. */
  countryCode: string;
  /** Discriminant added in Phase 10 (set programmatically in data/destinations.ts,
   *  not stored in the generated JSON) so code can distinguish the 30 full
   *  destinations from the 165 Phase 10 basic countries in a unified catalog. */
  recommendationReady: true;
}

/** Keys on Destination usable as a numeric scoring target (question.destKey). */
export type NumericDestinationKey = {
  [K in keyof Destination]: Destination[K] extends number ? K : never;
}[keyof Destination];

// --- Phase 10: the 165 additional countries --------------------------------
// Deliberately NOT given costLevel/safety/climate/etc: they have no
// recommendation-engine data yet (a later phase's job), and inventing scores
// here would be fabricated data. `recommendationReady: false` makes that
// distinction explicit and lets Explorer/Detail branch safely instead of
// crashing on missing fields.
export interface BasicCountry extends CountryBase {
  recommendationReady: false;
}

/** One entry in the unified worldwide catalog — either a full, scoreable
 *  destination (the original 30) or a basic country (Phase 10's 165). Narrow
 *  with `entry.recommendationReady` before accessing recommendation fields. */
export type CatalogEntry = Destination | BasicCountry;

export type PurposeId =
  | 'tourism'
  | 'work'
  | 'education'
  | 'medical'
  | 'immigration'
  | 'investment'
  | 'wellness'
  | 'other';

export interface PurposeMeta {
  id: PurposeId;
  icon: string;
  pScoreKey: NumericDestinationKey | null;
}

export type QuestionKind = 'target' | 'importance' | 'climate' | 'category' | 'flavor';

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface QuestionOption {
  value: string | number;
  label: LocalizedText;
  desc?: LocalizedText;
}

export interface Question {
  id: string;
  weight: number;
  kind: QuestionKind;
  /** Destination attribute this question scores against. Absent for 'flavor' questions. */
  destKey?: NumericDestinationKey | 'climate';
  /** Scale divisor for 'target' questions (defaults to 100 if absent, per original). */
  scale?: number;
  text: LocalizedText;
  options: QuestionOption[];
}

export type QuestionBanks = Record<PurposeId, Question[]>;

export type ClimateCompat = Record<string, Partial<Record<ClimateKind, number>>>;

export type ReasonLabels = Record<'ar' | 'en', Record<string, string>>;

export interface NavStrings {
  home: string;
  how: string;
  explore: string;
  quiz: string;
  cta: string;
}

export interface HeroStrings {
  eyebrow: string;
  h1: string;
  lead: string;
  cta: string;
  cta2: string;
  stat1n: string;
  stat1l: string;
  stat2n: string;
  stat2l: string;
  stat3n: string;
  stat3l: string;
}

export interface HowStrings {
  eyebrow: string;
  title: string;
  sub: string;
  s1t: string;
  s1d: string;
  s2t: string;
  s2d: string;
  s3t: string;
  s3d: string;
}

export interface PurposeCopy {
  n: string;
  d: string;
}

export interface PurposesStrings {
  title: string;
  sub: string;
  tourism: PurposeCopy;
  work: PurposeCopy;
  education: PurposeCopy;
  medical: PurposeCopy;
  immigration: PurposeCopy;
  investment: PurposeCopy;
  wellness: PurposeCopy;
  other: PurposeCopy;
}

export interface QuizStrings {
  question: string;
  of: string;
  back: string;
  next: string;
  seeResults: string;
  validation: string;
  startQuiz: string;
  changePurpose: string;
}

export interface ResultsStrings {
  title: string;
  sub: string;
  match: string;
  whyTitle: string;
  viewDetails: string;
  startAgain: string;
  exploreAll: string;
  rank1: string;
  top5: string;
  cost: string;
  safety: string;
  climate: string;
  visa: string;
}

export interface DetailStrings {
  back: string;
  startAgain: string;
  overview: string;
  why: string;
  cities: string;
  strengths: string;
  weaknesses: string;
  bestFor: string;
  cost: string;
  safety: string;
  climateL: string;
  language: string;
  visa: string;
  livingCost: string;
  region: string;
  match: string;
  browse: string;
  /** Phase 10 additions, for the graceful basic-country detail state. */
  capital: string;
  notRecommendationReady: string;
}

export interface ExploreStrings {
  title: string;
  sub: string;
  search: string;
  region: string;
  purpose: string;
  cost: string;
  allRegions: string;
  allPurposes: string;
  allCosts: string;
  results: string;
  noResults: string;
  noResultsSub: string;
  clearFilters: string;
}

export interface I18nDict {
  dir: 'rtl' | 'ltr';
  htmlLang: 'ar' | 'en';
  nav: NavStrings;
  brand: string;
  footer: string;
  hero: HeroStrings;
  how: HowStrings;
  purposes: PurposesStrings;
  disclaimer: string;
  quiz: QuizStrings;
  results: ResultsStrings;
  detail: DetailStrings;
  explore: ExploreStrings;
  costLevels: [string, string, string, string];
  climateLabels: Record<ClimateKind, string>;
  visaLabels: Record<VisaDifficulty, string>;
  /** Extended in Phase 10 to Continent (was Region) so the two new buckets
   *  (Africa, SouthAmerica) have labels too — see data/i18n/ar.ts / en.ts. */
  regionLabels: Record<Continent, string>;
}

export type Lang = 'ar' | 'en';
