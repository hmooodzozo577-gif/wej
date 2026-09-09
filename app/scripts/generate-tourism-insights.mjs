// Phase 13.5d — Destination Tourism Insights: the ONLY file in this
// feature that touches the network. Fetches TWO World Bank indicators
// (arrivals, receipts), hands each's raw rows to the pure pipeline in
// scripts/lib/tourismInsightsIngest.mjs, merges them, and only
// overwrites the committed snapshot (src/data/generated/
// tourismInsights.json) if validation passes. On any failure this
// exits non-zero and leaves the existing snapshot file untouched — same
// atomic-write, never-corrupt-the-committed-file design as
// generate-travel-cost-index.mjs.
//
// Run manually, or via .github/workflows/update-tourism-insights.yml:
//   node scripts/generate-tourism-insights.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEntries,
  buildSnapshot,
  normalizeSeriesRows,
  parseWorldBankResponse,
  serializeSnapshot,
  validateEntries,
} from './lib/tourismInsightsIngest.mjs';
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');
const outFile = path.join(outDir, 'tourismInsights.json');

// Live-verified (see TOURISM_INSIGHTS.md): both indicators are live/
// serving but neither has an observation newer than 2020. mrv=6 pulls
// the full available historical run (2015-2020) in one call per
// indicator, all countries at once.
const SOURCE_INDICATORS = { arrivals: 'ST.INT.ARVL', receiptsUsd: 'ST.INT.RCPT.CD' };
const MRV = 6;
const urlFor = (indicator) =>
  `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&mrv=${MRV}`;

// Same shared exclusion source of truth as generate-travel-cost-index.mjs
// — one hand-maintained list, no second mirror.
const EXCLUDED_COUNTRY_CODES = excludedCountriesData.map((c) => c.iso2);

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

async function fetchIndicatorRows(indicator) {
  const res = await fetch(urlFor(indicator));
  if (!res.ok) throw new Error(`World Bank API returned HTTP ${res.status} for ${indicator}`);
  const body = await res.json();
  return parseWorldBankResponse(body);
}

async function main() {
  const validCountryCodes = loadEffectiveCatalogCountryCodes();
  console.log(`Effective catalog (join target): ${validCountryCodes.size} countries.`);

  let arrivalsRows, receiptsRows;
  try {
    [arrivalsRows, receiptsRows] = await Promise.all([
      fetchIndicatorRows(SOURCE_INDICATORS.arrivals),
      fetchIndicatorRows(SOURCE_INDICATORS.receiptsUsd),
    ]);
  } catch (err) {
    console.error('Fetch or parse failed — leaving the existing snapshot untouched.');
    console.error(String(err));
    process.exit(1);
  }
  console.log(`Raw rows received: arrivals=${arrivalsRows.length}, receipts=${receiptsRows.length}`);

  const arrivalsNorm = normalizeSeriesRows(arrivalsRows, validCountryCodes);
  const receiptsNorm = normalizeSeriesRows(receiptsRows, validCountryCodes);

  for (const [name, norm] of [['arrivals', arrivalsNorm], ['receiptsUsd', receiptsNorm]]) {
    const counts = {};
    for (const r of norm.rejected) counts[r.reason] = (counts[r.reason] ?? 0) + 1;
    console.log(`${name}: accepted observations for ${norm.byCountry.size} countries; rejected ${norm.rejected.length}`, counts);
  }

  const entries = buildEntries(arrivalsNorm.byCountry, receiptsNorm.byCountry);
  console.log(`Matched ${entries.length}/${validCountryCodes.size} effective-catalog countries (either series).`);
  console.log(`Unmatched: ${validCountryCodes.size - entries.length}`);

  const allPeriods = new Set();
  for (const e of entries) {
    for (const obs of e.arrivals ?? []) allPeriods.add(obs.period);
    for (const obs of e.receiptsUsd ?? []) allPeriods.add(obs.period);
  }
  console.log(`Periods observed: ${[...allPeriods].sort().join(', ')}`);

  const validation = validateEntries(entries, validCountryCodes.size, EXCLUDED_COUNTRY_CODES);
  if (!validation.ok) {
    console.error('Validation failed — leaving the existing snapshot untouched:');
    for (const e of validation.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const snapshot = buildSnapshot(entries, SOURCE_INDICATORS, new Date().toISOString());
  const json = serializeSnapshot(snapshot);

  const tmpFile = `${outFile}.tmp`;
  fs.writeFileSync(tmpFile, json);
  fs.renameSync(tmpFile, outFile);

  console.log(`Wrote generated/tourismInsights.json (${entries.length} countries, ${(json.length / 1024).toFixed(1)} KB).`);
}

main();
