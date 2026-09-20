import { describe, expect, it } from 'vitest';
import { compactCitySummary } from './cityDescriptionClient';

describe('compact city narrative', () => {
  it('keeps at most two sentences while leaving numeric facts to the facts list', () => {
    expect(compactCitySummary('First sentence. Second sentence. Third sentence.')).toBe('First sentence. Second sentence.');
  });

  it('supports Arabic sentence punctuation', () => {
    expect(compactCitySummary('الجملة الأولى. الجملة الثانية؟ الجملة الثالثة.')).toBe('الجملة الأولى. الجملة الثانية؟');
  });
});
