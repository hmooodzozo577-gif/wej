// Phase 16.5 correction pass — the ONE trusted boundary that turns this
// app's own Question/option data into what the AI is shown. Centralized
// here (not inlined per call site) precisely because the task's real
// production bug lived in an inline, untested version of this exact
// mapping: NaturalPreferenceInput.tsx used to send `q.options.map((o) =>
// o.value)` — bare numbers with no label — so the model had nothing to
// ground a numeric direction in and guessed "naturecity" backwards for
// an explicit "فيها طبيعة" (nature) statement (see globalMappingAudit
// .test.ts for the full regression proof, and worker/src/ai/types.ts's
// InterpretableOption doc comment for the worker-side half of this fix).
//
// Semantics stay numeric/string exactly as Phase 14 already consumes
// them (see engine/scoreDestination.ts) — this function adds a LABEL
// alongside each value for the model's benefit only; it never changes,
// reorders, or reinterprets a value. Phase 14's own destKey scoring
// (target: closeness-to-destination-value; importance: weighted by
// stated importance; climate: compatibility matrix) is untouched by
// this module and untouched by which provenance an answer came from.
import type { InterpretableQuestion } from './types';
import type { Question } from '../data/types';

/** Builds the exact question payload sent to the Worker's
 *  interpret-preferences endpoint, in the given UI language. Every
 *  option carries {value, label} — never a bare value — so the model
 *  is told directly what each number/string means instead of having to
 *  guess it from the question id/kind alone. */
export function mapQuestionsForAi(questions: Question[], lang: 'ar' | 'en'): InterpretableQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    options: q.options.map((o) => ({ value: o.value, label: lang === 'ar' ? o.label.ar : o.label.en })),
  }));
}
