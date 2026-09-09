// Phase 10 test suite — worldwide country catalog.
// Covers: A) count, B) uniqueness, C) bilingual data, D) flags,
// E) existing-30 compatibility, per the Phase 10 requirements. Routing
// checks (F) live in routes/worldCatalog.routing.test.tsx.
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations';
import { BASIC_COUNTRIES } from './basicCountries';
import { WORLD_CATALOG } from './worldCatalog';
import { FLAG_SVG_RAW } from './flags';

const ORIGINAL_30_IDS = [
  'japan', 'skorea', 'malaysia', 'thailand', 'turkey', 'uae', 'ksa', 'qatar',
  'germany', 'france', 'uk', 'spain', 'italy', 'switzerland', 'netherlands',
  'canada', 'usa', 'australia', 'nz', 'singapore', 'austria', 'portugal',
  'greece', 'indonesia', 'norway', 'sweden', 'finland', 'ireland', 'czechia', 'poland',
];

describe('Phase 10 — worldwide country catalog', () => {
  describe('A. Country count', () => {
    it('WORLD_CATALOG has exactly 195 entries (193 UN members + 2 observers)', () => {
      expect(WORLD_CATALOG).toHaveLength(195);
    });

    it('is exactly 30 existing destinations + 165 new basic countries', () => {
      expect(DESTINATIONS).toHaveLength(30);
      expect(BASIC_COUNTRIES).toHaveLength(165);
      expect(DESTINATIONS.length + BASIC_COUNTRIES.length).toBe(195);
    });

    it('includes both UN observer states (Palestine, Vatican/Holy See)', () => {
      const ids = WORLD_CATALOG.map((c) => c.id);
      expect(ids).toContain('ps');
      expect(ids).toContain('va');
    });
  });

  describe('B. Uniqueness', () => {
    it('no duplicate ids across the whole catalog', () => {
      const ids = WORLD_CATALOG.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('no duplicate ISO alpha-2 codes (countryCode) across the whole catalog', () => {
      const codes = WORLD_CATALOG.map((c) => c.countryCode.toUpperCase());
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('no duplicate ISO alpha-3 codes among the 165 basic countries', () => {
      const iso3s = BASIC_COUNTRIES.map((c) => c.iso3);
      expect(new Set(iso3s).size).toBe(iso3s.length);
    });

    it('no basic country duplicates a country already covered by the original 30', () => {
      const existingCodes = new Set(DESTINATIONS.map((d) => d.countryCode.toUpperCase()));
      for (const c of BASIC_COUNTRIES) {
        expect(existingCodes.has(c.iso2), `${c.nameEn} (${c.iso2}) duplicates an existing destination`).toBe(false);
      }
    });
  });

  describe('C. Bilingual data', () => {
    it('every basic country has a non-empty Arabic and English name', () => {
      for (const c of BASIC_COUNTRIES) {
        expect(c.nameAr.length, `${c.id} missing Arabic name`).toBeGreaterThan(0);
        expect(c.nameEn.length, `${c.id} missing English name`).toBeGreaterThan(0);
      }
    });

    it('every entry in the full catalog has Arabic and English names', () => {
      for (const c of WORLD_CATALOG) {
        expect(c.nameAr.length).toBeGreaterThan(0);
        expect(c.nameEn.length).toBeGreaterThan(0);
      }
    });
  });

  describe('D. Flags', () => {
    it('every catalog entry has a valid local/bundled flag reference', () => {
      for (const c of WORLD_CATALOG) {
        const code = c.countryCode.toLowerCase();
        expect(FLAG_SVG_RAW[code], `missing flag for ${c.id} (${code})`).toBeTruthy();
        expect(FLAG_SVG_RAW[code]).toContain('<svg');
      }
    });

    it('FLAG_SVG_RAW has exactly 195 entries (no orphans, no gaps)', () => {
      expect(Object.keys(FLAG_SVG_RAW)).toHaveLength(195);
    });

    it('no remote flag URLs anywhere in the flag data (xmlns declarations are fine; <image>/href/src pointing at a URL are not)', () => {
      for (const [code, svg] of Object.entries(FLAG_SVG_RAW)) {
        expect(svg, `${code}: contains an <image> tag`).not.toMatch(/<image[\s>]/i);
        expect(svg, `${code}: references flagcdn or similar`).not.toMatch(/flagcdn|githubusercontent|flag-icons-cdn/i);
        // href/src attributes should only ever be local fragment refs (#id), never a URL.
        expect(svg, `${code}: href/src points at an http(s) URL`).not.toMatch(
          /(?:href|src)\s*=\s*["']https?:\/\//i,
        );
      }
    });

    it('no emoji flag characters (regional indicator symbol pairs) in the flag data', () => {
      for (const svg of Object.values(FLAG_SVG_RAW)) {
        expect(svg).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
      }
    });
  });

  describe('E. Existing 30 compatibility', () => {
    it('all 30 original destination ids still exist, unchanged', () => {
      const ids = new Set(DESTINATIONS.map((d) => d.id));
      for (const id of ORIGINAL_30_IDS) {
        expect(ids.has(id), `missing original destination id: ${id}`).toBe(true);
      }
      expect(DESTINATIONS).toHaveLength(ORIGINAL_30_IDS.length);
    });

    it('every original destination is recommendationReady', () => {
      for (const d of DESTINATIONS) {
        expect(d.recommendationReady).toBe(true);
      }
    });

    it('every basic country is explicitly NOT recommendationReady (no fabricated scores)', () => {
      for (const c of BASIC_COUNTRIES) {
        expect(c.recommendationReady).toBe(false);
        expect((c as unknown as Record<string, unknown>).costLevel).toBeUndefined();
        expect((c as unknown as Record<string, unknown>).safety).toBeUndefined();
      }
    });
  });
});
