#!/usr/bin/env node
// Country Intelligence + Purpose Suitability — Phase 11.x/14.x generator.
//
// Deliberately NO network fetch: this reads Wejhaty's own already-fetched,
// already-verified, already-committed snapshots (recommendationIndicators
// .json — which itself joins in the travelCostIndex/tourismInsights
// snapshots, see RECOMMENDATION_INDICATORS.md) and runs the scoring engine
// in app/src/intelligence/ over them. Re-fetching the same World Bank/OWID
// data a second time here would duplicate a working pipeline rather than
// reuse it, and this sandbox's own network egress to those hosts is
// unverified anyway (see TRAVEL_COST_INDEX.md) — reusing the committed
// snapshot is both the more correct architecture and the only thing that
// can actually run right now.
//
// The engine itself lives in app/src/intelligence/*.ts (typed, unit
// tested — see *.test.ts in that folder). This script loads it through
// Vite's own SSR module loader rather than reimplementing the scoring
// logic in plain JS a second time here — reusing the exact tested code,
// not a parallel copy of it that could silently drift from what the tests
// actually cover.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

function writeJsonAtomic(outFile, data) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const json = JSON.stringify(data, null, 2) + '\n';
  const tmpFile = `${outFile}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, json);
  fs.renameSync(tmpFile, outFile);
}

function loadJson(relativeToAppRoot) {
  return JSON.parse(fs.readFileSync(path.join(APP_ROOT, relativeToAppRoot), 'utf8'));
}

async function main() {
  const server = await createServer({ root: APP_ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

  try {
    const { computePurposeSuitability } = await server.ssrLoadModule('/src/intelligence/score.ts');
    const { SUITABLE_PURPOSES } = await server.ssrLoadModule('/src/intelligence/types.ts');
    const { SOURCES } = await server.ssrLoadModule('/src/intelligence/sources.ts');
    const { METHODOLOGIES } = await server.ssrLoadModule('/src/intelligence/methodology.ts');

    const indicatorSnapshot = loadJson('src/data/generated/recommendationIndicators.json');
    const excludedEntries = loadJson('src/data/excludedCountriesData.json');
    const excludedIso2 = new Set(excludedEntries.map((entry) => entry.iso2));

    // Re-applies the exclusion independently at this new layer rather than
    // trusting it was already applied upstream — the established pattern
    // in this repo (each new feature checks IL/ISR itself; see
    // worker/src/visa.ts, worker/src/cityDescriptions.ts,
    // generate-travel-cost-index.mjs).
    const effectiveEntries = indicatorSnapshot.entries.filter((entry) => !excludedIso2.has(entry.countryCode));

    const countries = effectiveEntries.map((entry) => ({
      countryCode: entry.countryCode,
      observations: {
        urbanPopulationPct: entry.indicators.urbanPopulationPct,
        incomePerCapitaPpp: entry.indicators.incomePerCapitaPpp,
        unemploymentPct: entry.indicators.unemploymentPct,
        lifeExpectancy: entry.indicators.lifeExpectancy,
        healthSpendPerCapita: entry.indicators.healthSpendPerCapita,
        tertiaryEnrollmentPct: entry.indicators.tertiaryEnrollmentPct,
        fdiPctGdp: entry.indicators.fdiPctGdp,
        gdpGrowthPct: entry.indicators.gdpGrowthPct,
        homicideRate: entry.indicators.homicideRate,
        priceLevelIndex: entry.priceLevelIndex,
        tourismArrivals: entry.tourismArrivals,
      },
    }));

    if (countries.length === 0) throw new Error('No countries loaded from recommendationIndicators.json — refusing to generate an empty dataset.');

    const updatedAt = new Date().toISOString();
    /** @type {Map<string, Map<string, any>>} */
    const byPurpose = new Map();
    for (const purpose of SUITABLE_PURPOSES) {
      byPurpose.set(purpose, computePurposeSuitability(purpose, countries, updatedAt));
    }

    // --- Output 1: compact summary for the frontend bundle ---
    const summaryEntries = [];
    for (const purpose of SUITABLE_PURPOSES) {
      for (const result of byPurpose.get(purpose).values()) {
        summaryEntries.push({
          countryCode: result.countryCode,
          purpose: result.purpose,
          modelVersion: result.modelVersion,
          score: result.score,
          insufficientData: result.insufficientData,
          coverage: result.coverage,
          confidence: result.confidence,
          updatedAt: result.updatedAt,
        });
      }
    }

    // --- Output 2: full per-component/source detail for the Worker's
    //     "Why this score?" endpoint and the admin coverage panel ---
    const detailEntries = [];
    for (const purpose of SUITABLE_PURPOSES) {
      for (const result of byPurpose.get(purpose).values()) detailEntries.push(result);
    }

    // --- Output 3: coverage/audit report (task 3.14/3.28) ---
    const byPurposeReport = {};
    for (const purpose of SUITABLE_PURPOSES) {
      const results = [...byPurpose.get(purpose).values()];
      const sufficient = results.filter((result) => !result.insufficientData);
      const insufficient = results.filter((result) => result.insufficientData);
      byPurposeReport[purpose] = {
        modelVersion: METHODOLOGIES[purpose].modelVersion,
        totalCountries: results.length,
        sufficientDataCount: sufficient.length,
        insufficientDataCount: insufficient.length,
        sufficientDataPct: Math.round((sufficient.length / results.length) * 100),
        confidenceHighCount: results.filter((result) => result.confidence === 'high').length,
        confidenceMediumCount: results.filter((result) => result.confidence === 'medium').length,
        averageCoverage: Math.round(results.reduce((sum, result) => sum + result.coverage, 0) / results.length),
        insufficientDataCountries: insufficient.map((result) => result.countryCode).sort(),
        // Per-factor observation counts — which indicators are the actual
        // gap, not just an aggregate coverage number.
        factorObservationCounts: Object.fromEntries(
          METHODOLOGIES[purpose].factors.map((factor) => [
            factor.key,
            results.filter((result) => result.components.find((c) => c.factor === factor.key)?.status === 'observed').length,
          ]),
        ),
      };
    }
    const coverageReport = {
      generatedAt: updatedAt,
      totalEffectiveCountries: countries.length,
      purposesScored: SUITABLE_PURPOSES,
      purposesExcluded: [{ purpose: 'other', reason: 'Catch-all fallback purpose with no defined identity (pScoreKey: null) — no methodology to build.' }],
      byPurpose: byPurposeReport,
    };

    // --- Safety checks before writing (task 3.18 — validate before
    //     replacing production data) ---
    if (summaryEntries.length !== countries.length * SUITABLE_PURPOSES.length) {
      throw new Error(`Summary entry count mismatch: expected ${countries.length * SUITABLE_PURPOSES.length}, got ${summaryEntries.length}`);
    }
    for (const entry of summaryEntries) {
      if (entry.countryCode === 'IL') throw new Error('Excluded country IL leaked into the generated output.');
      if (entry.score !== null && (entry.score < 0 || entry.score > 100 || !Number.isFinite(entry.score))) {
        throw new Error(`Score out of bounds for ${entry.countryCode}/${entry.purpose}: ${entry.score}`);
      }
    }

    writeJsonAtomic(path.join(APP_ROOT, 'src/data/generated/countryIntelligence.json'), {
      generatedAt: updatedAt,
      modelVersions: Object.fromEntries(SUITABLE_PURPOSES.map((purpose) => [purpose, METHODOLOGIES[purpose].modelVersion])),
      entries: summaryEntries,
    });

    writeJsonAtomic(path.join(REPO_ROOT, 'worker/src/generated/countryIntelligenceDetail.json'), {
      generatedAt: updatedAt,
      sources: SOURCES,
      methodologies: METHODOLOGIES,
      entries: detailEntries,
    });

    writeJsonAtomic(path.join(APP_ROOT, 'scripts/countryIntelligenceCoverage.json'), coverageReport);

    console.log(`Country Intelligence generated: ${countries.length} countries x ${SUITABLE_PURPOSES.length} purposes = ${summaryEntries.length} scores.`);
    for (const purpose of SUITABLE_PURPOSES) {
      const report = byPurposeReport[purpose];
      console.log(`  ${purpose} (${report.modelVersion}): ${report.sufficientDataCount}/${report.totalCountries} sufficient (${report.sufficientDataPct}%), avg coverage ${report.averageCoverage}%`);
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
