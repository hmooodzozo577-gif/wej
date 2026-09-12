// Phase 16 — deterministic mock AI provider. TEST-ONLY: never imported
// by index.ts's real request-handling path, never selected by
// resolveAiProvider() (see provider.ts's own doc comment on why real
// runtime resolution always returns null today). This exists so the
// Worker's HTTP plumbing (validation, structured-output re-validation,
// error mapping, size limits) can be exercised end-to-end in automated
// tests without a paid API call and without waiting for a real
// provider to be selected — per this task's own explicit requirement
// ("a mock provider for development/tests").
//
// Deliberately simplistic and rule-based (not a real language model) —
// it must never be mistaken for, or presented as, live AI. See
// index.ai.test.ts for how it's wired into tests via dependency
// injection, never via env vars.
import type {
  AiProvider,
  ExplainRecommendationRequest,
  ExplainRecommendationResult,
  InterpretPreferencesRequest,
  InterpretPreferencesResult,
  NextTurnRequest,
  NextTurnResult,
} from './types';
import { selectContextualQuestionScenarios } from './contextualQuestionLibrary';

export function createMockAiProvider(): AiProvider {
  return {
    async interpretPreferences(req: InterpretPreferencesRequest): Promise<InterpretPreferencesResult> {
      // Trivial keyword-ish rule: if the text mentions a question's id
      // or kind literally, "interpret" it as that question's first
      // option — just enough behavior to prove the plumbing (request
      // in, validated structured response out) end-to-end.
      const interpreted: InterpretPreferencesResult['interpreted'] = [];
      const lower = req.text.toLowerCase();
      for (const q of req.questions) {
        const firstOption = q.options[0];
        if (lower.includes(q.id.toLowerCase()) && firstOption !== undefined) {
          interpreted.push({ questionId: q.id, value: firstOption.value, confidence: 'medium' });
        }
      }
      return { interpreted, unmapped: interpreted.length === 0 ? [req.text] : [] };
    },

    // Phase 16.5 TRUE adaptive-interview pass — deterministic, test-only
    // "AI": picks the first eligible (unresolved, never-asked) catalog
    // entry and offers its first two allowed values as a choice, or
    // declares the interview complete once nothing is eligible. Just
    // enough behavior to exercise the real request/validation/response
    // pipeline end-to-end without a live model call.
    async nextTurn(req: NextTurnRequest): Promise<NextTurnResult> {
      const scenario = selectContextualQuestionScenarios(req)[0];
      if (!scenario) return { status: 'complete' };
      const targetDimensions = scenario.targetDimensions;
      const firstTarget = req.catalog.find((dimension) => dimension.id === targetDimensions[0]);
      if (!firstTarget) return { status: 'complete' };
      const opts = firstTarget.options.slice(0, 2);
      return {
        status: 'ask',
        scenarioId: scenario.id,
        questionType: 'choice',
        targetDimensions,
        prompt: `Mock question for ${scenario.id}`,
        options: opts.map((o, i) => ({
          id: `opt${i}`,
          // The production validator deliberately rejects labels copied
          // from the deterministic bank. Keep this test double inside
          // the same contract instead of weakening validation for tests.
          label: `Mock contextual choice ${i + 1}`,
          updates: Object.fromEntries(targetDimensions.map((id) => {
            const dimension = req.catalog.find((candidate) => candidate.id === id);
            const option = dimension?.options[Math.min(i, Math.max((dimension?.options.length ?? 1) - 1, 0))];
            return [id, option?.value ?? o.value];
          })),
        })),
      };
    },

    async explainRecommendation(req: ExplainRecommendationRequest): Promise<ExplainRecommendationResult> {
      return {
        summary: `Mock summary for ${req.purposeName} (${req.topResults.length} destinations).`,
        perDestination: req.topResults.map((r) => ({ destId: r.destId, explanation: `${r.name} matched on: ${r.reasons.join(', ') || 'overall fit'}.` })),
        caveats: ['This is a test-only mock explanation, not a live AI response.'],
      };
    },
  };
}
