// The 30 embedded flag SVGs, ported byte-for-byte (via scripts/extract-source.mjs)
// from FLAG_SVG_RAW in wejhaty.html — verbatim from the flag-icons project
// (https://github.com/lipis/flag-icons, MIT), embedded here exactly as the
// original: no external requests, no redrawing, no simplification.
//
// Keyed by lowercase ISO 3166-1 alpha-2 code, matching Destination.countryCode.toLowerCase().
import flagsJson from './generated/flags.json';

export const FLAG_SVG_RAW: Record<string, string> = flagsJson as Record<string, string>;
