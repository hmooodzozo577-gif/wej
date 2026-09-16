// Source catalog — every indicator this layer scores from, with real
// provenance. All are ALREADY the sources Wejhaty's own committed data
// pipelines fetch from (see app/scripts/RECOMMENDATION_INDICATORS.md,
// TOURISM_INSIGHTS.md, TRAVEL_COST_INDEX.md) — this module does not fetch
// anything new over the network; it reads the same already-verified,
// already-committed snapshots those pipelines produce. No blogs, no
// scraped rankings, no model-generated values.
import type { IntelligenceSource } from './types';

const WORLD_BANK_LICENSE =
  'World Bank Open Data — CC BY-4.0 (https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets)';
const OWID_LICENSE = 'Our World in Data — CC BY (https://ourworldindata.org/about#faqs), sourced from UN Tourism';

function worldBank(id: string, name: string, indicatorId: string): IntelligenceSource {
  return {
    id,
    name,
    provider: 'World Bank',
    tier: 'official-international',
    indicatorId,
    url: `https://data.worldbank.org/indicator/${indicatorId}`,
    license: WORLD_BANK_LICENSE,
  };
}

export const SOURCES: Record<string, IntelligenceSource> = {
  urbanPopulationPct: worldBank('urbanPopulationPct', 'World Bank — Urban population (% of total)', 'SP.URB.TOTL.IN.ZS'),
  incomePerCapitaPpp: worldBank('incomePerCapitaPpp', 'World Bank — GNI per capita, PPP', 'NY.GDP.PCAP.PP.CD'),
  unemploymentPct: worldBank('unemploymentPct', 'World Bank — Unemployment, total (modeled ILO estimate)', 'SL.UEM.TOTL.ZS'),
  lifeExpectancy: worldBank('lifeExpectancy', 'World Bank — Life expectancy at birth', 'SP.DYN.LE00.IN'),
  healthSpendPerCapita: worldBank('healthSpendPerCapita', 'World Bank — Current health expenditure per capita', 'SH.XPD.CHEX.PC.CD'),
  tertiaryEnrollmentPct: worldBank('tertiaryEnrollmentPct', 'World Bank — Tertiary school enrollment (gross %)', 'SE.TER.ENRR'),
  fdiPctGdp: worldBank('fdiPctGdp', 'World Bank — Foreign direct investment, net inflows (% of GDP)', 'BX.KLT.DINV.WD.GD.ZS'),
  gdpGrowthPct: worldBank('gdpGrowthPct', 'World Bank — GDP growth (annual %)', 'NY.GDP.MKTP.KD.ZG'),
  homicideRate: worldBank('homicideRate', 'World Bank — Intentional homicides (per 100,000 people)', 'VC.IHR.PSRC.P5'),
  priceLevelIndex: worldBank('priceLevelIndex', 'World Bank — Price level index (GDP)', 'PA.NUS.GDP.PLI'),
  tourismArrivals: {
    id: 'tourismArrivals',
    name: 'UN Tourism — International tourist arrivals (via Our World in Data)',
    provider: 'UN Tourism / Our World in Data',
    tier: 'official-international',
    indicatorId: 'OWID:international-tourist-trips',
    url: 'https://ourworldindata.org/grapher/international-tourist-trips',
    license: OWID_LICENSE,
  },
};

export function sourceOf(sourceId: string): IntelligenceSource {
  const source = SOURCES[sourceId];
  if (!source) throw new Error(`Unknown intelligence source id: ${sourceId}`);
  return source;
}
