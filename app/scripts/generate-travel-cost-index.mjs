// Phase 13.5c — Dynamic Travel Cost Index: the ONLY file in this feature
// that touches the network. Fetches the World Bank Indicators API,
// hands the raw response to the pure pipeline in
// scripts/lib/travelCostIndexIngest.mjs (parse -> normalize -> validate
// -> serialize), and only overwrites the committed snapshot
// (src/data/generated/travelCostIndex.json) if validation passes. On any
// failure (network, malformed response, insufficient coverage, an
// excluded country somehow present) this exits non-zero and leaves the
// existing snapshot file untouched — the app must keep working on stale-
// but-valid data rather than get a corrupt/empty one.
//
// Run manually (same convention as generate-airports.mjs /
// generate-world-countries.mjs — this project has no scheduled CI
// updater; see ../TRAVEL_COST_INDEX.md for why):
//   node scripts/generate-travel-cost-index.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSnapshot,
  normalizeRows,
  parseWorldBankResponse,
  serializeSnapshot,
  validateEntries,
} from './lib/travelCostIndexIngest.mjs';
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');
const outFile = path.join(outDir, 'travelCostIndex.json');

// CORRECTION (Phase 13.5c completion pass): PA.NUS.PPPC.RF is archived at
// the data-serving layer (confirmed live via GitHub Actions — see
// ../TRAVEL_COST_INDEX.md). PA.NUS.GDP.PLI is the live, currently-serving
// replacement with equivalent semantics (WDI/ICP-derived general price
// level), live-confirmed to return exactly 100 for USA/2025 — the
// documented US=100 baseline.
const SOURCE_INDICATOR = 'PA.NUS.GDP.PLI';
// mrv=1 -> most recent single observation per country, so normalizeRows
// never has to deduplicate across multiple years for the same country.
const WORLD_BANK_URL = `https://api.worldbank.org/v2/country/all/indicator/${SOURCE_INDICATOR}?format=json&per_page=20000&mrv=1`;

// Completion-pass cleanup: this used to be a hardcoded mirror of
// app/src/data/excludedCountries.ts's list ('IL'), duplicated because
// this script is plain Node ESM and can't import a .ts module. Both
// sides now import the SAME plain JSON file
// (src/data/excludedCountriesData.json) — one real source of truth,
// consumed identically by the runtime module and this script, no
// duplication left to drift out of sync.
const EXCLUDED_COUNTRY_CODES = excludedCountriesData.map((c) => c.iso2);

/** The app's real effective catalog country codes, derived from the SAME
 *  generated JSON destinations.ts/basicCountries.ts already read (not a
 *  new/invented country list), with the exclusion mirror above applied —
 *  this is the join key set normalizeRows() filters World Bank rows
 *  against. */
function loadEffectiveCatalogCountryCodes() {
  const destinations = JSON.parse(fs.readFileSync(path.join(outDir, 'destinations.json'), 'utf8'));
  const basicCountries = JSON.parse(fs.readFileSync(path.join(outDir, 'basicCountries.json'), 'utf8'));
  const excluded = new Set(EXCLUDED_COUNTRY_CODES);
  const codes = new Set();
  for (const entry of [...destinations, ...basicCountries]) {
    if (entry.countryCode && !excluded.has(entry.countryCode)) codes.add(entry.countryCode);
  }
  return codes;
}

async function main() {
  const validCountryCodes = loadEffectiveCatalogCountryCodes();
  console.log(`Effective catalog (join target): ${validCountryCodes.size} countries.`);

  let body;
  try {
    const res = await fetch(WORLD_BANK_URL);
    if (!res.ok) {
      throw new Error(`World Bank API returned HTTP ${res.status}`);
    }
    body = await res.json();
  } catch (err) {
    console.error('Fetch failed — leaving the existing snapshot untouched.');
    console.error(String(err));
    process.exit(1);
  }
  let rawRows;
  try {
    rawRows = parseWorldBankResponse(body);
  } catch (err) {
    console.error('Response parsing failed — leaving the existing snapshot untouched.');
    console.error(String(err));
    process.exit(1);
  }
  console.log(`Rows received: ${rawRows.length}`);

  const { accepted, rejected } = normalizeRows(rawRows, validCountryCodes);
  console.log(`Rows accepted: ${accepted.length}`);
  console.log(`Rows rejected: ${rejected.length}`);
  const rejectionCounts = {};
  for (const r of rejected) rejectionCounts[r.reason] = (rejectionCounts[r.reason] ?? 0) + 1;
  console.log('Rejection reasons:', rejectionCounts);

  const validation = validateEntries(accepted, validCountryCodes.size, EXCLUDED_COUNTRY_CODES);
  console.log(`Matched ${accepted.length}/${validCountryCodes.size} effective-catalog countries.`);
  console.log(`Unmatched: ${validCountryCodes.size - accepted.length}`);

  if (!validation.ok) {
    console.error('Validation failed — leaving the existing snapshot untouched:');
    for (const e of validation.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const snapshot = buildSnapshot(accepted, SOURCE_INDICATOR, new Date().toISOString());
  const json = serializeSnapshot(snapshot);

  // Atomic-ish write: write to a temp file in the same directory, then
  // rename over the real target — a crash mid-write can never leave a
  // half-written travelCostIndex.json behind.
  const tmpFile = `${outFile}.tmp`;
  fs.writeFileSync(tmpFile, json);
  fs.renameSync(tmpFile, outFile);

  console.log(`Wrote generated/travelCostIndex.json (${accepted.length} countries, ${(json.length / 1024).toFixed(1)} KB).`);
}

main();
