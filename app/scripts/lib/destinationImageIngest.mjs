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
  // Destination cards must show the place itself. These terms were added
  // after the full visual audit found technically valid files that only
  // happened to contain a country name (embassies abroad, maps, vehicles,
  // documents, toys, and explanatory graphics).
  'embassy of', 'consulate', 'locator', 'passport', 'identity card',
  'lego', 'aircraft', 'airplane', 'airline', 'satellite image', 'plaque',
  'population pyramid', 'referendum', 'road sign', 'signpost', ' imo ',
  'atr-72', 'atr 72', 'boeing ', 'airbus ',
  'banner',
  'football', 'airport', ' airfield', ' ship', 'collage', 'montage',
  'armed convoy', 'vaccination', ' envoy', ' kids', ' children',
  'transit area', 'plattegrond',
];
const LANDMARK_HINT_TERMS = ['skyline', 'landmark', 'cityscape', 'view of', 'panorama', 'temple', 'palace', 'tower', 'bridge', 'coast', 'mountain', 'old town', 'downtown'];
const MIN_WIDTH = 800;
const REJECTED_MIME = new Set(['image/svg+xml', 'application/pdf', 'image/tiff', 'image/gif']);

export function scoreCandidate(candidate) {
  const haystack = `${candidate.title} ${candidate.extmetadata?.Categories || ''} ${candidate.extmetadata?.ImageDescription || ''}`.toLowerCase();

  if (REJECTED_MIME.has(candidate.mime)) {
    return { score: 0, rejected: true, reason: `unsuitable file type: ${candidate.mime}` };
  }
  const excludedHit = EXCLUDED_TERMS.find((term) => {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack);
  });
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
  // Wikivoyage orders article media by appearance. Once banners, maps and
  // other non-destination assets are filtered out, the first travel photo is
  // normally the article's representative image. Preserve that editorial
  // signal instead of letting a later file win merely because its filename
  // contains a generic word such as "skyline".
  if (Number.isInteger(candidate.sourceRank) && candidate.sourceRank >= 0) {
    score += 10 / (candidate.sourceRank + 1);
  }

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
// Traditional (pre-ZIP-code) US state abbreviations, as they actually
// appear in prose captions ("Brazil, Ind.") — NOT a generic "short
// capitalized word + period" shape. An earlier version of this pattern
// matched any ≤5-letter capitalized word before a period (",Tokyo."),
// which flagged "Embassy of Afghanistan, Tokyo." as a false-positive
// homonym purely because "Tokyo." happens to be short — caught by
// re-auditing the full committed manifest against this heuristic.
const US_STATE_ABBREVIATIONS = [
  'Ala', 'Ariz', 'Ark', 'Calif', 'Colo', 'Conn', 'Del', 'Fla', 'Ga', 'Ill',
  'Ind', 'Kans', 'Kan', 'Ky', 'La', 'Mass', 'Md', 'Mich', 'Minn', 'Miss',
  'Mo', 'Mont', 'Neb', 'Nebr', 'Nev', 'Okla', 'Ore', 'Oreg', 'Pa', 'Penn',
  'Tenn', 'Tex', 'Va', 'Vt', 'Wash', 'Wis', 'Wisc', 'Wyo',
];
const US_STATE_ABBREV_HOMONYM_PATTERN = new RegExp(`,\\s*(?:${US_STATE_ABBREVIATIONS.join('|')})\\.(?:\\)|,|\\s|$)`);

// Many US towns share a name with a world country (Angola IN, Brazil IN,
// Lebanon OH/PA/NH/TN/KY, Peru IL/NE/IN, Chile?—not a state so out of
// scope here, etc.) — the comma-abbreviation pattern above only catches
// prose captions ("Brazil, Ind."). A real live example this audit
// caught: a Commons file titled "Angola-indiana-panorama.jpg" (a
// hyphenated filename slug, no comma, no abbreviation) — the full state
// name spelled out, hyphen-joined. Checked for full names (case-
// insensitive, word-boundary) within a small window around every
// country-name occurrence, not just the comma-abbreviation form.
const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
  'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma',
  'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah',
  'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
];

