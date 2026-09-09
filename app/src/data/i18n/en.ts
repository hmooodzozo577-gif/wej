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
    resolving: 'Finding your country…',
    currentLocation: 'Current location',
    nearestCountry: 'Nearest catalog country (approximate)',
    approxNote: 'This is an approximate straight-line estimate, not a real travel distance or border detection.',
    nearbyTitle: 'Nearby countries',
    denied: 'Location permission was denied. You can still browse and search normally.',
    unavailable: 'Your location could not be determined right now.',
    timeout: 'The location request took too long.',
    unsupported: 'Your browser does not support location services.',
  },
  // Phase 13.6 — Full Travel Integration. Like location above, not part
  // of the original wejhaty.html copy.
  travel: {
    title: 'Travel',
    loading: 'Looking up travel info…',
    needLocation: 'Share your location to see travel distance and duration to this destination.',
    setLocationCta: 'Set your location',
    distanceLabel: 'Distance',
    distanceUnit: 'km',
    durationLabel: 'Flight time',
    durationUnit: { h: 'h', m: 'm' },
    estimateNote: 'Estimated straight-line distance and flight time — not a real fare or booking.',
    priceLabel: 'Price',
    stopsLabel: 'Stops',
    nonStop: 'Non-stop',
    offerFoundNote: 'Real flight offer from our travel search — informational only, not a booking.',
  },
  // Phase 13.5a — Accommodation Discovery. Like travel/location above,
  // not part of the original wejhaty.html copy.
  accommodation: {
    title: 'Accommodation',
    costLabel: 'General accommodation affordability',
    guidanceByCostLevel: [
      'Accommodation here is generally budget-friendly, relative to other destinations in our catalog.',
      'Accommodation here is generally moderately priced, relative to other destinations in our catalog.',
      'Accommodation here is generally on the pricier side, relative to other destinations in our catalog.',
      'Accommodation here is generally premium/luxury-priced, relative to other destinations in our catalog.',
    ],
    disclaimer: 'General guidance based on our destination data — not a live price, availability, or booking.',
  },
  // Phase 13.5c — Dynamic Travel Cost Index. Like accommodation above,
  // not part of the original wejhaty.html copy.
  travelCost: {
    title: 'Travel Cost Index',
    indexLabel: 'Relative price level',
    tiers: {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
      veryHigh: 'Very high',
    },
    sourcePeriodLabel: 'Data: {year} (World Bank)',
    disclaimer: 'A general price-level estimate for this country, not a hotel price, food price, or live booking figure.',
  },
};
