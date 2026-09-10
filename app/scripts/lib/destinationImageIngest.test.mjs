import { describe, expect, it } from 'vitest';
import {
  buildManifestEntry,
  buildSearchQueries,
  classifyLicense,
  loadEffectiveCatalog,
  scoreCandidate,
  selectBestCandidate,
  validateManifestEntry,
} from './destinationImageIngest.mjs';

const excludedCountries = [{ iso2: 'IL', iso3: 'ISR', reason: 'test' }];
const countryInfoByIso2 = {
  SA: { iso3: 'SAU' },
  FR: { iso3: 'FRA' },
  MC: { iso3: 'MCO' },
  IL: { iso3: 'ISR' },
};
const basicCountries = [
  { id: 'sa', iso2: 'SA', nameEn: 'Saudi Arabia' },
  { id: 'fr', iso2: 'FR', nameEn: 'France' },
  { id: 'mc', iso2: 'MC', nameEn: 'Monaco' },
  { id: 'il', iso2: 'IL', nameEn: 'Israel' },
];
const destinations = [{ id: 'japan', countryCode: 'JP', nameEn: 'Japan' }];

describe('loadEffectiveCatalog', () => {
  it('excludes IL/ISR — never present', () => {
    const catalog = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2: { ...countryInfoByIso2, JP: { iso3: 'JPN' } }, excludedCountries });
    expect(catalog.some((c) => c.iso2 === 'IL')).toBe(false);
    expect(catalog.some((c) => c.iso3 === 'ISR')).toBe(false);
  });

  it('never substitutes Monaco for the exclusion — MC/MCO remains present', () => {
    const catalog = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2, excludedCountries });
    const mc = catalog.find((c) => c.iso2 === 'MC');
    expect(mc).toBeDefined();
    expect(mc.iso3).toBe('MCO');
  });

  it('combines basicCountries + destinations (both source arrays represented)', () => {
    const catalog = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2: { ...countryInfoByIso2, JP: { iso3: 'JPN' } }, excludedCountries });
    expect(catalog.some((c) => c.id === 'sa')).toBe(true); // from basicCountries
    expect(catalog.some((c) => c.id === 'japan')).toBe(true); // from destinations
  });

  it('is deterministic: same input -> same output', () => {
    const a = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2: { ...countryInfoByIso2, JP: { iso3: 'JPN' } }, excludedCountries });
    const b = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2: { ...countryInfoByIso2, JP: { iso3: 'JPN' } }, excludedCountries });
    expect(a).toEqual(b);
  });
});

