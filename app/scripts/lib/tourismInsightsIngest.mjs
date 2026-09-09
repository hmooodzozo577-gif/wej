// Phase 13.5d — Destination Tourism Insights: pure ingestion pipeline
// (parse -> normalize -> validate -> serialize), separate from network
// fetching so it is unit-testable with fixtures — mirrors
// scripts/lib/travelCostIndexIngest.mjs's own structure. Reuses that
// module's parseWorldBankResponse() as-is (it is generic to the World
// Bank [metadata, rows] response shape, not specific to any indicator)
// rather than duplicating it.
//
// SOURCE: World Bank Indicators API — ST.INT.ARVL ("International
// tourism, number of arrivals") and ST.INT.RCPT.CD ("International
// tourism, receipts (current US$)"), both World Development
// Indicators, UNWTO-sourced. Live-verified via a real GitHub Actions
// run (this sandboxed dev environment's own network egress is blocked
// to worldbank.org): BOTH indicators return real HTTP-success data for
// 2015-2020 with no gaps (USA, France checked directly with mrv=6) —
// they are NOT archived like PA.NUS.PPPC.RF was. But neither has a
// single observation newer than 2020, even though the API's own
// metadata "lastupdated" field is recent — World Bank's WDI has simply
// not received a newer UNWTO tourism update since. 2020 itself is kept
// as a real historical observation (the pandemic collapse), never
// dropped or "smoothed" — see app/scripts/TOURISM_INSIGHTS.md.
//
// COUNTRY-CODE JOIN / EXCLUSION: same principle as
// travelCostIndexIngest.mjs — `validCountryCodes` must be the app's
// real EFFECTIVE catalog country codes (exclusions already applied),
// which is what keeps Israel (IL/ISR) out and naturally filters World
// Bank's aggregate/region pseudo-codes without a hand-maintained
// blocklist.
import { parseWorldBankResponse } from './travelCostIndexIngest.mjs';

export { parseWorldBankResponse };

/** Same conservative-floor rationale as travelCostIndexIngest.mjs's own
 *  MIN_COVERAGE_RATIO, but lower: UNWTO tourism reporting has
 *  meaningfully sparser country coverage than World Bank's own PLI
 *  series (many small states / non-reporting economies never publish
 *  arrivals or receipts at all) — confirmed by the real ingestion run
 *  reported in TOURISM_INSIGHTS.md. 0.3 still guards against a
 *  garbled/truncated response being accepted as real. */
export const MIN_COVERAGE_RATIO = 0.3;

const YEAR_RE = /^[0-9]{4}$/;

/** Normalizes ONE indicator's raw World Bank rows into a Map of
 *  countryCode -> TourismObservation[] (unsorted), plus what was
 *  rejected and why. Keeps every valid (period, value) pair per
 *  country — this is deliberately NOT the same shape as
 *  travelCostIndexIngest.mjs's normalizeRows() (which keeps only the
 *  single most-recent value per country): a tourism trend needs the
 *  whole historical series, not just the latest point. Rejects (never
 *  silently drops) a duplicate (country, period) pair — same
 *  determinism principle as the travel-cost pipeline's duplicate
 *  handling, keeping the first occurrence in input order. */
export function normalizeSeriesRows(rawRows, validCountryCodes) {
  const validSet = new Set(validCountryCodes);
  const byCountry = new Map();
  const seenPeriods = new Map(); // countryCode -> Set(period)
  const rejected = [];

  for (const row of rawRows) {
    const countryCode = row?.country?.id;
    const period = row?.date;
    const value = row?.value;

    if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/.test(countryCode)) {
      rejected.push({ row, reason: 'missing_or_malformed_country_code' });
      continue;
    }
    if (!validSet.has(countryCode)) {
      rejected.push({ row, reason: 'not_in_effective_catalog' });
      continue;
    }
    if (typeof period !== 'string' || !YEAR_RE.test(period)) {
      rejected.push({ row, reason: 'missing_or_malformed_period' });
      continue;
    }
    if (value === null || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      // World Bank represents "no observation" as value: null for that
      // row rather than omitting the row — this is the expected,
      // frequent, non-error case for a period a country hasn't
      // reported, not a malformed response.
      rejected.push({ row, reason: value === null ? 'no_observation' : 'invalid_numeric_value' });
      continue;
    }

    const periodsForCountry = seenPeriods.get(countryCode) ?? new Set();
    if (periodsForCountry.has(period)) {
      rejected.push({ row, reason: 'duplicate_country_period' });
      continue;
    }
    periodsForCountry.add(period);
    seenPeriods.set(countryCode, periodsForCountry);

    const obs = byCountry.get(countryCode) ?? [];
    obs.push({ period, value });
    byCountry.set(countryCode, obs);
  }

  return { byCountry, rejected };
}

/** Merges the two per-indicator country maps (from normalizeSeriesRows,
 *  called once per indicator) into the final DestinationTourismEntry[]
 *  shape. A country with data in EITHER series gets an entry; a series
 *  with zero observations for that country is simply omitted (never an
 *  empty array masquerading as "checked, found nothing" vs "never
 *  checked" — both cases just don't have the key). Each series is
 *  sorted by period ascending — deterministic and chart-ready. */
export function buildEntries(arrivalsByCountry, receiptsByCountry) {
  const countryCodes = new Set([...arrivalsByCountry.keys(), ...receiptsByCountry.keys()]);
  const entries = [];

  for (const countryCode of countryCodes) {
    const entry = { countryCode };
    const arrivals = arrivalsByCountry.get(countryCode);
    const receiptsUsd = receiptsByCountry.get(countryCode);
    if (arrivals && arrivals.length > 0) {
      entry.arrivals = [...arrivals].sort((a, b) => a.period.localeCompare(b.period));
    }
    if (receiptsUsd && receiptsUsd.length > 0) {
      entry.receiptsUsd = [...receiptsUsd].sort((a, b) => a.period.localeCompare(b.period));
    }
    entries.push(entry);
  }

  entries.sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  return entries;
}

/** Validates the final entry list before it is allowed to become the
 *  new committed snapshot. Returns { ok, errors }; never throws. */
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

    if (!entry.arrivals && !entry.receiptsUsd) {
      errors.push(`entry for ${entry.countryCode} has neither series — should have been omitted entirely`);
    }
    for (const [seriesName, series] of [
      ['arrivals', entry.arrivals],
      ['receiptsUsd', entry.receiptsUsd],
    ]) {
      if (!series) continue;
      const periods = new Set();
      for (const obs of series) {
        if (!YEAR_RE.test(obs.period)) errors.push(`invalid period for ${entry.countryCode}.${seriesName}: ${obs.period}`);
        if (!Number.isFinite(obs.value) || obs.value < 0) {
          errors.push(`invalid value for ${entry.countryCode}.${seriesName}[${obs.period}]: ${obs.value}`);
        }
        if (periods.has(obs.period)) errors.push(`duplicate period for ${entry.countryCode}.${seriesName}: ${obs.period}`);
        periods.add(obs.period);
      }
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
 *  is injected by the caller so this stays pure and testable. */
export function buildSnapshot(entries, sourceIndicators, generatedAtIso) {
  return {
    snapshotUpdatedAt: generatedAtIso,
    sourceIndicators,
    entries,
  };
}

/** Deterministic JSON serialization — same rationale as
 *  travelCostIndexIngest.mjs's serializeSnapshot(). */
export function serializeSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}
