import { describe, expect, it } from 'vitest';
import { compactCitySummary, safeWikipediaUrl } from './cityDescriptionClient';

describe('compact city narrative', () => {
  it('keeps at most two sentences while leaving numeric facts to the facts list', () => {
    expect(compactCitySummary('First sentence. Second sentence. Third sentence.')).toBe('First sentence. Second sentence.');
  });

  it('supports Arabic sentence punctuation', () => {
    expect(compactCitySummary('الجملة الأولى. الجملة الثانية؟ الجملة الثالثة.')).toBe('الجملة الأولى. الجملة الثانية؟');
  });
});

describe('source link validation (Security Pass 2, optional item)', () => {
  it('keeps HTTPS Wikipedia article links', () => {
    for (const url of ['https://en.wikipedia.org/wiki/Tokyo', 'https://ar.wikipedia.org/wiki/%D8%B7%D9%88%D9%83%D9%8A%D9%88', 'https://en.m.wikipedia.org/wiki/Paris']) {
      expect(safeWikipediaUrl(url), url).toBe(url);
    }
  });

  it('drops every other scheme, host or shape', () => {
    for (const url of [
      'http://en.wikipedia.org/wiki/Tokyo',
      'javascript:alert(1)',
      'data:text/html,hi',
      'https://wikipedia.org.evil.example/wiki/Tokyo',
      'https://evilwikipedia.org/wiki/Tokyo',
      'https://en.wikipedia.org.evil.example/',
      'https://user:pass@en.wikipedia.org/wiki/Tokyo',
      'https://en.wikipedia.org:8443/wiki/Tokyo',
      '//en.wikipedia.org/wiki/Tokyo',
      'not a url',
      '',
    ]) {
      expect(safeWikipediaUrl(url), url).toBeNull();
    }
    expect(safeWikipediaUrl(null)).toBeNull();
    expect(safeWikipediaUrl(42)).toBeNull();
  });
});
