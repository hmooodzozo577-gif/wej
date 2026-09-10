// Phase 16.5 completion pass — bounded, AI-GUIDED contextual follow-ups.
//
// Architecture decision (reported explicitly, not silently simplified):
// a follow-up's WORDING and OPTIONS come from a small, vetted, already-
// translated template bank — never freshly authored by the model at
// request time. What genuinely IS AI-guided, dynamically, per traveler:
// WHETHER a follow-up fires at all, and WHICH one, driven directly by
// the real interpretation call's own `unmapped` output (the fragments of
// the traveler's own text the model could not map to any known
// dimension) — not a fixed script the same for everyone.
//
// Why a template bank instead of full free-form generation: (1) SECURITY
// — every option's `satisfies` mapping is a real, pre-validated
// QUESTION_BANKS value; nothing the model writes can become a UI string
// shown to the user or a mapping target, so prompt injection in the
// traveler's own text cannot reach this layer at all (contrast with a
// design where the model authors the question/options text itself,
// which would need a much larger runtime validation surface for
// arbitrary generated prose). (2) LATENCY — this selection is a pure,
// zero-latency local computation (keyword classification over already-
// fetched `unmapped` text), so it never costs a second ~40s AI round
// trip just to decide whether to ask a clarifying question. A second
// real AI call only happens if the traveler chooses the free-text
// escape hatch on a template (see NaturalPreferenceInput's follow-up
// handling) — and that call is itself scoped to just this template's
// `candidateDimensionIds`, never the full bank.
import { QUESTION_BANKS } from '../data/questionBanks';
import type { Answers } from '../engine';
import type { PurposeId } from '../data/types';
import type { FollowupOption, PendingFollowup } from '../state/types';

/** Hard cap on how many contextual follow-up turns one interview may
 *  use — the deterministic outer guardrail against an unbounded
 *  chatbot-style back-and-forth (task's own explicit stopping-criteria
 *  requirement). Counts BOTH resolved and dismissed follow-ups. */
export const MAX_FOLLOWUP_TURNS = 2;

interface FollowupTemplate {
  id: string;
  purposeIds: PurposeId[];
  /** Question ids this template can satisfy — used to skip offering it
   *  when every one of them is already known. */
  targetDimensionIds: string[];
  /** Deterministic, zero-AI-call trigger: does this fragment of the
   *  traveler's own (already-fetched) unmapped text suggest this
   *  template is relevant? Case-insensitive substring/regex match,
   *  Arabic and English — never a second model call just to decide. */
  matchesUnmapped: (fragment: string) => boolean;
  prompt: Record<'ar' | 'en', string>;
  buildOptions: (purposeId: PurposeId, answers: Answers) => FollowupOption[];
}

const QUIET_PATTERN = /هادئ|هدوء|ساكن|أطفش|صخب|ازدحام|quiet|calm|peaceful|crowd/i;
const NOVELTY_PATTERN = /مختلف عن المعتاد|شيء مختلف|تجربة مختلفة|جديد كليًا|different from usual|something different|unlike (my|the) usual/i;

const TEMPLATES: FollowupTemplate[] = [
  {
    id: 'quietness_clarify',
    purposeIds: ['tourism', 'other'],
    targetDimensionIds: ['nightlife', 'naturecity', 'adventure'],
    matchesUnmapped: (f) => QUIET_PATTERN.test(f),
    prompt: {
      ar: 'ذكرت رغبتك في أجواء هادئة — أي تجربة أقرب لك؟',
      en: 'You mentioned wanting something quiet — which experience is closest to what you have in mind?',
    },
    // Every option maps to a REAL existing Phase 14 dimension already in
    // the tourism/other bank (never a fabricated "quietness" score) —
    // see the Phase 16.5 completion-pass final report for the full
    // derivation of why each mapping is semantically safe.
    buildOptions: (purposeId, answers) => {
      const bank = QUESTION_BANKS[purposeId];
      const has = (id: string) => answers[id] !== undefined || !bank.some((q) => q.id === id);
      const options: FollowupOption[] = [];
      if (!has('nightlife')) {
        options.push({
          id: 'less_nightlife',
          label: { ar: 'أماكن أقل صخبًا (حياة ليلية أقل)', en: 'Quieter places (less nightlife)' },
          satisfies: { nightlife: 10 },
        });
      }
      if (!has('naturecity')) {
        options.push({
          id: 'nature_quiet',
          label: { ar: 'طبيعة هادئة بعيدة عن الزحام', en: 'Quiet nature, away from crowds' },
          satisfies: { naturecity: 15 },
        });
      }
      if (!has('adventure')) {
        options.push({
          id: 'slower_pace',
          label: { ar: 'وتيرة رحلة أبطأ واسترخاء', en: 'A slower, more relaxed trip pace' },
          satisfies: { adventure: 10 },
        });
      }
      return options;
    },
  },
  {
    id: 'cultural_novelty_clarify',
    purposeIds: ['tourism', 'other'],
    targetDimensionIds: ['culture'],
    matchesUnmapped: (f) => NOVELTY_PATTERN.test(f),
    prompt: {
      ar: 'ذكرت رغبتك في شيء مختلف عن المعتاد — كم تحب أن يكون الاختلاف؟',
      en: "You mentioned wanting something different from usual — how different would you like the experience to be?",
    },
    buildOptions: () => [
      {
        id: 'very_different',
        label: { ar: 'أبغى تجربة ثقافية مختلفة تمامًا عمّا اعتدت عليه', en: 'A culturally very different experience from what I am used to' },
        satisfies: { culture: 100 },
      },
      {
        id: 'somewhat_different',
        label: { ar: 'أبغى بعض الاختلاف، لكن مع شيء مألوف', en: 'Some difference, but with something familiar too' },
        satisfies: { culture: 50 },
      },
      {
        id: 'familiar',
        label: { ar: 'أفضّل بيئة أقرب لما أعرفه', en: 'I prefer an environment closer to what I already know' },
        satisfies: { culture: 20 },
      },
    ],
  },
];

/** Deterministically selects the next contextual follow-up to offer, or
 *  null if none applies. Never invoked more than once per interpretation
 *  result; the caller is responsible for the MAX_FOLLOWUP_TURNS bound
 *  (this function has no state of its own — see NaturalPreferenceInput's
 *  own turn-counting via `state.followupTurnsUsed`). */
export function selectFollowup(purposeId: PurposeId, unmapped: string[], answers: Answers): PendingFollowup | null {
  for (const template of TEMPLATES) {
    if (!template.purposeIds.includes(purposeId)) continue;
    if (template.targetDimensionIds.every((id) => answers[id] !== undefined)) continue; // nothing left it could satisfy
    if (!unmapped.some((f) => template.matchesUnmapped(f))) continue;
    const options = template.buildOptions(purposeId, answers);
    if (options.length === 0) continue; // every candidate dimension already known after all
    return {
      templateId: template.id,
      prompt: template.prompt,
      options,
      allowFreeText: true,
      candidateDimensionIds: template.targetDimensionIds,
    };
  }
  return null;
}
