import { describe, expect, it } from 'vitest';
import {
  MAX_QUESTIONS,
  MAX_TEXT_LENGTH,
  MAX_TOP_RESULTS,
  validateExplainRecommendationRequest,
  validateExplainRecommendationResult,
  validateInterpretPreferencesRequest,
  validateInterpretPreferencesResult,
} from './validate';
import type { ExplainRecommendationRequest, InterpretPreferencesRequest } from './types';

const validInterpretBody = {
  lang: 'ar',
  text: 'أبغى دولة باردة وهادية',
  questions: [{ id: 'climate', kind: 'climate', options: ['hot', 'mild', 'cold'] }],
};

describe('validateInterpretPreferencesRequest', () => {
  it('accepts a well-formed request', () => {
    expect(validateInterpretPreferencesRequest(validInterpretBody)).toEqual([]);
  });

  it('rejects a non-object body', () => {
    expect(validateInterpretPreferencesRequest('nope')).toEqual(['Request body must be a JSON object.']);
    expect(validateInterpretPreferencesRequest(null)).toEqual(['Request body must be a JSON object.']);
    expect(validateInterpretPreferencesRequest([1, 2])).toEqual(['Request body must be a JSON object.']);
  });

  it('rejects an unsupported lang', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, lang: 'fr' });
    expect(errs.some((e) => e.includes('lang'))).toBe(true);
  });

  it('rejects empty text', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, text: '   ' });
    expect(errs.some((e) => e.includes('text'))).toBe(true);
  });

  it('REGRESSION: oversized text is rejected (size-limit protection)', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, text: 'x'.repeat(MAX_TEXT_LENGTH + 1) });
    expect(errs.some((e) => e.includes(String(MAX_TEXT_LENGTH)))).toBe(true);
  });

  it('REGRESSION: an oversized questions array is rejected', () => {
    const questions = Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => ({ id: `q${i}`, kind: 'target', options: [1] }));
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, questions });
    expect(errs.some((e) => e.includes(String(MAX_QUESTIONS)))).toBe(true);
  });

  it('rejects a malformed question entry', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, questions: [{ id: 'x' }] });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('validateInterpretPreferencesResult — structured-output validation (never trust the model)', () => {
  const request: InterpretPreferencesRequest = {
    lang: 'ar',
    text: 'test',
    questions: [{ id: 'climate', kind: 'climate', options: ['hot', 'mild', 'cold'] }],
  };

  it('accepts a valid, in-schema response', () => {
    const result = validateInterpretPreferencesResult(
      { interpreted: [{ questionId: 'climate', value: 'cold', confidence: 'high' }], unmapped: [] },
      request,
    );
    expect(result.interpreted).toEqual([{ questionId: 'climate', value: 'cold', confidence: 'high' }]);
  });

  it('REGRESSION: drops an interpreted item with a question id that does not exist in the request', () => {
    const result = validateInterpretPreferencesResult(
      { interpreted: [{ questionId: 'nonexistent_question', value: 'cold', confidence: 'high' }], unmapped: [] },
      request,
    );
    expect(result.interpreted).toEqual([]);
  });

  it('REGRESSION: drops an interpreted item whose value is outside that question\'s real allowed options', () => {
    const result = validateInterpretPreferencesResult(
      { interpreted: [{ questionId: 'climate', value: 'scorching', confidence: 'high' }], unmapped: [] },
      request,
    );
    expect(result.interpreted).toEqual([]);
  });

  it('handles a completely malformed/garbage response safely (no throw, empty result)', () => {
    expect(validateInterpretPreferencesResult('not even an object', request)).toEqual({ interpreted: [], unmapped: [] });
    expect(validateInterpretPreferencesResult(null, request)).toEqual({ interpreted: [], unmapped: [] });
    expect(validateInterpretPreferencesResult(undefined, request)).toEqual({ interpreted: [], unmapped: [] });
    expect(validateInterpretPreferencesResult(42, request)).toEqual({ interpreted: [], unmapped: [] });
  });

  it('defaults an invalid/missing confidence to "low" rather than trusting an arbitrary string', () => {
    const result = validateInterpretPreferencesResult(
      { interpreted: [{ questionId: 'climate', value: 'cold', confidence: 'extremely certain' }], unmapped: [] },
      request,
    );
    expect(result.interpreted[0]?.confidence).toBe('low');
  });
});

const validExplainBody: ExplainRecommendationRequest = {
  lang: 'en',
  purposeName: 'Tourism & Vacation',
  profileSummary: 'Prefers a low budget, mild climate, and cultural experiences.',
  topResults: [{ destId: 'japan', name: 'Japan', score: 82, reasons: ['Strong climate match'], facts: 'Climate: Mild. Safety: 85/100.' }],
};

describe('validateExplainRecommendationRequest', () => {
  it('accepts a well-formed request', () => {
    expect(validateExplainRecommendationRequest(validExplainBody)).toEqual([]);
  });

  it('REGRESSION: an oversized topResults array is rejected', () => {
    const topResults = Array.from({ length: MAX_TOP_RESULTS + 1 }, (_, i) => ({ destId: `d${i}`, name: `D${i}`, score: 50, reasons: [], facts: '' }));
    const errs = validateExplainRecommendationRequest({ ...validExplainBody, topResults });
    expect(errs.some((e) => e.includes(String(MAX_TOP_RESULTS)))).toBe(true);
  });

  it('rejects an empty topResults array', () => {
    const errs = validateExplainRecommendationRequest({ ...validExplainBody, topResults: [] });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('validateExplainRecommendationResult — structured-output validation', () => {
  it('accepts a valid response', () => {
    const result = validateExplainRecommendationResult(
      { summary: 'Great fit overall.', perDestination: [{ destId: 'japan', explanation: 'Matches your climate preference.' }], caveats: [] },
      validExplainBody,
    );
    expect(result.summary).toBe('Great fit overall.');
    expect(result.perDestination).toHaveLength(1);
  });

  it('REGRESSION: drops a perDestination entry whose destId was never in the actual ranked results (never a fabricated/reranked destination)', () => {
    const result = validateExplainRecommendationResult(
      { summary: 'ok', perDestination: [{ destId: 'atlantis', explanation: 'A wonderful hidden gem.' }], caveats: [] },
      validExplainBody,
    );
    expect(result.perDestination).toEqual([]);
  });

  it('handles a garbage response safely', () => {
    expect(validateExplainRecommendationResult('garbage', validExplainBody)).toEqual({ summary: '', perDestination: [], caveats: [] });
    expect(validateExplainRecommendationResult(null, validExplainBody)).toEqual({ summary: '', perDestination: [], caveats: [] });
  });
});
