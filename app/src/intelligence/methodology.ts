// Per-purpose suitability methodology — task 3.6/3.13/3.29.
//
// Every factor here reads an indicator that already exists, with real
// provenance, in Wejhaty's own committed snapshots (recommendationIndicators
// .json, travelCostIndex.json via priceLevelIndex, tourismInsights.json via
// tourismArrivals — see sources.ts). Nothing is invented to "fill a gap":
// a candidate factor with no trustworthy structured indicator is listed in
// `excluded` with why, not approximated or guessed.
//
// Each purpose has ITS OWN factor set and weights — tourism does not reuse
// study's weights, study does not reuse work's, etc. (task 3.6). Weights
// within one purpose sum to 100, enforced by methodology.test.ts.
//
// MINIMUM DATA THRESHOLD (task 3.11): a purpose score is only computed when
// at least `minCoverage` of its factors have a real observation for that
// country; otherwise the country/purpose combination is reported as
// insufficient data (see score.ts), never filled in with a guess.
import type { PurposeMethodology, SuitablePurposeId } from './types';

const MIN_COVERAGE = 0.6;

const CLIMATE_REASON =
  'Climate desirability is a traveller PREFERENCE, not an objective good/bad quality — Phase 14 already models it as a compatibility match, not a suitability score. Scoring it here would be an opinion presented as a fact.';
const VISA_REASON =
  'No verified per-country entry-requirement dataset exists (worker/src/visa.ts returns "unknown" with no provider configured) — task 3.20 explicitly forbids inferring visa ease from unverified sources or penalizing/rewarding an "unknown" result.';
const CLIMATE_EXCLUSION = { factor: 'climate', reason: CLIMATE_REASON };
const CONNECTIVITY_EXCLUSION = {
  factor: 'internationalConnectivity',
  reason: 'No trustworthy structured flight-route/connectivity dataset is currently sourced by this project.',
};

