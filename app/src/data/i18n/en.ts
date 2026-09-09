// English strings, ported verbatim from I18N.en in wejhaty.html.
//
// Phase 10: see ar.ts — adds the two continent labels the original never
// needed (Africa, SouthAmerica) at the wrapper layer.
import enJson from '../generated/i18n.en.json';
import type { I18nDict } from '../types';

const base = enJson as I18nDict;

export const EN: I18nDict = {
  ...base,
  regionLabels: {
    ...base.regionLabels,
    Africa: 'Africa',
    SouthAmerica: 'South America',
  },
  detail: {
    ...base.detail,
    capital: 'Capital',
    notRecommendationReady:
      "There isn't enough data yet to include this destination in the recommendation engine — it will be added in a later phase.",
  },
};
