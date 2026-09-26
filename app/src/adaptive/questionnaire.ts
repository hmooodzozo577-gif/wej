// v1.1 — the questionnaire as asked: the Phase 14 questions exactly as
// before (effectiveQuestionBank + selectNextQuestion, untouched), THEN the
// optional Personal Match travel-need questions (personalization/
// travelNeeds.ts) in their fixed order.
//
// The travel-need questions are never handed to selectNextQuestion():
// its choice depends on the size of the remaining pool, so mixing them in
// would reorder the Phase 14 questions. Keeping the two phases apart keeps
// every Phase 14 path byte-for-byte what it was in v1.0.
import { effectiveQuestionBank } from '../data/questionBanks';
import type { PurposeId, Question } from '../data/types';
import type { Answers } from '../engine';
import { travelNeedQuestions } from '../personalization/travelNeeds';
import { selectNextQuestion } from './selectNextQuestion';

/** Every question that may appear in this questionnaire, for lookup by id:
 *  the Phase 14 bank for this location context, then the travel needs. */
export function questionnaireBank(purpose: PurposeId, hasLocation: boolean): Question[] {
  return [...effectiveQuestionBank(purpose, hasLocation), ...travelNeedQuestions(purpose)];
}

function isEligible(question: Question, answers: Answers): boolean {
  return !question.parent || question.parent.values.includes(answers[question.parent.questionId]);
}

export function nextQuestion(purpose: PurposeId, hasLocation: boolean, answers: Answers, path: readonly string[]): Question | null {
  const core = effectiveQuestionBank(purpose, hasLocation);
  const coreIds = new Set(core.map((question) => question.id));
  const next = selectNextQuestion(core, answers, path.filter((id) => coreIds.has(id)));
  if (next) return next;
  const asked = new Set(path);
  return travelNeedQuestions(purpose).find(
    (question) => !asked.has(question.id) && answers[question.id] === undefined && isEligible(question, answers),
  ) ?? null;
}
