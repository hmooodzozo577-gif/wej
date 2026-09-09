// Phase 13.2 (travel API foundation — build-time airport resolution).
// Generates the compact, committed `generated/airports.json` used by
// data/airports.ts's resolveNearestAirport(). Run manually when the
// airport list needs regenerating; output is committed as generated data,
// not fetched at runtime — same convention as generate-world-countries.mjs.
//
// SOURCE / LICENSE (documented explicitly, per the same standard already
// applied to world-countries/flag-icons/city-timezones):
// - The underlying airport data is OurAirports
//   (https://ourairports.com/data/, mirrored at
//   github.com/davidmegginson/ourairports-data), which is dedicated to the
//   PUBLIC DOMAIN (Unlicense) — no attribution required, commercial and
//   derivative use explicitly permitted. Confirmed directly on the mirror
//   repository before this dataset was adopted.
// - It is obtained here via the `ourairports-data-js` npm package (MIT
//   licensed wrapper, see its own LICENSE file) purely as a devDependency:
//   this script reads its bundled, pre-fetched JSON snapshot of the
//   OurAirports CSVs at generation time. The library's own runtime API
//   (still marked "not production ready" by its author) is never imported
//   or shipped — only its static `dist/data/*.json` files are read here,
//   the same "npm devDependency consumed once at build time" pattern as
//   world-countries/city-timezones.
// - REJECTED CANDIDATES: `airportsjs` and `airports-data` (dmnsgn) both
//   looked promising (MIT-licensed wrapper code) but their own data
//   traces back to OpenFlights (jpatokal/openflights), which is licensed
//   under the Open Database License (ODbL) — a share-alike license that
//   would require this project's derived `airports.json` to itself be
//   redistributed under ODbL. That is materially more restrictive than
//   every other data source this project uses (all MIT/public-domain), so
//   it was not silently assumed compatible and was rejected in favor of
//   the genuinely OurAirports-derived source above. `iata-location`
//   (also OurAirports-derived, ISC-licensed) was also inspected but its
//   package structure (~150 MB of per-airport-code nested modules, built
//   for single-IATA lookups) does not fit this script's need to enumerate
//   every airport in a country, so it wasn't used.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import basicInfoById from 'ourairports-data-js/data/basic_info.json' with { type: 'json' };
import coordinatesById from 'ourairports-data-js/data/coordinates.json' with { type: 'json' };
import regionById from 'ourairports-data-js/data/region.json' with { type: 'json' };
import referencesById from 'ourairports-data-js/data/references.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');

// ---- Filtering criteria (Task A2) ----
// Compact, "major/passenger airport" scope, entirely data-driven — no
// hard-coded country list, no manual airport list:
//   1. type is 'large_airport' or 'medium_airport' (OurAirports' own
//      classification — excludes small_airport/heliport/seaplane_base,
//      which are overwhelmingly private airstrips, helipads, or floatplane
//      docks, not airports a traveler would fly into).
//   2. iata_code is present (every row already sourced from
//      ourairports-data-js has one — that package pre-filters to
//      IATA-coded entries — but this is kept as an explicit condition so
//      the criteria stand on their own if the upstream source ever
//      changes).
//   3. scheduled_service === 'yes' — OurAirports' own field indicating the
//      airport has scheduled passenger service, not just charter/cargo/
//      military use. This is a real documented field in the source data,
//      not an invented heuristic.
const INCLUDED_TYPES = new Set(['large_airport', 'medium_airport']);

const basicRows = Object.values(basicInfoById);
const regionByRowId = new Map(Object.values(regionById).map((r) => [r.id, r]));
const referencesByRowId = new Map(Object.values(referencesById).map((r) => [r.id, r]));
const coordinatesByRowId = new Map(Object.values(coordinatesById).map((r) => [r.id, r]));

const filtered = basicRows.filter((row) => {
  if (!INCLUDED_TYPES.has(row.type)) return false;
  if (!row.iata_code) return false;
  const refs = referencesByRowId.get(row.id);
  if (refs?.scheduled_service !== 'yes') return false;
  const region = regionByRowId.get(row.id);
  if (!region?.iso_country) return false;
  const coords = coordinatesByRowId.get(row.id);
  if (typeof coords?.latitude_deg !== 'number' || typeof coords?.longitude_deg !== 'number') return false;
  return true;
});

// Defensive dedupe by IATA code: keep the first match. Not expected to
// trigger (IATA codes are meant to be globally unique), but generation
// must stay deterministic even if the source ever has a duplicate.
const byIata = new Map();
for (const row of filtered) {
  if (!byIata.has(row.iata_code)) byIata.set(row.iata_code, row);
}

const airports = [...byIata.values()]
  .map((row) => {
    const region = regionByRowId.get(row.id);
    const coords = coordinatesByRowId.get(row.id);
    return {
      iata: row.iata_code,
      name: row.name,
      countryCode: region.iso_country,
      lat: Math.round(coords.latitude_deg * 10000) / 10000,
      lng: Math.round(coords.longitude_deg * 10000) / 10000,
    };
  })
  .sort((a, b) => a.iata.localeCompare(b.iata));

const airportsJson = JSON.stringify(airports);
fs.writeFileSync(path.join(outDir, 'airports.json'), airportsJson);

const countryCount = new Set(airports.map((a) => a.countryCode)).size;
console.log(
  `Wrote ${airports.length} airports (large/medium, IATA-coded, scheduled ` +
    `passenger service) across ${countryCount} countries to ` +
    `generated/airports.json (${(airportsJson.length / 1024).toFixed(0)} KB)`,
);
