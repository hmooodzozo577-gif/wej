// Destination Imagery System — pure, network-free logic. All Wikimedia
// Commons API calls live in generate-destination-images.mjs (the CLI);
// everything here is deterministic and unit-testable with fixture data,
// per this project's established ingestion-library convention (see
// tourismInsightsIngest.mjs / travelCostIndexIngest.mjs).
//
// Pipeline: SOURCE -> DISCOVERY -> LICENSE VALIDATION -> SELECTION ->
// (OPTIMIZATION + download, in the CLI only) -> MANIFEST -> UI.

// --- Effective catalog -----------------------------------------------------
// The SAME 195-raw/194-effective catalog the app itself uses
// (data/worldCatalog.ts = DESTINATIONS + BASIC_COUNTRIES, exclusion
// applied via excludedCountriesData.json) — reconstructed here from the
// same generated JSON + the same exclusion file, since this script is
// plain Node ESM and can't import .ts modules. NOT a second, separately
// maintained exclusion list: excludedCountriesData.json is read directly,
// same file data/excludedCountries.ts reads, single source of truth.
export function loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2, excludedCountries }) {
  const excludedIso2 = new Set(excludedCountries.map((c) => c.iso2.toUpperCase()));
  const raw = [
    ...basicCountries.map((c) => ({ id: c.id, iso2: c.iso2, nameEn: c.nameEn })),
    ...destinations.map((d) => ({ id: d.id, iso2: d.countryCode, nameEn: d.nameEn })),
  ];
  return raw
    .filter((c) => !excludedIso2.has(c.iso2.toUpperCase()))
    .map((c) => {
      const info = countryInfoByIso2[c.iso2];
      return { id: c.id, iso2: c.iso2.toUpperCase(), iso3: info ? info.iso3.toUpperCase() : null, nameEn: c.nameEn };
    });
}

// --- Discovery: search query construction -----------------------------------
// Works from catalog identity alone (no per-country landmark name
// required) — `overrides` (keyed by ISO2) is an OPTIONAL curated
// improvement, never a requirement for the pipeline to function. See
// destinationImageOverrides.json for the (currently tiny, illustrative)
// override set.
export function buildSearchQueries(entry, overrides = {}) {
  const override = overrides[entry.iso2];
  if (override?.preferredQueries?.length) return override.preferredQueries;
  return [`${entry.nameEn} landmark`, `${entry.nameEn} skyline`, `${entry.nameEn}`];
}

// --- License policy ----------------------------------------------------------
// Checked against Commons' own `extmetadata.LicenseShortName` string
// (the actual machine-readable field Commons' API returns — not a guess
// at file-page prose). Allowlist only; everything else rejected,
// including genuinely ambiguous/unrecognized strings — never assume
// reusable.
const ALLOWED_LICENSE_PATTERNS = [
  /^cc0/i,
  /^public domain$/i,
  /^pd[\s-]/i,
  /^cc[\s-]by([\s-]4\.0|[\s-]3\.0|[\s-]2\.5|[\s-]2\.0)?$/i,
  /^cc[\s-]by[\s-]sa([\s-]4\.0|[\s-]3\.0|[\s-]2\.5|[\s-]2\.0)?$/i,
];
// Explicit reject patterns checked FIRST — a license string can contain
// "by" and also "nc"/"nd" (e.g. "CC BY-NC-ND 4.0"), so allow-pattern
// matching alone isn't enough; a licence with a non-commercial or
// no-derivatives clause is incompatible with this project's need to
// crop/resize/optimize and is rejected regardless of the "BY"/"SA"
// part also present in the string.
const REJECT_LICENSE_PATTERNS = [/nc/i, /\bnd\b|no[\s-]derivatives/i, /all rights reserved/i];

export function classifyLicense(licenseShortName) {
  const s = (licenseShortName || '').trim();
  if (!s) return { allowed: false, reason: 'missing license metadata' };
  if (REJECT_LICENSE_PATTERNS.some((p) => p.test(s))) {
    return { allowed: false, reason: `incompatible license clause (NC/ND/all-rights-reserved): "${s}"` };
  }
  if (ALLOWED_LICENSE_PATTERNS.some((p) => p.test(s))) return { allowed: true, reason: s };
  return { allowed: false, reason: `unrecognized/unverified license string: "${s}"` };
}

