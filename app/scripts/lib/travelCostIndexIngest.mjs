// Phase 13.5c — Dynamic Travel Cost Index: pure ingestion pipeline
// (parse -> normalize -> validate -> serialize), deliberately separate
// from network fetching so it is unit-testable with fixtures and never
// needs a live connection to run in CI/test (see
// travelCostIndexIngest.test.ts). generate-travel-cost-index.mjs is the
// only file in this pair that touches the network.
//
// SOURCE: World Bank Indicators API, indicator PA.NUS.PPPC.RF ("Price
// level ratio of PPP conversion factor to market exchange rate", part of
// the International Comparison Program / ICP). A value of 1.0 means the
// same general price level as the United States (the indicator's own
// reference point) — NOT an OECD=100-style index. See
// ../TRAVEL_COST_INDEX.md for the full source/semantics writeup.
//
// COUNTRY-CODE JOIN / EXCLUSION: `validCountryCodes` must be the app's
// real EFFECTIVE catalog countryCodes (i.e. WORLD_CATALOG's, with
// excludedCountries.ts's exclusions already applied) — never the raw
// world-countries/ISO list. Passing that set in is what keeps an
// excluded country (Israel, IL/ISR) out of the generated snapshot even
// though the World Bank dataset itself contains it, and is also what
// naturally filters WB's non-country aggregate rows (region/income-group
// pseudo-codes like "1A", "OE", "Z4") without any hand-maintained
// blocklist — they simply never match a real catalog countryCode.

/** Minimum fraction of the effective catalog that must be matched for a
 *  snapshot to be considered valid — guards against a garbled/truncated
 *  API response being accepted as "real" data. 0.5 is a deliberately
 *  conservative floor: the World Bank ICP round does not cover every
 *  country, so 100% coverage is never expected, but a well-formed
 *  response for this indicator has historically covered a large
 *  majority of economies with market exchange rates. */
export const MIN_COVERAGE_RATIO = 0.5;

/** Centralized, documented, tested classification thresholds for
 *  ratioToUS -> TravelCostTier. 1.0 = same general price level as the
 *  US (the source indicator's own reference point). Boundaries chosen
 *  so the tiers split roughly evenly across the real-world spread of
 *  published ICP price-level ratios (very low-income economies down
 *  near ~0.2-0.3, up to high-cost economies like Switzerland/Norway
 *  above ~1.3) — illustrative, not derived from a formula, and meant to
 *  be revisited if real data shows a materially different distribution. */
export const CLASSIFICATION_THRESHOLDS = {
  low: 0.6, // ratioToUS < 0.6 -> 'low'
  moderate: 0.9, // 0.6 <= ratioToUS < 0.9 -> 'moderate'
  high: 1.15, // 0.9 <= ratioToUS < 1.15 -> 'high'
  // ratioToUS >= 1.15 -> 'veryHigh'
};

/** Pure, deterministic: same ratioToUS always returns the same tier. */
export function classifyRatioToUS(ratioToUS) {
  if (ratioToUS < CLASSIFICATION_THRESHOLDS.low) return 'low';
  if (ratioToUS < CLASSIFICATION_THRESHOLDS.moderate) return 'moderate';
  if (ratioToUS < CLASSIFICATION_THRESHOLDS.high) return 'high';
  return 'veryHigh';
}

/** Parses a raw World Bank Indicators API JSON body (format=json) into
 *  its data-row array. The API returns `[metadata, rows]`; `rows` is
 *  null when the query matched nothing. Throws a descriptive Error on a
 *  structurally unexpected body (never silently returns something the
 *  caller could mistake for real rows). */
export function parseWorldBankResponse(body) {
  if (!Array.isArray(body) || body.length < 2) {
    throw new Error('Unexpected World Bank response shape: expected a [metadata, rows] array.');
  }
  const rows = body[1];
  if (rows === null) return [];
  if (!Array.isArray(rows)) {
    throw new Error('Unexpected World Bank response shape: rows is not an array.');
  }
  return rows;
}

