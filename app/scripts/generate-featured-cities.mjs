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
const catalog = [...destinations, ...basicCountries].filter((country) => country.countryCode !== 'IL');
const countryByIso2 = new Map(countries.map((country) => [country.cca2, country]));
const localizedByKey = new Map(existingCities.map((city) => [`${city.nameEn}|${city.countryCode}`, city.nameAr]));

const normalize = (value) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
const output = {};

for (const country of catalog) {
  const sourceCountry = countryByIso2.get(country.countryCode);
  const capital = sourceCountry?.capital?.[0] ?? country.capitalEn ?? null;
  const rows = cityTimezones.cityMapping
    .filter((city) => city.iso2 === country.countryCode && Number.isFinite(city.pop) && city.pop > 0)
    .sort((a, b) => b.pop - a.pop);

  const selected = [];
  const seen = new Set();
  const add = (nameEn, row, isCapital) => {
    const key = normalize(nameEn);
    if (!key || seen.has(key) || selected.length >= 5) return;
    seen.add(key);
    selected.push({
      nameEn,
      nameAr: localizedByKey.get(`${nameEn}|${country.countryCode}`) ?? nameEn,
      countryCode: country.countryCode,
      population: row ? Math.round(row.pop) : null,
      capital: isCapital,
      source: row ? 'city-timezones' : 'world-countries',
    });
  };

  if (capital) {
    const capitalRow = rows.find((city) => normalize(city.city) === normalize(capital));
    add(capitalRow?.city ?? capital, capitalRow, true);
  }
  for (const row of rows) add(row.city, row, capital ? normalize(row.city) === normalize(capital) : false);

  if (!selected.length) {
    throw new Error(`No featured city or capital available for ${country.countryCode}`);
  }
  output[country.countryCode] = selected;
}

if (Object.keys(output).length !== 194) {
  throw new Error(`Expected 194 effective-country records, got ${Object.keys(output).length}`);
}

fs.writeFileSync(path.join(dataDir, 'featuredCities.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote featured cities for ${Object.keys(output).length} countries.`);
