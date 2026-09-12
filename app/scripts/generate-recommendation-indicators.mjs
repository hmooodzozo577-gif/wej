import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import countries from 'world-countries';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generated = path.join(__dirname, '../src/data/generated');
const destinationCodes = JSON.parse(fs.readFileSync(path.join(generated, 'destinations.json'), 'utf8')).map((d) => d.countryCode);
const basicCodes = JSON.parse(fs.readFileSync(path.join(generated, 'basicCountries.json'), 'utf8')).map((d) => d.countryCode);
const effectiveCodes = new Set([...destinationCodes, ...basicCodes]);
const travelCostSnapshot = JSON.parse(fs.readFileSync(path.join(generated, 'travelCostIndex.json'), 'utf8'));
const tourismSnapshot = JSON.parse(fs.readFileSync(path.join(generated, 'tourismInsights.json'), 'utf8'));

const priceLevelByCode = new Map(
  travelCostSnapshot.entries.map((entry) => [entry.countryCode, {
    value: entry.priceLevelIndex,
    year: entry.sourcePeriod,
  }]),
);

const arrivalsByCode = new Map(
  tourismSnapshot.entries.flatMap((entry) => {
    const latest = [...(entry.arrivals ?? [])]
      .filter((observation) => Number.isFinite(observation.value))
      .sort((a, b) => Number(b.period) - Number(a.period))[0];
    return latest ? [[entry.countryCode, { value: latest.value, year: latest.period }]] : [];
  }),
);

const INDICATORS = {
  urbanPopulationPct: 'SP.URB.TOTL.IN.ZS',
  incomePerCapitaPpp: 'NY.GDP.PCAP.PP.CD',
  unemploymentPct: 'SL.UEM.TOTL.ZS',
  lifeExpectancy: 'SP.DYN.LE00.IN',
  healthSpendPerCapita: 'SH.XPD.CHEX.PC.CD',
  tertiaryEnrollmentPct: 'SE.TER.ENRR',
  fdiPctGdp: 'BX.KLT.DINV.WD.GD.ZS',
  gdpGrowthPct: 'NY.GDP.MKTP.KD.ZG',
  homicideRate: 'VC.IHR.PSRC.P5',
};

async function fetchLatest(indicator) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&date=2018:2025`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${indicator}: World Bank HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error(`${indicator}: unexpected response`);
  const latest = new Map();
  for (const row of body[1]) {
    const code = row.countryiso3code;
    if (!code || row.value == null) continue;
    const current = latest.get(code);
    if (!current || Number(row.date) > Number(current.year)) latest.set(code, { value: Number(row.value), year: String(row.date) });
  }
  return latest;
}

const fetched = {};
for (const [key, indicator] of Object.entries(INDICATORS)) {
  fetched[key] = await fetchLatest(indicator);
  console.log(`${indicator}: ${fetched[key].size} latest observations`);
}

const entries = countries
  .filter((country) => effectiveCodes.has(country.cca2) && country.cca2 !== 'IL')
  .map((country) => {
    const indicators = {};
    for (const key of Object.keys(INDICATORS)) {
      const observation = fetched[key].get(country.cca3);
      if (observation) indicators[key] = observation;
    }
    const priceLevelIndex = priceLevelByCode.get(country.cca2);
    const tourismArrivals = arrivalsByCode.get(country.cca2);
    return {
      countryCode: country.cca2,
      continent: country.region,
      subregion: country.subregion,
      latitude: country.latlng[0],
      longitude: country.latlng[1],
      landlocked: country.landlocked,
      island: !country.landlocked && country.borders.length === 0,
      areaKm2: country.area,
      indicators,
      ...(priceLevelIndex ? { priceLevelIndex } : {}),
      ...(tourismArrivals ? { tourismArrivals } : {}),
    };
  })
  .sort((a, b) => a.countryCode.localeCompare(b.countryCode));

if (entries.length !== 194) throw new Error(`Expected 194 effective countries, got ${entries.length}`);

fs.writeFileSync(
  path.join(generated, 'recommendationIndicators.json'),
  JSON.stringify(
    {
      snapshotUpdatedAt: new Date().toISOString(),
      source: 'World Bank Indicators API, existing UN Tourism/OWID snapshot, and world-countries 5.1.0',
      sourceIndicators: INDICATORS,
      entries,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${entries.length} recommendation indicator records`);
