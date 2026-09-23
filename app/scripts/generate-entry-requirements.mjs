// Phase 19 — Passport entry information: the ONLY network-touching step.
//
// Fetches a fixed, server-owned registry of official government sources,
// runs them through the pure parsers in lib/entryRequirementsIngest.mjs,
// validates the result and writes src/data/generated/entryRequirements.json
// atomically. Runs on a GitHub-hosted runner (see
// .github/workflows/update-entry-requirements.yml): the Claude sandbox and
// most developer networks cannot reach these hosts, and the browser never
// fetches them at all — the traveller's passport choice stays on the device.
//
// Fetch safety (Phase 19 P3/P8), implemented in lib/entryRequirementsFetch.mjs:
//   - every URL comes from SOURCES below; nothing is user- or page-supplied
//   - HTTPS only; hosts must be on ALLOWED_HOSTS
//   - redirects are followed manually, at most MAX_REDIRECTS, and only to
//     allowlisted hosts (an http:// hop on an allowlisted host is upgraded
//     to https://, never followed in the clear)
//   - each response is capped at MAX_BYTES and each request at TIMEOUT_MS
//   - robots.txt is read per host and a disallowed path fails the run
//   - one request per source per run, sequential, with an identifying
//     User-Agent; no CAPTCHA, login or anti-bot barrier is ever bypassed —
//     a source that blocks automated access is simply not in the registry
//
// Exit status: 0 only when every source fetched, parsed and validated.
// Any failure leaves the committed snapshot untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };
import basicCountries from '../src/data/generated/basicCountries.json' with { type: 'json' };
import recommendationDestinations from '../src/data/generated/destinations.json' with { type: 'json' };
import isoCodes from '../src/data/generated/isoCodes.json' with { type: 'json' };
import {
  buildSnapshot,
  createNameResolver,
  hasPhrase,
  htmlToLines,
  parseCanada,
  parseEuRegulation,
  parseMaldives,
  parseSaudiEvisa,
  parseSingapore,
  parseUk,
  validateSnapshot,
} from './lib/entryRequirementsIngest.mjs';
import { createSafeFetcher } from './lib/entryRequirementsFetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../src/data/generated/entryRequirements.json');

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'WejhatyEntryRequirements/1.0 (+https://github.com/hmooodzozo577-gif/wej)';

