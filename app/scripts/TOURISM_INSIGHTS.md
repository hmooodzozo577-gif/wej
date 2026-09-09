# Destination Tourism Insights (Phase 13.5d)

## What this is

A build-time-generated, committed snapshot of real historical tourism
statistics (international arrivals, tourism receipts), shown on the
destination page as `TourismInsights.tsx` — a separate concept from the
Travel Cost Index (`TRAVEL_COST_INDEX.md`): different source, different
units (headcounts/USD, not a price-level index), never combined on one
chart or axis.

## Source evaluation — original (World Bank) and the freshness correction

**Original source (Phase 13.5d initial pass):** World Bank
`ST.INT.ARVL` ("International tourism, number of arrivals") and
`ST.INT.RCPT.CD` ("International tourism, receipts (current US$)"),
both World Development Indicators, UNWTO-sourced. Live-verified via a
real GitHub Actions run: both indicators return real HTTP-success
data (not archived like `PA.NUS.PPPC.RF` was), but — confirmed
directly, not assumed — **neither has a single observation newer than
2020**, even though the API's own response metadata `lastupdated`
field is recent. This is World Bank WDI's own well-known freeze of its
UNWTO-sourced tourism series after 2020, not a Wejhaty staleness bug.

**Freshness correction (tourism-freshness pass):** the 2020 ceiling
made the section look outdated for current-tourism intelligence.
Re-investigated per priority order (UN Tourism first, then World Bank,
then OECD, then other): UN Tourism's own statistics database is
current (dashboard last updated mid-2026) but its bulk API access is
not confirmed free/self-service. **Our World in Data** republishes the
same UN Tourism series as public, CC BY-licensed, no-auth grapher
CSVs, explicitly designed for bulk/API reuse (each chart has a stable
`.csv` and `.metadata.json` endpoint) — a legitimate, licensed,
machine-readable redistribution channel for UN Tourism data, not a
blog/scrape/estimate.

Live-verified via a real GitHub Actions run: both
`international-tourist-trips` (arrivals) and
`spending-by-international-visitors-while-visiting-a-country`
(receipts) have real observations through **2024** — checked directly
for Saudi Arabia (arrivals: 29.7M in 2024; receipts: $46.3B in 2024)
and Japan. `.metadata.json` confirms `"citationLong":"UN Tourism
(2025) – processed by Our World in Data"`, `timespan: "1995-2024"`,
`lastUpdated: "2026-01-21"`, `nextUpdate: "2027-01-21"` — a real,
versioned, annually-refreshed dataset, not a one-off scrape.
`generate-tourism-insights.mjs` now fetches these two CSVs; ISO3
country codes (OWID's `Code` column) are mapped to this app's ISO2
codes via the already-installed `world-countries` package (no new
dependency). If World Bank's own indicators ever resume publishing
more recent data, that's a separate future re-evaluation — OWID is the
selected source for now because it is demonstrably fresher and
equally licensed/machine-readable.

The real 2020 pandemic collapse (e.g. Saudi Arabia arrivals: 17.5M in
2019 → 4.1M in 2020) remains in the historical series exactly as
published — never dropped, "smoothed", or treated as an error; 2021's
partial recovery and 2022-2024's real rebound are now visible too.

### Chart library evaluation

No charting library is installed in this project (checked
`app/package.json`). A single line-chart requirement does not justify
adding one: `TourismLineChart.tsx` is a small dependency-free SVG
component (see that file) — plain `<path>`/`<circle>`/`<text>`
elements over the real observed points, no interpolation, no
animation, RTL-safe (`dir="ltr"` on the chart's own wrapper only — time
series read left-to-right regardless of page direction), with a
visually-hidden data table for screen readers.

## What the numbers mean — and do NOT mean

- `arrivals` = a **headcount** of international arrivals for that
  country in that year. Not a percentage, not "80% tourists", not a
  ranking.
- `receiptsUsd` = **nominal USD** tourism receipts for that year. Not
  SAR, not inflation-adjusted, not a personal travel budget.
- **Growth** (`computeYoyGrowth()`, `data/tourismInsights.ts`) is
  *calculated*, deterministically, from two real consecutive-year
  arrivals observations — `((current - previous) / previous) * 100` —
  never a separately-sourced or invented "growth %". Returns
  `undefined` (never 0, never a guess) when there are fewer than 2
  observations, the two latest aren't exactly 1 year apart (a missing
  year in between), or the previous value is `<= 0`.
- Never combined with, or presented as, the Travel Cost Index
  (`PA.NUS.GDP.PLI`) in this feature.

## Pipeline

```
World Bank API (network, 2 indicators)
        |  generate-tourism-insights.mjs (fetch only)
        v
parseWorldBankResponse -> normalizeSeriesRows (x2) -> buildEntries -> validateEntries -> serializeSnapshot
        |  scripts/lib/tourismInsightsIngest.mjs (pure, unit-tested with fixtures)
        v
src/data/generated/tourismInsights.json  (committed snapshot)
        |
        v
src/data/tourismInsights.ts  (lazy-loaded read + computeYoyGrowth + formatCompactNumber)
        |
        v
TourismInsights.tsx + TourismLineChart.tsx
```

The React app never calls World Bank directly, at build time or
runtime.

## Snapshot shape

```json
{
  "snapshotUpdatedAt": "2026-01-01T00:00:00.000Z" or null,
  "sourceIndicators": { "arrivals": "OWID:international-tourist-trips", "receiptsUsd": "OWID:spending-by-international-visitors-while-visiting-a-country" },
  "entries": [
    { "countryCode": "JP", "arrivals": [{ "period": "2019", "value": 31900000 }], "receiptsUsd": [...] }
  ]
}
```

A country appears only if it has at least one real observation in
EITHER series; a series with zero observations for that country is
omitted entirely (never `[]` pretending "checked, found nothing").

## Failure / fallback behavior

Same atomic-write, never-corrupt-the-committed-file design as
`generate-travel-cost-index.mjs`: validated before writing (non-empty,
minimum coverage, no negative/non-finite values, no duplicate
country+period pairs, no excluded country code), write-to-temp +
rename. At runtime, `getTourismInsights()` returns `undefined` — never
a guess — for a missing/excluded/failed-to-load case;
`TourismInsights.tsx` renders nothing in that case.

## Exclusion (Israel / IL / ISR)

Same three independent layers as the Travel Cost Index, reusing the
SAME `excludedCountriesData.json` (no second hardcoded mirror):
effective-catalog join in the generator, `validateEntries()`'s
explicit check, and `getTourismInsights()`'s own `isExcludedIso2()`
check.

## Automation

`.github/workflows/update-tourism-insights.yml` mirrors
`update-travel-cost-index.yml`'s exact structure (monthly + manual
dispatch, least-privilege permissions, first-party actions only,
branch-push-then-separate-PR-attempt, the same repository-setting
diagnostic for a blocked `gh pr create`). See that workflow's own
comments and `TRAVEL_COST_INDEX.md`'s "Known blocker" section — the
same repository setting (`Settings → Actions → General → Workflow
permissions → "Allow GitHub Actions to create and approve pull
requests"`) blocks this workflow's PR step identically.
