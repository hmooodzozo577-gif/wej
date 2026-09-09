# Destination Tourism Insights (Phase 13.5d)

## What this is

A build-time-generated, committed snapshot of real historical tourism
statistics (international arrivals, tourism receipts), shown on the
destination page as `TourismInsights.tsx` — a separate concept from the
Travel Cost Index (`TRAVEL_COST_INDEX.md`): different World Bank
indicators, different units (headcounts/USD, not a price-level index),
never combined on one chart or axis.

## Source evaluation

Priority order followed: World Bank first (globally consistent,
already the source for Travel Cost Index), then UNWTO/OECD/other only
if World Bank were insufficient. World Bank's own tourism indicators
are themselves UNWTO-sourced, so a separate direct UNWTO integration
was not pursued.

- **`ST.INT.ARVL`** — "International tourism, number of arrivals".
  Headcount of international arrivals; not a percentage of anything.
- **`ST.INT.RCPT.CD`** — "International tourism, receipts (current
  US$)". Nominal USD (not inflation-adjusted, not SAR).

Both are World Development Indicators, public, no authentication.

### Live verification (critical — do not assume from old docs)

Live-verified via a real GitHub Actions run (this sandboxed dev
environment's own network egress is blocked to worldbank.org): both
indicators return real HTTP-success data, so they are **not archived**
like `PA.NUS.PPPC.RF` was. But — confirmed directly, not assumed —
**neither indicator has a single observation newer than 2020**, even
though the API's own response metadata `lastupdated` field is recent.
`mrv=6` for USA and France both returned a fully-populated 2015-2020
series with no gaps for either indicator. This matches World Bank
WDI's own well-known freeze of its UNWTO-sourced tourism series after
2020 — not a Wejhaty staleness bug, and not something a future
ingestion run can fix by asking again differently. If World Bank ever
resumes publishing, the monthly automation (below) will pick it up
without any code change.

2020 itself (a real, extreme collapse — e.g. USA arrivals: 165.5M in
2019 → 45.0M in 2020) is kept as a genuine historical observation, not
dropped, "smoothed", or treated as an error.

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
  "sourceIndicators": { "arrivals": "ST.INT.ARVL", "receiptsUsd": "ST.INT.RCPT.CD" },
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
