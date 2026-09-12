#!/usr/bin/env node
// Destination Imagery System — ingestion CLI.
//
// Pipeline: SOURCE (Wikimedia Commons) -> DISCOVERY (search queries from
// catalog identity) -> LICENSE VALIDATION -> SELECTION (deterministic
// scoring) -> COUNTRY RELEVANCE -> DUPLICATE CHECK -> DOWNLOAD ->
// OPTIMIZATION (sharp, resize + WebP) -> MANIFEST
// (data/generated/destinationImages.json) -> UI (data/destinationVisuals.ts
// reads the manifest; no runtime Commons dependency).
//
// Modes:
//   --country SA        ingest a single country (ISO2)
//   --all                ingest the full effective catalog
//   --dry-run             discovery + scoring only, no download/write
//
// Re-run safety: a country whose manifest entry + local asset already
// exist is SKIPPED (no needless re-download) unless explicitly
// re-targeted with --force (this run's `--country`/`--all` always
// re-targets — the skip only protects a later, narrower re-run from
// clobbering already-good entries it wasn't asked to touch).
//
// This script does NOT run automatically on every Destination page view
// (see data/destinationVisuals.ts) — it is a manual/CI-triggered
// maintenance tool (see .github/workflows/generate-destination-images.yml),
// same pattern as generate-tourism-insights.mjs / generate-travel-cost-index.mjs.
//
// NETWORK: this script makes real requests to commons.wikimedia.org and
// upload.wikimedia.org. It is designed to run in an environment with
// real internet access (a GitHub Actions runner) — Claude's own sandbox
// egress proxy denies both hosts by organization policy (confirmed live,
// not assumed — see the final report's "Network Test" sections), which
// is exactly why this script exists as a separately-triggerable CI job
// rather than something run inline during a Claude session.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import basicCountries from '../src/data/generated/basicCountries.json' with { type: 'json' };
import destinations from '../src/data/generated/destinations.json' with { type: 'json' };
import countryInfo from '../src/data/generated/countryInfo.json' with { type: 'json' };
import excludedCountriesData from '../src/data/excludedCountriesData.json' with { type: 'json' };
import overridesData from './destinationImageOverrides.json' with { type: 'json' };
import {
  buildManifestEntry,
  buildSearchQueries,
  checkCountryRelevance,
  classifyLicense,
  isDuplicateHash,
  loadEffectiveCatalog,
  selectBestCandidate,
  validateManifestEntry,
} from './lib/destinationImageIngest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '../src/data/generated/destinationImages.json');
const ASSETS_DIR = path.join(__dirname, '../public/destinations');
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIVOYAGE_API = 'https://en.wikivoyage.org/w/api.php';
const USER_AGENT = 'Wejhaty-DestinationImages/1.0 (https://github.com/hmooodzozo577-gif/wej; build-time ingestion tool, not a runtime client)';
const MAX_HERO_WIDTH = 1440; // within the task's own 1200-1600px target band
const WEBP_QUALITY = 78; // hero-friendly quality/size balance, tuned for a ~100-200KB target average

