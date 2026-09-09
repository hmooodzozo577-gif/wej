# Dynamic Travel Cost Index (Phase 13.5c)

## What this is

A build-time-generated, committed snapshot of general country-level price
levels, additive to (never replacing) the existing static
`Destination.costLevel`. Used by `TravelCostIndexInfo.tsx` on the
destination detail page.

## Authoritative source

World Bank Indicators API, indicator **`PA.NUS.GDP.PLI`** — "Price level
index (GDP)", World Development Indicators, sourced from the International
Comparison Program (ICP). Public, no authentication required.

### Indicator correction (Phase 13.5c completion pass)

The originally-assumed indicator, `PA.NUS.PPPC.RF` ("Price level ratio of
PPP conversion factor (GDP) to market exchange rate"), is still listed in
the World Bank's general indicator catalog metadata, but its own data
endpoint now returns an error ("The indicator was not found. It may have
been deleted or archived.") — confirmed live via a real GitHub Actions run
against the actual API, including with zero extra query parameters, which
rules out a request-shape bug and confirms genuine server-side archival.

`PA.NUS.GDP.PLI` is the live, currently-serving replacement with equivalent
semantics (still WDI/ICP-derived, still "how expensive is this country in
general") on a **100-baseline scale** rather than the old ~1.0-baseline
ratio. Also confirmed live via GitHub Actions: `USA`, `date: "2025"`,
`mrv=1` returns exactly `value: 100`, validating the documented US=100
baseline.

This sandboxed dev environment's own network egress is blocked to
`api.worldbank.org` (direct `curl`/`fetch` from here fails); GitHub-hosted
Actions runners have separate, unrestricted network access and are the
verification path used above.

## What the number means — and does NOT mean

`priceLevelIndex` is that indicator's value **as published**: 100 means
"the same general price level as the United States" (the indicator's own
reference point). Above 100 = more expensive than the US, below 100 =
cheaper.

It is a **general economy-wide price level estimate**. It is **not**:

- a hotel nightly price
- a food price
- a tourist daily budget
- a live booking/availability figure
- a currency conversion of any kind

`TravelCostIndexInfo.tsx`'s disclaimer copy (EN/AR) says this explicitly
on every render.

## Pipeline

```
World Bank API (network)
        |  generate-travel-cost-index.mjs (fetch only)
        v
parseWorldBankResponse -> normalizeRows -> validateEntries -> serializeSnapshot
        |  scripts/lib/travelCostIndexIngest.mjs (pure, unit-tested with fixtures)
        v
src/data/generated/travelCostIndex.json  (committed snapshot)
        |
        v
src/data/travelCostIndex.ts  (lazy-loaded read + classifyPriceLevelIndex)
        |
        v
TravelCostIndexInfo.tsx / AccommodationInfo.tsx-adjacent UI
```

The React app never calls World Bank/OECD/IMF directly, at build time or
at runtime. The site works with a stale (or never-yet-generated) snapshot.

## Update command

```
node scripts/generate-travel-cost-index.mjs
```

Same convention as `generate-airports.mjs`/`generate-world-countries.mjs`
for running it manually. Since the completion pass this is also run
automatically — see "Automation" below.

## Snapshot shape

```json
{
  "snapshotUpdatedAt": "2026-01-01T00:00:00.000Z" or null,
  "sourceIndicator": "PA.NUS.GDP.PLI",
  "entries": [{ "countryCode": "JP", "priceLevelIndex": 132, "sourcePeriod": "2023" }]
}
```

- `snapshotUpdatedAt`: when this FILE was generated. `null` if the
  updater has never successfully run (its shipped default).
- `entries[].sourcePeriod`: the year the SOURCE OBSERVATION is for — an
  annual/periodic dataset, deliberately not implied to be "measured
  today".

## Failure / fallback behavior

- The updater validates before writing: non-empty, ≥50% coverage of the
  app's effective catalog, no NaN/Infinity/≤0 values, no duplicate
  country codes, no excluded country code present. On any failure it
  exits non-zero and **does not touch** the existing committed snapshot
  (atomic temp-file + rename write).
- At runtime, `getTravelCostIndex()` returns `undefined` — never a
  guess — when: the snapshot fails to load, has no entry for a country,
  or that country is excluded. Callers (`TravelCostIndexInfo.tsx`) render
  nothing in that case; `AccommodationInfo.tsx`'s own existing
  `costLevel`-based guidance is untouched and keeps working regardless.

## Exclusion (Israel / IL / ISR)

Enforced in three independent layers:

1. `generate-travel-cost-index.mjs` only accepts rows whose country code
   is in the app's effective catalog (derived from the same generated
   `destinations.json`/`basicCountries.json` already used elsewhere, with
   the shared exclusion list applied) — Israel can never enter the
   committed snapshot even though the World Bank dataset contains it.
2. `validateEntries()` explicitly fails the whole snapshot if an
   excluded code is somehow present.
3. `getTravelCostIndex()` itself checks `isExcludedIso2()` before any
   lookup, independent of the above.

`app/src/data/excludedCountries.ts` remains the runtime source of truth
for the app's effective catalog. The list of excluded countries itself
lives in `app/src/data/excludedCountriesData.json` — a plain JSON file
imported identically by `excludedCountries.ts` (TS runtime) and by
`generate-travel-cost-index.mjs` (plain Node ESM, via a `type: "json"`
import assertion), so there is exactly one hand-maintained exclusion list,
never a hardcoded mirror in this script.

## Automation

`.github/workflows/update-travel-cost-index.yml` runs this pipeline
monthly (`cron: '0 3 1 * *'`) and on-demand (`workflow_dispatch`). It:

1. Checks out the repo, installs `app/`'s dependencies, and runs the
   ingestion unit tests (fixtures only, no network) as a pre-flight gate.
2. Runs `node scripts/generate-travel-cost-index.mjs` — the only
   network-touching step. A failure here (fetch, malformed response,
   insufficient coverage, an excluded code present) fails the job and
   leaves the committed snapshot untouched; nothing downstream runs.
3. Uploads the generated snapshot as a workflow artifact for inspection.
4. Diffs the snapshot against the committed one; if unchanged, stops
   (no-op run, no PR).
5. If changed, opens a pull request from a fresh per-run branch
   (`update-travel-cost-index-<run id>`) using the GitHub CLI with the
   built-in `GITHUB_TOKEN` — never a direct push to the target branch,
   never a force push, never a reused branch.

Permissions are least-privilege (`contents: write`, `pull-requests:
write` — nothing else), and only first-party GitHub Actions are used
(`actions/checkout`, `actions/setup-node`, `actions/upload-artifact` —
the same ones `deploy-pages.yml` already uses).
