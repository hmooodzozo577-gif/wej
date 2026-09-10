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

// --- Phase 11 Step 1: build-time Country Information -----------------------
// Additive, purely informational data for ALL 195 catalog entries (the 30
// existing destinations too, not just the 165 basic countries), sourced at
// build time from the already-installed `world-countries` package — no
// runtime network call. Deliberately excludes population/timezones (only
// available from a live API, out of scope for this step) and excludes any
// field already on CatalogEntry (capital, continent, subregion, nameEn/Ar,
// flag) to avoid duplication. Keyed by ISO 3166-1 alpha-2 (countryCode),
// which both Destination and BasicCountry already carry, so one dataset
// covers both without retrofitting new fields onto either.
export interface CountryInfoCurrency {
  /** ISO 4217 code, e.g. "JPY". */
  code: string;
  name: string;
  symbol?: string;
}

export interface CountryInfo {
  /** ISO 3166-1 alpha-2, uppercase — matches CatalogEntry.countryCode. */
  iso2: string;
  /** ISO 3166-1 alpha-3, uppercase. Phase 11 Step 3: the only place a full
   *  destination's iso3 exists (BasicCountry already has its own; Destination
   *  was deliberately never given one — see CountryBase above), so border
   *  codes can be resolved back to a catalog entry for every one of the 195. */
  iso3: string;
  officialNameEn: string;
  officialNameAr: string;
  areaKm2: number;
  /** Empty array for countries with no reported official currency (rare). */
  currencies: CountryInfoCurrency[];
  languagesEn: string[];
  /** E.164-style calling code with leading "+", e.g. "+81". */
  callingCode: string;
  /** ISO 3166-1 alpha-3 codes of bordering countries; empty for islands / no land border. */
  borders: string[];
  /** Phase 12 — a single approximate country centroid (world-countries'
   *  own `latlng`), NOT a boundary/polygon. Only used for straight-line
   *  distance ranking (data/geo.ts) — see that file for the explicit
   *  accuracy caveat before using this for anything else. */
  latlng: { lat: number; lng: number };
}

/** Phase 12 (city-level location personalization) — one "major" city (see
 *  generate-world-countries.mjs Step 11 for the population threshold and
 *  source). `nameAr` is a real, hand-verified Arabic name only for a small
 *  curated set of well-known cities; everywhere else it deliberately
 *  equals `nameEn` rather than guessing a transliteration — see that
 *  script's ARABIC_CITY_NAMES table. `countryCode` matches
 *  CatalogEntry.countryCode (ISO 3166-1 alpha-2). */
export interface CityLocation {
  nameEn: string;
  nameAr: string;
  countryCode: string;
  lat: number;
  lng: number;
}

/** Phase 13.2 (travel API foundation — airport resolution) — one major,
 *  scheduled-passenger-service airport (see scripts/generate-airports.mjs
 *  for the exact source and filtering criteria). Unlike `CityLocation`,
 *  there is no `nameAr`: OurAirports has no non-English name field, and
 *  unlike cities.ts's small hand-verified table, no curated Arabic airport
 *  names exist yet — rather than guess a transliteration for ~3,000
 *  airports, this type only carries the real English name. A `nameAr`
 *  field can be added in a later phase if a genuine curated source is
 *  found. `countryCode` matches CatalogEntry.countryCode (ISO 3166-1
 *  alpha-2) — the same country-code space used throughout the app, not a
 *  second country model. */
export interface AirportLocation {
  iata: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
}

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
  /** Phase 11 Step 1 additions, for the Country Information section. */
  countryInfo: string;
  officialName: string;
  area: string;
  areaUnit: string;
  currency: string;
  languages: string;
  callingCode: string;
  borders: string;
  /** Hero-image correction pass — compact photo-attribution disclosure
   *  (the Hero background image itself carries no alt text, so this is
   *  the only accessible place source/author/license live). */
  photoInfo: string;
  photoSource: string;
  photoAuthor: string;
  photoLicense: string;
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

/** Phase 12 — Location Personalization strings. Not part of the original
 *  extracted wejhaty.html copy (this feature didn't exist there), so — like
 *  regionLabels.Africa/SouthAmerica and detail.capital before it — this is
 *  added directly in data/i18n/ar.ts / en.ts rather than sourced from the
 *  generated JSON. */
export interface LocationStrings {
  title: string;
  sub: string;
  cta: string;
  retry: string;
  reset: string;
  requesting: string;
  /** Phase 12 fix: shown while resolveCurrentCountry() is still running
   *  (after the browser permission is already granted). */
  resolving: string;
  /** Label for a real point-in-polygon match (method: 'boundary') — safe to
   *  present with confidence, no accuracy caveat needed. Used for both the
   *  "city, country" and country-only sub-cases (only the value differs —
   *  see LocationPersonalize.tsx). */
  currentLocation: string;
  /** Label for the nearest-centroid fallback (method: 'centroid-fallback') —
   *  always paired with approxNote below. */
  nearestCountry: string;
  /** Explicit accuracy caveat shown next to the fallback result — never
   *  shown for a real boundary match. */
  approxNote: string;
  nearbyTitle: string;
  denied: string;
  unavailable: string;
  timeout: string;
  unsupported: string;
}

