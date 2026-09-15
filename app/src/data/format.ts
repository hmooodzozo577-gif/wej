// Centralized number formatting: every visible number, in Arabic or
// English, must render with Latin digits (0-9). `Intl.NumberFormat`/
// `toLocaleString` with an 'ar-*' locale silently switches to
// Arabic-Indic digits — always force 'en-US' as the digit source here,
// regardless of the active language, and let callers pass grouping/
// fraction options as needed.
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(value);
}
