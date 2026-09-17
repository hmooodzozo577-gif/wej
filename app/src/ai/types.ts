// Phase 16 workstream E/F — the browser-side mirror of worker/src/ai.ts's
// request/response contract. Kept as a small, independent copy rather than
// a shared package, the same convention already used for
// countryIntelligence/detailClient.ts's SuitabilityDetail: the Worker and
// the app are separate bundles with no shared build step.
//
// Every field here is either a canonical code (country/purpose/visa) or an
// already-computed number the deterministic systems produced — never a
// coordinate, a passport number, or any other traveller-identifying value.
// See buildExplanationRequest.ts for where these are assembled.
export type AILang = 'ar' | 'en';
export type AIExplanationKind = 'recommendation' | 'countryFit';

export type VisaStatusForAI =
  | 'visaFree'
  | 'visaOnArrival'
  | 'eVisa'
  | 'authorizationRequired'
  | 'embassyVisaRequired'
  | 'unknown';

export type ConfidenceForAI = 'high' | 'medium' | 'low' | null;

export interface AIMatchReason {
  label: string;
  fit: number;
}

export interface AISuitabilityContext {
  purpose: string;
  score: number | null;
  confidence: ConfidenceForAI;
  coverage: number;
  insufficientData: boolean;
}

export interface AIOtherPurposeContext {
  purpose: string;
  score: number | null;
  confidence: ConfidenceForAI;
  insufficientData: boolean;
}

export interface AIExplanationRequest {
  kind: AIExplanationKind;
  lang: AILang;
  countryCode: string;
  purpose: string;
  matchScore?: number;
  matchReasons?: AIMatchReason[];
  suitability?: AISuitabilityContext;
  bestSuitedForGroup?: string[] | null;
  otherSuitablePurposes?: AIOtherPurposeContext[];
  visaStatus?: VisaStatusForAI;
  missingDataFlags?: string[];
}

export interface AIExplanationOutput {
  summary: string;
  whyItFits: string[];
  tradeoffs: string[];
  confidenceNotes: string;
  missingDataNotes: string[];
}

export type AIUnavailableReason =
  | 'not_configured'
  | 'invalid_request'
  | 'provider_timeout'
  | 'provider_error'
  | 'rate_limited'
  | 'invalid_response'
  | 'grounding_violation'
  | 'network_error';

export type AIExplanationResult =
  | { available: true; explanation: AIExplanationOutput; cached: boolean; modelVersion: string }
  | { available: false; reason: AIUnavailableReason };
