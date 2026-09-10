#!/usr/bin/env node
// Destination Imagery System — ingestion CLI.
//
// Pipeline: SOURCE (Wikimedia Commons) -> DISCOVERY (search queries from
// catalog identity) -> LICENSE VALIDATION -> SELECTION (deterministic
// scoring) -> OPTIMIZATION (download + WebP conversion) -> MANIFEST
// (data/generated/destinationImages.json) -> UI (data/destinationVisuals.ts
// reads the manifest; no runtime Commons dependency).
//
// Modes:
//   --country SA        ingest a single country (ISO2)
//   --all                ingest the full effective catalog (194 countries)
//   --dry-run             discovery + scoring only, no download/write
//
// Re-run safety: an existing manifest entry for a country is left alone
// unless that country is explicitly targeted again — this script never
// blindly re-downloads everything on every run.
//
// This script does NOT run automatically on every Destination page view
// (see data/destinationVisuals.ts) — it is a manual/CI-triggered
// maintenance tool, same pattern as generate-tourism-insights.mjs /
// generate-travel-cost-index.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import basicCountries from '../src/data/generated/basicCountries.json' with { type: 'json' };
import destinations from '../src/data/generated/destinations.json' with { type: 'json' };
import countryInfo from '../src/data/generated/countryInfo.json' with { type: 'json' };
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };
import overridesData from './destinationImageOverrides.json' with { type: 'json' };
import { buildManifestEntry, buildSearchQueries, classifyLicense, loadEffectiveCatalog, selectBestCandidate, validateManifestEntry } from './lib/destinationImageIngest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '../src/data/generated/destinationImages.json');
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

function parseArgs(argv) {
  const args = { country: null, all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--country') args.country = argv[++i]?.toUpperCase();
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

/** One real Commons API search + imageinfo fetch for a single query
 *  string. Returns an array of candidate objects shaped for
 *  scoreCandidate() (destinationImageIngest.mjs), or throws on network
 *  failure — the caller decides how to report that per-country. */
async function searchCommons(query) {
  const searchUrl = `${COMMONS_API}?action=query&format=json&list=search&srnamespace=6&srlimit=5&srsearch=${encodeURIComponent(query)}`;
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Wejhaty-DestinationImages/1.0 (build-time ingestion tool)' } });
  if (!searchRes.ok) throw new Error(`Commons search HTTP ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const titles = (searchJson.query?.search || []).map((r) => r.title);
  if (titles.length === 0) return [];

  const infoUrl = `${COMMONS_API}?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent(titles.join('|'))}`;
  const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': 'Wejhaty-DestinationImages/1.0 (build-time ingestion tool)' } });
  if (!infoRes.ok) throw new Error(`Commons imageinfo HTTP ${infoRes.status}`);
  const infoJson = await infoRes.json();
  const pages = Object.values(infoJson.query?.pages || {});
  return pages
    .filter((p) => p.imageinfo?.[0])
    .map((p) => {
      const ii = p.imageinfo[0];
      const em = ii.extmetadata || {};
      return {
        title: p.title,
        url: ii.url,
        descriptionUrl: ii.descriptionurl,
        width: ii.width,
        height: ii.height,
        mime: ii.mime,
        extmetadata: {
          LicenseShortName: em.LicenseShortName?.value,
          LicenseUrl: em.LicenseUrl?.value,
          Artist: em.Artist?.value?.replace(/<[^>]+>/g, ''), // strip any HTML markup Commons embeds
          Categories: em.Categories?.value,
          ImageDescription: em.ImageDescription?.value?.replace(/<[^>]+>/g, ''),
        },
      };
    });
}

async function ingestOne(entry, { dryRun }) {
  const queries = buildSearchQueries(entry, overridesData);
  const report = { iso2: entry.iso2, nameEn: entry.nameEn, status: null, detail: null };

  let candidates = [];
  try {
    for (const q of queries) {
      const found = await searchCommons(q);
      candidates = candidates.concat(found);
      if (candidates.length >= 5) break;
    }
  } catch (err) {
    report.status = 'BLOCKED — NETWORK';
    report.detail = err.message;
    return report;
  }

  const picked = selectBestCandidate(candidates);
  if (!picked) {
    report.status = 'NO_CANDIDATE';
    report.detail = candidates.length === 0 ? 'no search results' : 'no candidate passed license/quality gates';
    return report;
  }

  const license = classifyLicense(picked.candidate.extmetadata.LicenseShortName);
  const manifestEntry = buildManifestEntry({
    entry,
    candidate: picked.candidate,
    license,
    localPath: `/destinations/${entry.iso2.toLowerCase()}.webp`,
    width: picked.candidate.width,
    height: picked.candidate.height,
    retrievedAt: new Date().toISOString(),
  });
  const validation = validateManifestEntry(manifestEntry);
  if (!validation.valid) {
    report.status = 'INVALID';
    report.detail = validation.errors.join('; ');
    return report;
  }

  if (dryRun) {
    report.status = 'DRY_RUN_OK';
    report.detail = `would select: ${picked.candidate.title}`;
    return report;
  }

  // OPTIMIZATION (download + WebP conversion) is intentionally NOT
  // implemented in this pass — see the final report's "Image system
  // principle" section: adding an image-processing dependency (e.g.
  // sharp) with nothing to exercise it against (no candidate has ever
  // reached this point in this environment — Commons is unreachable,
  // see the report) would be speculative dead weight, not a justified
  // dependency. This is the one deliberately unimplemented step; every
  // step before it (discovery, scoring, license validation, manifest
  // schema) is real and tested.
  report.status = 'BLOCKED — OPTIMIZATION NOT IMPLEMENTED THIS PASS';
  report.detail = `selected candidate would be: ${picked.candidate.title} (download/WebP step not built — see report)`;
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.country && !args.all) {
    console.error('Usage: generate-destination-images.mjs (--country XX | --all) [--dry-run]');
    process.exit(1);
  }

  const countryInfoByIso2 = countryInfo;
  const catalog = loadEffectiveCatalog({ basicCountries, destinations, countryInfoByIso2, excludedCountries: excludedCountriesData });
  console.log(`Effective catalog: ${catalog.length} countries (excluded: ${excludedCountriesData.map((c) => c.iso2).join(', ')})`);

  const targets = args.all ? catalog : catalog.filter((c) => c.iso2 === args.country);
  if (targets.length === 0) {
    console.error(args.country ? `No effective-catalog entry for ${args.country} (excluded or unknown).` : 'No targets.');
    process.exit(1);
  }

  const reports = [];
  for (const entry of targets) {
    const report = await ingestOne(entry, { dryRun: args.dryRun });
    reports.push(report);
    console.log(`${report.status.padEnd(45)} ${entry.iso2}  ${entry.nameEn}${report.detail ? ` — ${report.detail}` : ''}`);
  }

  const summary = reports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\n--- Summary ---');
  for (const [status, count] of Object.entries(summary)) console.log(`${status}: ${count}`);

  if (!args.dryRun && !MANIFEST_PATH.includes('..')) {
    // No entries actually completed the pipeline this pass (see summary
    // above) — never overwrite a real manifest with an empty/partial
    // result. Only write when there is at least one genuinely completed
    // entry (which the current build cannot produce — see the report).
    if (!fs.existsSync(MANIFEST_PATH)) {
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify([], null, 2) + '\n');
      console.log(`\nWrote empty manifest to ${MANIFEST_PATH} (no country completed the full pipeline this run).`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
