// Phase 16.5 TRUE adaptive-interview pass — the ONE place this project
// turns a purpose's question bank + the current interview state into the
// AI Dimension Catalog (worker/src/ai/types.ts's DimensionCatalogEntry),
// mirroring ai/mapQuestionsForAi.ts's role for Capability A: a single
// trusted boundary, never inlined per call site.
//
// Sent in FULL (every dimension, resolved or not) — never just the
// unresolved ones — so the model can see what's already known and never
// re-target it (see worker/src/ai/prompts.ts's buildNextTurnPrompt, which
// explicitly instructs the model never to target a RESOLVED or
// already-asked dimension). The Worker's own validateNextTurnResult is
// the real enforcement point regardless (see ai/aiService.ts's doc
// comment) — this module only decides what the model gets to SEE.
import { QUESTION_BANKS } from '../data/questionBanks';
import { classifyQuestion } from '../profile/travelProfile';
import type { DimensionCatalogEntry } from './types';
import type { AppState } from '../state/types';
import type { PurposeId, Lang } from '../data/types';

export function buildDimensionCatalog(
  purposeId: PurposeId,
  state: Pick<AppState, 'answers' | 'askedDimensionIds'>,
  lang: Lang,
): DimensionCatalogEntry[] {
  const bank = QUESTION_BANKS[purposeId];
  const askedSet = new Set(state.askedDimensionIds);
  return bank.map((q) => {
    const resolved = state.answers[q.id] !== undefined;
    return {
      id: q.id,
      kind: q.kind,
      question: lang === 'ar' ? q.text.ar : q.text.en,
      rankingWeight: q.weight,
      rankingSupported: classifyQuestion(q) === 'RANKING_SUPPORTED',
      // A resolved dimension is, by construction, also "already asked" —
      // the model has no reason to ever revisit it either way; this
      // keeps the two flags consistent without callers having to reason
      // about the (resolved && !alreadyAsked) case that can't legitimately
      // arise from this project's own interview flow.
      alreadyAsked: resolved || askedSet.has(q.id),
      resolved,
      options: q.options.map((o) => ({ value: o.value, label: lang === 'ar' ? o.label.ar : o.label.en })),
    };
  });
}

/** Product-appropriate hard ceiling on real AI next-turn calls per
 *  interview (Section 22 — replaces the old artificial
 *  MAX_FOLLOWUP_TURNS=2 cap for the NORMAL AI-driven path;
 *  followupTemplates.ts's own constant remains only for its legacy/
 *  fallback-support role).
 *
 *  Rationale: at minimum, one turn per ranking-supported dimension this
 *  purpose bank has (the AI should never need MORE turns than there are
 *  actual scoring inputs to fill) — plus 3 extra turns of headroom for
 *  genuine context-only clarification (quietness/cultural-novelty-style
 *  ambiguity, Sections 15-16) that doesn't itself resolve a
 *  ranking-supported dimension. Capped at 12 absolute turns as a hard
 *  safety ceiling regardless of bank size, so a natural-language entry
 *  that already resolved most dimensions up front produces a SHORTER
 *  interview than the fixed bank, never a longer one (the task's own
 *  explicit goal — "natural description should generally REDUCE
 *  effort... do not turn an 8-question experience into a 15-question
 *  conversation"). */
export function computeMaxInterviewTurns(catalog: DimensionCatalogEntry[]): number {
  const rankingSupportedCount = catalog.filter((d) => d.rankingSupported).length;
  return Math.min(rankingSupportedCount + 3, 12);
}
