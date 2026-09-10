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
