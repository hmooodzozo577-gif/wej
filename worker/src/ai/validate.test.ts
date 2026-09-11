import { describe, expect, it } from 'vitest';
import {
  MAX_CATALOG_ENTRIES,
  MAX_NEXT_TURN_OPTIONS,
  MAX_ORIGIN_COUNTRY_LENGTH,
  MAX_QUESTIONS,
  MAX_TEXT_LENGTH,
  MAX_TOP_RESULTS,
  validateExplainRecommendationRequest,
  validateExplainRecommendationResult,
  validateInterpretPreferencesRequest,
  validateInterpretPreferencesResult,
  validateNextTurnRequest,
  validateNextTurnResult,
} from './validate';
import type { ExplainRecommendationRequest, InterpretPreferencesRequest, NextTurnRequest } from './types';

const validInterpretBody = {
  lang: 'ar',
  text: 'أبغى دولة باردة وهادية',
  questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] }],
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
    const questions = Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => ({ id: `q${i}`, kind: 'target', options: [{ value: 1, label: 'One' }] }));
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, questions });
    expect(errs.some((e) => e.includes(String(MAX_QUESTIONS)))).toBe(true);
  });

  it('rejects a malformed question entry', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, questions: [{ id: 'x' }] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('BUG FIX REGRESSION: rejects an option missing its label (the old bare-value shape) — a label is now required, not optional', () => {
    const errs = validateInterpretPreferencesRequest({
      ...validInterpretBody,
      questions: [{ id: 'climate', kind: 'climate', options: ['hot', 'mild', 'cold'] }],
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('LOCATION: accepts a well-formed originCountry', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, originCountry: 'Saudi Arabia' });
    expect(errs).toEqual([]);
  });

  it('LOCATION: originCountry is fully optional — absent is valid', () => {
    expect(validateInterpretPreferencesRequest(validInterpretBody)).toEqual([]);
  });

  it('LOCATION: rejects an oversized originCountry', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, originCountry: 'x'.repeat(MAX_ORIGIN_COUNTRY_LENGTH + 1) });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('LOCATION: rejects a coordinate-shaped originCountry (defense in depth against a coordinate ever landing here)', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, originCountry: '24.7136, 46.6753' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('LOCATION: rejects a non-string originCountry', () => {
    const errs = validateInterpretPreferencesRequest({ ...validInterpretBody, originCountry: 12345 });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('validateInterpretPreferencesResult — structured-output validation (never trust the model)', () => {
  const request: InterpretPreferencesRequest = {
    lang: 'ar',
    text: 'test',
    questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] }],
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

describe('validateNextTurnRequest — Phase 16.5 TRUE adaptive-interview Capability C', () => {
  const validNextTurnBody: NextTurnRequest = {
    lang: 'ar',
    purposeName: 'Tourism',
    turnNumber: 1,
    confirmedProfile: {},
    catalog: [
      { id: 'climate', kind: 'climate', rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 'cold', label: 'Cold' }] },
    ],
  };

  it('accepts a well-formed request', () => {
    expect(validateNextTurnRequest(validNextTurnBody)).toEqual([]);
  });

  it('rejects an empty/oversized catalog', () => {
    expect(validateNextTurnRequest({ ...validNextTurnBody, catalog: [] }).length).toBeGreaterThan(0);
    const bigCatalog = Array.from({ length: MAX_CATALOG_ENTRIES + 1 }, (_, i) => ({
      id: `d${i}`,
      kind: 'target',
      rankingSupported: true,
      resolved: false,
      alreadyAsked: false,
      options: [{ value: 1, label: 'x' }],
    }));
    expect(validateNextTurnRequest({ ...validNextTurnBody, catalog: bigCatalog }).length).toBeGreaterThan(0);
  });

  it('rejects a catalog entry missing the resolved/alreadyAsked/rankingSupported flags', () => {
    const errs = validateNextTurnRequest({ ...validNextTurnBody, catalog: [{ id: 'x', kind: 'target', options: [{ value: 1, label: 'x' }] }] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects a non-object confirmedProfile', () => {
    expect(validateNextTurnRequest({ ...validNextTurnBody, confirmedProfile: 'nope' }).length).toBeGreaterThan(0);
  });

  it('rejects turnNumber out of range', () => {
    expect(validateNextTurnRequest({ ...validNextTurnBody, turnNumber: 0 }).length).toBeGreaterThan(0);
    expect(validateNextTurnRequest({ ...validNextTurnBody, turnNumber: 999 }).length).toBeGreaterThan(0);
  });

  it('LOCATION: rejects a coordinate-shaped originCountry', () => {
    expect(validateNextTurnRequest({ ...validNextTurnBody, originCountry: '24.7136, 46.6753' }).length).toBeGreaterThan(0);
  });
});

describe('validateNextTurnResult — the authoritative gate for Capability C (never trust the model)', () => {
  const request: NextTurnRequest = {
    lang: 'ar',
    purposeName: 'Tourism',
    turnNumber: 2,
    confirmedProfile: { climate: 'cold' },
    catalog: [
      { id: 'climate', kind: 'climate', rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 'cold', label: 'Cold' }] },
      {
        id: 'naturecity',
        kind: 'target',
        rankingSupported: true,
        resolved: false,
        alreadyAsked: false,
        options: [{ value: 15, label: 'Nature' }, { value: 90, label: 'Cities' }],
      },
      { id: 'adventure', kind: 'target', rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 10, label: 'Relax' }, { value: 90, label: 'Adventure' }] },
    ],
  };

  it('accepts a valid choice turn', () => {
    const result = validateNextTurnResult(
      {
        status: 'ask',
        questionType: 'choice',
        targetDimensions: ['naturecity'],
        prompt: 'Nature or cities?',
        options: [{ id: 'a', label: 'Nature', updates: { naturecity: 15 } }],
      },
      request,
    );
    expect(result).toEqual({
      status: 'ask',
      questionType: 'choice',
      targetDimensions: ['naturecity'],
      prompt: 'Nature or cities?',
      options: [{ id: 'a', label: 'Nature', updates: { naturecity: 15 } }],
    });
  });

  it('accepts a valid free_text turn', () => {
    const result = validateNextTurnResult({ status: 'ask', questionType: 'free_text', targetDimensions: ['naturecity'], prompt: 'Tell me more' }, request);
    expect(result).toEqual({ status: 'ask', questionType: 'free_text', targetDimensions: ['naturecity'], prompt: 'Tell me more' });
  });

  it('accepts complete', () => {
    expect(validateNextTurnResult({ status: 'complete' }, request)).toEqual({ status: 'complete' });
  });

  it('DUPLICATE PREVENTION: rejects a turn targeting an already-resolved dimension — never trusts the model\'s claim', () => {
    const result = validateNextTurnResult(
      { status: 'ask', questionType: 'free_text', targetDimensions: ['climate'], prompt: 'What weather do you like?' },
      request,
    );
    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects an option whose updates use a value outside the real allowed set — never trusts an invented value', () => {
    const result = validateNextTurnResult(
      {
        status: 'ask',
        questionType: 'choice',
        targetDimensions: ['naturecity'],
        prompt: 'x',
        options: [{ id: 'a', label: 'Nature', updates: { naturecity: 999 } }],
      },
      request,
    );
    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects an option whose updates target a dimension outside targetDimensions — no side-channel update', () => {
    const result = validateNextTurnResult(
      {
        status: 'ask',
        questionType: 'choice',
        targetDimensions: ['naturecity'],
        prompt: 'x',
        options: [{ id: 'a', label: 'Nature', updates: { climate: 'hot' } }],
      },
      request,
    );
    expect(result).toEqual({ status: 'invalid' });
  });

  it('MULTI-DIMENSION: accepts one option updating two eligible dimensions at once', () => {
    const result = validateNextTurnResult(
      {
        status: 'ask',
        questionType: 'choice',
        targetDimensions: ['naturecity', 'adventure'],
        prompt: 'Describe your ideal day',
        options: [{ id: 'a', label: 'Quiet nature walk', updates: { naturecity: 15, adventure: 10 } }],
      },
      request,
    );
    expect(result.status).toBe('ask');
    if (result.status === 'ask' && result.questionType === 'choice') {
      expect(result.options[0]?.updates).toEqual({ naturecity: 15, adventure: 10 });
    }
  });

  it('bounds option count to MAX_NEXT_TURN_OPTIONS', () => {
    const manyOptions = Array.from({ length: MAX_NEXT_TURN_OPTIONS + 3 }, (_, i) => ({
      id: `o${i}`,
      label: `opt${i}`,
      updates: { naturecity: 15 },
    }));
    const result = validateNextTurnResult({ status: 'ask', questionType: 'choice', targetDimensions: ['naturecity'], prompt: 'x', options: manyOptions }, request);
    expect(result.status).toBe('ask');
    if (result.status === 'ask' && result.questionType === 'choice') {
      expect(result.options.length).toBeLessThanOrEqual(MAX_NEXT_TURN_OPTIONS);
    }
  });

  it('rejects malformed/garbage responses as invalid, never silently "complete"', () => {
    expect(validateNextTurnResult('garbage', request)).toEqual({ status: 'invalid' });
    expect(validateNextTurnResult(null, request)).toEqual({ status: 'invalid' });
    expect(validateNextTurnResult({ status: 'something_else' }, request)).toEqual({ status: 'invalid' });
    expect(validateNextTurnResult({ status: 'ask' }, request)).toEqual({ status: 'invalid' }); // missing everything else
  });

  it('rejects a choice turn with no valid options after filtering', () => {
    const result = validateNextTurnResult({ status: 'ask', questionType: 'choice', targetDimensions: ['naturecity'], prompt: 'x', options: [] }, request);
    expect(result).toEqual({ status: 'invalid' });
  });
});
