// Security Pass 2 (D1/D2) — the shared origin and country-exclusion rules,
// and proof that every module now uses them rather than its own copy.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALLOWED_ORIGIN, isAllowedOrigin, isExcludedCountry } from './shared';

describe('isAllowedOrigin', () => {
  it('accepts only the exact GitHub Pages origin', () => {
    expect(isAllowedOrigin(ALLOWED_ORIGIN)).toBe(true);
    for (const origin of [
      null, undefined, '', 'null',
      'http://hmooodzozo577-gif.github.io',
      'https://hmooodzozo577-gif.github.io/',
      'https://hmooodzozo577-gif.github.io/wej',
      'https://HMOOODZOZO577-GIF.github.io',
      'https://hmooodzozo577-gif.github.io.evil.example',
      'https://evil.example',
    ]) {
      expect(isAllowedOrigin(origin), String(origin)).toBe(false);
    }
  });
});

describe('isExcludedCountry', () => {
  it('excludes Israel in both ISO forms, any case, trimmed', () => {
    for (const code of ['IL', 'il', ' IL ', 'ISR', 'isr', 'Isr']) expect(isExcludedCountry(code), code).toBe(true);
  });

  it('leaves every other code, and non-strings, alone', () => {
    for (const code of ['SA', 'FR', 'PS', 'ILL', 'I', '', 'SAU', 'IRL', 'IS']) expect(isExcludedCountry(code), code).toBe(false);
    for (const value of [null, undefined, 42, {}, ['IL']]) expect(isExcludedCountry(value)).toBe(false);
  });
});

describe('no module keeps its own copy', () => {
  const sources = readdirSync(new URL('.', import.meta.url))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'shared.ts')
    .map((name) => [name, readFileSync(new URL(name, import.meta.url), 'utf8')] as const);

  it('has no hard-coded IL/ISR comparison outside shared.ts', () => {
    for (const [name, source] of sources) {
      expect(/['"](IL|ISR)['"]/.test(source), name).toBe(false);
    }
  });

  it('has no second copy of the allowed origin outside shared.ts', () => {
    for (const [name, source] of sources) {
      // The city-description User-Agent names the site URL (with /wej/) as
      // Wikimedia's policy asks; that is a contact address, not a CORS rule.
      const bare = source.replaceAll('https://hmooodzozo577-gif.github.io/wej/', '');
      expect(bare.includes('https://hmooodzozo577-gif.github.io'), name).toBe(false);
    }
  });
});
