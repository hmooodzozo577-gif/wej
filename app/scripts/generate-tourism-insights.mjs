// Phase 13.5d — Destination Tourism Insights: the ONLY file in this
// feature that touches the network. Fetches TWO Our World in Data
// grapher CSVs (arrivals, receipts — see tourismInsightsIngest.mjs's
// module doc comment for the freshness correction and why OWID was
// selected), maps their ISO3 country codes to this app's ISO2 codes via
// the already-installed `world-countries` package, hands the resulting
// rows to the pure pipeline in scripts/lib/tourismInsightsIngest.mjs,
// merges them, and only overwrites the committed snapshot
// (src/data/generated/tourismInsights.json) if validation passes. On
// any failure this exits non-zero and leaves the existing snapshot
// untouched — same atomic-write, never-corrupt-the-committed-file
// design as generate-travel-cost-index.mjs.
//
// Run manually, or via .github/workflows/update-tourism-insights.yml:
//   node scripts/generate-tourism-insights.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import countries from 'world-countries';
import {
  buildEntries,
  buildSnapshot,
  normalizeSeriesRows,
  parseOwidCsv,
  serializeSnapshot,
  validateEntries,
} from './lib/tourismInsightsIngest.mjs';
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');
const outFile = path.join(outDir, 'tourismInsights.json');

// Live-verified (see TOURISM_INSIGHTS.md): both OWID grapher CSVs have
// real observations through 2024 (checked directly for Saudi Arabia
// and Japan) — UN Tourism-sourced, CC BY licensed, no auth needed.
const SOURCE_INDICATORS = {
  arrivals: 'OWID:international-tourist-trips',
  receiptsUsd: 'OWID:spending-by-international-visitors-while-visiting-a-country',
};
const OWID_URLS = {
  arrivals: 'https://ourworldindata.org/grapher/international-tourist-trips.csv',
  receiptsUsd: 'https://ourworldindata.org/grapher/spending-by-international-visitors-while-visiting-a-country.csv',
};

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

/** ISO3 -> ISO2, from the same `world-countries` package
 *  generate-world-countries.mjs already uses (MIT licensed, already a
 *  dependency — no new one added). */
function loadIso3ToIso2Map() {
  const map = new Map();
  for (const c of countries) {
    if (c.cca3 && c.cca2) map.set(c.cca3, c.cca2);
  }
  return map;
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWID returned HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const validCountryCodes = loadEffectiveCatalogCountryCodes();
  const iso3ToIso2 = loadIso3ToIso2Map();
  console.log(`Effective catalog (join target): ${validCountryCodes.size} countries.`);

  let arrivalsCsv, receiptsCsv;
  try {
    [arrivalsCsv, receiptsCsv] = await Promise.all([fetchCsv(OWID_URLS.arrivals), fetchCsv(OWID_URLS.receiptsUsd)]);
  } catch (err) {
    console.error('Fetch failed — leaving the existing snapshot untouched.');
    console.error(String(err));
    process.exit(1);
  }

  const arrivalsRows = parseOwidCsv(arrivalsCsv, iso3ToIso2);
  const receiptsRows = parseOwidCsv(receiptsCsv, iso3ToIso2);
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
  let latestPeriod = null;
  for (const e of entries) {
    for (const obs of e.arrivals ?? []) {
      allPeriods.add(obs.period);
      if (!latestPeriod || obs.period > latestPeriod) latestPeriod = obs.period;
    }
    for (const obs of e.receiptsUsd ?? []) {
      allPeriods.add(obs.period);
      if (!latestPeriod || obs.period > latestPeriod) latestPeriod = obs.period;
    }
  }
  console.log(`Periods observed: ${[...allPeriods].sort().join(', ')}`);
  console.log(`Latest observation period: ${latestPeriod}`);

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