/** True if `text` contains a US-state-homonym signal anywhere — not
 *  windowed around the country-name match. A real live case ("Cambodia
 *  Town Founding Members of Long Beach, California") had the state
 *  name ~40 characters after the country match, well outside any small
 *  window; a genuinely country-relevant photo essentially never needs
 *  to mention a US state at all, so a whole-text check is both simpler
 *  and safer than trying to guess a window size. */
function looksLikeUsStateHomonym(text, entry) {
  if (entry.iso2 !== 'US' && /\b(?:u\.?s\.? state|united states)\b/i.test(text)) return true;
  if (US_STATE_ABBREV_HOMONYM_PATTERN.test(text)) return true;
  // Skip the full-name check for the (rare) case where the country's
  // own name IS a US state name (e.g. Georgia) — the heuristic can't
  // distinguish those and would only produce false rejections.
  const entryIsAStateNameToo = US_STATE_NAMES.includes(entry.nameEn.toLowerCase());
  if (entryIsAStateNameToo) return false;
  return US_STATE_NAMES.some((state) => new RegExp(`\\b${state}\\b`, 'i').test(text));
}

/** Checks one text blob (Categories OR title/description) for both a
 *  country-name match AND a homonym escape — used identically for
 *  whichever source checkCountryRelevance ends up trusting, so a
 *  homonym-indicating Commons Category (e.g. literally "Angola,
 *  Indiana" as its OWN category text — a real live case this audit
 *  found, where Categories itself named the US town) can't shortcut
 *  past the same check a plain title/description would have to pass. */
function matchesCountryWithoutHomonym(text, entry, nameEscaped) {
  const wordBoundary = new RegExp(`\\b${nameEscaped}\\b`, 'i');
  if (!wordBoundary.test(text)) return { found: false };
  return { found: true, homonym: looksLikeUsStateHomonym(text, entry) };
}

export function checkCountryRelevance(candidate, entry, { sourceArticle } = {}) {
  if (sourceArticle && sourceArticle.trim().toLocaleLowerCase('en') === entry.nameEn.trim().toLocaleLowerCase('en')) {
    return { relevant: true, reason: `listed in the ${entry.nameEn} travel article` };
  }

  const nameEscaped = entry.nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const categories = candidate.extmetadata?.Categories || '';
  if (categories) {
    const result = matchesCountryWithoutHomonym(categories, entry, nameEscaped);
    if (!result.found) {
      return { relevant: false, reason: `"${entry.nameEn}" not found in Commons Categories — rejected (Categories present but doesn't mention the country)` };
    }
    if (result.homonym) {
      return { relevant: false, reason: `"${entry.nameEn}" appears to name a place OTHER than the country itself (Commons Categories text reads like a homonym US town/state) — rejected` };
    }
    return { relevant: true, reason: 'country name matched in Commons Categories (structured metadata)' };
  }

  const freeText = `${candidate.title} ${candidate.extmetadata?.ImageDescription || ''}`;
  const result = matchesCountryWithoutHomonym(freeText, entry, nameEscaped);
  if (!result.found) {
    return { relevant: false, reason: `"${entry.nameEn}" not found in candidate title/description — weak relevance confidence, rejected` };
  }
  if (result.homonym) {
    return { relevant: false, reason: `"${entry.nameEn}" appears to name a place OTHER than the country itself (nearby text reads like a homonym US town/state) — rejected` };
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
  // Extreme banner/strip crops (e.g. 1440x206, a ~7:1 aspect ratio) pass
  // the width>height check above but crop to an unrecognizable sliver
  // under this UI's fixed 4:3 object-fit:cover box — caught live in the
  // quality audit (Benin/Tajikistan/Vanuatu all selected a "skyline
  // banner" image at this ratio). A real landscape photo is essentially
  // never wider than ~2.5:1; reject anything beyond that band rather
  // than accept a technically-landscape but practically-useless crop.
  if (typeof entry.width === 'number' && typeof entry.height === 'number' && entry.height > 0 && entry.width / entry.height > 2.5) {
    errors.push(`extreme aspect ratio (${entry.width}x${entry.height}) — banner/strip crop, not a usable landscape photo`);
  }
  const license = classifyLicense(entry.license);
  if (!license.allowed) errors.push(`invalid license in manifest: ${license.reason}`);
  return { valid: errors.length === 0, errors };
}
