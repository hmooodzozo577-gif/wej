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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');
const outFile = path.join(outDir, 'travelCostIndex.json');

const SOURCE_INDICATOR = 'PA.NUS.PPPC.RF';
// mrv=1 -> most recent single observation per country, so normalizeRows
// never has to deduplicate across multiple years for the same country.
const WORLD_BANK_URL = `https://api.worldbank.org/v2/country/all/indicator/${SOURCE_INDICATOR}?format=json&per_page=20000&mrv=1`;

// Defense-in-depth mirror of app/src/data/excludedCountries.ts's current
// entries. This script is plain Node ESM and cannot import that TS
// module directly, so this list is NOT a second source of truth for the
// app's exclusion behavior (excludedCountries.ts + WORLD_CATALOG remain
// that, at runtime) — it only stops an excluded country from ever
// sitting in the generated snapshot file in the first place. Keep in
// sync with excludedCountries.ts if that list ever changes.
const EXCLUDED_COUNTRY_CODES = ['IL'];

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
