import { CLIMATE_COMPAT, QUESTION_BANKS } from '../data/questionBanks';
import type { Destination, PurposeId, Question } from '../data/types';
import { rankDestinations, type Answers } from '../engine';

const TOP_CANDIDATES = 12;

function purposeForBank(bank: Question[]): PurposeId | null {
  const entry = (Object.entries(QUESTION_BANKS) as [PurposeId, Question[]][]).find(([, questions]) => questions === bank);
  return entry?.[0] ?? null;
}

function numericDispersion(values: number[], scale: number): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.min(100, (Math.sqrt(variance) / Math.max(scale, 1)) * 200);
}

function climateDispersion(candidates: Destination[]): number {
  const counts = new Map<string, number>();
  for (const destination of candidates) {
    counts.set(destination.climate, (counts.get(destination.climate) ?? 0) + 1);
  }
  if (counts.size <= 1) return 0;
  const total = candidates.length;
  const entropy = [...counts.values()].reduce((sum, count) => {
    const probability = count / total;
    return sum - probability * Math.log2(probability);
  }, 0);
  return (entropy / Math.log2(Object.keys(CLIMATE_COMPAT.hot ?? {}).length || 5)) * 100;
}

function questionDispersion(question: Question, candidates: Destination[]): number {
  if (!question.destKey || question.kind === 'flavor') return 0;
  if (question.kind === 'climate') return climateDispersion(candidates);
  const values = candidates
    .map((destination) => destination[question.destKey as keyof Destination])
    .filter((value): value is number => typeof value === 'number');
  return numericDispersion(values, question.scale ?? 100);
}

function rankRemainingQuestions(
  remaining: Question[],
  purpose: PurposeId | null,
  answers: Answers,
): Question[] {
  const candidates = purpose
    ? rankDestinations(purpose, answers).slice(0, TOP_CANDIDATES).map((result) => result.dest)
    : [];
  return remaining
    .map((question, index) => ({
      question,
      index,
      score: question.weight * 10 + questionDispersion(question, candidates),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ question }) => question);
}

/**
 * Chooses a deterministic next question from the current candidate set.
 * The first question keeps the bank's established highest-weight choice.
 * Later questions are ordered by how well their supported destination field
 * separates the leading candidates. The option chosen on the previous turn
 * selects a distinct branch among those useful questions, so different
 * answers produce different paths without inventing scoring dimensions.
 */
export function selectNextQuestion(bank: Question[], answers: Answers, askedIds: string[]): Question | null {
  const asked = new Set(askedIds);
  const remaining = bank.filter((question) => !asked.has(question.id) && answers[question.id] === undefined);
  if (remaining.length === 0) return null;

  const flavor = remaining.find((question) => question.kind === 'flavor');
  if (flavor) return flavor;

  if (askedIds.length === 0) {
    return remaining.reduce((best, question) => (question.weight > best.weight ? question : best));
  }

  const previousId = askedIds[askedIds.length - 1];
  const previousQuestion = bank.find((question) => question.id === previousId);
  const previousValue = previousId ? answers[previousId] : undefined;
  const optionIndex = previousQuestion?.options.findIndex((option) => option.value === previousValue) ?? 0;
  const purpose = purposeForBank(bank);

  if (!previousQuestion || optionIndex < 0) {
    return rankRemainingQuestions(remaining, purpose, answers)[0] ?? null;
  }

  // Build all sibling branches together. Each option gets its strongest
  // still-unassigned question for the candidate set that option would
  // produce. This preserves semantic relevance while guaranteeing distinct
  // immediate branches whenever enough unanswered questions remain.
  const assigned = new Set<string>();
  const branches: Question[] = [];
  for (const option of previousQuestion.options) {
    const hypotheticalAnswers = { ...answers, [previousQuestion.id]: option.value };
    const ranked = rankRemainingQuestions(remaining, purpose, hypotheticalAnswers);
    const choice = ranked.find((question) => !assigned.has(question.id)) ?? ranked[0];
    if (!choice) break;
    branches.push(choice);
    assigned.add(choice.id);
  }

  return branches[optionIndex % branches.length] ?? branches[0] ?? null;
}