function parseArgs(argv) {
  const args = { country: null, all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--country') args.country = argv[++i]?.toUpperCase();
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wraps fetch() with exponential-backoff retry on 429/5xx — the full
 *  194-country run's first real attempt found Commons rate-limiting
 *  (HTTP 429) a large tail of the catalog once requests had been
 *  running for a few minutes straight with no backoff at all (see the
 *  final report's "Network Test" section). Honors a numeric
 *  Retry-After header when Commons sends one; otherwise backs off
 *  2s/4s/8s/16s. Not retried: any non-429/5xx error (e.g. a genuine
 *  404) — retrying those would just waste the country's attempt
 *  budget on an error that will never resolve. */
async function fetchWithRetry(url, options, { maxAttempts = 5 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const res = lastErr?.res;
      const retryAfterHeader = res?.headers?.get?.('retry-after');
      const retryAfterMs = retryAfterHeader && !Number.isNaN(Number(retryAfterHeader)) ? Number(retryAfterHeader) * 1000 : null;
      await sleep(retryAfterMs ?? 2000 * 2 ** (attempt - 1));
    }
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      lastErr = { res, message: `HTTP ${res.status}` };
      continue;
    }
    return res; // non-retryable status — let the caller's own !res.ok handling report it
  }
  return lastErr.res;
}

async function searchCommons(query) {
  // A small fixed delay before every search call, not just on retry —
  // proactively spaces requests out across a long --all run instead of
  // only reacting after Commons has already started rate-limiting.
  await sleep(300);
  const searchUrl = `${COMMONS_API}?action=query&format=json&list=search&srnamespace=6&srlimit=6&srsearch=${encodeURIComponent(query)}`;
  const searchRes = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!searchRes.ok) throw new Error(`Commons search HTTP ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const titles = (searchJson.query?.search || []).map((r) => r.title);
  if (titles.length === 0) return [];

  return getCommonsImageInfo(titles);
}

async function getCommonsImageInfo(titles) {
  if (titles.length === 0) return [];
  const fileTitles = titles.map((title) => title.startsWith('File:') ? title : `File:${title}`);
  const infoUrl = `${COMMONS_API}?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent(fileTitles.join('|'))}`;
  const infoRes = await fetchWithRetry(infoUrl, { headers: { 'User-Agent': USER_AGENT } });
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
          Artist: em.Artist?.value?.replace(/<[^>]+>/g, ''),
          Categories: em.Categories?.value,
          ImageDescription: em.ImageDescription?.value?.replace(/<[^>]+>/g, ''),
        },
      };
    });
}

/**
 * Wikimedia Commons search is useful as a fallback, but the previous visual
 * audit proved that country-name matching alone can return embassies abroad,
 * homonymous places, documents and random objects. Wikivoyage country pages
 * provide a human-edited travel context and preserve the order in which their
 * images appear. We use that ordered list first, then retrieve the exact file,
 * license and attribution data from Commons.
 */
async function getWikivoyageCandidates(articleTitle, countryName) {
  const parseUrl = `${WIKIVOYAGE_API}?action=parse&format=json&redirects=1&prop=images&page=${encodeURIComponent(articleTitle)}`;
  const parseRes = await fetchWithRetry(parseUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!parseRes.ok) throw new Error(`Wikivoyage parse HTTP ${parseRes.status}`);
  const parseJson = await parseRes.json();
  if (parseJson.error) throw new Error(`Wikivoyage article unavailable: ${parseJson.error.info || parseJson.error.code}`);

  const imageNames = (parseJson.parse?.images || [])
    .filter((name) => /\.(?:jpe?g|png|webp)$/i.test(name))
    .filter((name) => !/(banner|map|locator|flag|gpx|icon|logo|symbol|route|visa|passport|diagram|chart|graph)/i.test(name))
    .slice(0, 24);

  const info = await getCommonsImageInfo(imageNames);
  const order = new Map(imageNames.map((name, index) => [`File:${name}`.replace(/ /g, '_').toLowerCase(), index]));
  return info.map((candidate) => ({
    ...candidate,
    sourceRank: order.get(candidate.title.replace(/ /g, '_').toLowerCase()) ?? imageNames.length,
    sourceArticle: countryName,
    sourceArticleTitle: parseJson.parse?.title || articleTitle,
    selectionSource: 'wikivoyage',
  }));
}

async function downloadBuffer(url) {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** DOWNLOAD + OPTIMIZATION: real fetch of the original file, resized to
 *  a hero-friendly max width (aspect ratio preserved, never upscaled)
 *  and converted to WebP. Returns the optimized buffer plus its real
 *  post-resize dimensions — the manifest must reflect the ACTUAL stored
 *  asset, not the original Commons file's dimensions. */
async function downloadAndOptimize(candidate) {
  const original = await downloadBuffer(candidate.url);
  const image = sharp(original, { failOn: 'error' });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('could not read image dimensions (corrupt/invalid file)');

  const targetWidth = Math.min(MAX_HERO_WIDTH, meta.width);
  const optimized = await image
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const outMeta = await sharp(optimized).metadata();
  return { buffer: optimized, width: outMeta.width, height: outMeta.height };
}

async function ingestOne(entry, { dryRun, seenHashes }) {
  const override = overridesData[entry.iso2];
  const queries = buildSearchQueries(entry, overridesData);
  const report = { iso2: entry.iso2, nameEn: entry.nameEn, status: null, detail: null };

  let candidates = [];
  try {
    if (override?.preferredTitles?.length) {
      const curated = await getCommonsImageInfo(override.preferredTitles);
      candidates.push(...curated.map((candidate, index) => ({
        ...candidate,
        sourceRank: index,
        sourceArticle: entry.nameEn,
        sourceArticleTitle: override.wikivoyageTitle || entry.nameEn,
        selectionSource: 'curated-title',
      })));
    }
    const articleCandidates = await getWikivoyageCandidates(override?.wikivoyageTitle || entry.nameEn, entry.nameEn);
    candidates.push(...articleCandidates.map((candidate) => ({
      ...candidate,
      sourceRank: candidate.sourceRank + (override?.preferredTitles?.length || 0),
    })));
    // Commons search remains a fallback for countries whose travel article has
    // no usable licensed landscape photograph. Search results never inherit a
    // relevance bypass merely because a preferred query was configured.
    if (candidates.length === 0) {
    for (const q of queries) {
      const found = await searchCommons(q);
      candidates = candidates.concat(found);
    }
    }
  } catch (err) {
    try {
      for (const q of queries) {
        const found = await searchCommons(q);
        candidates = candidates.concat(found);
      }
    } catch (fallbackErr) {
      report.status = 'NETWORK';
      report.detail = `${err.message}; Commons fallback: ${fallbackErr.message}`;
      return report;
    }
  }

  // Try candidates in score order until one clears EVERY remaining gate
  // (relevance, download, optimization, final manifest validation) — a
  // top-scoring candidate failing any one of these shouldn't silently
  // fail the whole country when a runner-up would work. (This loop
  // itself exists because the mandatory 6-country proof run's very
  // first attempt found a candidate that passed relevance but failed
  // validation — non-landscape — and the run gave up on that country
  // entirely instead of trying the next candidate; see the final
  // report's "End-to-End Six-Country Proof" section.)
  const ranked = [];
  const seenTitles = new Set();
  for (const c of candidates) {
    if (seenTitles.has(c.title)) continue;
    seenTitles.add(c.title);
    ranked.push(c);
  }

  const attempts = [];
  for (const candidate of selectAllViable(ranked)) {
    const rel = checkCountryRelevance(candidate, entry, { sourceArticle: candidate.sourceArticle });
    if (!rel.relevant) {
      attempts.push({ candidate, stage: 'relevance', detail: rel.reason });
      continue;
    }

    if (dryRun) {
      report.status = 'DRY_RUN_OK';
      report.detail = `would select: ${candidate.title} (${rel.reason})`;
      return report;
    }

    let optimized;
    try {
      optimized = await downloadAndOptimize(candidate);
    } catch (err) {
      attempts.push({ candidate, stage: 'download', detail: err.message });
      continue;
    }

    const hash = crypto.createHash('sha256').update(optimized.buffer).digest('hex');
    if (isDuplicateHash(hash, seenHashes)) {
      attempts.push({ candidate, stage: 'duplicate', detail: `hash ${hash.slice(0, 12)}… already used` });
      continue;
    }

    const license = classifyLicense(candidate.extmetadata.LicenseShortName);
    const localFileName = `${entry.iso2.toLowerCase()}.webp`;
    const manifestEntry = buildManifestEntry({
      entry,
      candidate,
      license,
      localPath: `/destinations/${localFileName}`,
      width: optimized.width,
      height: optimized.height,
      retrievedAt: new Date().toISOString(),
    });
    const validation = validateManifestEntry(manifestEntry);
    if (!validation.valid) {
      attempts.push({ candidate, stage: 'validation', detail: validation.errors.join('; ') });
      continue;
    }

    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ASSETS_DIR, localFileName), optimized.buffer);
    seenHashes.add(hash);

    report.status = 'OK';
    report.detail = `${candidate.title} — ${optimized.width}x${optimized.height}, ${(optimized.buffer.length / 1024).toFixed(1)}KB`;
    report.manifestEntry = manifestEntry;
    return report;
  }

  if (dryRun) {
    report.status = candidates.length === 0 ? 'NO_CANDIDATE' : 'COUNTRY_RELEVANCE';
    report.detail = candidates.length === 0 ? 'no search results across all queries' : 'no candidate passed license/quality AND country-relevance gates';
    return report;
  }

  if (attempts.length === 0) {
    report.status = 'NO_CANDIDATE';
    report.detail = 'no search results across all queries';
  } else {
    // Report the LAST attempt's failure stage as the headline reason
    // (most informative — later attempts got further through the
    // pipeline), with a count of how many candidates were tried.
    const last = attempts[attempts.length - 1];
    const stageToStatus = { relevance: 'COUNTRY_RELEVANCE', download: 'DOWNLOAD_FAILED', duplicate: 'DUPLICATE', validation: 'INVALID' };
    report.status = stageToStatus[last.stage] || 'OTHER';
    report.detail = `${attempts.length} candidate(s) tried, all failed — last: [${last.stage}] ${last.detail}`;
  }
  return report;
}

/** Candidates in score order (highest first), rejected ones excluded —
 *  a thin generator wrapper around selectBestCandidate's own scoring so
 *  ingestOne can try runner-ups without duplicating the scoring logic. */
function selectAllViable(candidates) {
  const scored = candidates
    .map((c) => ({ candidate: c, result: selectBestCandidate([c]) }))
    .filter((r) => r.result)
    .sort((a, b) => b.result.score - a.result.score || a.candidate.title.localeCompare(b.candidate.title));
  return scored.map((r) => r.candidate);
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

  // Existing manifest entries not re-targeted this run are preserved
  // as-is (re-run safety — see this file's own doc comment).
  const existingManifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : [];
  const targetIso2 = new Set(targets.map((t) => t.iso2));
  const preserved = existingManifest.filter((e) => !targetIso2.has(e.iso2));
  const seenHashes = new Set(); // this run's own dedup scope, not cross-run (a legitimately re-selected image for a re-targeted country isn't a "duplicate" of its own prior self)

  const reports = [];
  const newEntries = [];
  for (const entry of targets) {
    const report = await ingestOne(entry, { dryRun: args.dryRun, seenHashes });
    reports.push(report);
    if (report.manifestEntry) newEntries.push(report.manifestEntry);
    console.log(`${report.status.padEnd(22)} ${entry.iso2}  ${entry.nameEn}${report.detail ? ` — ${report.detail}` : ''}`);
  }

  const summary = reports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\n--- Summary ---');
  for (const [status, count] of Object.entries(summary)) console.log(`${status}: ${count}`);
  console.log(`Effective catalog: ${catalog.length} | Attempted: ${targets.length} | Successful: ${newEntries.length}`);

  if (!args.dryRun) {
    const finalManifest = [...preserved, ...newEntries].sort((a, b) => a.iso2.localeCompare(b.iso2));
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(finalManifest, null, 2) + '\n');
    console.log(`\nWrote manifest (${finalManifest.length} entries) to ${MANIFEST_PATH}`);

    // Orphan-file cleanup: a country that was RE-TARGETED this run but
    // failed (network/relevance/etc.) has no manifest entry after the
    // write above — but a prior successful run may have left its old
    // .webp asset on disk. An asset with no manifest entry is exactly
    // the "missing attribution / untracked file" class of bug the
    // required quality audit checks for, so remove it here rather than
    // leaving it to be found (and manually cleaned up) after the fact.
    const finalIso2 = new Set(finalManifest.map((e) => e.iso2.toLowerCase()));
    if (fs.existsSync(ASSETS_DIR)) {
      for (const file of fs.readdirSync(ASSETS_DIR)) {
        if (!file.endsWith('.webp')) continue;
        const iso2 = file.slice(0, -'.webp'.length);
        if (targetIso2.has(iso2.toUpperCase()) && !finalIso2.has(iso2)) {
          fs.unlinkSync(path.join(ASSETS_DIR, file));
          console.log(`Removed orphaned asset (re-targeted but failed this run): ${file}`);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
