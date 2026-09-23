// Phase 19 — Passport entry information: pure ingestion pipeline
// (official page -> text lines -> per-source parse -> validate ->
// snapshot). Deliberately separate from network fetching so every parser
// is unit-tested with fixtures and never needs a live connection
// (entryRequirementsIngest.test.mjs). generate-entry-requirements.mjs is
// the only file in this pair that touches the network.
//
// THE RULE THIS FILE EXISTS TO ENFORCE (Phase 19 P6/P7/P20): a category is
// assigned to a (passport, destination) pair only when an official source
// for THAT destination lists THAT nationality, or states a rule that
// explicitly covers every foreign national. Everything else stays
// 'unknown' — absent from the snapshot — and the UI shows the official
// source instead of a guess. Notes (allowed stay, passport validity,
// declarations) are attached only when their exact supporting phrase is
// found in the fetched source text; a missing phrase drops the note.
//
// Failure is closed: an unrecognised country name, a missing section
// anchor, an unrecognised footnote on a covered nationality, or a list
// whose size falls outside its plausible range throws, the generator
// exits non-zero and the committed snapshot is left untouched.

export const METHODOLOGY_VERSION = 'entry-sources-1.0';

/** Normalised requirement categories (Phase 19 P6). 'unknown' is never
 *  written to the snapshot: absence IS unknown. */
export const CATEGORIES = ['visa_free', 'visa_on_arrival', 'evisa', 'visa_required', 'permit_required'];

/** Every note a parser may attach, each backed by an exact source phrase
 *  (or, for footnotes, an exact footnote pattern). The frontend has one
 *  AR/EN string per code and nothing else. */
export const NOTE_CODES = [
  'uk_eta',
  'eu_90_in_180',
  'biometric_passport',
  'ca_some_eta',
  'ca_eta_air',
  'sa_evisa_90_days',
  'mv_passport_1_month',
  'mv_traveller_declaration',
];

// ---------------------------------------------------------------------------
// HTML -> text lines
// ---------------------------------------------------------------------------

const BLOCK_TAGS = /^(p|li|tr|br|h[1-6]|div|td|th|dt|dd|section|article|table|ul|ol)$/i;
const ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITY_MAP[name.toLowerCase()] ?? whole);
}

/** Visible text of an HTML document, one block per line. No DOM, no
 *  dependency: scripts/styles are dropped, block-level tags become line
 *  breaks, every other tag is removed. */
export function htmlToLines(html) {
  const withoutInvisible = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  // Inline tags (links, emphasis) vanish without adding a space, exactly
  // as a browser renders "(<a>Iceland</a>, Norway)"; block tags break lines.
  const text = withoutInvisible.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (_, tag) => (BLOCK_TAGS.test(tag) ? '\n' : ''));
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[\s ​]+/g, ' ').trim())
    .filter(Boolean);
}

/** EUR-Lex / Publications Office markup renders footnote references as
 *  "(", "6", ")" in separate elements, which may land on separate lines or
 *  on one line with spaces depending on the markup. Collapse every such
 *  marker to "(6)", fold marker-only lines into the entry above them
 *  ("Kosovo (18)" + "(19)" -> "Kosovo (18) (19)"), and read the footnote
 *  definitions, which are the lines that START with a marker followed by
 *  text ("(6) The exemption ... biometric passports."). */
