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
} from './types';

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
          interpreted.push({ questionId: q.id, value: firstOption, confidence: 'medium' });
        }
      }
      return { interpreted, unmapped: interpreted.length === 0 ? [req.text] : [] };
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
