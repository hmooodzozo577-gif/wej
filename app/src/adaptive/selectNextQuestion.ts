import type { Question } from '../data/types';
import type { Answers } from '../engine';

function isEligible(question: Question, answers: Answers): boolean {
  if (!question.parent) return true;
  return question.parent.values.includes(answers[question.parent.questionId]);
}

/** Follows explicit option branches before choosing another useful,
 * unanswered canonical dimension. Unchosen conditional siblings stay out. */
export function selectNextQuestion(bank: Question[], answers: Answers, askedIds: string[]): Question | null {
  if (!bank.length) return null;
  if (!askedIds.length) return bank[0] ?? null;

  const asked = new Set(askedIds);
  const askedDimensions = new Set(
    askedIds.map((id) => bank.find((question) => question.id === id)?.profileKey).filter(Boolean),
  );
  const previous = bank.find((question) => question.id === askedIds[askedIds.length - 1]);
  const previousAnswer = previous ? answers[previous.id] : undefined;
  if (previous?.nextByValue && previousAnswer !== undefined) {
    const explicitId = previous.nextByValue[String(previousAnswer)];
    const explicit = bank.find((question) => question.id === explicitId);
    if (explicit && !asked.has(explicit.id) && isEligible(explicit, answers)) return explicit;
  }

  const remaining = bank.filter(
    (question) =>
      !asked.has(question.id) &&
      answers[question.id] === undefined &&
      isEligible(question, answers) &&
      (!question.profileKey || !askedDimensions.has(question.profileKey)),
  );
  if (!remaining.length) return null;

  const optionIndex = previous?.options.findIndex((option) => option.value === previousAnswer) ?? 0;
  const ranked = [...remaining].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  return ranked[Math.max(0, optionIndex) % ranked.length] ?? null;
}
