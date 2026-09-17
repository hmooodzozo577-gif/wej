// Phase 16 workstream E.2/F — assembles the MINIMAL structured context sent
// to the AI explanation endpoint, from data the deterministic systems have
// already computed. This is the one place on the frontend that decides what
// leaves the browser for this feature; every field is a canonical code or
// an already-computed number — never a coordinate, a passport number, or
// any other traveller-identifying value (worker/src/ai.ts double-checks the
// same boundary server-side).
import type { CatalogEntry, PurposeId, Question } from '../data/types';
import type { Reason } from '../engine';
import type { CountryIntelligenceEntry } from '../data/countryIntelligence';
import type { VisaRequirementCategory } from '../visa/types';
import { bestSuitedFor } from '../intelligence/bestSuitedFor';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { AIExplanationRequest, AILang } from './types';

const MAX_MATCH_REASONS = 4;

function questionLabel(purpose: PurposeId, reasonId: string, lang: AILang): string | undefined {
  const question: Question | undefined = QUESTION_BANKS[purpose]?.find((item) => item.id === reasonId);
  return question?.text[lang];
}

/** Workstream F, purpose-first traveller: "I want to study" -> the engine
 *  already ranked destinations -> this explains ONE ranked result. `reasons`
 *  and `score` come straight from Phase 14's RankedResult; the AI never
 *  sees or influences either. */
export function buildRecommendationExplanationRequest(params: {
  lang: AILang;
  purpose: PurposeId;
  dest: CatalogEntry;
  score: number;
  reasons: Reason[];
  suitability?: CountryIntelligenceEntry;
  visaStatus?: VisaRequirementCategory;
  visaConfigured: boolean;
}): AIExplanationRequest {
  const { lang, purpose, dest, score, reasons, suitability, visaStatus, visaConfigured } = params;

  const matchReasons = reasons
    .filter((reason) => reason.id !== '__purpose' && reason.weight > 0)
    .sort((a, b) => b.weight * b.fit - a.weight * a.fit)
    .slice(0, MAX_MATCH_REASONS)
    .map((reason) => ({ label: questionLabel(purpose, reason.id, lang), fit: Math.round(reason.fit) }))
    .filter((reason): reason is { label: string; fit: number } => !!reason.label);

  const missingDataFlags: string[] = [];
  if (!visaConfigured || !visaStatus || visaStatus === 'unknown') missingDataFlags.push('visaUnknown');
  if (suitability?.insufficientData) missingDataFlags.push(`insufficientData:${purpose}`);

  return {
    kind: 'recommendation',
    lang,
    countryCode: dest.countryCode,
    purpose,
    matchScore: Math.round(score),
    ...(matchReasons.length > 0 ? { matchReasons } : {}),
    ...(suitability
      ? {
          suitability: {
            purpose: suitability.purpose,
            score: suitability.score,
            confidence: suitability.confidence,
            coverage: suitability.coverage,
            insufficientData: suitability.insufficientData,
          },
        }
      : {}),
    visaStatus: visaConfigured ? visaStatus ?? 'unknown' : 'unknown',
    ...(missingDataFlags.length > 0 ? { missingDataFlags } : {}),
  };
}

const MAX_OTHER_PURPOSES = 6;

/** Workstream F, country-first traveller: "I like Japan, what is it best
 *  for?" -> the SAME bestSuitedFor() grouping already shown on the country
 *  page decides the ranking; the AI only summarizes it in prose. */
export function buildCountryFitExplanationRequest(params: {
  lang: AILang;
  countryCode: string;
  entries: CountryIntelligenceEntry[];
}): AIExplanationRequest {
  const { lang, countryCode, entries } = params;
  const result = bestSuitedFor(entries);
  const leadPurpose = result.eligible ? result.topGroup![0]! : entries[0]?.purpose ?? 'tourism';
  const leadEntry = entries.find((entry) => entry.purpose === leadPurpose);

  const otherSuitablePurposes = result.ranked
    .filter((entry) => entry.purpose !== leadPurpose)
    .slice(0, MAX_OTHER_PURPOSES)
    .map((entry) => ({ purpose: entry.purpose, score: entry.score, confidence: entry.confidence, insufficientData: entry.insufficientData }));

  const missingDataFlags: string[] = [];
  if (!result.eligible) missingDataFlags.push('insufficientDataAllPurposes');

  return {
    kind: 'countryFit',
    lang,
    countryCode,
    purpose: leadPurpose,
    ...(leadEntry
      ? {
          suitability: {
            purpose: leadEntry.purpose,
            score: leadEntry.score,
            confidence: leadEntry.confidence,
            coverage: leadEntry.coverage,
            insufficientData: leadEntry.insufficientData,
          },
        }
      : {}),
    bestSuitedForGroup: result.eligible ? result.topGroup : null,
    ...(otherSuitablePurposes.length > 0 ? { otherSuitablePurposes } : {}),
    visaStatus: 'unknown',
    missingDataFlags: [...missingDataFlags, 'visaUnknown'],
  };
}
