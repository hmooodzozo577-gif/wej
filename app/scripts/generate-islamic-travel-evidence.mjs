// v1.1 — fetches the Islamic-travel evidence snapshot (mapped mosques and
// places tagged halal, per country) from OpenStreetMap via the Overpass
// API. The ONLY network-touching file of this feature; the pure pipeline,
// its limits and its licence are documented in lib/islamicTravelIngest.mjs.
//
// Run on a machine with internet access, or via
// .github/workflows/update-islamic-travel-evidence.yml:
//   node scripts/generate-islamic-travel-evidence.mjs
//
// Atomic: the committed snapshot is replaced only when every country was
// asked and the result validates; any failure exits non-zero and leaves it
// untouched. Polite to the public Overpass instance: one query at a time,
// a pause between queries, and backoff on 429/504.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };
import { buildSnapshot, countryQuery, parseCountryResponse, serializeSnapshot, validateEntries } from './lib/islamicTravelIngest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');
const outFile = path.join(outDir, 'islamicTravelEvidence.json');
const ENDPOINT = process.env.OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'WejhatyDataPipeline/1.1 (+https://github.com/hmooodzozo577-gif/wej; monthly snapshot)';
const PAUSE_MS = Number(process.env.OVERPASS_PAUSE_MS ?? 2500);
const MAX_ATTEMPTS = 6;

const excluded = new Set(excludedCountriesData.map((entry) => entry.iso2));

function effectiveCodes() {
  const destinations = JSON.parse(fs.readFileSync(path.join(outDir, 'destinations.json'), 'utf8'));
  const basic = JSON.parse(fs.readFileSync(path.join(outDir, 'basicCountries.json'), 'utf8'));
  return new Set([...destinations, ...basic].map((entry) => entry.countryCode).filter((code) => code && !excluded.has(code)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function askCountry(iso2) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: countryQuery(iso2) }),
      });
    } catch (error) {
      console.warn(`${iso2}: network error (attempt ${attempt}): ${error.message}`);
      await sleep(5000 * attempt);
      continue;
    }
    if (response.status === 429 || response.status === 504 || response.status === 503) {
      console.warn(`${iso2}: HTTP ${response.status} (attempt ${attempt}), backing off`);
      await sleep(15000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`${iso2}: HTTP ${response.status}`);
    const parsed = parseCountryResponse(await response.json());
    if (parsed) return parsed;
    console.warn(`${iso2}: malformed or partial answer (attempt ${attempt})`);
    await sleep(10000 * attempt);
  }
  return null;
}

const codes = [...effectiveCodes()].sort();
console.log(`Asking Overpass about ${codes.length} countries at ${ENDPOINT}`);
const entries = [];
for (const [index, code] of codes.entries()) {
  const answer = await askCountry(code);
  if (answer && answer.areaFound) {
    entries.push({ countryCode: code, status: 'ok', mosques: answer.mosques, halalPlaces: answer.halalPlaces });
    console.log(`${index + 1}/${codes.length} ${code}: mosques=${answer.mosques} halal=${answer.halalPlaces}`);
  } else {
    entries.push({ countryCode: code, status: 'unavailable' });
    console.log(`${index + 1}/${codes.length} ${code}: unavailable (${answer ? 'no boundary area' : 'no valid answer'})`);
  }
  await sleep(PAUSE_MS);
}

const errors = validateEntries(entries, { expectedCodes: new Set(codes), excludedCodes: excluded });
if (errors.length) {
  console.error('Validation failed; the committed snapshot is untouched:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const tmp = `${outFile}.tmp`;
fs.writeFileSync(tmp, serializeSnapshot(buildSnapshot(entries)));
fs.renameSync(tmp, outFile);
const ok = entries.filter((entry) => entry.status === 'ok').length;
console.log(`Wrote ${path.relative(process.cwd(), outFile)}: ${ok}/${codes.length} countries with data.`);