export function collapseFootnotes(lines) {
  const collapsed = lines.join('\n').replace(/\(\s*(\*?\d+)\s*\)/g, '($1)').split('\n');
  const out = [];
  const footnotes = new Map();
  for (const line of collapsed) {
    if (/^(\(\*?\d+\)\s*)+$/.test(line) && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${line}`;
      continue;
    }
    const definition = /^\((\*?\d+)\)\s+(\S.*)$/.exec(line);
    if (definition) footnotes.set(definition[1], definition[2]);
    out.push(line);
  }
  return { lines: out, footnotes };
}

/** Lines strictly between the first line matching `start` and the next
 *  line (after it) matching `end`. Throws when either anchor is missing:
 *  a page whose structure moved must fail, not parse garbage. */
export function sliceBetween(lines, start, end, label) {
  const from = lines.findIndex((line) => start.test(line));
  if (from < 0) throw new Error(`${label}: start anchor ${start} not found`);
  const to = lines.findIndex((line, index) => index > from && end.test(line));
  if (to < 0) throw new Error(`${label}: end anchor ${end} not found`);
  return lines.slice(from + 1, to);
}

// ---------------------------------------------------------------------------
// Country names -> ISO 3166-1 alpha-2
// ---------------------------------------------------------------------------

export function normalizeName(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`‘]/g, '')
    .replace(/\*/g, '')
    .replace(/\bst\.?\s/g, 'saint ')
    .replace(/[-–—/,.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Spellings official sources use that differ from the catalog's English
 *  names. Keys are normalizeName() output. */
export const NAME_ALIASES = {
  'bosnia herzegovina': 'BA',
  'czechia': 'CZ',
  'turkiye': 'TR',
  'cote divoire': 'CI',
  'cote divoire formerly ivory coast': 'CI',
  'democratic republic of the congo': 'CD',
  'congo democratic republic of': 'CD',
  'congo': 'CG',
  'congo republic of': 'CG',
  'korea north': 'KP',
  'democratic peoples republic of korea': 'KP',
  'republic of korea': 'KR',
  'myanmar burma': 'MM',
  'former yugoslav republic of macedonia': 'MK',
  'peoples republic of china': 'CN',
  'china peoples republic of': 'CN',
  'the gambia': 'GM',
  'sao tome e principe': 'ST',
  'cabo verde': 'CV',
  'federated states of micronesia': 'FM',
  'micronesia fed states': 'FM',
  'the bahamas': 'BS',
  'holy see': 'VA',
  'vatican city state': 'VA',
  'the palestinian authority': 'PS',
  'a palestinian authority passport': 'PS',
  'maldives islands': 'MV',
  'cameroon republic of': 'CM',
  'costa rica republic of': 'CR',
  'saudi arabia kingdom of': 'SA',
  'brunei darussalam': 'BN',
  'united states of america': 'US',
  'british citizen': 'GB',
  'russian federation': 'RU',
  'viet nam': 'VN',
};

/** Names that legitimately appear in official lists but are not countries
 *  in Wejhaty's catalog (territories, special passports, British
 *  nationality classes). Skipped silently, never mapped to a country. */
const NON_CATALOG = [
  /^hong kong/, /^macao/, /^macau/, /^taiwan/, /^kosovo/, /^british (national|overseas|subject|protected)/,
  /^stateless/, /^anguilla$/, /^bermuda$/, /^british virgin islands$/, /^cayman islands$/, /^falkland islands/,
  /^gibraltar$/, /^montserrat$/, /^pitcairn/, /^saint helena/, /^turks and caicos/, /^british nationals/,
];

/** Builds a resolver from the effective catalog (excluded countries already
 *  removed) plus the excluded codes, which resolve to null — they are
 *  recognised, then dropped, so an official list mentioning them neither
 *  fails the run nor ever reaches the snapshot. */
export function createNameResolver(catalog, excludedCodes, excludedNames = []) {
  const byName = new Map();
  for (const { iso2, nameEn } of catalog) byName.set(normalizeName(nameEn), iso2);
  for (const [alias, iso2] of Object.entries(NAME_ALIASES)) byName.set(alias, iso2);
  const excludedNorm = new Set(excludedNames.map(normalizeName));
  const excluded = new Set(excludedCodes);

  return function resolve(rawName) {
    const candidates = [];
    const full = normalizeName(rawName);
    candidates.push(full);
    const beforeParen = normalizeName(rawName.split('(')[0]);
    candidates.push(beforeParen);
    for (const suffix of [' republic of', ' kingdom of']) if (beforeParen.endsWith(suffix)) candidates.push(beforeParen.slice(0, -suffix.length));
    if (beforeParen.startsWith('the ')) candidates.push(beforeParen.slice(4));
    for (const candidate of candidates) {
      if (excludedNorm.has(candidate)) return { status: 'excluded' };
      const iso2 = byName.get(candidate);
      if (iso2) return excluded.has(iso2) ? { status: 'excluded' } : { status: 'ok', iso2 };
    }
    if (NON_CATALOG.some((pattern) => pattern.test(beforeParen) || pattern.test(full))) return { status: 'non-catalog' };
    return { status: 'unknown' };
  };
}

/** Resolves a list of raw entry lines. Unknown names are collected, not
 *  thrown one at a time, so a failing run reports all of them at once. */
export function resolveNames(entries, resolve, label) {
  const codes = [];
  const unknown = [];
  for (const entry of entries) {
    const result = resolve(entry);
    if (result.status === 'ok') codes.push({ iso2: result.iso2, raw: entry });
    else if (result.status === 'unknown') unknown.push(entry);
  }
  if (unknown.length) throw new Error(`${label}: unrecognised country names: ${unknown.join(' | ')}`);
  return codes;
}

function assertRange(count, [min, max], label) {
  if (count < min || count > max) throw new Error(`${label}: ${count} entries, outside the plausible range ${min}-${max}`);
}

/** Case-, quote- and whitespace-insensitive (official HTML is full of
 *  non-breaking spaces and typographic apostrophes). */
function phraseKey(text) {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .toLowerCase();
}

export function hasPhrase(lines, phrase) {
  return phraseKey(lines.join(' ')).includes(phraseKey(phrase));
}

/** Attaches a note only when its supporting phrase is present. */
function supportedNotes(lines, candidates, warnings, label) {
  const notes = [];
  for (const [code, phrase] of candidates) {
    if (hasPhrase(lines, phrase)) notes.push(code);
    else warnings.push(`${label}: note ${code} dropped — phrase not found: "${phrase}"`);
  }
  return notes;
}

function requirePhrase(lines, phrase, label) {
  if (!hasPhrase(lines, phrase)) throw new Error(`${label}: required phrase not found: "${phrase}"`);
}

// ---------------------------------------------------------------------------
// Per-source parsers. Each returns { rules: Map<nationality, {category,
// notes}>, warnings } for the destination(s) the source governs.
// ---------------------------------------------------------------------------

function setRule(rules, iso2, category, notes = []) {
  const existing = rules.get(iso2);
  if (existing && existing.category !== category) {
    // Listed under two different requirements (e.g. depends on passport
    // type). The source does not give one answer, so neither do we.
    rules.set(iso2, { category: 'conflict', notes: [] });
    return;
  }
  rules.set(iso2, { category, notes: [...new Set([...(existing?.notes ?? []), ...notes])] });
}

function finaliseRules(rules) {
  for (const [iso2, rule] of rules) if (rule.category === 'conflict') rules.delete(iso2);
  return rules;
}

/** UK — Immigration Rules Appendix Visitor: Visa national list, plus
 *  Appendix ETA National List. */
export function parseUk({ visaNationalLines, etaNationalLines }, resolve) {
  const warnings = [];
  const rules = new Map();
  const visa = sliceBetween(visaNationalLines, /^\(a\) Nationals or citizens of the following countries/i, /^\(b\) stateless/i, 'UK visa national list');
  const visaCodes = resolveNames(visa, resolve, 'UK visa national list');
  assertRange(visaCodes.length, [60, 140], 'UK visa national list');
  for (const { iso2 } of visaCodes) setRule(rules, iso2, 'visa_required');

  const start = etaNationalLines.findIndex((line) => /^ETANL 1\.1\b/.test(line));
  if (start < 0) throw new Error('UK ETA national list: ETANL 1.1 not found');
  const eta = etaNationalLines.slice(start + 1).filter((line) => !/^\(/.test(line) && !/^\*/.test(line));
  const etaCodes = resolveNames(eta, resolve, 'UK ETA national list');
  assertRange(etaCodes.length, [40, 120], 'UK ETA national list');
  for (const { iso2 } of etaCodes) setRule(rules, iso2, 'permit_required', ['uk_eta']);
  return { rules: finaliseRules(rules), warnings };
}

const EU_FOOTNOTE_RULES = [
  { pattern: /biometric passports/i, effect: 'note', note: 'biometric_passport' },
  { pattern: /agreement on visa exemption to be concluded/i, effect: 'conditional' },
];

/** EU — Regulation (EU) 2018/1806, consolidated text: Annex I (visa
 *  required) and Annex II (exempt for stays of no more than 90 days in any
 *  180-day period). */
export function parseEuRegulation(rawLines, resolve) {
  const warnings = [];
  const rules = new Map();
  const { lines, footnotes } = collapseFootnotes(rawLines);
  const isEntry = (line) =>
    !/^(ANNEX|LIST OF|\d+\.\s|ENTITIES|SPECIAL ADMINISTRATIVE|BRITISH NATIONALS|Those territories)/.test(line) &&
    !/^[▼►◄—\s-]+(M\d+|B)?[\s—-]*$/.test(line) &&
    !/^▼|^►|◄$/.test(line) &&
    /[a-z]/i.test(line);
  const clean = (line) => line.replace(/^►M\d+\s*/, '').replace(/\s*◄$/, '').trim();

  const annexI = sliceBetween(lines, /^ANNEX I$/, /^ANNEX II$/, 'EU Annex I').map(clean).filter(isEntry);
  const annexII = sliceBetween(lines, /^ANNEX II$/, /^ANNEX III$/, 'EU Annex II').map(clean).filter(isEntry);
  requirePhrase(lines, 'FOR STAYS OF NO MORE THAN 90 DAYS IN ANY 180-DAY PERIOD', 'EU Annex II heading');

  const required = resolveNames(annexI, resolve, 'EU Annex I');
  assertRange(required.length, [80, 130], 'EU Annex I');
  for (const { iso2 } of required) setRule(rules, iso2, 'visa_required');

  const exempt = resolveNames(annexII, resolve, 'EU Annex II');
  assertRange(exempt.length, [40, 80], 'EU Annex II');
  for (const { iso2, raw } of exempt) {
    const refs = [...raw.matchAll(/\((\d+)\)/g)].map((match) => match[1]);
    const notes = ['eu_90_in_180'];
    let conditional = false;
    for (const ref of refs) {
      const text = footnotes.get(ref);
      if (!text) throw new Error(`EU Annex II: footnote (${ref}) on "${raw}" has no definition`);
      const rule = EU_FOOTNOTE_RULES.find((candidate) => candidate.pattern.test(text));
      if (!rule) throw new Error(`EU Annex II: unrecognised footnote (${ref}) on "${raw}": ${text}`);
      if (rule.effect === 'note') notes.push(rule.note);
      if (rule.effect === 'conditional') conditional = true;
    }
    if (conditional) {
      // The Regulation makes the exemption depend on an agreement it does
      // not itself say is in force. Not stated here, so not claimed.
      warnings.push(`EU Annex II: ${iso2} left unknown — exemption conditional on an agreement (${raw})`);
      continue;
    }
    setRule(rules, iso2, 'visa_free', notes);
  }
  return { rules: finaliseRules(rules), warnings };
}

/** Canada — IRCC "What you need to enter Canada". */
export function parseCanada(lines, resolve) {
  const warnings = [];
  const rules = new Map();
  const visa = sliceBetween(lines, /^Visa-required countries or territories$/i, /^Stateless individuals/i, 'Canada visa-required list');
  const visaCodes = resolveNames(visa, resolve, 'Canada visa-required list');
  assertRange(visaCodes.length, [100, 170], 'Canada visa-required list');
  for (const { iso2, raw } of visaCodes) {
    setRule(rules, iso2, 'visa_required', /may be eligible for an (electronic travel authorization|eTA)/i.test(raw) ? ['ca_some_eta'] : []);
  }
  const eta = sliceBetween(lines, /^eTA-required countries or territories$/i, /^Find out how to apply for an eTA/i, 'Canada eTA-required list');
  const etaCodes = resolveNames(eta, resolve, 'Canada eTA-required list');
  assertRange(etaCodes.length, [35, 80], 'Canada eTA-required list');
  const etaNotes = supportedNotes(lines, [['ca_eta_air', 'You need an eTA and a valid passport to board your flight to Canada']], warnings, 'Canada');
  for (const { iso2 } of etaCodes) setRule(rules, iso2, 'permit_required', etaNotes);
  return { rules: finaliseRules(rules), warnings };
}

/** Singapore — ICA "Check if You Need an Entry Visa". The page is a
 *  negative list whose own rule covers everyone else: "If your travel
 *  document is issued by one of the countries/places listed below, you will
 *  require a valid visa". */
export function parseSingapore(lines, resolve, catalogCodes) {
  const warnings = [];
  const rules = new Map();
  requirePhrase(lines, 'listed below, you will require a valid visa to enter Singapore', 'Singapore');
  const listed = sliceBetween(lines, /^Travel Documents by Countries and Places$/i, /^You will also need a visa if you are travelling on/i, 'Singapore visa list')
    .filter((line) => !/^If your travel document/i.test(line));
  const listedCodes = resolveNames(listed, resolve, 'Singapore visa list');
  assertRange(listedCodes.length, [15, 60], 'Singapore visa list');
  const also = sliceBetween(lines, /^You will also need a visa if you are travelling on/i, /^You may contact us/i, 'Singapore document list');
  const palestinian = also.some((line) => /Palestinian Authority passport/i.test(line));
  const required = new Set(listedCodes.map(({ iso2 }) => iso2));
  if (palestinian && catalogCodes.includes('PS')) required.add('PS');
  for (const iso2 of catalogCodes) {
    if (iso2 === 'SG') continue;
    setRule(rules, iso2, required.has(iso2) ? 'visa_required' : 'visa_free');
  }
  return { rules: finaliseRules(rules), warnings };
}

/** Saudi Arabia — the official eVisa portal's eligible-country list. Only
 *  listed nationalities get an answer; the portal itself sends everyone
 *  else to an embassy, so they stay unknown. */
export function parseSaudiEvisa(lines, resolve) {
  const warnings = [];
  const rules = new Map();
  requirePhrase(lines, 'can apply for an eVisa', 'Saudi eVisa portal');
  const listed = sliceBetween(lines, /^Eligible Countries$/i, /^If your country is not in the list/i, 'Saudi eVisa list')
    .filter((line) => !/^(North America|South America|Europe|Asia|Africa|Oceania|Middle East)$/i.test(line));
  const codes = resolveNames(listed, resolve, 'Saudi eVisa list');
  assertRange(codes.length, [40, 110], 'Saudi eVisa list');
  const notes = supportedNotes(lines, [['sa_evisa_90_days', 'spend up to 90 days in the country']], warnings, 'Saudi eVisa');
  for (const { iso2 } of codes) setRule(rules, iso2, 'evisa', notes);
  return { rules: finaliseRules(rules), warnings };
}

/** Maldives — Maldives Immigration "Tourist Visa - On Arrival": one rule
 *  stated for every foreign tourist. */
export function parseMaldives(lines, catalogCodes) {
  const warnings = [];
  const rules = new Map();
  requirePhrase(lines, 'Tourist visa is granted on arrival to the Maldives', 'Maldives');
  requirePhrase(lines, 'do not require pre-approval for the visa', 'Maldives');
  const notes = supportedNotes(
    lines,
    [
      ['mv_passport_1_month', "at least 1 month's validity"],
      ['mv_traveller_declaration', "must complete and submit the 'Traveller Declaration' within 96 hours before arrival"],
    ],
    warnings,
    'Maldives',
  );
  for (const iso2 of catalogCodes) if (iso2 !== 'MV') setRule(rules, iso2, 'visa_on_arrival', notes);
  return { rules: finaliseRules(rules), warnings };
}

// ---------------------------------------------------------------------------
// Snapshot assembly + validation
// ---------------------------------------------------------------------------

/** Compact snapshot. Destinations that share one legal source (the 29
 *  Schengen States) share one rule table instead of 29 copies. Each entry
 *  is "category" or "category|note|note". Only covered nationalities
 *  appear; a missing nationality means unknown. */
export function buildSnapshot({ generatedAt, sources, tables }) {
  const out = { methodologyVersion: METHODOLOGY_VERSION, generatedAt, sources: {}, tables: {}, destinations: {} };
  for (const source of sources) out.sources[source.id] = source.meta;
  for (const { id, destinations, sourceIds, rules } of tables) {
    const entries = {};
    for (const [nationality, rule] of [...rules].sort(([a], [b]) => a.localeCompare(b))) {
      entries[nationality] = [rule.category, ...rule.notes].join('|');
    }
    out.tables[id] = { sources: sourceIds, entries };
    for (const destination of destinations) out.destinations[destination] = id;
  }
  out.destinations = Object.fromEntries(Object.entries(out.destinations).sort(([a], [b]) => a.localeCompare(b)));
  return out;
}

export function validateSnapshot(snapshot, { catalogCodes, excludedCodes }) {
  const errors = [];
  const catalog = new Set(catalogCodes);
  const excluded = new Set(excludedCodes);
  for (const [destination, tableId] of Object.entries(snapshot.destinations)) {
    if (excluded.has(destination)) errors.push(`excluded destination present: ${destination}`);
    if (!catalog.has(destination)) errors.push(`destination not in catalog: ${destination}`);
    if (!snapshot.tables[tableId]) errors.push(`${destination}: unknown table ${tableId}`);
  }
  for (const [tableId, { sources, entries }] of Object.entries(snapshot.tables)) {
    if (!sources.length) errors.push(`${tableId}: no source`);
    for (const id of sources) if (!snapshot.sources[id]) errors.push(`${tableId}: unknown source ${id}`);
    for (const [nationality, value] of Object.entries(entries)) {
      const [category, ...notes] = value.split('|');
      if (excluded.has(nationality)) errors.push(`excluded nationality present: ${tableId}/${nationality}`);
      if (!catalog.has(nationality)) errors.push(`nationality not in catalog: ${tableId}/${nationality}`);
      if (!CATEGORIES.includes(category)) errors.push(`${tableId}/${nationality}: bad category ${category}`);
      for (const note of notes) if (!NOTE_CODES.includes(note)) errors.push(`${tableId}/${nationality}: unknown note ${note}`);
    }
  }
  for (const [id, meta] of Object.entries(snapshot.sources)) {
    if (!/^https:\/\//.test(meta.url)) errors.push(`source ${id}: display URL is not HTTPS`);
    if (!meta.checkedAt) errors.push(`source ${id}: no checkedAt`);
  }
  return errors;
}