export const METHODOLOGIES: Record<SuitablePurposeId, PurposeMethodology> = {
  tourism: {
    purpose: 'tourism',
    modelVersion: 'tourism-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'affordability', label: 'Affordability', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'touristDraw', label: 'Established tourist draw', sourceId: 'tourismArrivals', direction: 'higherIsBetter', transform: 'log', weight: 25 },
      { key: 'healthSafetyNet', label: 'Health safety net', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 10 },
      { key: 'economicStability', label: 'Economic stability', sourceId: 'gdpGrowthPct', direction: 'higherIsBetter', transform: 'linear', weight: 10 },
      { key: 'amenityDensity', label: 'Urban amenity density', sourceId: 'urbanPopulationPct', direction: 'higherIsBetter', transform: 'linear', weight: 15 },
    ],
    excluded: [
      { factor: 'tourismInfrastructureQuality', reason: 'No trustworthy structured indicator sourced for this project (e.g. hotel capacity, transit quality by country).' },
      { factor: 'attractionsCatalog', reason: 'Would require a curated attractions dataset; only the 30 editorial destinations have hand-written attraction content, not all 194.' },
      CONNECTIVITY_EXCLUSION,
      CLIMATE_EXCLUSION,
      { factor: 'entryFriction', reason: VISA_REASON },
    ],
  },
  work: {
    purpose: 'work',
    modelVersion: 'work-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'laborMarket', label: 'Labor market strength', sourceId: 'unemploymentPct', direction: 'lowerIsBetter', transform: 'linear', weight: 25 },
      { key: 'income', label: 'Income level', sourceId: 'incomePerCapitaPpp', direction: 'higherIsBetter', transform: 'log', weight: 25 },
      { key: 'economicGrowth', label: 'Economic growth', sourceId: 'gdpGrowthPct', direction: 'higherIsBetter', transform: 'linear', weight: 15 },
      { key: 'costOfLiving', label: 'Cost of living', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 10 },
      { key: 'health', label: 'Health system context', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 10 },
    ],
    excluded: [
      { factor: 'skillDemandBySector', reason: 'No trustworthy structured skill-demand dataset by sector/country is currently sourced.' },
      { factor: 'workerImmigrationConditions', reason: VISA_REASON },
      { factor: 'taxImplications', reason: 'No structured, current per-country tax-rate dataset is currently sourced.' },
    ],
  },
  education: {
    purpose: 'education',
    modelVersion: 'education-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'educationAccess', label: 'Education access/enrollment', sourceId: 'tertiaryEnrollmentPct', direction: 'higherIsBetter', transform: 'linear', weight: 30 },
      { key: 'affordability', label: 'Affordability', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'postGradEnvironment', label: 'Post-graduation economic environment', sourceId: 'incomePerCapitaPpp', direction: 'higherIsBetter', transform: 'log', weight: 15 },
      { key: 'health', label: 'Health system context', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 15 },
    ],
    excluded: [
      { factor: 'programLanguageAccessibility', reason: 'No structured per-country dataset of program language availability is currently sourced.' },
      { factor: 'institutionRankings', reason: 'Only the 30 editorial destinations carry a reviewed uniRank value — not available for all 194 countries, so excluded from a model meant to be consistent across the full catalog.' },
      { factor: 'studentWorkConditions', reason: VISA_REASON },
      { factor: 'studentImmigrationConditions', reason: VISA_REASON },
    ],
  },
  medical: {
    purpose: 'medical',
    modelVersion: 'medical-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'healthSystemInvestment', label: 'Health system investment', sourceId: 'healthSpendPerCapita', direction: 'higherIsBetter', transform: 'log', weight: 30 },
      { key: 'healthOutcomes', label: 'Health outcomes', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 25 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'affordability', label: 'Affordability', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'economicContext', label: 'Economic context', sourceId: 'incomePerCapitaPpp', direction: 'higherIsBetter', transform: 'log', weight: 15 },
    ],
    excluded: [
      { factor: 'facilityAccreditation', reason: 'No structured per-country hospital/clinic accreditation dataset is currently sourced.' },
      { factor: 'treatmentSpecialtyAvailability', reason: 'No structured dataset of medical specialties available by country is currently sourced.' },
      { factor: 'waitingTimes', reason: 'Only the 30 editorial destinations carry a reviewed waiting-time value — not available for all 194 countries.' },
    ],
  },
  immigration: {
    purpose: 'immigration',
    modelVersion: 'immigration-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'income', label: 'Income level', sourceId: 'incomePerCapitaPpp', direction: 'higherIsBetter', transform: 'log', weight: 20 },
      { key: 'health', label: 'Health outcomes', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 15 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'laborMarket', label: 'Labor market strength', sourceId: 'unemploymentPct', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'costOfLiving', label: 'Cost of living', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'educationForFamily', label: 'Education environment', sourceId: 'tertiaryEnrollmentPct', direction: 'higherIsBetter', transform: 'linear', weight: 15 },
    ],
    excluded: [
      { factor: 'immigrationLegalConditions', reason: VISA_REASON },
      { factor: 'residencyPathwayData', reason: 'No structured, verified per-country residency-pathway dataset is currently sourced.' },
    ],
  },
  investment: {
    purpose: 'investment',
    modelVersion: 'investment-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'fdiAttractiveness', label: 'FDI attractiveness', sourceId: 'fdiPctGdp', direction: 'higherIsBetter', transform: 'linear', weight: 25 },
      { key: 'economicGrowth', label: 'Economic growth', sourceId: 'gdpGrowthPct', direction: 'higherIsBetter', transform: 'linear', weight: 25 },
      { key: 'marketPurchasingPower', label: 'Market purchasing power', sourceId: 'incomePerCapitaPpp', direction: 'higherIsBetter', transform: 'log', weight: 20 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'costBase', label: 'Cost base', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
    ],
    excluded: [
      { factor: 'regulatoryEaseOfBusiness', reason: 'The World Bank discontinued its Doing Business index (the standard source for this); no current authoritative replacement is sourced by this project.' },
      { factor: 'taxBusinessFactors', reason: 'No structured, current per-country business tax dataset is currently sourced.' },
      { factor: 'investmentEntryConditions', reason: VISA_REASON },
    ],
  },
  wellness: {
    purpose: 'wellness',
    modelVersion: 'wellness-v1',
    minCoverage: MIN_COVERAGE,
    factors: [
      { key: 'health', label: 'Health outcomes', sourceId: 'lifeExpectancy', direction: 'higherIsBetter', transform: 'linear', weight: 25 },
      { key: 'healthSystem', label: 'Health system investment', sourceId: 'healthSpendPerCapita', direction: 'higherIsBetter', transform: 'log', weight: 20 },
      { key: 'safety', label: 'Safety', sourceId: 'homicideRate', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
      { key: 'affordability', label: 'Affordability', sourceId: 'priceLevelIndex', direction: 'lowerIsBetter', transform: 'linear', weight: 15 },
      { key: 'tranquility', label: 'Tranquility (lower urban density)', sourceId: 'urbanPopulationPct', direction: 'lowerIsBetter', transform: 'linear', weight: 20 },
    ],
    excluded: [
      { factor: 'wellnessAmenities', reason: 'No structured per-country spa/wellness-facility dataset is currently sourced.' },
      { factor: 'environmentalQuality', reason: 'No structured per-country pollution/environmental-quality index is currently sourced.' },
    ],
  },
};

export function methodologyFor(purpose: SuitablePurposeId): PurposeMethodology {
  return METHODOLOGIES[purpose];
}
