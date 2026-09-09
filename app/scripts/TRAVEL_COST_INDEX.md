# Dynamic Travel Cost Index (Phase 13.5c)

## What this is

A build-time-generated, committed snapshot of general country-level price
levels, additive to (never replacing) the existing static
`Destination.costLevel`. Used by `TravelCostIndexInfo.tsx` on the
destination detail page.

## Authoritative source

World Bank Indicators API, indicator **`PA.NUS.PPPC.RF`** — "Price level
ratio of PPP conversion factor to market exchange rate", sourced from the
International Comparison Program (ICP). Public, no authentication
required.

## What the number means — and does NOT mean

`ratioToUS` is that indicator's value **as published**: 1.0 means "the
same general price level as the United States" (the indicator's own
reference point — this is **not** an OECD=100-style index, and this
project does not rescale it to one).

It is a **general economy-wide price level estimate**. It is **not**:

- a hotel nightly price
- a food price
- a tourist daily budget
- a live booking/availability figure

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
src/data/travelCostIndex.ts  (lazy-loaded read + classifyRatioToUS)
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

Run manually — same convention as `generate-airports.mjs`/
`generate-world-countries.mjs`. There is no scheduled GitHub Action for
this (see "Automation" below).

## Snapshot shape

```json
{
  "snapshotUpdatedAt": "2026-01-01T00:00:00.000Z" or null,
  "sourceIndicator": "PA.NUS.PPPC.RF",
  "entries": [{ "countryCode": "JP", "ratioToUS": 1.32, "sourcePeriod": "2023" }]
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
   `destinations.json`/`basicCountries.json` already used elsewhere,
   with a static IL mirror applied) — Israel can never enter the
   committed snapshot even though the World Bank dataset contains it.
2. `validateEntries()` explicitly fails the whole snapshot if an
   excluded code is somehow present.
3. `getTravelCostIndex()` itself checks `isExcludedIso2()` before any
   lookup, independent of the above.

`app/src/data/excludedCountries.ts` remains the single source of truth
for the app's effective catalog; nothing here duplicates or overrides it.

## Automation

No scheduled GitHub Action was added. This repository's existing
generated-data scripts (`generate-airports.mjs`, `generate-world-
countries.mjs`) are all run manually by a maintainer, not via CI — this
follows that same convention rather than introducing new scheduled-
workflow write permissions for an annual/periodic dataset that does not
need daily refreshing. A maintainer with network access runs the command
above and commits the result like any other generated-data update. If
automatic updates are wanted later, the safest next step is a scheduled
workflow that runs the updater and opens a PR with the diff (never a
direct push) — the updater's own fetch/validate separation already
supports that without further changes.
