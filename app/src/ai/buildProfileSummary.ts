// Phase 16 — AI API Integration. Builds the short, deterministic profile
// summary sent as ExplainRecommendationRequest.profileSummary — never a
// raw dump of browser storage or state.answers itself, never a
// coordinate, just the already-answered questions' own text/label pairs
// (the SAME text already shown to the user during the quiz), bounded in
// length (mirrors worker/src/ai/validate.ts's MAX_PROFILE_SUMMARY_LENGTH).
import type { Answers } from '../engine';
import type { Lang, Question } from '../data/types';

const MAX_SUMMARY_LENGTH = 1000;

export function buildProfileSummary(lang: Lang, questions: Question[], answers: Answers): string {
  const parts: string[] = [];
  for (const q of questions) {
    const value = answers[q.id];
    if (value === undefined) continue; // unanswered — omitted, never guessed
    const opt = q.options.find((o) => o.value === value);
    if (!opt) continue;
    const qText = lang === 'ar' ? q.text.ar : q.text.en;
    const optText = lang === 'ar' ? opt.label.ar : opt.label.en;
    parts.push(`${qText}: ${optText}`);
  }
  const joined = parts.join('; ');
  return joined.length > MAX_SUMMARY_LENGTH ? joined.slice(0, MAX_SUMMARY_LENGTH) : joined;
}
