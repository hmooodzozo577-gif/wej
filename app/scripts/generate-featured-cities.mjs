// Item #5 — featured city content.
//
// What was wrong: every city rendered the SAME two template sentences
// ("capitalCityDescription" / "majorCityDescription"), so a country's five
// cities differed only by name and population. The user's verdict — "most
// city descriptions repeat essentially the same text and only population
// changes" — was exactly right.
//
// What this generator produces instead is a per-city record of REAL,
// source-backed facts, each of which genuinely differs between cities:
//
//   role            capital / largest known city / Nth-largest known city
//   region          the administrative region (province/state) it sits in
//   timezone        its IANA time zone (differs between cities in big countries)
//   population      approximate, as published
//   fromCapital     straight-line distance and compass bearing from the
//                   national capital, computed from real coordinates
//   airport         the nearest airport with an IATA code, and how far it is
//
// Deliberately NOT produced: any "what the city is known for" narrative,
// notable-attraction list, or character description. There is no licensed,
// offline, 194-country source for that in this project, and the brief is
// explicit — "If data is unavailable: show less rather than inventing
// content". A templated sentence per city type is what this replaces; a
// fabricated one per city would be worse. See PROJECT_STATE.md for the
// external-source blocker that keeps the narrative layer unbuilt.
//
// Sources: city-timezones (city, province, timezone, population,
// coordinates), world-countries (capital), and this project's own
// airports.json (OurAirports, IATA-coded airports only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cityTimezones from 'city-timezones';
import countries from 'world-countries';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(scriptDir, '..', 'src', 'data', 'generated');
const destinations = JSON.parse(fs.readFileSync(path.join(dataDir, 'destinations.json'), 'utf8'));
const basicCountries = JSON.parse(fs.readFileSync(path.join(dataDir, 'basicCountries.json'), 'utf8'));
const existingCities = JSON.parse(fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'));
const airports = JSON.parse(fs.readFileSync(path.join(dataDir, 'airports.json'), 'utf8'));
const catalog = [...destinations, ...basicCountries].filter((country) => country.countryCode !== 'IL');
const countryByIso2 = new Map(countries.map((country) => [country.cca2, country]));
const localizedByKey = new Map(existingCities.map((city) => [`${city.nameEn}|${city.countryCode}`, city.nameAr]));

// Beyond this, "the nearest airport" stops being a useful fact about the
// city — it becomes a fact about a different part of the country.
const MAX_AIRPORT_DISTANCE_KM = 120;
// Below this, "north-east of the capital" is noise rather than information,
// and inside a capital's own metropolitan area it would be misleading.
const MIN_CAPITAL_DISTANCE_KM = 25;

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg) => (deg * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/** Initial great-circle bearing from `a` to `b`, snapped to eight points. */
function bearingOf(a, b) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  const normalized = (degrees + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8];
}

const airportsByCountry = new Map();
for (const airport of airports) {
  if (!airportsByCountry.has(airport.countryCode)) airportsByCountry.set(airport.countryCode, []);
  airportsByCountry.get(airport.countryCode).push(airport);
}

function nearestAirport(countryCode, coords) {
  let best;
  for (const airport of airportsByCountry.get(countryCode) ?? []) {
    const distanceKm = haversineKm(coords, { lat: airport.lat, lng: airport.lng });
    if (!best || distanceKm < best.distanceKm) best = { iata: airport.iata, name: airport.name, distanceKm };
  }
  if (!best || best.distanceKm > MAX_AIRPORT_DISTANCE_KM) return null;
  return { ...best, distanceKm: Math.round(best.distanceKm) };
}

const normalize = (value) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
const output = {};

for (const country of catalog) {
  const sourceCountry = countryByIso2.get(country.countryCode);
  const capital = sourceCountry?.capital?.[0] ?? country.capitalEn ?? null;
  const rows = cityTimezones.cityMapping
    .filter((city) => city.iso2 === country.countryCode && Number.isFinite(city.pop) && city.pop > 0)
    .sort((a, b) => b.pop - a.pop);

  // Population rank is computed over the FULL sorted list for the country,
  // before the five featured cities are chosen, so "3rd largest" means third
  // largest in the source data — not third in this card.
  const rankByCity = new Map(rows.map((row, index) => [normalize(row.city), index + 1]));
  const capitalRow = capital ? rows.find((city) => normalize(city.city) === normalize(capital)) : undefined;
  const capitalCoords = capitalRow
    ? { lat: capitalRow.lat, lng: capitalRow.lng }
    : sourceCountry?.latlng
      ? { lat: sourceCountry.latlng[0], lng: sourceCountry.latlng[1] }
      : null;
  // Only a real capital position supports a "distance from the capital"
  // claim. A country centroid does not, so that case produces no claim.
  const capitalPositionIsReal = !!capitalRow;

  const selected = [];
  const seen = new Set();
  const add = (nameEn, row, isCapital) => {
    const key = normalize(nameEn);
    if (!key || seen.has(key) || selected.length >= 5) return;
    seen.add(key);
    const coords = row ? { lat: row.lat, lng: row.lng } : null;
    const fromCapital =
      !isCapital && coords && capitalCoords && capitalPositionIsReal
        ? (() => {
            const distanceKm = haversineKm(capitalCoords, coords);
            if (distanceKm < MIN_CAPITAL_DISTANCE_KM) return null;
            return { distanceKm: Math.round(distanceKm), bearing: bearingOf(capitalCoords, coords) };
          })()
        : null;
    selected.push({
      nameEn,
      nameAr: localizedByKey.get(`${nameEn}|${country.countryCode}`) ?? nameEn,
      countryCode: country.countryCode,
      population: row ? Math.round(row.pop) : null,
      capital: isCapital,
      populationRank: rankByCity.get(key) ?? null,
      region: row?.province && normalize(row.province) !== key ? row.province : null,
      timezone: row?.timezone ?? null,
      fromCapital,
      airport: coords ? nearestAirport(country.countryCode, coords) : null,
      source: row ? 'city-timezones' : 'world-countries',
    });
  };

  if (capital) add(capitalRow?.city ?? capital, capitalRow, true);
  for (const row of rows) add(row.city, row, capital ? normalize(row.city) === normalize(capital) : false);

  if (!selected.length) {
    throw new Error(`No featured city or capital available for ${country.countryCode}`);
  }
  output[country.countryCode] = selected;
}

if (Object.keys(output).length !== 194) {
  throw new Error(`Expected 194 effective-country records, got ${Object.keys(output).length}`);
}

const cityCount = Object.values(output).reduce((sum, cities) => sum + cities.length, 0);
const withFacts = Object.values(output)
  .flat()
  .filter((city) => city.region || city.timezone || city.fromCapital || city.airport).length;

fs.writeFileSync(path.join(dataDir, 'featuredCities.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote featured cities for ${Object.keys(output).length} countries — ${cityCount} cities, ${withFacts} with at least one sourced distinguishing fact.`,
);
