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
    photoInfo: 'Photo info',
    photoSource: 'Source',
    photoAuthor: 'Author',
    photoLicense: 'License',
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
    denied:
      'Location permission was denied. You can still use Wejhaty normally — only distances, nearby destinations, and some location-based personalization may be less accurate. Country facts and tourism statistics are not affected.',
    unavailable: 'Your location could not be determined right now.',
    timeout: 'The location request took too long.',
    unsupported: 'Your browser does not support location services.',
  },
  locationIntro: {
    title: 'Improve your destination suggestions',
    body: 'We use your approximate location to improve distance accuracy, show nearby destinations, and personalize some suggestions.',
    allow: 'Allow location',
    notNow: 'Not now',
    alreadyGrantedBody: 'Your browser already allows this site to use your approximate location — turn it on now to improve your suggestions.',
    alreadyGrantedCta: 'Use my location now',
    deniedNote: 'Location for this site is turned off in your browser settings. You can keep using Wejhaty normally without it.',
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
    moreDetailsLabel: 'How is this calculated?',
  },
  // Phase 13.5c — Dynamic Travel Cost Index. Like accommodation above,
  // not part of the original wejhaty.html copy.
  travelCost: {
    title: 'Travel Cost Index',
    differenceBelow: 'Price level is about {percent}% below the reference level',
    differenceAbove: 'Price level is about {percent}% above the reference level',
    differenceAt: 'Price level is about at the reference level',
    indexLabel: 'Price Level Index',
    baselineNote: 'United States = 100',
    baselineExplainer:
      'The index uses the United States as a reference point set at 100, to compare general price levels between countries. 100 is not a rating out of 100 — and this is not a daily travel budget or a flight/hotel price.',
    tierLabel: 'Relative to the United States',
    tiers: {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
      veryHigh: 'Very high',
    },
    relative: {
      low: 'Relatively lower than the United States',
      moderate: 'Roughly similar to the United States',
      high: 'Relatively higher than the United States',
      veryHigh: 'Substantially higher than the United States',
    },
    sourcePeriodLabel: 'Source data: {year} (World Bank)',
    disclaimer:
      'A general relative price-level estimate — not a currency amount, hotel price, food price, daily budget, or live booking figure.',
    moreDetailsLabel: 'How is this calculated?',
  },
  tourismInsights: {
    title: 'Tourism Insights',
    arrivalsLabel: 'International tourist arrivals',
    receiptsLabel: 'Tourism receipts',
    growthLabel: 'Annual arrivals growth',
    sourcePeriodLabel: 'Tourism data: {year} (UN Tourism)',
    growthPeriodLabel: '{from} → {to}',
    arrivalsChartTitle: 'International tourist arrivals over time',
    receiptsChartTitle: 'Tourism receipts over time',
    unavailable: 'No tourism data is available for this destination yet.',
    disclaimer:
      'International arrivals and receipts figures from UN Tourism (via Our World in Data) — not a live measurement, and not a personal travel budget.',
  },
  // Phase 16 — AI API Integration. Optional, additive: the questionnaire
  // and results work identically with none of this text ever shown.
  ai: {
    interpret: {
      title: 'Tell us about your trip',
      optional: 'Optional',
      subtitle:
        'Describe what you\'re looking for in your own words, and we\'ll use it to understand your preferences and skip asking about anything you\'ve already told us.',
      placeholder: 'e.g. "I want somewhere cold and quiet, with nature, and good for families"',
      cta: 'Understand my preferences',
      loading: 'Understanding your preferences…',
      unavailable: 'This feature isn\'t available yet — you can keep answering the questions directly.',
      error: 'Couldn\'t understand that right now. You can keep answering the questions directly.',
      proposedTitle: 'Here\'s what we understood about your trip',
      apply: 'Use these preferences',
      dismiss: 'Dismiss',
      unmappedNote: 'Some of what you wrote didn\'t map to a question.',
      noneFound: 'Nothing in your text mapped to a question yet — try adding more detail.',
      lowConfidence: 'uncertain',
      satisfiedTitle: 'Already taken into account',
      satisfiedSubtitle: 'We won\'t ask about these again.',
      remove: 'Remove',
    },
    followup: {
      freeTextToggle: "None of these? Describe it in your own words",
      freeTextPlaceholder: 'e.g. somewhere without big crowds…',
      aiPromptPlaceholder: 'Type your answer in your own words…',
      freeTextSubmit: 'Send',
      skip: 'Skip',
      freeTextLoading: 'Understanding…',
      freeTextError: "Couldn't understand that right now — you can skip this and continue with the regular questions.",
    },
    explain: {
      title: 'Personalized insight',
      badge: 'AI-enhanced',
      loading: 'Generating a personalized explanation…',
      unavailable: 'A personalized AI explanation isn\'t available right now — your results above are unaffected.',
      error: 'Couldn\'t generate a personalized explanation right now — your results above are unaffected.',
    },
    // Phase 16.5 (TRUE AI-driven adaptive interview completion) — fixed
    // chrome around the AI next-turn question; the question's own text is
    // AI-generated and never lives here.
    turn: {
      loading: 'Preparing your next question…',
      progressLabel: 'Confirmed so far',
      completeTitle: 'We have enough information about your trip',
      completeBody: 'You can see your results now, or go back to change anything confirmed above.',
    },
  },
};
