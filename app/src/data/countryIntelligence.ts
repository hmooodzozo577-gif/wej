// Frontend accessor for the compact Country Intelligence summary — see
// app/scripts/generate-country-intelligence.mjs for how this snapshot is
// produced and app/src/intelligence/ for the scoring engine that produces
// it. Only the compact per-country-per-purpose numbers ship here; full
// component/source detail ("Why this score?") is fetched lazily from the
// Worker (see src/countryIntelligence/detailClient.ts) — the same
// keep-the-bundle-light convention already used for the Wikipedia city
// description layer.
import snapshot from './generated/countryIntelligence.json';
import type { ConfidenceLevel, SuitablePurposeId } from '../intelligence/types';

export interface CountryIntelligenceEntry {
  countryCode: string;
  purpose: SuitablePurposeId;
  modelVersion: string;
  score: number | null;
  insufficientData: boolean;
  coverage: number;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
}

const entries = snapshot.entries as CountryIntelligenceEntry[];

const byCountry = new Map<string, CountryIntelligenceEntry[]>();
for (const entry of entries) {
  const list = byCountry.get(entry.countryCode);
  if (list) list.push(entry);
  else byCountry.set(entry.countryCode, [entry]);
}

/** All purpose suitability entries for a country, in methodology order.
 *  Empty for a country code the snapshot has no data for at all (should
 *  not happen for any effective catalog country — see the accompanying
 *  test against the real committed snapshot). */
export function getCountrySuitability(countryCode: string): CountryIntelligenceEntry[] {
  return byCountry.get(countryCode) ?? [];
}

export const COUNTRY_INTELLIGENCE_GENERATED_AT: string = snapshot.generatedAt;
export const COUNTRY_INTELLIGENCE_MODEL_VERSIONS: Record<SuitablePurposeId, string> =
  snapshot.modelVersions as Record<SuitablePurposeId, string>;