// --- Candidate scoring / filtering -------------------------------------------
// Deterministic heuristic, documented (not claimed to be semantically
// perfect — see the final report). Operates on the shape Commons'
// `query.pages[].imageinfo[0]` + `extmetadata` actually returns:
// { title, url, width, height, mime, extmetadata: { LicenseShortName,
//   Artist, Categories, ImageDescription } }.
const EXCLUDED_TERMS = [
  'flag of', 'coat of arms', 'national emblem', 'seal of', 'logo',
  'map of', 'locator map', 'location map',
  'portrait', 'president', 'prime minister', 'politician', 'king of', 'president of',
  'diagram', 'chart', 'graph', 'screenshot', 'infographic',
  // Added after the 6-country end-to-end proof run found a real false
  // positive: "BUR-16-Japanese occupation Burma-10 rupees (1942-44)" was
  // selected for Japan — a banknote/currency scan, not a landmark.
  'banknote', 'rupee', 'rupees', 'currency', ' coin', 'coins', 'postage stamp', 'numismatic',
];
const LANDMARK_HINT_TERMS = ['skyline', 'landmark', 'cityscape', 'view of', 'panorama', 'temple', 'palace', 'tower', 'bridge', 'coast', 'mountain', 'old town', 'downtown'];
const MIN_WIDTH = 800;
const REJECTED_MIME = new Set(['image/svg+xml', 'application/pdf', 'image/tiff', 'image/gif']);

export function scoreCandidate(candidate) {
  const haystack = `${candidate.title} ${candidate.extmetadata?.Categories || ''} ${candidate.extmetadata?.ImageDescription || ''}`.toLowerCase();

  if (REJECTED_MIME.has(candidate.mime)) {
    return { score: 0, rejected: true, reason: `unsuitable file type: ${candidate.mime}` };
  }
  const excludedHit = EXCLUDED_TERMS.find((term) => haystack.includes(term));
  if (excludedHit) {
    return { score: 0, rejected: true, reason: `excluded term matched: "${excludedHit}"` };
  }
  const width = candidate.width || 0;
  const height = candidate.height || 0;
  if (width < MIN_WIDTH) {
    return { score: 0, rejected: true, reason: `below minimum resolution (${width}px < ${MIN_WIDTH}px)` };
  }
  const license = classifyLicense(candidate.extmetadata?.LicenseShortName);
  if (!license.allowed) {
    return { score: 0, rejected: true, reason: `license rejected: ${license.reason}` };
  }

  let score = 1; // passed every hard gate above
  if (width > height) score += 2; // landscape orientation strongly preferred
  const aspect = height > 0 ? width / height : 0;
  if (aspect >= 1.3 && aspect <= 2.2) score += 1; // a "strong horizontal composition" band, not ultra-panoramic or near-square
  if (width >= 1600) score += 1; // comfortably above hero-image resolution
  if (LANDMARK_HINT_TERMS.some((term) => haystack.includes(term))) score += 2;

  return { score, rejected: false, reason: null };
}

/** Deterministic selection: highest score wins; ties broken by title
 *  ascending (a stable, semantically-neutral key — never source order,
 *  never randomness) so the SAME candidate set always yields the SAME
 *  pick. */
export function selectBestCandidate(candidates) {
  const viable = candidates.map((c) => ({ candidate: c, ...scoreCandidate(c) })).filter((r) => !r.rejected);
  if (viable.length === 0) return undefined;
  viable.sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));
  return viable[0];
}

// --- Manifest -----------------------------------------------------------------
// Schema per the task's own spec (section 14), adapted: `localPath` is
// only ever set once a file has actually been downloaded+optimized by
// the CLI — never guessed/constructed from the country code alone (that
// would silently claim an image exists when it doesn't).
export function buildManifestEntry({ entry, candidate, license, localPath, width, height, retrievedAt }) {
  return {
    iso2: entry.iso2,
    iso3: entry.iso3,
    countryName: entry.nameEn,
    landmarkName: candidate.title.replace(/^File:/, '').replace(/\.(jpe?g|png|webp)$/i, ''),
    localPath,
    sourcePage: candidate.descriptionUrl || candidate.url,
    author: candidate.extmetadata?.Artist || null,
    license: license.reason,
    licenseUrl: candidate.extmetadata?.LicenseUrl || null,
    originalUrl: candidate.url,
    retrievedAt,
    width,
    height,
  };
}

