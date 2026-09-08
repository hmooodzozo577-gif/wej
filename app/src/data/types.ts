// Typed shapes for the data ported verbatim from wejhaty.html. Field names
// and semantics match the original `DK` schema / QUESTION_BANKS / I18N
// exactly — this file adds compile-time safety, it does not change meaning.

export type Region = 'Asia' | 'Europe' | 'MiddleEast' | 'NAmerica' | 'Oceania';
export type ClimateKind = 'tropical' | 'mediterranean' | 'temperate' | 'cold' | 'desert';
export type VisaDifficulty = 'easy' | 'moderate' | 'hard';

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
}

/** Keys on Destination usable as a numeric scoring target (question.destKey). */
export type NumericDestinationKey = {
  [K in keyof Destination]: Destination[K] extends number ? K : never;
}[keyof Destination];

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
  regionLabels: Record<Region, string>;
}

export type Lang = 'ar' | 'en';