/** Normalizes raw World Bank rows into TravelCostIndexEntry objects,
 *  keeping only rows whose country id matches `validCountryCodes`
 *  (the app's effective catalog — see module doc comment) and whose
 *  value is a finite, positive number. Returns both what was accepted
 *  and why anything was rejected, for the CLI's reporting and for tests.
 *  Deterministic: sorts accepted entries by countryCode, and — if the
 *  same (already-valid) country code somehow appears twice — keeps only
 *  the first occurrence in input order, rejecting the rest as
 *  duplicates, rather than silently overwriting. */
export function normalizeRows(rawRows, validCountryCodes) {
  const validSet = new Set(validCountryCodes);
  const accepted = [];
  const rejected = [];
  const seen = new Set();

  for (const row of rawRows) {
    const countryCode = row?.country?.id;
    const value = row?.value;
    const sourcePeriod = row?.date;

    if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/.test(countryCode)) {
      rejected.push({ row, reason: 'missing_or_malformed_country_code' });
      continue;
    }
    if (!validSet.has(countryCode)) {
      rejected.push({ row, reason: 'not_in_effective_catalog' });
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      rejected.push({ row, reason: 'invalid_numeric_value' });
      continue;
    }
    if (typeof sourcePeriod !== 'string' || sourcePeriod.length === 0) {
      rejected.push({ row, reason: 'missing_source_period' });
      continue;
    }
    if (seen.has(countryCode)) {
      rejected.push({ row, reason: 'duplicate_country_code' });
      continue;
    }
    seen.add(countryCode);
    accepted.push({ countryCode, ratioToUS: value, sourcePeriod });
  }

  accepted.sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  return { accepted, rejected };
}

/** Validates a normalized entry list before it is allowed to become the
 *  new committed snapshot. Returns { ok, errors }; never throws — the
 *  caller (the CLI script) decides what to do with a failing result
 *  (exit non-zero, keep the previous snapshot untouched). */
export function validateEntries(entries, effectiveCatalogSize, excludedCountryCodes) {
  const errors = [];

  if (entries.length === 0) {
    errors.push('zero entries after normalization');
  }

  const coverage = effectiveCatalogSize > 0 ? entries.length / effectiveCatalogSize : 0;
  if (coverage < MIN_COVERAGE_RATIO) {
    errors.push(
      `coverage ${entries.length}/${effectiveCatalogSize} (${(coverage * 100).toFixed(1)}%) is below the minimum ${(MIN_COVERAGE_RATIO * 100).toFixed(0)}%`,
    );
  }

  const codes = new Set();
  for (const entry of entries) {
    if (codes.has(entry.countryCode)) errors.push(`duplicate country code in final entries: ${entry.countryCode}`);
    codes.add(entry.countryCode);

    if (!Number.isFinite(entry.ratioToUS) || entry.ratioToUS <= 0) {
      errors.push(`invalid ratioToUS for ${entry.countryCode}: ${entry.ratioToUS}`);
    }
    if (typeof entry.sourcePeriod !== 'string' || entry.sourcePeriod.length === 0) {
      errors.push(`missing sourcePeriod for ${entry.countryCode}`);
    }
  }

  for (const excluded of excludedCountryCodes ?? []) {
    if (codes.has(excluded)) {
      errors.push(`excluded country code present in entries: ${excluded}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Builds the final, committed-snapshot-shaped object. `generatedAtIso`
 *  is injected by the caller (not computed here) so this stays pure and
 *  trivially testable with a fixed value. */
export function buildSnapshot(entries, sourceIndicator, generatedAtIso) {
  return {
    snapshotUpdatedAt: generatedAtIso,
    sourceIndicator,
    entries,
  };
}

/** Deterministic JSON serialization (stable key order via buildSnapshot's
 *  own object literal order + entries already sorted by countryCode in
 *  normalizeRows) — two runs against the same input produce byte-
 *  identical output, which keeps snapshot diffs meaningful. */
export function serializeSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}
