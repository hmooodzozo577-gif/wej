import indicatorSnapshot from './generated/recommendationIndicators.json';
import { WORLD_CATALOG, continentOf } from './worldCatalog';
import { QUESTION_BANKS } from './questionBanks';
import type {
  ClimateKind,
  PurposeId,
  Question,
  RecommendationProfile,
  RecommendationProfileKey,
} from './types';
import type { Answers } from '../engine/types';

type Observation = { value: number; year: string };
type IndicatorEntry = {
  countryCode: string;
  subregion: string;
  latitude: number;
  longitude: number;
  landlocked: boolean;
  island: boolean;
  areaKm2: number;
  indicators: Record<string, Observation>;
  priceLevelIndex?: Observation;
  tourismArrivals?: Observation;
};

const indicatorEntries = indicatorSnapshot.entries as IndicatorEntry[];
const indicatorByCode = new Map(indicatorEntries.map((entry) => [entry.countryCode, entry]));
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index] ?? 0;
}

function normalizer(values: Array<number | undefined>, invert = false, logarithmic = false) {
  const observed = values.filter((value): value is number => Number.isFinite(value));
  const transformed = observed.map((value) => (logarithmic ? Math.log10(Math.max(0, value) + 1) : value));
  const low = percentile(transformed, 0.05);
  const high = percentile(transformed, 0.95);
  return (input: number | undefined): number | undefined => {
    if (!Number.isFinite(input)) return undefined;
    const value = logarithmic ? Math.log10(Math.max(0, input!) + 1) : input!;
    const ratio = high === low ? 0.5 : Math.max(0, Math.min(1, (value - low) / (high - low)));
    return Math.round((invert ? 1 - ratio : ratio) * 100);
  };
}

const raw = indicatorEntries.map((entry) => ({
  code: entry.countryCode,
  urbanity: entry.indicators.urbanPopulationPct?.value,
  income: entry.indicators.incomePerCapitaPpp?.value,
  employment: entry.indicators.unemploymentPct?.value,
  life: entry.indicators.lifeExpectancy?.value,
  healthSpend: entry.indicators.healthSpendPerCapita?.value,
  education: entry.indicators.tertiaryEnrollmentPct?.value,
  investment: entry.indicators.fdiPctGdp?.value,
  growth: entry.indicators.gdpGrowthPct?.value,
  safety: entry.indicators.homicideRate?.value,
  cost: entry.priceLevelIndex?.value,
  popularity: entry.tourismArrivals?.value,
  size: entry.areaKm2,
}));

const normalize = {
  urbanity: normalizer(raw.map((row) => row.urbanity)),
  income: normalizer(raw.map((row) => row.income), false, true),
  employment: normalizer(raw.map((row) => row.employment), true),
  life: normalizer(raw.map((row) => row.life)),
  healthSpend: normalizer(raw.map((row) => row.healthSpend), false, true),
  education: normalizer(raw.map((row) => row.education)),
  investment: normalizer(raw.map((row) => row.investment)),
  growth: normalizer(raw.map((row) => row.growth)),
  safety: normalizer(raw.map((row) => row.safety), true, true),
  cost: normalizer(raw.map((row) => row.cost)),
  popularity: normalizer(raw.map((row) => row.popularity), false, true),
  size: normalizer(raw.map((row) => row.size), false, true),
};

function climateFromLatitude(latitude: number): ClimateKind {
  const absolute = Math.abs(latitude);
  if (absolute >= 55) return 'cold';
  if (absolute >= 38) return 'temperate';
  if (absolute >= 24) return 'mediterranean';
  return 'tropical';
}

const normalizedRows = raw.map((row) => ({
  ...row,
  urbanity: normalize.urbanity(row.urbanity),
  income: normalize.income(row.income),
  employment: normalize.employment(row.employment),
  life: normalize.life(row.life),
  healthSpend: normalize.healthSpend(row.healthSpend),
  education: normalize.education(row.education),
  investment: normalize.investment(row.investment),
  growth: normalize.growth(row.growth),
  safety: normalize.safety(row.safety),
  cost: normalize.cost(row.cost),
  popularity: normalize.popularity(row.popularity),
  size: normalize.size(row.size),
}));