/** Workstream C — Global Location Personalization: the app-wide,
 *  first-visit "why we're asking" prompt (components/LocationIntro.tsx),
 *  distinct from LocationStrings above (Explore's own, already-existing
 *  location card, which this does NOT replace — see that component's
 *  doc comment). Shown once per browser (a dismissal flag in
 *  localStorage, never coordinates — see LocationIntro.tsx), before any
 *  browser permission dialog ever fires. */
export interface LocationIntroStrings {
  title: string;
  body: string;
  allow: string;
  notNow: string;
}

/** Phase 13.6 — Full Travel Integration strings. Like LocationStrings,
 *  this feature has no wejhaty.html equivalent, so it's added directly in
 *  data/i18n/ar.ts / en.ts rather than sourced from the generated JSON. */
export interface TravelStrings {
  title: string;
  loading: string;
  needLocation: string;
  setLocationCta: string;
  distanceLabel: string;
  distanceUnit: string;
  durationLabel: string;
  /** { h: string; m: string } — short hour/minute unit suffixes, e.g.
   *  { h: 'h', m: 'm' } or the Arabic equivalents. */
  durationUnit: { h: string; m: string };
  /** Shown under a fallback distance/duration estimate — must always make
   *  clear this is a straight-line estimate, never a real fare. */
  estimateNote: string;
  priceLabel: string;
  stopsLabel: string;
  nonStop: string;
  /** Shown under a real, Worker-returned offer. */
  offerFoundNote: string;
}

/** Phase 13.5a — Accommodation Discovery strings. Like LocationStrings/
 *  TravelStrings, no wejhaty.html equivalent, so added directly in
 *  data/i18n/ar.ts / en.ts rather than sourced from the generated JSON. */
export interface AccommodationStrings {
  title: string;
  costLabel: string;
  /** 4-tuple, one qualitative guidance sentence per Destination.costLevel
   *  (1-4) — the SAME costLevel already shown on this page as the
   *  general cost tier, reused here for an accommodation-specific
   *  framing. Never a numeric price. */
  guidanceByCostLevel: [string, string, string, string];
  /** Composition-refinement pass: previously always shown directly below
   *  guidanceByCostLevel. Live measurement during that pass found this
   *  card had become the tallest in the compact Travel/Accommodation/
   *  Travel-Cost row specifically because of this second paragraph —
   *  moved into a <details> disclosure (see AccommodationInfo.tsx),
   *  same pattern as TravelCostIndexInfo.tsx's methodology text. Not
   *  deleted, not hidden from anyone who wants it — one tap away. The
   *  still-always-visible guidanceByCostLevel sentence already carries
   *  the core honesty signal ("generally X-priced, RELATIVE to other
   *  destinations"), so the reader isn't left without any caveat by
   *  default. */
  disclaimer: string;
  /** Summary label for the <details> element holding `disclaimer`. */
  moreDetailsLabel: string;
}

// --- Phase 13.5c: Dynamic Travel Cost Index ---------------------------------
// Additive, optional, build-time-generated snapshot layer on top of the
// static Destination.costLevel above. Never replaces costLevel (still
// consumed as-is by Explore's filter, DestinationCard, Results, and
// AccommodationInfo's fallback), never touched by the recommendation
// engine, and never fabricated: a country simply has no entry when the
// source dataset doesn't cover it. See scripts/lib/travelCostIndexIngest.mjs
// for the ingestion pipeline and app/scripts/TRAVEL_COST_INDEX.md for the
// full source/semantics/update documentation.

/** One country's real source observation. `priceLevelIndex` is the World
 *  Bank indicator PA.NUS.GDP.PLI ("Price level index (GDP)") value AS
 *  PUBLISHED, live-verified via a GitHub Actions run against the real
 *  API — 100 means "the same general price level as the United States"
 *  (confirmed live: the US itself returns exactly 100), the indicator's
 *  own baseline, not a Wejhaty invention. (The originally-targeted
 *  indicator, PA.NUS.PPPC.RF, is still listed in the World Bank's
 *  catalog metadata but its data endpoint now returns "deleted or
 *  archived" — confirmed live; PA.NUS.GDP.PLI is the currently-serving
 *  replacement with equivalent semantics. See TRAVEL_COST_INDEX.md.)
 *  Never a nightly hotel price, food price, or tourist daily budget —
 *  see AccommodationInfo.tsx's disclaimer copy. */
