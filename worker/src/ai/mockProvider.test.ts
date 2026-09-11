import { describe, expect, it } from 'vitest';
import { createMockAiProvider } from './mockProvider';

describe('createMockAiProvider — test/dev-only, never live AI', () => {
  const provider = createMockAiProvider();

  it('interpretPreferences maps recognizable text to an in-schema question/value pair', async () => {
    const result = await provider.interpretPreferences({
      lang: 'en',
      text: 'I care about climate a lot',
      questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }, { value: 'mild', label: 'Mild' }, { value: 'cold', label: 'Cold' }] }],
    });
    expect(result.interpreted).toEqual([{ questionId: 'climate', value: 'hot', confidence: 'medium' }]);
  });

  it('returns the text as unmapped when nothing recognizable is found', async () => {
    const result = await provider.interpretPreferences({
      lang: 'en',
      text: 'something totally unrelated',
      questions: [{ id: 'climate', kind: 'climate', options: [{ value: 'hot', label: 'Hot' }] }],
    });
    expect(result.interpreted).toEqual([]);
    expect(result.unmapped).toEqual(['something totally unrelated']);
  });

  it('explainRecommendation never returns a destId outside the ones it was given', async () => {
    const result = await provider.explainRecommendation({
      lang: 'en',
      purposeName: 'Tourism',
      profileSummary: 'test',
      topResults: [{ destId: 'japan', name: 'Japan', score: 80, reasons: ['x'], facts: '' }],
    });
    expect(result.perDestination.every((p) => p.destId === 'japan')).toBe(true);
  });

  it('its own output is clearly marked as a mock, never dressed up as live AI', async () => {
    const result = await provider.explainRecommendation({
      lang: 'en',
      purposeName: 'Tourism',
      profileSummary: 'test',
      topResults: [],
    });
    expect(result.caveats.some((c) => c.toLowerCase().includes('mock'))).toBe(true);
  });

  it('nextTurn asks about the first eligible (unresolved, never-asked) catalog entry', async () => {
    const result = await provider.nextTurn({
      lang: 'en',
      purposeName: 'Tourism',
      turnNumber: 1,
      confirmedProfile: {},
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
      ],
    });
    expect(result.status).toBe('ask');
    if (result.status === 'ask') expect(result.targetDimensions).toEqual(['naturecity']);
  });

  it('nextTurn returns complete when every catalog entry is resolved or already asked', async () => {
    const result = await provider.nextTurn({
      lang: 'en',
      purposeName: 'Tourism',
      turnNumber: 1,
      confirmedProfile: { climate: 'cold' },
      catalog: [{ id: 'climate', kind: 'climate', rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 'cold', label: 'Cold' }] }],
    });
    expect(result.status).toBe('complete');
  });

  it('never fabricates a flight/hotel/budget currency value in either capability\'s output', async () => {
    const interp = await provider.interpretPreferences({ lang: 'en', text: 'x', questions: [] });
    const expl = await provider.explainRecommendation({
      lang: 'en',
      purposeName: 'Tourism',
      profileSummary: 'x',
      topResults: [{ destId: 'a', name: 'A', score: 1, reasons: [], facts: '' }],
    });
    const allText = JSON.stringify(interp) + JSON.stringify(expl);
    expect(allText).not.toMatch(/\$\d|SAR\s*\d|USD\s*\d/);
  });
});
