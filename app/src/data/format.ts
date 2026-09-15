// Item #4 — the ONE place Wejhaty decides what a digit looks like.
//
// Requirement: every visible number in the app renders as 0-9, in both
// languages. Two separate leaks produced Arabic-Indic digits, and the
// previous pass only closed the first:
//
//   1. FORMATTERS. `Intl.NumberFormat`/`toLocaleString`/`toLocaleDateString`
//      with an 'ar-*' locale emit ٠١٢٣٤٥٦٧٨٩. Closed by formatNumber()
//      below, which pins 'en-US' as the digit source whatever the UI
//      language is.
//   2. LITERAL TEXT. Arabic-Indic digits typed directly into translated
//      strings and content data — the home-page stat values ("٨", "٪ ٠"),
//      "أفضل ٥ وجهات", "رؤية ٢٠٣٠", and every destination's
//      `livingCostAr` ("٢٬٢٠٠ دولار/شهرياً"). No formatter is involved, so
//      the previous fix could not have caught these. Closed by
//      toLatinDigits()/deepLatinDigits() below, applied at the data
//      boundary (data/i18n/ar.ts, data/destinations.ts) rather than by
//      hand-editing the generated files, so a regeneration from source
//      cannot silently reintroduce them.
//
// Anything new that renders a number should go through formatNumber(); any
// new localized content loaded from generated JSON should go through
// deepLatinDigits(). data/latinDigits.test.ts fails if either is skipped.

/** Arabic-Indic (U+0660-0669) and Extended Arabic-Indic / Persian
 *  (U+06F0-06F9) digit ranges. Both are checked everywhere: a mixed source
 *  dataset can contain either. */
const NON_LATIN_DIGITS = /[٠-٩۰-۹]/g;

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** True when `value` contains any Arabic-Indic or Persian digit. */
export function hasNonLatinDigits(value: string): boolean {
  // A fresh lastIndex every call — the module-level regex is global.
  NON_LATIN_DIGITS.lastIndex = 0;
  return NON_LATIN_DIGITS.test(value);
}

/** The Arabic decimal separator (U+066B) and thousands separator (U+066C).
 *  Not digits, but they only ever appear INSIDE a number, and leaving them
 *  behind produces "2٬200" — a Latin-digit number wearing an Arabic-Indic
 *  group separator, which reads worse than either convention on its own. */
const ARABIC_NUMERIC_SEPARATORS: Record<string, string> = { '\u066B': '.', '\u066C': ',' };

/** Rewrites Arabic-Indic and Persian digits as Latin 0-9 (and the Arabic
 *  numeric separators as their Latin equivalents), leaving every other
 *  character — Arabic letters, the Arabic percent sign U+066A, ordinary
 *  punctuation — exactly as it was. */
export function toLatinDigits(value: string): string {
  return value
    .replace(NON_LATIN_DIGITS, (digit) => {
      const code = digit.codePointAt(0)!;
      const base = code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO;
      return String(code - base);
    })
    .replace(/[\u066B\u066C]/g, (separator) => ARABIC_NUMERIC_SEPARATORS[separator] ?? separator);
}

/** toLatinDigits() applied through a plain JSON-shaped value (string,
 *  array, object), preserving structure. Used at the boundary where
 *  generated localized content enters the app. */
export function deepLatinDigits<T>(value: T): T {
  if (typeof value === 'string') return toLatinDigits(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => deepLatinDigits(item)) as unknown as T;
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepLatinDigits(item);
    }
    return result as unknown as T;
  }
  return value;
}

/** Centralized number formatting: every visible number, in Arabic or
 *  English, must render with Latin digits (0-9). `Intl.NumberFormat`/
 *  `toLocaleString` with an 'ar-*' locale silently switches to
 *  Arabic-Indic digits — always force 'en-US' as the digit source here,
 *  regardless of the active language, and let callers pass grouping/
 *  fraction options as needed. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(value);
}

/** Dates, for the same reason as formatNumber(): an 'ar-*' date locale
 *  emits Arabic-Indic digits (and, on some platforms, a non-Gregorian
 *  calendar). Pinned to 'en-CA' for a stable, unambiguous YYYY-MM-DD. */
export function formatIsoDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
