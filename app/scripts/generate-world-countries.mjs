// Phase 10 — generates the worldwide "basic country" catalog (the 165
// countries not already covered by the 30 existing recommendation-ready
// destinations) plus their local flag SVGs. Run manually when the country
// list needs regenerating; output is committed as generated data, not
// fetched at runtime.
//
// SOURCE / CONVENTION (documented explicitly per Phase 10 requirements):
// - Country facts (ISO codes, English/Arabic names, region/subregion,
//   capital) come from the `world-countries` npm package (MIT), itself
//   built on the maintained mledoze/countries dataset.
// - Country list = 193 UN member states + 2 UN observer states (the Holy
//   See / Vatican City, and the State of Palestine) = 195 total. This is
//   the same "195 countries" convention widely cited for "countries of the
//   world" lists.
// - NOTE: the `world-countries` dataset flags Vatican City with
//   `unMember: true`, which is incorrect (Vatican is an observer, not a
//   member) — verified against the known real UN membership count (193).
//   This script corrects for that: it takes `unMember === true` EXCLUDING
//   Vatican (cca2 'VA') as the 193 members, then explicitly adds Palestine
//   (cca2 'PS') and Vatican (cca2 'VA') as the 2 observers.
// - "Middle East" is not a continent; for consistency with the app's own
//   existing region categories (which already treat UAE/Saudi/Qatar as
//   'MiddleEast', separate from 'Asia'), this script buckets any Asian
//   country whose `subregion` is the UN M49 "Western Asia" group as
//   'MiddleEast', and the rest of `region: Asia` as 'Asia'. This is an
//   objective, sourced rule (not a manual/invented list).
// - Flags: local SVGs from the `flag-icons` npm package (MIT) — the SAME
//   library the existing 30 embedded flags were originally sourced from
//   (see WEJHATY_PROJECT_CONTEXT.md). No remote URLs, no emoji.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import countries from 'world-countries';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../src/data/generated');

// ---- 1. Resolve the 195-country list ----
const trueMembers = countries.filter((c) => c.unMember === true && c.cca2 !== 'VA');
const observers = countries.filter((c) => c.cca2 === 'PS' || c.cca2 === 'VA');
const world195 = [...trueMembers, ...observers];

if (world195.length !== 195) {
  throw new Error(`Expected 195 countries, got ${world195.length} — convention or dataset changed, review script`);
}

// ---- 2. Exclude the 30 already covered by existing recommendation-ready destinations ----
const existingDestinations = JSON.parse(
  fs.readFileSync(path.join(outDir, 'destinations.json'), 'utf8'),
);
const existingCodes = new Set(existingDestinations.map((d) => d.countryCode.toUpperCase()));
if (existingCodes.size !== 30) {
  throw new Error(`Expected 30 existing destination codes, got ${existingCodes.size}`);
}

const newCountries = world195.filter((c) => !existingCodes.has(c.cca2));
console.log(`World total: ${world195.length}, already covered: ${existingCodes.size}, new basic countries: ${newCountries.length}`);

// ---- 3. Continent classification ----
function toContinent(c) {
  if (c.region === 'Africa') return 'Africa';
  if (c.region === 'Europe') return 'Europe';
  if (c.region === 'Oceania') return 'Oceania';
  if (c.region === 'Americas') {
    return c.subregion === 'South America' ? 'SouthAmerica' : 'NAmerica';
  }
  if (c.region === 'Asia') {
    return c.subregion === 'Western Asia' ? 'MiddleEast' : 'Asia';
  }
  throw new Error(`Unhandled region for ${c.name.common}: ${c.region}`);
}

// ---- 4. Verify no missing Arabic names (fail loudly rather than invent) ----
const missingAra = newCountries.filter((c) => !c.translations?.ara?.common);
if (missingAra.length > 0) {
  throw new Error(`Missing Arabic name for: ${missingAra.map((c) => c.name.common).join(', ')}`);
}

// ---- 5. Build the basic-country records ----
const basicCountries = newCountries
  .map((c) => ({
    id: c.cca2.toLowerCase(),
    iso2: c.cca2,
    iso3: c.cca3,
    nameEn: c.name.common,
    nameAr: c.translations.ara.common,
    continent: toContinent(c),
    subregion: c.subregion,
    capitalEn: c.capital?.[0] ?? null,
    countryCode: c.cca2,
    recommendationReady: false,
  }))
  .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

// ---- 6. Verify uniqueness before writing ----
const ids = new Set(basicCountries.map((c) => c.id));
const iso2s = new Set(basicCountries.map((c) => c.iso2));
const iso3s = new Set(basicCountries.map((c) => c.iso3));
if (ids.size !== basicCountries.length) throw new Error('Duplicate id in generated basic countries');
if (iso2s.size !== basicCountries.length) throw new Error('Duplicate iso2 in generated basic countries');
if (iso3s.size !== basicCountries.length) throw new Error('Duplicate iso3 in generated basic countries');

