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
    countryInfo: 'Country Information',
    officialName: 'Official Name',
    area: 'Area',
    areaUnit: 'km²',
    currency: 'Currency',
    languages: 'Languages',
    callingCode: 'Calling Code',
    borders: 'Borders',
  },
  // Phase 12 — Location Personalization. Not part of the original
  // wejhaty.html copy (this feature didn't exist there), so it's a plain
  // new key here rather than spread from `base`.
  location: {
    title: 'Location Personalization',
    sub: 'Share your approximate location to see nearby countries in the catalog.',
    cta: 'Use My Location',
    retry: 'Try Again',
    reset: 'Clear',
    requesting: 'Requesting your location…',
    nearestCountry: 'Nearest catalog country (approximate)',
    approxNote: 'This is an approximate straight-line estimate, not a real travel distance or border detection.',
    nearbyTitle: 'Nearby countries',
    denied: 'Location permission was denied. You can still browse and search normally.',
    unavailable: 'Your location could not be determined right now.',
    timeout: 'The location request took too long.',
    unsupported: 'Your browser does not support location services.',
  },
};
