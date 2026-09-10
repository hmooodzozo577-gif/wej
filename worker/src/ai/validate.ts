// Phase 16 — request validation and STRUCTURED-OUTPUT validation. Every
// value an AI provider returns passes through here before this Worker
// ever includes it in a response — invalid AI output fails safely
// (dropped/rejected), never passed through to the frontend unvalidated.
import type {
  ExplainRecommendationRequest,
  ExplainRecommendationResult,
  InterpretPreferencesRequest,
  InterpretPreferencesResult,
  RankedDestinationContext,
} from './types';

// ---- Request-size / shape limits -------------------------------------------
// Deliberately small and fixed — this endpoint has no legitimate reason
// to receive a paragraph of pasted text, 100 "questions", or 50 ranked
// destinations. Same "reasonable request-size limit" discipline the
// task requires; numbers chosen generously above real UI usage (an
// 8-question bank, top-5-or-so results) without inviting abuse.
export const MAX_TEXT_LENGTH = 500;
export const MAX_QUESTIONS = 20;
export const MAX_TOP_RESULTS = 10;
export const MAX_FACTS_LENGTH = 2000;
export const MAX_PROFILE_SUMMARY_LENGTH = 1000;

const LANGS = new Set(['ar', 'en']);

export function validateInterpretPreferencesRequest(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const b = body as Partial<InterpretPreferencesRequest>;

  if (typeof b.lang !== 'string' || !LANGS.has(b.lang)) {
    errors.push('lang must be "ar" or "en".');
  }
  if (typeof b.text !== 'string' || b.text.trim().length === 0) {
    errors.push('text must be a non-empty string.');
  } else if (b.text.length > MAX_TEXT_LENGTH) {
    errors.push(`text must be at most ${MAX_TEXT_LENGTH} characters.`);
  }
  if (!Array.isArray(b.questions) || b.questions.length === 0) {
    errors.push('questions must be a non-empty array.');
  } else if (b.questions.length > MAX_QUESTIONS) {
    errors.push(`questions must contain at most ${MAX_QUESTIONS} entries.`);
  } else {
    for (const q of b.questions) {
      const options = (q as { options?: unknown }).options;
      const optionsValid =
        Array.isArray(options) &&
        options.every(
          (o) =>
            typeof o === 'object' &&
            o !== null &&
            (typeof (o as { value?: unknown }).value === 'string' || typeof (o as { value?: unknown }).value === 'number') &&
            typeof (o as { label?: unknown }).label === 'string',
        );
      if (
        typeof q !== 'object' ||
        q === null ||
        typeof (q as { id?: unknown }).id !== 'string' ||
        typeof (q as { kind?: unknown }).kind !== 'string' ||
        !optionsValid
      ) {
        errors.push('every entry in questions must have {id: string, kind: string, options: {value: string|number, label: string}[]}.');
        break;
      }
    }
  }
  return errors;
}

export function validateExplainRecommendationRequest(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const b = body as Partial<ExplainRecommendationRequest>;

  if (typeof b.lang !== 'string' || !LANGS.has(b.lang)) {
    errors.push('lang must be "ar" or "en".');
  }
  if (typeof b.purposeName !== 'string' || b.purposeName.trim().length === 0) {
    errors.push('purposeName must be a non-empty string.');
  }
  if (typeof b.profileSummary !== 'string') {
    errors.push('profileSummary must be a string.');
  } else if (b.profileSummary.length > MAX_PROFILE_SUMMARY_LENGTH) {
    errors.push(`profileSummary must be at most ${MAX_PROFILE_SUMMARY_LENGTH} characters.`);
  }
  if (!Array.isArray(b.topResults) || b.topResults.length === 0) {
    errors.push('topResults must be a non-empty array.');
  } else if (b.topResults.length > MAX_TOP_RESULTS) {
    errors.push(`topResults must contain at most ${MAX_TOP_RESULTS} entries.`);
  } else {
    for (const r of b.topResults) {
      const item = r as Partial<RankedDestinationContext> | null;
      if (
        !item ||
        typeof item.destId !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.score !== 'number' ||
        !Array.isArray(item.reasons) ||
        typeof item.facts !== 'string' ||
        item.facts.length > MAX_FACTS_LENGTH
      ) {
        errors.push('every entry in topResults must have {destId, name, score, reasons: string[], facts} and facts must respect the length limit.');
        break;
      }
    }
  }
  return errors;
}

// ---- Structured AI output validation ---------------------------------------
// The model is never trusted to have followed instructions. Every
// field is re-checked against the REQUEST's own allowed values (the
// request is what the frontend/user actually asked about — grounding
// the response in it, not in whatever the model claims).

export function validateInterpretPreferencesResult(raw: unknown, request: InterpretPreferencesRequest): InterpretPreferencesResult {
  const allowed = new Map(request.questions.map((q) => [q.id, new Set(q.options.map((o) => o.value))]));
  const interpreted: InterpretPreferencesResult['interpreted'] = [];
  const unmapped: string[] = [];

  const r = raw as { interpreted?: unknown; unmapped?: unknown } | null;
  if (r && Array.isArray(r.interpreted)) {
    for (const item of r.interpreted) {
      const candidate = item as { questionId?: unknown; value?: unknown; confidence?: unknown } | null;
      if (!candidate || typeof candidate.questionId !== 'string') continue;
      const validValues = allowed.get(candidate.questionId);
      if (!validValues) continue; // model invented a question id that doesn't exist — dropped, not trusted
      if (typeof candidate.value !== 'string' && typeof candidate.value !== 'number') continue;
      if (!validValues.has(candidate.value)) continue; // value outside the real option set — dropped
      const confidence = candidate.confidence === 'high' || candidate.confidence === 'medium' || candidate.confidence === 'low' ? candidate.confidence : 'low';
      interpreted.push({ questionId: candidate.questionId, value: candidate.value, confidence });
    }
  }
  if (r && Array.isArray(r.unmapped)) {
    for (const u of r.unmapped) {
      if (typeof u === 'string' && u.length > 0 && u.length <= 200) unmapped.push(u);
    }
  }
  return { interpreted, unmapped };
}

export function validateExplainRecommendationResult(raw: unknown, request: ExplainRecommendationRequest): ExplainRecommendationResult {
  const allowedDestIds = new Set(request.topResults.map((r) => r.destId));
  const r = raw as { summary?: unknown; perDestination?: unknown; caveats?: unknown } | null;

  const summary = r && typeof r.summary === 'string' && r.summary.length > 0 && r.summary.length <= 2000 ? r.summary : '';

  const perDestination: ExplainRecommendationResult['perDestination'] = [];
  if (r && Array.isArray(r.perDestination)) {
    for (const item of r.perDestination) {
      const candidate = item as { destId?: unknown; explanation?: unknown } | null;
      if (!candidate || typeof candidate.destId !== 'string' || !allowedDestIds.has(candidate.destId)) continue; // never a destination outside what was actually ranked
      if (typeof candidate.explanation !== 'string' || candidate.explanation.length === 0 || candidate.explanation.length > 1000) continue;
      perDestination.push({ destId: candidate.destId, explanation: candidate.explanation });
    }
  }

  const caveats: string[] = [];
  if (r && Array.isArray(r.caveats)) {
    for (const c of r.caveats) {
      if (typeof c === 'string' && c.length > 0 && c.length <= 300) caveats.push(c);
    }
  }

  return { summary, perDestination, caveats };
}
