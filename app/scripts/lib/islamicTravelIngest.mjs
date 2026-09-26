// v1.1 — Islamic-travel evidence: pure pipeline (no network).
//
// What the evidence is: counts of places MAPPED in OpenStreetMap for each
// country, read through the Overpass API by generate-islamic-travel-evidence.mjs:
//   - mosques / Muslim places of worship: amenity=place_of_worship + religion=muslim
//   - places explicitly tagged as serving halal food: diet:halal=yes|only
//
// What it is NOT: a measure of how Islamic a country, its people or its
// government is. It never reads religion statistics, an official religion,
// a country name or a region. A Muslim-majority country where halal is the
// default and nobody tags it is simply "no evidence" — not a low score —
// and a non-Muslim-majority country with many tagged places counts as
// evidence. Mapping completeness varies by country; that is why only
// positive evidence is ever used and absence is never scored (the runtime
// classification lives in src/personalization/travelNeeds.ts).
//
// Licence: OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0.
// The committed snapshot is a derived database under the same licence.

export const OVERPASS_SOURCE = 'OpenStreetMap contributors, via the Overpass API';
export const OVERPASS_LICENSE = 'ODbL-1.0';
export const MOSQUE_SELECTOR = 'nwr["amenity"="place_of_worship"]["religion"="muslim"]';
export const HALAL_SELECTOR = 'nwr["diet:halal"~"^(yes|only)$"]';

/** One Overpass QL query per country: the country's admin_level=2
 *  boundary area (printed as ids, so a missing boundary is never mistaken
 *  for "nothing mapped"), then two `out count` blocks — mosques, then
 *  halal places — inside it. */
export function countryQuery(iso2) {
  if (!/^[A-Z]{2}$/.test(iso2)) throw new Error(`Invalid ISO2 code: ${iso2}`);
  return [
    '[out:json][timeout:600];',
    `area["ISO3166-1"="${iso2}"]["admin_level"="2"]["boundary"="administrative"]->.country;`,
    '.country out ids;',
    `${MOSQUE_SELECTOR}(area.country);`,
    'out count;',
    `${HALAL_SELECTOR}(area.country);`,
    'out count;',
  ].join('\n');
}

/** Reads one country's answer. null for anything malformed or partial;
 *  { areaFound: false } when the boundary does not exist in the data. */
export function parseCountryResponse(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.elements)) return null;
  const areaFound = body.elements.some((element) => element?.type === 'area');
  if (!areaFound) return { areaFound: false };
  const counts = body.elements.filter((element) => element && element.type === 'count');
  if (counts.length !== 2) return null;
  const total = (element) => Number(element.tags?.total);
  const mosques = total(counts[0]);
  const halalPlaces = total(counts[1]);
  if (!Number.isInteger(mosques) || mosques < 0 || !Number.isInteger(halalPlaces) || halalPlaces < 0) return null;
  return { areaFound: true, mosques, halalPlaces };
}

export function buildSnapshot(entries, now = new Date()) {
  const sorted = [...entries].sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  return {
    snapshotUpdatedAt: now.toISOString(),
    source: OVERPASS_SOURCE,
    license: OVERPASS_LICENSE,
    selectors: { mosques: MOSQUE_SELECTOR, halalPlaces: HALAL_SELECTOR },
    entries: sorted,
  };
}

/** Refuses a snapshot that could mislead: an excluded country, a duplicate,
 *  a malformed count, or too little coverage to be worth shipping. */
export function validateEntries(entries, { expectedCodes, excludedCodes, minCoverage = 0.8 }) {
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    if (excludedCodes.has(entry.countryCode)) errors.push(`excluded country present: ${entry.countryCode}`);
    if (seen.has(entry.countryCode)) errors.push(`duplicate: ${entry.countryCode}`);
    seen.add(entry.countryCode);
    if (entry.status === 'ok') {
      for (const key of ['mosques', 'halalPlaces']) {
        if (!Number.isInteger(entry[key]) || entry[key] < 0) errors.push(`${entry.countryCode}: bad ${key}`);
      }
    } else if (entry.status !== 'unavailable') {
      errors.push(`${entry.countryCode}: bad status`);
    }
  }
  // Coverage counts each expected country once, whatever else is present.
  const ok = new Set(entries.filter((entry) => entry.status === 'ok' && expectedCodes.has(entry.countryCode)).map((entry) => entry.countryCode)).size;
  if (expectedCodes.size && ok / expectedCodes.size < minCoverage) {
    errors.push(`coverage ${ok}/${expectedCodes.size} is below ${Math.round(minCoverage * 100)}%`);
  }
  for (const code of expectedCodes) if (!seen.has(code)) errors.push(`missing: ${code}`);
  return errors;
}

export function serializeSnapshot(snapshot) {
  return `${JSON.stringify(snapshot)}\n`;
}
