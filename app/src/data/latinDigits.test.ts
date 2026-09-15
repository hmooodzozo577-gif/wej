// Item #4 — Latin digits everywhere, enforced.
//
// The previous pass fixed only the Intl/toLocaleString leak, and the user
// still saw Arabic-Indic numerals in production. The reason: literal
// Arabic-Indic digits typed straight into the Arabic content — no formatter
// involved, so no formatter fix could have caught them. These tests assert
// the outcome ("nothing the user can read contains a non-Latin digit")
// rather than the mechanism, so a future leak through ANY route fails here.
//
// A companion test, latinDigits.render.test.tsx, asserts the same thing
// against actually-rendered Arabic screens.
import { describe, expect, it } from 'vitest';
import { deepLatinDigits, formatIsoDate, formatNumber, hasNonLatinDigits, toLatinDigits } from './format';
import { I18N } from './i18n';
import { DESTINATIONS } from './destinations';
import { BASIC_COUNTRIES } from './basicCountries';
import { COUNTRY_INFO } from './countryInfo';
import { QUESTION_BANKS, effectiveQuestionBank } from './questionBanks';
import featuredCitiesJson from './generated/featuredCities.json';

/** Every string reachable from a JSON-shaped value, with its path. */
function strings(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      strings(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

function offenders(value: unknown): string[] {
  return strings(value)
    .filter((entry) => hasNonLatinDigits(entry.text))
    .map((entry) => `${entry.path}: ${entry.text}`);
}

describe('toLatinDigits', () => {
  it('rewrites Arabic-Indic digits', () => {
    expect(toLatinDigits('٢٠٣٠')).toBe('2030');
    expect(toLatinDigits('أفضل ٥ وجهات')).toBe('أفضل 5 وجهات');
  });

  it('rewrites Extended Arabic-Indic (Persian) digits', () => {
    expect(toLatinDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
  });

  it('normalizes the Arabic numeric separators along with the digits', () => {
    // Leaving U+066C behind would render "2٬200": Latin digits wearing an
    // Arabic-Indic group separator.
    expect(toLatinDigits('٢٬٢٠٠ دولار/شهرياً')).toBe('2,200 دولار/شهرياً');
    expect(toLatinDigits('٣٫٥')).toBe('3.5');
  });

  it('leaves Arabic letters and non-numeric symbols untouched', () => {
    // U+066A is the Arabic percent SIGN — correct Arabic typography, not a digit.
    expect(toLatinDigits('٪ ٠')).toBe('٪ 0');
    expect(toLatinDigits('مرحبا')).toBe('مرحبا');
  });

  it('is a no-op for text that is already Latin', () => {
    expect(toLatinDigits('Up to 5,000 SAR')).toBe('Up to 5,000 SAR');
  });

  it('deepLatinDigits preserves structure and non-string values', () => {
    expect(deepLatinDigits({ a: '٥', b: [{ c: '٧' }], n: 3, z: null })).toEqual({
      a: '5',
      b: [{ c: '7' }],
      n: 3,
      z: null,
    });
  });
});

describe('formatNumber / formatIsoDate never emit non-Latin digits', () => {
  it('formats with Latin digits whatever the ambient locale looks like', () => {
    expect(hasNonLatinDigits(formatNumber(1234567))).toBe(false);
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(hasNonLatinDigits(formatNumber(0.25, { style: 'percent' }))).toBe(false);
  });

  it('formats dates with Latin digits and a Gregorian calendar', () => {
    expect(formatIsoDate('2026-09-15T00:00:00Z')).toBe('2026-09-15');
    expect(hasNonLatinDigits(formatIsoDate(new Date(0)))).toBe(false);
  });

  it('returns empty rather than "Invalid Date" for unusable input', () => {
    expect(formatIsoDate('not a date')).toBe('');
  });
});

describe('no user-visible content carries a non-Latin digit', () => {
  it('the Arabic dictionary is clean', () => {
    expect(offenders(I18N.ar)).toEqual([]);
  });

  it('the English dictionary is clean', () => {
    expect(offenders(I18N.en)).toEqual([]);
  });

  it('the 30 editorial destinations are clean (this is where livingCostAr leaked)', () => {
    expect(offenders(DESTINATIONS)).toEqual([]);
  });

  it('basic country facts are clean', () => {
    expect(offenders(BASIC_COUNTRIES)).toEqual([]);
  });

  it('country information is clean', () => {
    expect(offenders(COUNTRY_INFO)).toEqual([]);
  });

  it('featured city data is clean', () => {
    expect(offenders(featuredCitiesJson)).toEqual([]);
  });

  it('every question, option label and option description is clean, for every purpose', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      // Both bank shapes: with and without location-dependent questions.
      expect(offenders(effectiveQuestionBank(purpose, true))).toEqual([]);
      expect(offenders(effectiveQuestionBank(purpose, false))).toEqual([]);
    }
  });
});
