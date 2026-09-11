// Phase 16.5 completion pass — a formal Travel Profile, as its own
// typed read model over the existing interview state, per the task's
// explicit requirement not to let `Answers` keep growing into an
// implicit profile with no defined semantics.
//
// This module NEVER duplicates Phase 14: it is a pure, read-only VIEW
// derived from `AppState.answers`/`satisfaction`/`confidence`. Phase 14
// (engine/scoreDestination.ts) is untouched and keeps consuming
// `Answers` exactly as before — see adaptive/adaptiveParity.test.ts for
// the structural proof that nothing here can reach scoring.
import { QUESTION_BANKS } from '../data/questionBanks';
import type { AnswerProvenance, AppState } from '../state/types';
import type { PurposeId, Question } from '../data/types';

/** §13's field classification, applied per-question:
 *  - RANKING_SUPPORTED: this question's answer is an actual Phase 14
 *    scoring input today (every non-flavor question — see
 *    scoreDestination.ts, which reads every kind except 'flavor' via
 *    its destKey).
 *  - INTERVIEW_CONTEXT: useful for the interview (choosing what to ask
 *    next, personalizing copy) but NOT itself consumed by Phase 14
 *    scoring today. Concretely: every 'flavor' question (e.g. work's
 *    "field", investment's "sector") — scoreDestination.ts explicitly
 *    filters these out (`q.kind !== 'flavor'`) before scoring. This is
 *    derived from that real filter, not assumed. */
export type ProfileFieldClass = 'RANKING_SUPPORTED' | 'INTERVIEW_CONTEXT';

export function classifyQuestion(q: Question): ProfileFieldClass {
  return q.kind === 'flavor' ? 'INTERVIEW_CONTEXT' : 'RANKING_SUPPORTED';
}

export interface TravelProfileField {
  questionId: string;
  classification: ProfileFieldClass;
  status: 'confirmed' | 'unknown';
  value: string | number | null;
  provenance: AnswerProvenance | null;
  /** Only ever populated for provenance 'ai_interpreted' — see
   *  AppState.confidence's own doc comment. */
  confidence: 'high' | 'medium' | 'low' | null;
}

export interface TravelProfile {
  purposeId: PurposeId;
  fields: TravelProfileField[];
  /** Convenience counts — used by dynamic-progress-style UI and by the
   *  regression tests below; not a replacement for reading `fields`
   *  directly when the classification matters. */
  confirmedCount: number;
  totalCount: number;
}

/** Concepts this project can already ask about, has no reason to
 *  invent a fabricated score for, and does not yet have destination-
 *  side data to rank on — kept as an explicit registry (never silently
 *  dropped) rather than a per-question classification, since none of
 *  these are questions in any bank today. Mirrors this project's own
 *  "BLOCKED — SUITABLE DESTINATION DATA" convention.
 *
 *  Roadmap cleanup: Cultural Compatibility Ranking is explicitly
 *  CANCELLED by the user (not merely blocked pending data) — never
 *  build a compatibility percentage, a culture score, or a Phase 14
 *  culture weight. It is kept in this registry (status updated, not
 *  removed) so a future pass can see the decision was made, not
 *  forgotten. Cultural preference may still exist as plain interview
 *  CONTEXT (e.g. Section 16's cultural-novelty clarification) — that is
 *  a different, preserved thing from a ranking SCORE. */
export const BLOCKED_RANKING_CONCEPTS = [
  {
    concept: 'culturalCompatibility',
    reason:
      'Traveler cultural-comfort preference can be learned by asking (and is, as interview context — see the AI next-turn cultural-novelty handling), but a Cultural Compatibility RANKING (a percentage/score feeding Phase 14) is explicitly cancelled by the user, not merely blocked on missing destination-side data.',
    status: 'CANCELLED / OUT OF SCOPE',
  },
  {
    concept: 'quietnessPace',
    reason:
      '"هادئة"/quietness has no ranking-supported dimension in most purpose banks (wellness\'s own "quiet" importance question is the one real exception) — kept as interview context or a clarifying follow-up, never forced onto naturecity or any other field.',
    status: 'CONTEXT ONLY (purpose-dependent — see wellness.quiet)',
  },
] as const;

/** Builds the current Travel Profile for a purpose from the raw
 *  interview state. Pure function — no side effects, no AI call, safe
 *  to call on every render. */
export function buildTravelProfile(purposeId: PurposeId, state: Pick<AppState, 'answers' | 'satisfaction' | 'confidence'>): TravelProfile {
  const bank = QUESTION_BANKS[purposeId];
  const fields: TravelProfileField[] = bank.map((q) => {
    const value = state.answers[q.id];
    const confirmed = value !== undefined;
    return {
      questionId: q.id,
      classification: classifyQuestion(q),
      status: confirmed ? 'confirmed' : 'unknown',
      value: confirmed ? value : null,
      provenance: confirmed ? (state.satisfaction[q.id] ?? 'direct') : null,
      confidence: confirmed ? (state.confidence[q.id] ?? null) : null,
    };
  });
  return {
    purposeId,
    fields,
    confirmedCount: fields.filter((f) => f.status === 'confirmed').length,
    totalCount: fields.length,
  };
}
