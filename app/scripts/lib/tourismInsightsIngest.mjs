// Phase 13.5d — Destination Tourism Insights: pure ingestion pipeline
// (parse -> normalize -> validate -> serialize), separate from network
// fetching so it is unit-testable with fixtures.
//
// SOURCE CORRECTION (tourism-freshness pass): originally World Bank
// ST.INT.ARVL/ST.INT.RCPT.CD (still live, but live-verified frozen at
// 2020 — see the git history of this file). Migrated to **Our World in
// Data**'s grapher CSVs (`international-tourist-trips` for arrivals,
// `spending-by-international-visitors-while-visiting-a-country` for
// receipts) — both UN Tourism-sourced, CC BY licensed, explicitly
// designed for bulk/API reuse, and live-verified via a real GitHub
// Actions run to have real observations through **2024** (Saudi Arabia
// and Japan checked directly) — genuinely current, not fabricated.
// parseWorldBankResponse() (still used by travelCostIndexIngest.mjs,
// unaffected) does not apply to this CSV-shaped source; parseOwidCsv()
// below is this source's own minimal parser.
//
// COUNTRY-CODE JOIN / EXCLUSION: same principle as
// travelCostIndexIngest.mjs — `validCountryCodes` must be the app's
// real EFFECTIVE catalog country codes (ISO2, exclusions already
// applied), which is what keeps Israel (IL/ISR) out. OWID's CSV rows
// use ISO3 codes (`Code` column) — generate-tourism-insights.mjs maps
// ISO3->ISO2 via the already-installed `world-countries` package (no
// new dependency) before calling normalizeSeriesRows() below, and OWID's
// own region/aggregate rows (e.g. "World", "Asia" with no real ISO3 in
// that column) are filtered out by that same join, with no hand-
// maintained blocklist.

/** Minimal CSV row parser — handles double-quoted fields (with embedded
 *  commas or escaped `""` quotes), since some OWID entity names contain
 *  commas (e.g. "Korea, Rep."). Deliberately not a general CSV library
 *  (no new dependency for one well-defined column shape): returns an
 *  array of arrays, header row included as returned[0]. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const lines = text.split(/\r\n|\n/);
  for (const line of lines) {
    if (line.length === 0 && !inQuotes && rows.length > 0 && row.length === 0 && field === '') continue;
    let i = 0;
    if (!inQuotes) {
      row = [];
      field = '';
    }
    while (i < line.length) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        if (ch === '"') {
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (inQuotes) {
      // Embedded newline inside a quoted field — join with the next line.
      field += '\n';
      continue;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

/** Parses an OWID grapher CSV (header: Entity,Code,Year,<value column>[,...])
 *  into the same raw-row shape normalizeSeriesRows() already expects
 *  ({ country: { id }, date, value }), using an injected iso3->iso2 map
 *  so this stays a pure, fixture-testable function with no dependency
 *  on the `world-countries` package itself. Only columns 0-3 (Entity,
 *  Code, Year, first value column) are used; any further columns (e.g.
 *  OWID's own "World region" annotation) are ignored. Rows whose Code
 *  has no entry in `iso3ToIso2` (OWID's own region/aggregate rows, or a
 *  territory this app's catalog doesn't track) are simply skipped here
 *  — normalizeSeriesRows() also independently re-checks catalog
 *  membership, so this is not the only guard. */
export function parseOwidCsv(text, iso3ToIso2) {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const rows = [];
  for (const cols of table.slice(1)) {
    const [, iso3, year, rawValue] = cols;
    if (!iso3) continue;
    const iso2 = iso3ToIso2.get(iso3);
    if (!iso2) continue;
    const value = rawValue === '' || rawValue === undefined ? null : Number(rawValue);
    rows.push({ country: { id: iso2 }, date: year, value });
  }
  return rows;
}

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