type NumericInputKey = Exclude<keyof (typeof normalizedRows)[number], 'code'>;
const numericKeys: NumericInputKey[] = ['urbanity', 'income', 'employment', 'life', 'healthSpend', 'education', 'investment', 'growth', 'safety', 'cost', 'popularity', 'size'];
const medians = Object.fromEntries(
  numericKeys.map((key) => [key, percentile(normalizedRows.map((row) => row[key]).filter((value): value is number => typeof value === 'number'), 0.5)]),
) as Record<NumericInputKey, number>;

function valueOrMedian(row: (typeof normalizedRows)[number], key: NumericInputKey, imputed: RecommendationProfileKey[], profileKey: RecommendationProfileKey) {
  const value = row[key];
  if (typeof value === 'number') return value;
  imputed.push(profileKey);
  return medians[key];
}

export const RECOMMENDATION_PROFILES: RecommendationProfile[] = WORLD_CATALOG.map((country) => {
  const source = indicatorByCode.get(country.countryCode)!;
  const row = normalizedRows.find((item) => item.code === country.countryCode)!;
  const imputedKeys: RecommendationProfileKey[] = [];
  const income = valueOrMedian(row, 'income', imputedKeys, 'income');
  const employment = valueOrMedian(row, 'employment', imputedKeys, 'opportunity');
  const life = valueOrMedian(row, 'life', imputedKeys, 'health');
  const healthSpend = valueOrMedian(row, 'healthSpend', imputedKeys, 'health');
  const costScore = valueOrMedian(row, 'cost', imputedKeys, 'costLevel');
  return {
    countryCode: country.countryCode,
    region: continentOf(country),
    subregion: source.subregion,
    // Preserve the reviewed climate category on the original editorial
    // profiles. Other countries use a deliberately broad latitude band and
    // never present it as a measured climate observation.
    climate: country.recommendationReady ? country.climate : climateFromLatitude(source.latitude),
    costLevel: Math.max(1, Math.min(4, Math.ceil((costScore + 1) / 25))),
    coastal: source.landlocked ? 0 : 100,
    island: source.island ? 100 : 0,
    urbanity: valueOrMedian(row, 'urbanity', imputedKeys, 'urbanity'),
    popularity: valueOrMedian(row, 'popularity', imputedKeys, 'popularity'),
    size: valueOrMedian(row, 'size', imputedKeys, 'size'),
    income,
    opportunity: Math.round((income + employment) / 2),
    health: Math.round((life * 0.6 + healthSpend * 0.4)),
    education: valueOrMedian(row, 'education', imputedKeys, 'education'),
    investment: valueOrMedian(row, 'investment', imputedKeys, 'investment'),
    growth: valueOrMedian(row, 'growth', imputedKeys, 'growth'),
    safety: valueOrMedian(row, 'safety', imputedKeys, 'safety'),
    latitudeZone: Math.round(((source.latitude + 90) / 180) * 100),
    longitudeZone: Math.round(((source.longitude + 180) / 360) * 100),
    dataCoverage: Math.round((numericKeys.filter((key) => typeof row[key] === 'number').length / numericKeys.length) * 100),
    imputedKeys: [...new Set(imputedKeys)],
  };
});

export const RECOMMENDATION_PROFILE_BY_CODE = new Map(RECOMMENDATION_PROFILES.map((profile) => [profile.countryCode, profile]));

function closestOption(question: Question, profile: RecommendationProfile): string | number {
  const key = question.profileKey;
  if (!key) return question.options[0]!.value;
  const wanted = profile[key];
  const exact = question.options.find((option) => option.value === wanted);
  if (exact) return exact.value;
  if (typeof wanted === 'number') {
    return question.options.reduce((best, option) => {
      if (typeof option.value !== 'number') return best;
      return Math.abs(option.value - wanted) < Math.abs(Number(best.value) - wanted) ? option : best;
    }, question.options.find((option) => typeof option.value === 'number') ?? question.options[0]!).value;
  }
  return question.options[0]!.value;
}

/** Used by exhaustive reachability tests: only selects values that exist in
 * the real bank and only activates child nodes whose parent was selected. */
export function idealAnswersFor(profile: RecommendationProfile, purpose: PurposeId): Answers {
  const answers: Answers = {};
  const bank = QUESTION_BANKS[purpose];
  let changed = true;
  while (changed) {
    changed = false;
    for (const question of bank) {
      if (answers[question.id] !== undefined) continue;
      if (question.parent && !question.parent.values.includes(answers[question.parent.questionId])) continue;
      answers[question.id] = closestOption(question, profile);
      changed = true;
    }
  }
  return answers;
}