fs.writeFileSync(
  path.join(outDir, 'basicCountries.json'),
  JSON.stringify(basicCountries, null, 2) + '\n',
);
console.log(`Wrote ${basicCountries.length} basic countries to generated/basicCountries.json`);

// ---- 7. Flags: read the raw SVG for each new code from flag-icons, merge
//         into the existing flags.json (never overwriting the 30 already there) ----
const existingFlags = JSON.parse(fs.readFileSync(path.join(outDir, 'flags.json'), 'utf8'));
const flagDir = path.join(__dirname, '../node_modules/flag-icons/flags/4x3');

const newFlags = {};
for (const c of basicCountries) {
  const code = c.id; // lowercase iso2
  if (existingFlags[code]) continue; // safety: never overwrite an existing flag
  const svgPath = path.join(flagDir, `${code}.svg`);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`No flag-icons SVG found for ${code} (${c.nameEn})`);
  }
  newFlags[code] = fs.readFileSync(svgPath, 'utf8');
}

const missingFlags = basicCountries.filter((c) => !existingFlags[c.id] && !newFlags[c.id]);
if (missingFlags.length > 0) {
  throw new Error(`Missing flags for: ${missingFlags.map((c) => c.id).join(', ')}`);
}

fs.writeFileSync(
  path.join(outDir, 'basicCountryFlags.json'),
  JSON.stringify(newFlags, null, 2) + '\n',
);
console.log(`Wrote ${Object.keys(newFlags).length} new flag SVGs to generated/basicCountryFlags.json`);

// ---- 8. Final sanity: 30 + newCountries.length should equal 195 ----
const total = existingCodes.size + basicCountries.length;
console.log(`Total world catalog size: ${total} (expected 195)`);
if (total !== 195) throw new Error('Total catalog size mismatch');

// ---- 9. Phase 11 Step 1 — build-time Country Information dataset ----
// Additional, purely informational fields for ALL 195 catalog countries
// (the 30 existing destinations too, not just the 165 basic countries),
// keyed by ISO 3166-1 alpha-2 so lookups work uniformly for both. Sourced
// from the same already-installed `world-countries` package — no live API,
// no runtime network call, no new dependency. Deliberately excludes
// population and timezones (only available from the live REST Countries
// API, out of scope per the Phase 11 architecture decision), and excludes
// any field already present on CatalogEntry (capital, continent, subregion,
// nameEn/Ar, flag) to avoid duplication.
function callingCodeOf(c) {
  const idd = c.idd;
  if (!idd?.root) return null;
  // A single suffix unambiguously completes the code (e.g. root "+3" +
  // suffix "3" = "+33" for France). Multiple suffixes usually mean the root
  // itself IS the shared calling code (e.g. NANP's "+1" for US/Canada, or
  // "+7" for Russia/Kazakhstan) — combining with an arbitrary suffix would
  // fabricate a specific one, so use the root alone in that case.
  if (Array.isArray(idd.suffixes) && idd.suffixes.length === 1) {
    return idd.root + idd.suffixes[0];
  }
  return idd.root;
}

const countryInfo = {};
for (const c of world195) {
  if (!c.name.official) throw new Error(`Missing official name for ${c.name.common}`);
  if (!c.translations?.ara?.official) throw new Error(`Missing Arabic official name for ${c.name.common}`);
  if (c.area == null) throw new Error(`Missing area for ${c.name.common}`);
  const callingCode = callingCodeOf(c);
  if (!callingCode) throw new Error(`Missing calling code for ${c.name.common}`);

  countryInfo[c.cca2] = {
    iso2: c.cca2,
    // Phase 11 Step 3: the 30 original destinations carry no iso3 anywhere
    // else (deliberately never retrofitted — see types.ts), so this is the
    // only place border-code resolution can get an iso3 for ALL 195
    // catalog entries. Same source (world-countries' cca3) already used
    // for `borders` itself below.
    iso3: c.cca3,
    officialNameEn: c.name.official,
    officialNameAr: c.translations.ara.official,
    areaKm2: c.area,
    currencies: Object.entries(c.currencies ?? {}).map(([code, v]) => ({
      code,
      name: v.name,
      symbol: v.symbol,
    })),
    languagesEn: Object.values(c.languages ?? {}),
    callingCode,
    borders: c.borders ?? [],
  };
}

const countryInfoCount = Object.keys(countryInfo).length;
if (countryInfoCount !== 195) {
  throw new Error(`Expected 195 country info records, got ${countryInfoCount}`);
}

fs.writeFileSync(
  path.join(outDir, 'countryInfo.json'),
  JSON.stringify(countryInfo, null, 2) + '\n',
);
console.log(`Wrote ${countryInfoCount} country info records to generated/countryInfo.json`);
