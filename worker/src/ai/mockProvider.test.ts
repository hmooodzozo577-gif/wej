import { describe, expect, it } from 'vitest';
import { createMockAiProvider } from './mockProvider';

describe('createMockAiProvider — test/dev-only, never live AI', () => {
  const provider = createMockAiProvider();

  it('interpretPreferences maps recognizable text to an in-schema question/value pair', async () => {
    const result = await provider.interpretPreferences({
      lang: 'en',
      text: 'I care about climate a lot',
      questions: [{ id: 'climate', kind: 'climate', options: ['hot', 'mild', 'cold'] }],
    });
    expect(result.interpreted).toEqual([{ questionId: 'climate', value: 'hot', confidence: 'medium' }]);
  });

  it('returns the text as unmapped when nothing recognizable is found', async () => {
    const result = await provider.interpretPreferences({
      lang: 'en',
      text: 'something totally unrelated',
      questions: [{ id: 'climate', kind: 'climate', options: ['hot'] }],
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