export interface TravelCostIndexEntry {
  /** ISO 3166-1 alpha-2, uppercase — matches CatalogEntry.countryCode. */
  countryCode: string;
  priceLevelIndex: number;
  /** The year the source observation itself is FOR (e.g. "2023") — not
   *  when this snapshot file was generated. World Bank ICP data is
   *  published on a multi-year cycle; this is deliberately named
   *  distinctly from `snapshotUpdatedAt` on TravelCostSnapshot so the UI
   *  never implies annual economic data was "measured today". */
  sourcePeriod: string;
}

/** The whole committed, generated snapshot (data/generated/
 *  travelCostIndex.json) — deliberately a small wrapper object, not a
 *  bare array, so "not yet generated"/"ingestion never ran" (entries: [],
 *  snapshotUpdatedAt: null) is structurally distinguishable from "ran and
 *  legitimately found zero countries" (which would itself fail the
 *  ingestion script's minimum-coverage validation and never get
 *  committed — see TRAVEL_COST_INDEX.md). */
export interface TravelCostSnapshot {
  /** ISO date-time the SNAPSHOT FILE was (re)generated by the ingestion
   *  script, or null if it has never successfully run. Distinct from any
   *  entry's `sourcePeriod`. */
  snapshotUpdatedAt: string | null;
  /** World Bank Indicators API indicator code this snapshot was built
   *  from — kept here so the data stays traceable to its exact source. */
  sourceIndicator: string;
  entries: TravelCostIndexEntry[];
}

/** Four-tier relative classification of `priceLevelIndex`, thresholds centralized
 *  in data/travelCostIndex.ts's CLASSIFICATION_THRESHOLDS (never scattered
 *  as magic numbers in a component). */
export type TravelCostTier = 'low' | 'moderate' | 'high' | 'veryHigh';

/** Phase 13.5c strings. Like AccommodationStrings above, no wejhaty.html
 *  equivalent. */
export interface TravelCostStrings {
  title: string;
  /** PRIMARY explanation (Travel Cost clarity fix): a plain-language
   *  "cheaper/pricier than the reference level, by about how much"
   *  sentence — see computeBaselineDifference() in travelCostIndex.ts.
   *  `{percent}` is replaced with the rounded magnitude; below/above
   *  are separate templates (not one template with a +/- sign) so each
   *  reads as a natural sentence in both languages. `at` is used
   *  instead when the rounded difference is 0. */
  differenceBelow: string;
  differenceAbove: string;
  differenceAt: string;
  /** Label shown above the actual numeric priceLevelIndex value — now
   *  SECONDARY technical detail, shown below the plain-language
   *  difference sentence above, not as the headline. */
  indexLabel: string;
  /** Fixed baseline explanation, e.g. "United States = 100" — kept as
   *  a short secondary label alongside indexLabel's value. */
  baselineNote: string;
  /** Longer secondary explainer: what the 100 baseline actually means
   *  (a comparison reference point) and explicitly what it is NOT (a
   *  rating out of 100, a daily travel budget, a flight/hotel price). */
  baselineExplainer: string;
  /** Label shown above the short tier word (tiers below). */
  tierLabel: string;
  tiers: Record<TravelCostTier, string>;
  /** Fuller relative-to-baseline sentence per tier, e.g. "Relatively
   *  lower than the United States" — shown alongside the short tier
   *  word, not instead of it. */
  relative: Record<TravelCostTier, string>;
  /** e.g. "Source data: {year}" — {year} replaced with sourcePeriod
   *  (the economic OBSERVATION period), never snapshotUpdatedAt (when
   *  Wejhaty last refreshed the snapshot) — see travelCostIndex.ts. */
  sourcePeriodLabel: string;
  disclaimer: string;
  /** Composition-refinement pass: summary label for the <details> element
   *  that now holds baselineNote/baselineExplainer/relative[tier]/
   *  disclaimer — moved out of the card's default visible content (see
   *  TravelCostIndexInfo.tsx) so the card no longer visually dominates
   *  the compact Travel/Accommodation/Travel Cost row with several
   *  paragraphs of methodology. None of that text was removed — it's
   *  one click away, not deleted. */
  moreDetailsLabel: string;
}

// --- Phase 13.5d: Destination Tourism Insights -----------------------------
// Additive, optional, build-time-generated snapshot layer, entirely separate
// from TravelCostSnapshot above — different World Bank indicators, different
// units, never combined on one chart/axis. See
// scripts/lib/tourismInsightsIngest.mjs for the ingestion pipeline and
// app/scripts/TOURISM_INSIGHTS.md for full source/semantics documentation.

/** One annual observation. `period` is the calendar year the observation
 *  is FOR (e.g. "2020"), as a string (matches TravelCostIndexEntry's
 *  sourcePeriod convention) — never implied to be "measured today". */
