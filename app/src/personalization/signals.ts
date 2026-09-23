// Phase 18.2 — turns stored quiz answers into deterministic, typed
// preference signals. The ONLY place that interprets answers for Personal
// Match: no UI component reads raw answers to decide what a traveller
// prefers.
//
// Signal rules (see README.md for the full methodology):
//   - Only answered questions become signals. Unanswered never counts.
//   - An explicit "no preference" / "does not matter" answer is neutral:
//     recorded, never scored, never penalized.
//   - Importance answers carry strength: "a deciding factor" is strong,
//     "a secondary factor" is minor. Strength changes weight only; no
//     preference, however strong, becomes a hard constraint.
//   - The one genuine requirement the questionnaire asks — "must it be
//     reachable by land?" answered yes — is a hard constraint, evaluated
//     outside the weighted average.
//   - One signal per factor, first answer wins — the same de-duplication
//     Phase 14 applies to canonical dimensions.
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import type { PurposeId, Question, RecommendationProfileKey } from '../data/types';
import type { Answers } from '../engine/types';
import type { FactorId, NormalizedPreferences, PreferenceSignal, SignalStrength } from './types';

export const FACTOR_BY_PROFILE_KEY: Partial<Record<RecommendationProfileKey, FactorId>> = {
  climate: 'climate',
  costLevel: 'budget',
  urbanity: 'setting',
  coastal: 'coast',
  island: 'island',
  size: 'size',
  popularity: 'popularity',
  safety: 'safety',
  health: 'health',
  income: 'income',
  opportunity: 'opportunity',
  education: 'education',
  investment: 'investment',
  growth: 'growth',
};

/** The medical questionnaire's size question offers "the size of the
 *  country does not matter to me" as its 95 option — a stated absence of
 *  preference, not a wish for a vast country. */
const NO_PREFERENCE_TARGET_VALUES: Readonly<Record<string, number>> = {
  'medical-size': 95,
};

const YES_NO_KEYS: ReadonlySet<RecommendationProfileKey> = new Set(['coastal', 'island']);

function strengthOf(importance: number): SignalStrength {
  if (importance >= 100) return 'strong';
  if (importance <= 25) return 'minor';
  return 'normal';
}

function signalFor(question: Question, answer: string | number, factor: FactorId): PreferenceSignal | 'neutral' | null {
  const key = question.profileKey;
  const base = { factor, questionId: question.id, value: answer, weight: question.weight, strength: 'normal' as SignalStrength };
  switch (question.kind) {
    case 'climate':
      return typeof answer === 'string' ? { ...base, kind: 'climate' } : null;
    case 'importance': {
      if (typeof answer !== 'number') return null;
      return { ...base, kind: 'importance', weight: (question.weight * answer) / 100, strength: strengthOf(answer) };
    }
    case 'target': {
      if (typeof answer !== 'number' || !key) return null;
      if (key === 'costLevel') return { ...base, kind: 'budget' };
      if (YES_NO_KEYS.has(key)) {
        if (answer === 100) return { ...base, kind: 'want' };
        if (answer === 0) return { ...base, kind: 'avoid' };
        return 'neutral';
      }
      if (NO_PREFERENCE_TARGET_VALUES[question.id] === answer) return 'neutral';
      return { ...base, kind: 'target' };
    }
    default:
      return null;
  }
}

export function normalizePreferences(purpose: PurposeId, answers: Answers): NormalizedPreferences {
  const signals: PreferenceSignal[] = [];
  const neutral: string[] = [];
  const seen = new Set<FactorId>();

  for (const question of QUESTION_BANKS[purpose] ?? []) {
    const answer = answers[question.id];
    if (answer === undefined) continue;

    if (question.kind === 'proximity') {
      if (seen.has('proximity')) continue;
      seen.add('proximity');
      if (Number(answer) > 0) {
        signals.push({ factor: 'proximity', questionId: question.id, kind: 'near', value: answer, weight: question.weight, strength: 'normal' });
      } else {
        neutral.push(question.id);
      }
      continue;
    }

    const factor = question.profileKey ? FACTOR_BY_PROFILE_KEY[question.profileKey] : undefined;
    if (!factor || seen.has(factor)) continue;
    seen.add(factor);
    const signal = signalFor(question, answer, factor);
    if (signal === 'neutral') neutral.push(question.id);
    else if (signal && signal.weight > 0) signals.push(signal);
  }

  const landBorderId = landBorderQuestionId(purpose);
  const constraints: NormalizedPreferences['constraints'] = [];
  if (answers[landBorderId] === 1) constraints.push({ kind: 'landBorder', questionId: landBorderId });
  else if (answers[landBorderId] === 0) neutral.push(landBorderId);

  signals.sort((a, b) => b.weight - a.weight || a.questionId.localeCompare(b.questionId));
  return { purpose, signals, constraints, neutral };
}
