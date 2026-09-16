// Item #12 — Wejhaty's canonical entry-requirement vocabulary, mirroring
// worker/src/visa.ts. Deliberately coarse: it is the most a recommendation
// product can honestly say, and every provider's own taxonomy maps onto it
// without implying more precision than the provider gave.
//
// 'unknown' is a first-class answer. It is what the app says when no
// provider is configured, when a provider fails, and when a provider
// returns a value the adapter does not recognise — never a guess.
export type VisaRequirementCategory =
  | 'visaFree'
  | 'visaOnArrival'
  | 'eVisa'
  | 'authorizationRequired'
  | 'embassyVisaRequired'
  | 'unknown';

export interface VisaRequirement {
  passportCode: string;
  destinationCode: string;
  category: VisaRequirementCategory;
  /** Provider text, passed through verbatim — never paraphrased into a
   *  stronger claim than the provider made. */
  details?: string;
  provider: string;
  /** ISO 8601. Entry rules change; a requirement with no check date must
   *  never be displayed as current. */
  checkedAt: string;
}

/** Every category except 'unknown', ordered from most to least convenient.
 *  This ordering is the ONLY thing the ranking layer uses, and it is a
 *  statement about traveller convenience, not about legal eligibility. */
export const VISA_CONVENIENCE_ORDER: VisaRequirementCategory[] = [
  'visaFree',
  'visaOnArrival',
  'eVisa',
  'authorizationRequired',
  'embassyVisaRequired',
];

export function visaConvenienceRank(category: VisaRequirementCategory): number {
  const index = VISA_CONVENIENCE_ORDER.indexOf(category);
  // 'unknown' sits between the extremes rather than at either end: it must
  // neither reward nor punish a destination we have no data for.
  return index === -1 ? (VISA_CONVENIENCE_ORDER.length - 1) / 2 : index;
}