export interface TourismObservation {
  period: string;
  value: number;
}

/** One country's real source observations. Both series are optional —
 *  a country may have one, both, or (if excluded/uncovered) neither;
 *  never fabricated to fill a gap. Live-verified via a GitHub Actions
 *  run against the real API (this sandboxed dev environment's own
 *  network egress is blocked to worldbank.org): both indicators are
 *  live/serving but World Bank's own WDI has not published a new
 *  observation for either since 2020 — the arrays below reflect that
 *  real ceiling, not a Wejhaty staleness bug. See
 *  TOURISM_INSIGHTS.md. */
export interface DestinationTourismEntry {
  /** ISO 3166-1 alpha-2, uppercase — matches CatalogEntry.countryCode. */
  countryCode: string;
  /** World Bank ST.INT.ARVL — "International tourism, number of
   *  arrivals" (headcount of international arrivals, not a percentage
   *  of anything, not a poll). */
  arrivals?: TourismObservation[];
  /** World Bank ST.INT.RCPT.CD — "International tourism, receipts
   *  (current US$)" — nominal USD, not inflation-adjusted, not SAR. */
  receiptsUsd?: TourismObservation[];
}

/** The whole committed, generated snapshot (data/generated/
 *  tourismInsights.json) — same "small wrapper, not a bare array"
 *  rationale as TravelCostSnapshot. */
export interface TourismInsightsSnapshot {
  /** ISO date-time the SNAPSHOT FILE was (re)generated, or null if the
   *  updater has never successfully run. */
  snapshotUpdatedAt: string | null;
  /** The two World Bank indicator codes this snapshot was built from. */
  sourceIndicators: { arrivals: string; receiptsUsd: string };
  entries: DestinationTourismEntry[];
}

/** Result of computing year-over-year growth from two consecutive real
 *  observations — never a separately-sourced "growth percentage".
 *  `undefined` (never 0, never a guess) when growth cannot be computed:
 *  no previous observation, non-consecutive/non-adjacent periods, or
 *  previous value <= 0 (division-by-zero/undefined-percentage guard).
 *  See computeYoyGrowth() in data/tourismInsights.ts. */
export interface YoyGrowth {
  currentPeriod: string;
  previousPeriod: string;
  /** Percentage points, e.g. 8.4 means +8.4%. Can be negative (a real
   *  decline, e.g. the 2019->2020 pandemic collapse — never hidden or
   *  clamped). */
  percent: number;
}

/** Phase 13.5d strings. Like TravelCostStrings above, no wejhaty.html
 *  equivalent. */
export interface TourismInsightsStrings {
  title: string;
  arrivalsLabel: string;
  receiptsLabel: string;
  growthLabel: string;
  /** e.g. "Tourism data: {year}" — {year} is the observation's own
   *  period, never snapshotUpdatedAt. Mirrors TravelCostStrings'
   *  sourcePeriodLabel distinction. */
  sourcePeriodLabel: string;
  /** e.g. "{from} -> {to}" for the growth card's period range. */
  growthPeriodLabel: string;
  arrivalsChartTitle: string;
  receiptsChartTitle: string;
  /** Shown when a country has no tourism snapshot coverage at all. */
  unavailable: string;
  disclaimer: string;
}

/** Phase 16 — AI API Integration strings. Like LocationStrings/
 *  TravelStrings, no wejhaty.html equivalent, so added directly in
 *  data/i18n/ar.ts / en.ts rather than sourced from the generated JSON.
 *  Deliberately a small surface — this is not a Results/Quiz redesign,
 *  just the two capabilities' own labels/messages (see
 *  components/NaturalPreferenceInput.tsx / RecommendationExplanation.tsx). */
export interface AiStrings {
  interpret: {
    title: string;
    placeholder: string;
    cta: string;
    loading: string;
    unavailable: string;
    error: string;
    proposedTitle: string;
    apply: string;
    dismiss: string;
    unmappedNote: string;
    noneFound: string;
  };
  explain: {
    title: string;
    badge: string;
    loading: string;
    unavailable: string;
    error: string;
  };
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
  location: LocationStrings;
  locationIntro: LocationIntroStrings;
  travel: TravelStrings;
  accommodation: AccommodationStrings;
  travelCost: TravelCostStrings;
  tourismInsights: TourismInsightsStrings;
  ai: AiStrings;
  costLevels: [string, string, string, string];
  climateLabels: Record<ClimateKind, string>;
  visaLabels: Record<VisaDifficulty, string>;
  /** Extended in Phase 10 to Continent (was Region) so the two new buckets
   *  (Africa, SouthAmerica) have labels too — see data/i18n/ar.ts / en.ts. */
  regionLabels: Record<Continent, string>;
}

export type Lang = 'ar' | 'en';