describe('buildSearchQueries', () => {
  it('generates sensible default queries from catalog identity alone (no override needed)', () => {
    const queries = buildSearchQueries({ iso2: 'FR', iso3: 'FRA', nameEn: 'France' }, {});
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((q) => q.includes('France'))).toBe(true);
  });

  it('uses a curated override when present, instead of the generic default', () => {
    const overrides = { SA: { preferredQueries: ['AlUla Saudi Arabia', 'Riyadh skyline Saudi Arabia'] } };
    const queries = buildSearchQueries({ iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia' }, overrides);
    expect(queries).toEqual(['AlUla Saudi Arabia', 'Riyadh skyline Saudi Arabia']);
  });

  it('194 real countries never require an override to produce a query (architecture requirement)', () => {
    // no override table entry for 'FR' — must still work
    expect(() => buildSearchQueries({ iso2: 'FR', iso3: 'FRA', nameEn: 'France' })).not.toThrow();
  });
});

describe('classifyLicense', () => {
  it.each([
    ['CC0', true],
    ['Public Domain', true],
    ['CC BY 4.0', true],
    ['CC BY-SA 4.0', true],
    ['CC BY-SA 3.0', true],
  ])('allows %s', (license, expected) => {
    expect(classifyLicense(license).allowed).toBe(expected);
  });

  it.each([
    ['CC BY-NC 4.0', false],
    ['CC BY-NC-SA 4.0', false],
    ['CC BY-ND 4.0', false],
    ['All rights reserved', false],
    ['', false],
    [undefined, false],
    ['Some unrecognized custom license', false],
  ])('rejects %s', (license, expected) => {
    expect(classifyLicense(license).allowed).toBe(expected);
  });
});

function makeCandidate(overrides = {}) {
  return {
    title: 'File:Example landscape view.jpg',
    url: 'https://upload.wikimedia.org/example.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    width: 2000,
    height: 1200,
    mime: 'image/jpeg',
    extmetadata: { LicenseShortName: 'CC BY-SA 4.0', Artist: 'Example Photographer', Categories: 'Landscapes', ImageDescription: 'A landscape view' },
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('accepts a well-formed landscape candidate with a valid license', () => {
    const r = scoreCandidate(makeCandidate());
    expect(r.rejected).toBe(false);
    expect(r.score).toBeGreaterThan(0);
  });

  it('rejects a flag image by excluded-term match', () => {
    const r = scoreCandidate(makeCandidate({ title: 'File:Flag of Saudi Arabia.svg', mime: 'image/svg+xml' }));
    expect(r.rejected).toBe(true);
  });

  it('rejects a map by excluded-term match', () => {
    const r = scoreCandidate(makeCandidate({ title: 'File:Map of France.png' }));
    expect(r.rejected).toBe(true);
    expect(r.reason).toMatch(/excluded term/);
  });

  it('rejects a coat of arms / logo', () => {
    const r = scoreCandidate(makeCandidate({ title: 'File:Coat of arms of Japan.svg', mime: 'image/svg+xml' }));
    expect(r.rejected).toBe(true);
  });

  it('rejects a portrait/politician image', () => {
    const r = scoreCandidate(makeCandidate({ title: 'File:Portrait of the president of France.jpg' }));
    expect(r.rejected).toBe(true);
  });

  it('rejects an SVG/diagram/undersized image by file type or resolution', () => {
    expect(scoreCandidate(makeCandidate({ mime: 'image/svg+xml' })).rejected).toBe(true);
    expect(scoreCandidate(makeCandidate({ width: 200, height: 120 })).rejected).toBe(true);
  });

  it('rejects an incompatible license even if everything else is ideal', () => {
    const r = scoreCandidate(makeCandidate({ extmetadata: { LicenseShortName: 'CC BY-NC 4.0' } }));
    expect(r.rejected).toBe(true);
    expect(r.reason).toMatch(/license/);
  });

  it('scores a landscape-oriented, landmark-hinting, high-resolution image higher than a plain square photo', () => {
    const strong = scoreCandidate(makeCandidate({ title: 'File:City skyline panorama.jpg', width: 2400, height: 1400 }));
    const plain = scoreCandidate(makeCandidate({ title: 'File:Example square photo.jpg', width: 900, height: 900 }));
    expect(strong.score).toBeGreaterThan(plain.score);
  });
});

describe('selectBestCandidate', () => {
  it('picks the highest-scoring candidate', () => {
    const weak = makeCandidate({ title: 'File:Plain.jpg', width: 900, height: 900 });
    const strong = makeCandidate({ title: 'File:City skyline panorama.jpg', width: 2400, height: 1400 });
    const picked = selectBestCandidate([weak, strong]);
    expect(picked.candidate.title).toBe(strong.title);
  });

  it('excludes rejected candidates entirely, even if they are the only ones present', () => {
    const flag = makeCandidate({ title: 'File:Flag of Test.svg', mime: 'image/svg+xml' });
    expect(selectBestCandidate([flag])).toBeUndefined();
  });

  it('is deterministic for a tie: same input always yields the same pick', () => {
    const a = makeCandidate({ title: 'File:A view.jpg' });
    const b = makeCandidate({ title: 'File:B view.jpg' });
    const first = selectBestCandidate([a, b]);
    const second = selectBestCandidate([b, a]); // reversed source order
    expect(first.candidate.title).toBe(second.candidate.title);
  });

  it('returns undefined for an empty candidate list', () => {
    expect(selectBestCandidate([])).toBeUndefined();
  });
});

describe('buildManifestEntry / validateManifestEntry', () => {
  it('builds a manifest entry with every required field and it validates', () => {
    const entry = { iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia' };
    const candidate = makeCandidate();
    const license = classifyLicense(candidate.extmetadata.LicenseShortName);
    const manifestEntry = buildManifestEntry({
      entry,
      candidate,
      license,
      localPath: '/destinations/sa.webp',
      width: candidate.width,
      height: candidate.height,
      retrievedAt: '2026-01-01T00:00:00Z',
    });
    const result = validateManifestEntry(manifestEntry);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a manifest entry for IL/ISR even if somehow constructed', () => {
    const result = validateManifestEntry({
      iso2: 'IL', iso3: 'ISR', countryName: 'Israel', localPath: '/x.webp',
      sourcePage: 'https://example.org', license: 'CC0', originalUrl: 'https://example.org/x.jpg',
      retrievedAt: '2026-01-01T00:00:00Z', width: 2000, height: 1200,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('excluded'))).toBe(true);
  });

  it('rejects a manifest entry missing required fields', () => {
    const result = validateManifestEntry({ iso2: 'FR' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-landscape (portrait/square) entry', () => {
    const result = validateManifestEntry({
      iso2: 'FR', iso3: 'FRA', countryName: 'France', localPath: '/x.webp',
      sourcePage: 'https://example.org', license: 'CC0', originalUrl: 'https://example.org/x.jpg',
      retrievedAt: '2026-01-01T00:00:00Z', width: 900, height: 1600,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-landscape'))).toBe(true);
  });

  it('rejects an entry with an invalid/unrecognized license', () => {
    const result = validateManifestEntry({
      iso2: 'FR', iso3: 'FRA', countryName: 'France', localPath: '/x.webp',
      sourcePage: 'https://example.org', license: 'Some made-up license', originalUrl: 'https://example.org/x.jpg',
      retrievedAt: '2026-01-01T00:00:00Z', width: 2000, height: 1200,
    });
    expect(result.valid).toBe(false);
  });
});