// --- Country relevance -------------------------------------------------------
// A beautiful image from the WRONG country is worse than no image. Cheap,
// honest heuristic (NOT semantically perfect — documented limitation
// below) revised after this task's own mandatory 6-country end-to-end
// proof run surfaced two real false positives on the FIRST attempt:
//   - "BUR-16-Japanese occupation Burma-10 rupees (1942-44)" selected
//     for Japan: naive `.includes('japan')` matched inside "Japanese"
//     (an adjective describing the banknote's historical association,
//     not evidence the image DEPICTS Japan). Fixed by (1) a word-
//     boundary regex ("Japanese" no longer matches `\bjapan\b`) and
//     (2) new EXCLUDED_TERMS for banknote/currency/coin — the image
//     was never landmark-relevant regardless of the country match.
//   - A "Brazil, Ind." (Brazil, Indiana, USA — a real town that HAPPENS
//     to share the country's name) photo selected for Brazil: a
//     genuine homonym-place problem that word-boundary matching alone
//     does NOT solve ("Brazil" is a real whole word there too).
//     Mitigated, not solved: Commons' own structured `Categories`
//     metadata is preferred over free-text title/description when
//     present (a real Brazil-the-country photo is actually CATEGORIZED
//     under Brazil; a US town's photo is categorized under its US
//     state/county, not the unrelated country name) — falls back to
//     title/description only when Categories is unavailable, and a
//     title-only match immediately followed by a US-state-abbreviation
//     pattern (", Xx." / ", Xxx.") is rejected outright as a likely
//     homonym rather than trusted.
// KNOWN LIMITATION (do not claim otherwise): this is still a heuristic,
// not semantic country verification — a well-written but genuinely
// misleading caption could still pass. It is a real, demonstrated
// improvement over a plain substring check, not a claim of solving
// place-name disambiguation in general.
const US_STATE_ABBREV_HOMONYM_PATTERN = /,\s*[A-Z][a-z]{1,4}\.(?:\)|,|\s|$)/;

export function checkCountryRelevance(candidate, entry, { fromOverride = false } = {}) {
  if (fromOverride) return { relevant: true, reason: 'from curated override' };

  const nameEscaped = entry.nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundary = new RegExp(`\\b${nameEscaped}\\b`, 'i');

  const categories = candidate.extmetadata?.Categories || '';
  if (categories) {
    return wordBoundary.test(categories)
      ? { relevant: true, reason: 'country name matched in Commons Categories (structured metadata)' }
      : { relevant: false, reason: `"${entry.nameEn}" not found in Commons Categories — rejected (Categories present but doesn't mention the country)` };
  }

  const freeText = `${candidate.title} ${candidate.extmetadata?.ImageDescription || ''}`;
  const globalMatcher = new RegExp(`\\b${nameEscaped}\\b`, 'gi');
  const occurrences = [...freeText.matchAll(globalMatcher)];
  if (occurrences.length === 0) {
    return { relevant: false, reason: `"${entry.nameEn}" not found in candidate title/description — weak relevance confidence, rejected` };
  }
  // Check EVERY occurrence, not just the first — a homonym-indicating
  // mention anywhere (e.g. a country name appearing again later as
  // "Brazil, Ind." even though it appeared earlier in an unrelated
  // phrase) is reason enough to distrust this candidate.
  for (const m of occurrences) {
    const tail = freeText.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (US_STATE_ABBREV_HOMONYM_PATTERN.test(tail)) {
      return { relevant: false, reason: `"${entry.nameEn}" appears to name a place OTHER than the country itself (e.g. "${entry.nameEn}${tail.trim()}" reads like a homonym town) — rejected` };
    }
  }
  return { relevant: true, reason: 'country name matched in title/description (no Categories metadata available)' };
}

// --- Duplicate detection -----------------------------------------------------
// The SAME image (by content hash, not just by URL — two different
// Commons file pages can serve byte-identical content) must never be
// assigned to two different countries. `seenHashes` is owned by the
// CALLER (the CLI, across one run) — this function is a pure decision
// given that state, not a hidden global.
export function isDuplicateHash(hash, seenHashes) {
  return seenHashes.has(hash);
}

const REQUIRED_MANIFEST_FIELDS = ['iso2', 'iso3', 'countryName', 'localPath', 'sourcePage', 'license', 'originalUrl', 'retrievedAt', 'width', 'height'];

export function validateManifestEntry(entry) {
  const errors = [];
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') errors.push(`missing required field: ${field}`);
  }
  if (entry.iso2 === 'IL' || entry.iso3 === 'ISR') errors.push('excluded country (IL/ISR) must never appear in the manifest');
  if (typeof entry.width === 'number' && typeof entry.height === 'number' && entry.width <= entry.height) {
    errors.push('non-landscape image (width <= height)');
  }
  const license = classifyLicense(entry.license);
  if (!license.allowed) errors.push(`invalid license in manifest: ${license.reason}`);
  return { valid: errors.length === 0, errors };
}
