# Deterministic adaptive questionnaire

`selectNextQuestion.ts` chooses the next unanswered question without network
calls or generated content.

The first question preserves the established bank priority. Later turns:

1. rank the current 30 recommendation-ready destinations through Phase 14;
2. inspect the leading candidate set;
3. prefer remaining questions whose existing destination field best separates
   those candidates;
4. use the previous canonical option to select a distinct branch among the most
   informative remaining questions.

Every selected question and option comes from the bilingual canonical bank.
No new score, field, or weight is introduced. Phase 14 still receives only the
final `Answers` object and remains the ranking authority.

The reducer stores the shown path. Editing an earlier answer removes stale
downstream answers and recomputes the branch. Tests cover determinism, complete
bank traversal, answer-driven divergence, and Phase 14 parity.
