// Ports the per-language destination text accessors from wejhaty.html
// (nameOf, descOf, citiesOf, strengthsOf, weaknessesOf, langOf, livingCostOf).
import type { Destination, FlagSubject, Lang } from './types';

// nameOf works for any CatalogEntry (Destination or BasicCountry) — both
// satisfy FlagSubject. Everything else here (description, cities,
// strengths, etc.) only exists on full destinations, so stays typed to
// Destination and is only ever called after narrowing on
// `recommendationReady` — see components/DestinationCard.tsx.
export const nameOf = (d: FlagSubject, lang: Lang): string => (lang === 'ar' ? d.nameAr : d.nameEn);
export const descOf = (d: Destination, lang: Lang): string => (lang === 'ar' ? d.descAr : d.descEn);
export const citiesOf = (d: Destination, lang: Lang): string[] =>
  lang === 'ar' ? d.citiesAr : d.citiesEn;
export const strengthsOf = (d: Destination, lang: Lang): string[] =>
  lang === 'ar' ? d.strengthsAr : d.strengthsEn;
export const weaknessesOf = (d: Destination, lang: Lang): string[] =>
  lang === 'ar' ? d.weaknessesAr : d.weaknessesEn;
export const langOf = (d: Destination, lang: Lang): string => (lang === 'ar' ? d.langAr : d.langEn);
export const livingCostOf = (d: Destination, lang: Lang): string =>
  lang === 'ar' ? d.livingCostAr : d.livingCostEn;

/** costLevels is a 4-tuple [low, medium, high, luxury] in the active I18nDict. */
export const costLabel = (costLevels: readonly [string, string, string, string], level: number): string =>
  costLevels[level - 1];