// Schengen States that apply Regulation (EU) 2018/1806's lists: the 25 EU
// Member States in the Schengen area (every Member State except Cyprus and
// Ireland) and the four associated countries. Verified on every run against
// the Commission's own statement of the membership (see verifySchengen).
const SCHENGEN = ['AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'NO', 'CH', 'LI'];

/** The registry. `fetchUrl` is what the runner reads; `url` is the page a
 *  traveller is sent to (the human-readable version of the same document). */
const SOURCES = [
  {
    id: 'uk-visa-nationals',
    fetchUrl: 'https://www.gov.uk/api/content/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list',
    format: 'govuk-json',
    meta: {
      authority: { en: 'UK Home Office', ar: 'وزارة الداخلية البريطانية' },
      title: { en: 'Immigration Rules, Appendix Visitor: Visa national list', ar: 'قواعد الهجرة البريطانية — قائمة الجنسيات التي تحتاج تأشيرة' },
      url: 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list',
    },
  },
  {
    id: 'uk-eta-nationals',
    fetchUrl: 'https://www.gov.uk/api/content/guidance/immigration-rules/immigration-rules-appendix-eta-national-list',
    format: 'govuk-json',
    meta: {
      authority: { en: 'UK Home Office', ar: 'وزارة الداخلية البريطانية' },
      title: { en: 'Immigration Rules, Appendix ETA National List', ar: 'قواعد الهجرة البريطانية — قائمة جنسيات تصريح السفر الإلكتروني (ETA)' },
      url: 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-eta-national-list',
    },
  },
  {
    id: 'eu-regulation-2018-1806',
    fetchUrl: 'https://publications.europa.eu/resource/celex/02018R1806-20251230',
    accept: 'application/xhtml+xml',
    acceptLanguage: 'eng',
    format: 'html',
    meta: {
      authority: { en: 'European Union — Publications Office', ar: 'الاتحاد الأوروبي — مكتب المنشورات' },
      title: {
        en: 'Regulation (EU) 2018/1806, Annexes I and II (consolidated text of 30 December 2025)',
        ar: 'اللائحة الأوروبية 2018/1806، الملحقان الأول والثاني (النص الموحّد بتاريخ 30 ديسمبر 2025)',
      },
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02018R1806-20251230',
    },
  },
  {
    id: 'eu-schengen-area',
    fetchUrl: 'https://home-affairs.ec.europa.eu/policies/schengen/schengen-area_en',
    format: 'html',
    meta: {
      authority: { en: 'European Commission — Migration and Home Affairs', ar: 'المفوضية الأوروبية — الهجرة والشؤون الداخلية' },
      title: { en: 'Schengen area', ar: 'منطقة شنغن' },
      url: 'https://home-affairs.ec.europa.eu/policies/schengen/schengen-area_en',
    },
  },
  {
    id: 'ca-ircc-entry',
    fetchUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html',
    format: 'html',
    meta: {
      authority: { en: 'Immigration, Refugees and Citizenship Canada', ar: 'وزارة الهجرة واللاجئين والمواطنة الكندية' },
      title: { en: 'What you need to enter Canada', ar: 'متطلبات دخول كندا' },
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html',
    },
  },
  {
    id: 'sg-ica-visa',
    fetchUrl: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements',
    format: 'html',
    meta: {
      authority: { en: 'Immigration & Checkpoints Authority of Singapore', ar: 'هيئة الهجرة ونقاط التفتيش في سنغافورة' },
      title: { en: 'Check if You Need an Entry Visa', ar: 'هل تحتاج إلى تأشيرة لدخول سنغافورة؟' },
      url: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements',
    },
  },
  {
    id: 'sa-evisa',
    fetchUrl: 'https://visa.visitsaudi.com/',
    format: 'html',
    meta: {
      authority: { en: 'Saudi eVisa portal (Ministry of Tourism)', ar: 'منصة التأشيرة السياحية السعودية (وزارة السياحة)' },
      title: { en: 'Saudi eVisa — eligible countries', ar: 'التأشيرة السياحية الإلكترونية — الدول المؤهلة' },
      url: 'https://visa.visitsaudi.com/',
    },
  },
  {
    id: 'mv-immigration',
    fetchUrl: 'https://www.immigration.gov.mv/visa/tourist-visa',
    format: 'html',
    meta: {
      authority: { en: 'Maldives Immigration', ar: 'إدارة الهجرة في جزر المالديف' },
      title: { en: 'Tourist Visa — On Arrival', ar: 'التأشيرة السياحية عند الوصول' },
      url: 'https://www.immigration.gov.mv/visa/tourist-visa',
    },
  },
];

const ALLOWED_HOSTS = [
  'www.gov.uk',
  'publications.europa.eu',
  'home-affairs.ec.europa.eu',
  'www.canada.ca',
  'www.ica.gov.sg',
  'visa.visitsaudi.com',
  'www.immigration.gov.mv',
];

const { safeFetch, assertRobotsAllow } = createSafeFetcher({
  allowedHosts: ALLOWED_HOSTS,
  timeoutMs: TIMEOUT_MS,
  maxBytes: MAX_BYTES,
  maxRedirects: MAX_REDIRECTS,
  userAgent: USER_AGENT,
});

async function loadSource(source) {
  const url = new URL(source.fetchUrl);
  await assertRobotsAllow(url);
  const { body, finalUrl } = await safeFetch(source.fetchUrl, { accept: source.accept, acceptLanguage: source.acceptLanguage });
  let html = body;
  let sourceUpdatedAt;
  if (source.format === 'govuk-json') {
    const data = JSON.parse(body);
    html = data?.details?.body;
    if (typeof html !== 'string' || !html.length) throw new Error(`${source.id}: gov.uk content API returned no body`);
    sourceUpdatedAt = typeof data.public_updated_at === 'string' ? data.public_updated_at : undefined;
  }
  const lines = htmlToLines(html);
  console.log(`  ${source.id}: ${lines.length} lines from ${finalUrl}${sourceUpdatedAt ? ` (source updated ${sourceUpdatedAt})` : ''}`);
  return { lines, sourceUpdatedAt };
}

function loadCatalog() {
  const excluded = new Set(excludedCountriesData.map((entry) => entry.iso2));
  const catalog = [];
  for (const entry of basicCountries) catalog.push({ iso2: entry.iso2, nameEn: entry.nameEn });
  for (const entry of recommendationDestinations) catalog.push({ iso2: isoCodes[entry.id], nameEn: entry.nameEn });
  const effective = catalog.filter((entry) => entry.iso2 && !excluded.has(entry.iso2));
  return {
    effective,
    codes: effective.map((entry) => entry.iso2),
    excludedCodes: [...excluded],
    excludedNames: catalog.filter((entry) => excluded.has(entry.iso2)).map((entry) => entry.nameEn),
  };
}

function verifySchengen(lines) {
  for (const phrase of [
    'The Schengen area is composed of 29 countries: 25 EU Member States and 4 non-EU countries (Iceland, Norway, Switzerland and Liechtenstein)',
    'Cyprus participates in the Schengen cooperation. Nevertheless, internal borders controls have not yet been abolished',
    'Ireland, on the other hand, is exceptionally allowed by the Schengen Protocol not to apply the Schengen rules',
  ]) {
    if (!hasPhrase(lines, phrase)) {
      const near = lines.find((line) => line.includes('Schengen area is composed') || line.includes('Cyprus participates') || line.includes('Ireland, on the other hand'));
      console.error(`  nearest line on the page: ${near ?? '(none)'}`);
      throw new Error(`Schengen area page: membership statement changed — "${phrase.slice(0, 60)}…" not found`);
    }
  }
  if (SCHENGEN.length !== 29) throw new Error('Schengen registry is not 29 states');
}

async function main() {
  const checkedAt = new Date().toISOString();
  const catalog = loadCatalog();
  const resolve = createNameResolver(catalog.effective, catalog.excludedCodes, catalog.excludedNames);
  console.log(`Effective catalog: ${catalog.codes.length} countries; excluded: ${catalog.excludedCodes.join(', ')}`);

  const loaded = {};
  for (const source of SOURCES) loaded[source.id] = await loadSource(source);

  const warnings = [];
  const tables = [];
  const add = (id, destinations, sourceIds, result) => {
    warnings.push(...result.warnings);
    // A destination's own nationals are not "visitors" to it; the UI says
    // "this is your passport's country" instead of any category.
    for (const code of destinations) result.rules.delete(code);
    tables.push({ id, destinations, sourceIds, rules: result.rules });
  };

  add('uk', ['GB'], ['uk-visa-nationals', 'uk-eta-nationals'], parseUk({ visaNationalLines: loaded['uk-visa-nationals'].lines, etaNationalLines: loaded['uk-eta-nationals'].lines }, resolve));
  verifySchengen(loaded['eu-schengen-area'].lines);
  add('schengen', SCHENGEN, ['eu-regulation-2018-1806', 'eu-schengen-area'], parseEuRegulation(loaded['eu-regulation-2018-1806'].lines, resolve));
  add('canada', ['CA'], ['ca-ircc-entry'], parseCanada(loaded['ca-ircc-entry'].lines, resolve));
  add('singapore', ['SG'], ['sg-ica-visa'], parseSingapore(loaded['sg-ica-visa'].lines, resolve, catalog.codes));
  add('saudi', ['SA'], ['sa-evisa'], parseSaudiEvisa(loaded['sa-evisa'].lines, resolve));
  add('maldives', ['MV'], ['mv-immigration'], parseMaldives(loaded['mv-immigration'].lines, catalog.codes));

  const snapshot = buildSnapshot({
    generatedAt: checkedAt,
    sources: SOURCES.map((source) => ({
      id: source.id,
      meta: { ...source.meta, checkedAt, ...(loaded[source.id].sourceUpdatedAt ? { sourceUpdatedAt: loaded[source.id].sourceUpdatedAt } : {}) },
    })),
    tables,
  });

  const errors = validateSnapshot(snapshot, { catalogCodes: catalog.codes, excludedCodes: catalog.excludedCodes });
  for (const warning of warnings) console.log(`WARN ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    throw new Error(`${errors.length} validation error(s); snapshot not written`);
  }

  for (const [tableId, { entries }] of Object.entries(snapshot.tables)) {
    const counts = {};
    for (const value of Object.values(entries)) counts[value] = (counts[value] ?? 0) + 1;
    const covering = Object.entries(snapshot.destinations).filter(([, id]) => id === tableId).map(([code]) => code);
    console.log(`  ${tableId} (${covering.join(' ')}): ${Object.keys(entries).length} nationalities — ${JSON.stringify(counts)}`);
    // Full table in the log, so a reviewer can audit every value against
    // the official page without checking out the branch.
    console.log(`    ${Object.entries(entries).map(([code, value]) => `${code}=${value}`).join(' ')}`);
  }

  const temp = `${OUTPUT}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(snapshot, null, 1)}\n`);
  fs.renameSync(temp, OUTPUT);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)} (${Object.keys(snapshot.destinations).length} destinations).`);
}

main().catch((error) => {
  console.error(`generate-entry-requirements failed: ${error.message}`);
  process.exit(1);
});
