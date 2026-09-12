import { describe, expect, it } from 'vitest';
import {
  buildManifestEntry,
  buildSearchQueries,
  checkCountryRelevance,
  classifyLicense,
  isDuplicateHash,
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

  it.each([
    'File:Embassy of Afghanistan, Tokyo. Rooftop patio.jpg',
    'File:Bahamas Ireland Locator (cropped).png',
    'File:2017-03-29 01 BARBADOS II - IMO 9229221 - Barbados.jpg',
    'File:Temporary Slovak passport issued in 1940.jpg',
    'File:Lego Singapore Set.jpg',
    'File:UTAir-Ukraine ATR-72.jpg',
    'File:National Historic Landmark plaque.jpg',
    'File:Satellite image of Latvia in March 2003.png',
  ])('rejects audited non-destination imagery: %s', (title) => {
    expect(scoreCandidate(makeCandidate({ title })).rejected).toBe(true);
  });

  it('strongly prioritizes the first suitable travel photo from a country travel article', () => {
    const lead = scoreCandidate(makeCandidate({ title: 'File:Band-e Amir National Park.jpg', sourceRank: 0 }));
    const later = scoreCandidate(makeCandidate({ title: 'File:Kabul skyline panorama.jpg', sourceRank: 12 }));
    expect(lead.score).toBeGreaterThan(later.score);
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

  it('REGRESSION (Benin/Tajikistan/Vanuatu banner crops): rejects an extreme banner-strip aspect ratio even though width > height', () => {
    // Real candidates the live pipeline selected before this fix: e.g.
    // "Cotonou skyline banner.jpg" at 1440x206 (~7:1) — technically
    // landscape (width > height) but crops to an unrecognizable sliver
    // under this UI's fixed 4:3 object-fit:cover box.
    const result = validateManifestEntry({
      iso2: 'BJ', iso3: 'BEN', countryName: 'Benin', localPath: '/x.webp',
      sourcePage: 'https://example.org', license: 'CC0', originalUrl: 'https://example.org/x.jpg',
      retrievedAt: '2026-01-01T00:00:00Z', width: 1440, height: 206,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('extreme aspect ratio'))).toBe(true);
  });

  it('accepts a normal landscape-photo aspect ratio (e.g. 4:3, 16:9)', () => {
    const result = validateManifestEntry({
      iso2: 'FR', iso3: 'FRA', countryName: 'France', localPath: '/x.webp',
      sourcePage: 'https://example.org', license: 'CC0', originalUrl: 'https://example.org/x.jpg',
      retrievedAt: '2026-01-01T00:00:00Z', width: 1440, height: 810,
    });
    expect(result.valid).toBe(true);
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

describe('checkCountryRelevance', () => {
  const entry = { iso2: 'FR', iso3: 'FRA', nameEn: 'France' };

  it('accepts a candidate whose structured Categories mention the country', () => {
    const candidate = makeCandidate({ title: 'File:Eiffel Tower.jpg', extmetadata: { Categories: 'Eiffel Tower|France|Paris' } });
    expect(checkCountryRelevance(candidate, entry).relevant).toBe(true);
  });

  it('rejects a candidate whose Categories are present but do not mention the country (Categories takes priority over title)', () => {
    const candidate = makeCandidate({ title: 'File:Eiffel Tower, France.jpg', extmetadata: { Categories: 'Towers|Paris landmarks' } });
    expect(checkCountryRelevance(candidate, entry).relevant).toBe(false);
  });

  it('falls back to title/description only when Categories is genuinely unavailable', () => {
    const candidate = makeCandidate({ title: 'File:Eiffel Tower, France.jpg', extmetadata: {} });
    expect(checkCountryRelevance(candidate, entry).relevant).toBe(true);
  });

  it('rejects a candidate with no mention of the target country anywhere in its metadata', () => {
    const candidate = makeCandidate({ title: 'File:Some tower.jpg', extmetadata: { Categories: 'Towers', ImageDescription: 'A tower' } });
    expect(checkCountryRelevance(candidate, entry).relevant).toBe(false);
  });

  it('accepts a photo tied to the matching country travel article without requiring a repeated metadata mention', () => {
    const candidate = makeCandidate({ title: 'File:AlUla canyon.jpg', extmetadata: {} });
    const saEntry = { iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia' };
    expect(checkCountryRelevance(candidate, saEntry, { sourceArticle: 'Saudi Arabia' }).relevant).toBe(true);
  });

  it('does not mistake the word photographs for a standalone graph', () => {
    const r = scoreCandidate(makeCandidate({
      title: 'File:Grand Place Brussels panorama.jpg',
      extmetadata: { LicenseShortName: 'CC BY-SA 4.0', Categories: 'Belgium photographs|City panoramas' },
    }));
    expect(r.rejected).toBe(false);
  });

  it('does not let a search-query override bypass country relevance', () => {
    const candidate = makeCandidate({ title: 'File:Atlanta, Georgia Skyline.jpg', extmetadata: { Categories: 'Atlanta|Georgia (U.S. state)' } });
    const georgiaEntry = { iso2: 'GE', iso3: 'GEO', nameEn: 'Georgia' };
    expect(checkCountryRelevance(candidate, georgiaEntry, { fromOverride: true }).relevant).toBe(false);
  });

  // Regression tests for the two real false positives the mandatory
  // 6-country proof run found on its FIRST attempt (see the final
  // report) — both are real bugs this heuristic used to have.
  it('REGRESSION (Japan/banknote): does not match the country name inside an unrelated adjective ("Japanese" must not match "Japan")', () => {
    const japanEntry = { iso2: 'JP', iso3: 'JPN', nameEn: 'Japan' };
    const candidate = makeCandidate({
      title: 'File:BUR-16-Japanese occupation Burma-10 rupees (1942-44).jpg',
      extmetadata: {},
    });
    expect(checkCountryRelevance(candidate, japanEntry).relevant).toBe(false);
  });

  it('REGRESSION (Brazil, Indiana): rejects a title-only match immediately followed by a US-state-abbreviation homonym pattern', () => {
    const brazilEntry = { iso2: 'BR', iso3: 'BRA', nameEn: 'Brazil' };
    const candidate = makeCandidate({
      title: 'File:Brazil Town Tour, National Avenue, 1997 (Brazil, Ind.) - DPLA.jpg',
      extmetadata: {},
    });
    expect(checkCountryRelevance(candidate, brazilEntry).relevant).toBe(false);
  });

  it('REGRESSION (Angola, Indiana): rejects a hyphenated filename-slug homonym with no comma/abbreviation at all', () => {
    // Real live result found by the post-ingestion quality audit: the
    // manifest's AO (Angola) entry selected "Angola-indiana-panorama.jpg"
    // — the full state name, hyphen-joined, no comma, no abbreviation —
    // which the original comma-abbreviation-only pattern completely
    // missed (it shipped in a real manifest before this fix).
    const angolaEntry = { iso2: 'AO', iso3: 'AGO', nameEn: 'Angola' };
    const candidate = makeCandidate({ title: 'File:Angola-indiana-panorama.jpg', extmetadata: {} });
    expect(checkCountryRelevance(candidate, angolaEntry).relevant).toBe(false);
  });

  it('REGRESSION (Angola, Indiana via Commons Categories itself): the Categories branch must apply the SAME homonym check, not just accept on a bare word match', () => {
    // The real live bug: the first homonym-heuristic fix only checked
    // freeText (title/description) — but Commons' own Categories field
    // can itself literally be "Angola, Indiana" (the town's own
    // category), which the OLD Categories branch accepted immediately
    // on a bare word-boundary match without ever reaching the homonym
    // check at all. Re-running the exact same real candidate after the
    // freeText-only fix reproduced the identical wrong image — this is
    // what actually fixed it.
    const angolaEntry = { iso2: 'AO', iso3: 'AGO', nameEn: 'Angola' };
    const candidate = makeCandidate({
      title: 'File:Angola-indiana-panorama.jpg',
      extmetadata: { Categories: 'Angola, Indiana|Panoramas of the United States' },
    });
    expect(checkCountryRelevance(candidate, angolaEntry).relevant).toBe(false);
  });

  it('REGRESSION (Sudan, Texas / Sweden, Maine / Cambodia Town Long Beach California): three more real live wrong-place matches', () => {
    const cases = [
      { iso2: 'SD', iso3: 'SDN', nameEn: 'Sudan', title: 'File:Sudan Texas grain elevator 2010.jpg' },
      { iso2: 'SE', iso3: 'SWE', nameEn: 'Sweden', title: 'File:Sweden, Maine (10510245296).jpg' },
      { iso2: 'KH', iso3: 'KHM', nameEn: 'Cambodia', title: 'File:Cambodia Town Founding Members of Long Beach, California.jpg' },
    ];
    for (const { iso2, iso3, nameEn, title } of cases) {
      const entry = { iso2, iso3, nameEn };
      const candidate = makeCandidate({ title, extmetadata: {} });
      expect(checkCountryRelevance(candidate, entry).relevant, `${nameEn} should be rejected`).toBe(false);
    }
  });

  it('REGRESSION (false positive: "Embassy of Afghanistan, Tokyo."): a short capitalized word before a period is NOT a US state abbreviation just because it is short', () => {
    // Found re-auditing the full committed manifest: the first
    // abbreviation pattern matched any comma + short capitalized word +
    // period (",Tokyo.") regardless of whether that word was an actual
    // US state abbreviation — flagging this genuinely correct Afghanistan
    // entry as a false-positive homonym. Fixed by matching against an
    // explicit list of real state abbreviations instead of a generic
    // shape.
    const afghanistanEntry = { iso2: 'AF', iso3: 'AFG', nameEn: 'Afghanistan' };
    const candidate = makeCandidate({ title: 'File:Embassy of Afghanistan, Tokyo. Rooftop patio.jpg', extmetadata: {} });
    expect(checkCountryRelevance(candidate, afghanistanEntry).relevant).toBe(true);
  });

  it('does not false-positive when the country name itself is also a US state name (Georgia)', () => {
    const georgiaEntry = { iso2: 'GE', iso3: 'GEO', nameEn: 'Georgia' };
    const candidate = makeCandidate({ title: 'File:Tbilisi skyline, Georgia.jpg', extmetadata: {} });
    expect(checkCountryRelevance(candidate, georgiaEntry).relevant).toBe(true);
  });

  it('still accepts a genuine, unambiguous title-only match for the same country (Brazil) when no homonym pattern follows', () => {
    const brazilEntry = { iso2: 'BR', iso3: 'BRA', nameEn: 'Brazil' };
    const candidate = makeCandidate({ title: 'File:Christ the Redeemer, Rio de Janeiro, Brazil.jpg', extmetadata: {} });
    expect(checkCountryRelevance(candidate, brazilEntry).relevant).toBe(true);
  });
});

describe('isDuplicateHash', () => {
  it('flags a hash already present in the seen set', () => {
    const seen = new Set(['abc123']);
    expect(isDuplicateHash('abc123', seen)).toBe(true);
  });

  it('does not flag a genuinely new hash', () => {
    const seen = new Set(['abc123']);
    expect(isDuplicateHash('def456', seen)).toBe(false);
  });
});
