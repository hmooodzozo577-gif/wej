// Phase 16 — request validation and STRUCTURED-OUTPUT validation. Every
// value an AI provider returns passes through here before this Worker
// ever includes it in a response — invalid AI output fails safely
// (dropped/rejected), never passed through to the frontend unvalidated.
import type {
  DimensionCatalogEntry,
  ExplainRecommendationRequest,
  ExplainRecommendationResult,
  InterpretPreferencesRequest,
  InterpretPreferencesResult,
  NextTurnOption,
  NextTurnRequest,
  NextTurnResult,
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
// Phase 16.5 completion pass — location integration: a coarse country
// name only (e.g. "Saudi Arabia"), never a coordinate or address.
export const MAX_ORIGIN_COUNTRY_LENGTH = 100;
// Phase 16.5 TRUE adaptive-interview pass — Capability C bounds.
export const MAX_CATALOG_ENTRIES = 20;
export const MAX_NEXT_TURN_PROMPT_LENGTH = 300;
export const MAX_NEXT_TURN_OPTIONS = 4;
export const MAX_NEXT_TURN_OPTION_LABEL_LENGTH = 120;
export const MAX_TURN_NUMBER = 20;
export const MAX_UNRESOLVED_PREFERENCES = 10;
export const MAX_UNRESOLVED_PREFERENCE_LENGTH = 200;

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
  if (b.originCountry !== undefined && (typeof b.originCountry !== 'string' || b.originCountry.length > MAX_ORIGIN_COUNTRY_LENGTH)) {
    errors.push(`originCountry, if present, must be a string of at most ${MAX_ORIGIN_COUNTRY_LENGTH} characters.`);
  }
  // Defense in depth against a coordinate accidentally landing here —
  // reject anything shaped like "12.345, 67.890" outright rather than
  // silently forwarding it to the model.
  if (typeof b.originCountry === 'string' && /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/.test(b.originCountry)) {
    errors.push('originCountry must not contain coordinate-shaped values.');
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

function isValidInterpretableOptionsArray(options: unknown): boolean {
  return (
    Array.isArray(options) &&
    options.every(
      (o) =>
        typeof o === 'object' &&
        o !== null &&
        (typeof (o as { value?: unknown }).value === 'string' || typeof (o as { value?: unknown }).value === 'number') &&
        typeof (o as { label?: unknown }).label === 'string',
    )
  );
}

export function validateNextTurnRequest(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const b = body as Partial<NextTurnRequest>;

  if (typeof b.lang !== 'string' || !LANGS.has(b.lang)) {
    errors.push('lang must be "ar" or "en".');
  }
  if (typeof b.purposeName !== 'string' || b.purposeName.trim().length === 0) {
    errors.push('purposeName must be a non-empty string.');
  }
  if (typeof b.turnNumber !== 'number' || !Number.isInteger(b.turnNumber) || b.turnNumber < 1 || b.turnNumber > MAX_TURN_NUMBER) {
    errors.push(`turnNumber must be an integer between 1 and ${MAX_TURN_NUMBER}.`);
  }
  if (b.originCountry !== undefined && (typeof b.originCountry !== 'string' || b.originCountry.length > MAX_ORIGIN_COUNTRY_LENGTH)) {
    errors.push(`originCountry, if present, must be a string of at most ${MAX_ORIGIN_COUNTRY_LENGTH} characters.`);
  }
  if (typeof b.originCountry === 'string' && /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/.test(b.originCountry)) {
    errors.push('originCountry must not contain coordinate-shaped values.');
  }
  if (typeof b.confirmedProfile !== 'object' || b.confirmedProfile === null || Array.isArray(b.confirmedProfile)) {
    errors.push('confirmedProfile must be an object.');
  } else {
    for (const value of Object.values(b.confirmedProfile)) {
      if (typeof value !== 'string' && typeof value !== 'number') {
        errors.push('every confirmedProfile value must be a string or number.');
        break;
      }
    }
  }
  if (b.unresolvedPreferences !== undefined) {
    if (
      !Array.isArray(b.unresolvedPreferences) ||
      b.unresolvedPreferences.length > MAX_UNRESOLVED_PREFERENCES ||
      b.unresolvedPreferences.some(
        (value) =>
          typeof value !== 'string' ||
          value.trim().length === 0 ||
          value.length > MAX_UNRESOLVED_PREFERENCE_LENGTH ||
          /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/.test(value),
      )
    ) {
      errors.push('unresolvedPreferences must contain only bounded non-coordinate strings.');
    }
  }
  if (!Array.isArray(b.catalog) || b.catalog.length === 0) {
    errors.push('catalog must be a non-empty array.');
  } else if (b.catalog.length > MAX_CATALOG_ENTRIES) {
    errors.push(`catalog must contain at most ${MAX_CATALOG_ENTRIES} entries.`);
  } else {
    for (const d of b.catalog) {
      const entry = d as Partial<DimensionCatalogEntry> | null;
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        typeof entry.kind !== 'string' ||
        (entry.question !== undefined &&
          (typeof entry.question !== 'string' || entry.question.trim().length === 0 || entry.question.length > MAX_NEXT_TURN_PROMPT_LENGTH)) ||
        (entry.rankingWeight !== undefined &&
          (typeof entry.rankingWeight !== 'number' || !Number.isFinite(entry.rankingWeight) || entry.rankingWeight < 0)) ||
        typeof entry.rankingSupported !== 'boolean' ||
        typeof entry.resolved !== 'boolean' ||
        typeof entry.alreadyAsked !== 'boolean' ||
        !isValidInterpretableOptionsArray(entry.options)
      ) {
        errors.push(
          'every entry in catalog must have {id, kind, question?: string, rankingSupported, resolved, alreadyAsked: boolean, options: {value, label}[]}.',
        );
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

// Phase 16.5 TRUE adaptive-interview pass — the authoritative gate for
// Capability C. This is the ONE place an AI-chosen turn is trusted: every
// target dimension must exist in the request's own catalog AND be both
// unresolved and never-asked (semantic, dimension-level duplicate
// prevention — never just an id-string coincidence); every option's
// updates must use only the request's own real allowed values for that
// dimension. Anything that fails re-validation becomes `{status:
// 'invalid'}` — NEVER silently coerced to 'complete' (which would falsely
// claim sufficient information exists) and never passed through
// unvalidated.
export type NextTurnValidationDiagnostic =
  | 'decision_shape'
  | 'question_type'
  | 'free_text_alternatives'
  | 'target_dimensions'
  | 'question_prompt'
  | 'choice_options';

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] as number;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j] as number;
      previous[j] = Math.min(
        (previous[j] as number) + 1,
        (previous[j - 1] as number) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length] as number;
}

function copiesBankQuestion(prompt: string, bankQuestion: string): boolean {
  const candidate = normalizeQuestion(prompt);
  const source = normalizeQuestion(bankQuestion);
  if (!candidate || !source) return false;
  if (candidate === source) return true;
  const longest = Math.max(candidate.length, source.length);
  return longest > 0 && 1 - editDistance(candidate, source) / longest >= 0.82;
}

function embedsChoiceAlternatives(prompt: string, lang: NextTurnRequest['lang']): boolean {
  return lang === 'ar' ? /(?:^|\s)(?:أم|أو|او)(?=\s|[؟?،,.]|$)/u.test(prompt) : /\bor\b/iu.test(prompt);
}

export function validateNextTurnResult(
  raw: unknown,
  request: NextTurnRequest,
  onInvalid?: (diagnostic: NextTurnValidationDiagnostic) => void,
): NextTurnResult {
  // Keep the existing validation/result contract; the route may collect
  // a fixed rejection category without logging any model/user content.
  const invalid = (diagnostic: NextTurnValidationDiagnostic): NextTurnResult => {
    onInvalid?.(diagnostic);
    return { status: 'invalid' };
  };
  const eligible = new Map(request.catalog.filter((d) => !d.resolved && !d.alreadyAsked).map((d) => [d.id, d]));
  const r = raw as
    | { status?: unknown; questionType?: unknown; targetDimensions?: unknown; prompt?: unknown; options?: unknown }
    | null;

  if (!r || typeof r !== 'object') return invalid('decision_shape');
  if (r.status === 'complete') return { status: 'complete' };
  if (r.status !== 'ask') return invalid('decision_shape');

  const questionType = r.questionType === 'choice' || r.questionType === 'free_text' ? r.questionType : null;
  const targetDimensions = Array.isArray(r.targetDimensions)
    ? r.targetDimensions.filter((id): id is string => typeof id === 'string' && eligible.has(id))
    : [];
  const prompt =
    typeof r.prompt === 'string' && r.prompt.trim().length > 0 && r.prompt.length <= MAX_NEXT_TURN_PROMPT_LENGTH ? r.prompt.trim() : null;

  if (!questionType) return invalid('question_type');
  if (targetDimensions.length === 0) return invalid('target_dimensions');
  if (!prompt) return invalid('question_prompt');
  if (request.catalog.some((dimension) => copiesBankQuestion(prompt, dimension.question ?? ''))) {
    return invalid('question_prompt');
  }
  if (targetDimensions.includes('budget') && targetDimensions.length !== 1) return invalid('target_dimensions');

  if (questionType === 'free_text') {
    // If the model already knows distinct alternatives, the traveler
    // should receive them as selectable options. Embedding “A or B” in
    // a textarea prompt recreates a choice question with worse UX and
    // prevents immediate progression after selection.
    if (embedsChoiceAlternatives(prompt, request.lang)) return invalid('free_text_alternatives');
    return { status: 'ask', questionType: 'free_text', targetDimensions, prompt };
  }

  // questionType === 'choice'
  const options: NextTurnOption[] = [];
  const budgetOnly = targetDimensions.length === 1 && targetDimensions[0] === 'budget';
  const bankOptionLabels = targetDimensions.flatMap((id) => eligible.get(id)?.options.map((option) => option.label) ?? []);
  const optionIds = new Set<string>();
  const optionLabels = new Set<string>();
  let rejectedCopiedOrDuplicateOption = false;
  if (Array.isArray(r.options)) {
    for (const raw of r.options.slice(0, MAX_NEXT_TURN_OPTIONS)) {
      const candidate = raw as Partial<NextTurnOption> | null;
      if (
        !candidate ||
        typeof candidate.id !== 'string' ||
        typeof candidate.label !== 'string' ||
        candidate.label.trim().length === 0 ||
        candidate.label.length > MAX_NEXT_TURN_OPTION_LABEL_LENGTH ||
        typeof candidate.updates !== 'object' ||
        candidate.updates === null ||
        Array.isArray(candidate.updates)
      ) {
        continue;
      }
      const normalizedLabel = normalizeQuestion(candidate.label);
      if (
        optionIds.has(candidate.id) ||
        optionLabels.has(normalizedLabel) ||
        (!budgetOnly && bankOptionLabels.some((label) => copiesBankQuestion(candidate.label as string, label)))
      ) {
        rejectedCopiedOrDuplicateOption = true;
        break;
      }
      const updates: Record<string, string | number> = {};
      let allValid = true;
      for (const [dimId, value] of Object.entries(candidate.updates)) {
        // Every updated dimension must be one this turn actually
        // declared as a target (never a side-channel update to an
        // unrelated or resolved dimension) and the value must be one of
        // that dimension's own real allowed values — never invented.
        const dim = targetDimensions.includes(dimId) ? eligible.get(dimId) : undefined;
        if (!dim || (typeof value !== 'string' && typeof value !== 'number') || !dim.options.some((o) => o.value === value)) {
          allValid = false;
          break;
        }
        updates[dimId] = value;
      }
      if (targetDimensions.some((id) => updates[id] === undefined)) allValid = false;
      if (allValid && Object.keys(updates).length > 0) {
        const label = candidate.label.trim();
        options.push({ id: candidate.id, label, updates });
        optionIds.add(candidate.id);
        optionLabels.add(normalizedLabel);
      }
    }
  }
  if (rejectedCopiedOrDuplicateOption || options.length < 2) return invalid('choice_options');
  // Declaring a target means the traveler is actually choosing its value.
  // A dimension assigned the same value by every option is an unasked,
  // silent inference and must not enter the confirmed profile.
  if (targetDimensions.some((id) => new Set(options.map((option) => option.updates[id])).size < 2)) {
    return invalid('choice_options');
  }
  return { status: 'ask', questionType: 'choice', targetDimensions, prompt, options };
}
