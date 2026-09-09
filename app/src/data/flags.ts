// The 30 original embedded flag SVGs, ported byte-for-byte (via
// scripts/extract-source.mjs) from FLAG_SVG_RAW in wejhaty.html — verbatim
// from the flag-icons project (https://github.com/lipis/flag-icons, MIT).
//
// Phase 10 adds the other 165 countries' flags — same library, same MIT
// source, extracted via scripts/generate-world-countries.mjs — merged in
// here rather than overwriting the original 30's file, so the original
// extraction stays untouched and verifiable independently.
//
// No external requests, no redrawing, no simplification, no emoji, for
// either set. Keyed by lowercase ISO 3166-1 alpha-2 code.
import flagsJson from './generated/flags.json';
import basicCountryFlagsJson from './generated/basicCountryFlags.json';

export const FLAG_SVG_RAW: Record<string, string> = {
  ...(flagsJson as Record<string, string>),
  ...(basicCountryFlagsJson as Record<string, string>),
};
