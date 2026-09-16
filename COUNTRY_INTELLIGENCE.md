# Country Intelligence + Purpose Suitability Scoring

Phase 11.x (country intelligence expansion) / Phase 14.x (purpose
suitability scoring). This is a **Country Suitability** layer — how
suitable a country is *in general* for a purpose — deliberately separate
from Phase 14's own MATCH scoring (how well a country matches *one
traveller's answers*). Personal Match (combining suitability with a
traveller's own preferences) is explicitly a Phase 18 concern; nothing
here writes into a `RecommendationProfile` or a Phase 14 score, and Phase
14's `DIMENSIONS`/`PURPOSE_DIMENSIONS`/weights are unchanged (proven by
`app/src/engine/phase14WeightsBaseline.test.ts`, which deep-compares the
live `QUESTION_BANKS` against a baseline captured before this work began).

## Architecture

```
app/src/intelligence/           Pure scoring engine (no React, no DOM)
  types.ts                        Shared types
  sources.ts                      Real source catalog (World Bank/OWID)
  methodology.ts                  Per-purpose factor sets + weights
  normalize.ts                    Winsorized 0-100 normalization
  score.ts                        Deterministic score/confidence/coverage

app/scripts/generate-country-intelligence.mjs
  Build-time generator. Loads the engine through Vite's SSR module
  loader (reuses the real, tested TS code — never a second copy of the
  scoring logic in plain JS) and runs it over the ALREADY-COMMITTED
  recommendationIndicators.json snapshot (itself joining in
  travelCostIndex.json/tourismInsights.json — see
  app/scripts/RECOMMENDATION_INDICATORS.md). No network fetch happens
  here: this reuses Wejhaty's existing, already-sourced World Bank/OWID
  pipeline rather than duplicating it.

  Writes:
    app/src/data/generated/countryIntelligence.json
      Compact score/confidence/coverage summary — bundled with the
      frontend (≈9KB gzip). This is ALL the frontend ships for this
      feature; no per-component detail.
    worker/src/generated/countryIntelligenceDetail.json
      Full per-component/per-source breakdown (≈133KB gzip) — bundled
      with the WORKER, not the frontend, exactly like
      worker/src/generated/cityCoordinates.json already is. Served on
      demand by intelligence.ts.
    app/scripts/countryIntelligenceCoverage.json
      Human-auditable coverage/freshness report (see "Coverage" below).

app/src/data/countryIntelligence.ts
  Frontend accessor for the compact summary — getCountrySuitability(code).

app/src/countryIntelligence/
  detailClient.ts   Lazy fetch of the full Worker detail, memoized,
                    fails safe to "not available" (never hangs, never
                    fabricates).
  insights.ts       Derives "main strengths"/"main limitations" labels
                    from a result's OWN structured components — never
                    generated prose.

app/src/components/CountrySuitability.tsx
  The "Suitable for" card on a country page (Destination.tsx), inside
  the existing optional "Show additional information" section but as
  its OWN full-width row below .info-cards-grid — that 4-card grid is a
  hand-tuned named CSS grid with its own history of rejected/corrected
  layouts (Destination.infoCardsLayout.test.tsx); adding a 5th item
  into it without a grid-area would risk breaking that accepted layout.

worker/src/intelligence.ts
  GET /api/intelligence/:countryCode/:purpose — serves the full detail
  from the bundled JSON. No D1, no secret, no external fetch: this is
  static, versioned, build-time-computed reference data, not live user
  data, so a plain in-memory lookup is the correct architecture (see
  "Why not D1" below).

worker/src/analytics.ts (buildIntelligenceHealth) +
worker/src/adminPage.ts (renderIntelligenceHealth, inside the existing
Content tab) + worker/src/adminI18n.ts (`intelligence.*` strings)
  Admin observability — extends the existing Content tab rather than
  adding a new one, per this round's own scope instruction to extend
  Admin/Content/Technical "without rewriting the Admin system."
```

### Why not D1

Country Intelligence is deterministic, versioned, reference data that
only changes when the generation pipeline re-runs — the same shape as
`recommendationIndicators.json`, `travelCostIndex.json`,
`cityCoordinates.json`, none of which live in D1 either. D1 in this repo
is reserved for genuinely dynamic, user-generated data (sessions, events,
ratings, feedback). Writing this into D1 would also require a live write
this sandbox cannot perform or verify (no network egress to the deployed
Worker) and gain nothing a bundled static asset doesn't already provide —
a straight in-memory Map lookup, servable with zero external
dependencies. If a future round wants live per-country queries filtered
server-side, that's a real reason to reconsider; today it isn't needed.

## Purposes scored

Wejhaty's canonical purpose set (`app/src/data/types.ts`, `PurposeId`) has
8 values: `tourism`, `work`, `education`, `medical`, `immigration`,
`investment`, `wellness`, `other`. **`other` is excluded** — it is a
catch-all fallback with no defined identity (`pScoreKey: null` in
`purposes.json`), so there is no methodology to build for it. The 7
scored purposes are `SUITABLE_PURPOSES` in `app/src/intelligence/types.ts`.

## Source catalog

Every factor reads an indicator Wejhaty's OWN pipelines already fetch and
commit — nothing is fetched a second time for this layer:

| Source id | Provider | Indicator | License |
|---|---|---|---|
| `urbanPopulationPct` | World Bank | `SP.URB.TOTL.IN.ZS` | CC BY-4.0 |
| `incomePerCapitaPpp` | World Bank | `NY.GDP.PCAP.PP.CD` | CC BY-4.0 |
| `unemploymentPct` | World Bank | `SL.UEM.TOTL.ZS` | CC BY-4.0 |
| `lifeExpectancy` | World Bank | `SP.DYN.LE00.IN` | CC BY-4.0 |
| `healthSpendPerCapita` | World Bank | `SH.XPD.CHEX.PC.CD` | CC BY-4.0 |
| `tertiaryEnrollmentPct` | World Bank | `SE.TER.ENRR` | CC BY-4.0 |
| `fdiPctGdp` | World Bank | `BX.KLT.DINV.WD.GD.ZS` | CC BY-4.0 |
| `gdpGrowthPct` | World Bank | `NY.GDP.MKTP.KD.ZG` | CC BY-4.0 |
| `homicideRate` | World Bank | `VC.IHR.PSRC.P5` | CC BY-4.0 |
| `priceLevelIndex` | World Bank | `PA.NUS.GDP.PLI` | CC BY-4.0 |
| `tourismArrivals` | UN Tourism (via OWID) | `international-tourist-trips` | CC BY |

Full provenance (name, tier, indicator id, URL, license) lives in
`app/src/intelligence/sources.ts` and is enforced by
`methodology.test.ts` ("every factor references a real, catalogued
source").

## Per-purpose methodology

Each purpose has its OWN factor set and weights (never reused from
another purpose — enforced by `methodology.test.ts`). See
`app/src/intelligence/methodology.ts` for the exact factors, weights, and
each purpose's `excluded` list (a candidate factor from the task's own
brainstormed examples, with WHY it isn't scored — no trustworthy
indicator, editorial-only coverage, or a hard exclusion like visa/climate).

Summary (weights sum to 100 per purpose):

- **Tourism** (`tourism-v1`): touristDraw 25, safety 20, affordability 20,
  amenityDensity 15, healthSafetyNet 10, economicStability 10.
- **Work** (`work-v1`): laborMarket 25, income 25, economicGrowth 15,
  costOfLiving 15, safety 10, health 10.
- **Education** (`education-v1`): educationAccess 30, affordability 20,
  safety 20, postGradEnvironment 15, health 15.
- **Medical** (`medical-v1`): healthSystemInvestment 30, healthOutcomes 25,
  safety 15, affordability 15, economicContext 15.
- **Immigration** (`immigration-v1`): income 20, safety 20, laborMarket 15,
  costOfLiving 15, educationForFamily 15, health 15.
- **Investment** (`investment-v1`): fdiAttractiveness 25, economicGrowth
  25, marketPurchasingPower 20, safety 15, costBase 15.
- **Wellness** (`wellness-v1`): health 25, healthSystem 20, safety 20,
  tranquility 20, affordability 15.

Two exclusions apply to every purpose, always:

- **Visa/entry requirements** are never a scoring input (task 3.20 /
  `worker/src/visa.ts` — no verified provider means `unknown`, and
  `unknown` must never be penalized or rewarded).
- **Climate** is never a scoring input — climate desirability is a
  traveller preference, not an objective good/bad quality (Phase 14
  already models it as a compatibility match, not a suitability score).

## Normalization — what 0-100 means

Documented in `app/src/intelligence/normalize.ts`: a normalized value of
100 means "at or above the 95th percentile of countries actually observed
for this factor"; 0 means "at or below the 5th percentile"; values between
are a linear position in that winsorized range. This is a **criterion-
based position within the observed population**, not a global rank or
percentile — bounded (0-100 clamp), so one extreme outlier cannot crush
everyone else toward the same end of the scale. Skewed indicators (income,
health spend, tourism arrivals) are log-transformed before normalizing.
Never confuse this with a global percentile/rank — the code and tests
keep the two concepts explicitly separate (task 3.13).

## Score, coverage, confidence

`app/src/intelligence/score.ts`:

- **Score** = a weighted average of the NORMALIZED VALUES ACTUALLY
  OBSERVED for a country, re-weighted over just the observed factors —
  a country missing one indicator is not artificially dragged down by
  the gap. The gap is disclosed separately via coverage/confidence, never
  blended into the score number.
- **Coverage** = % of a purpose's factors actually observed for that
  country.
- **Minimum data threshold**: below 60% coverage (`minCoverage` in each
  methodology), no score is computed — `score: null`,
  `insufficientData: true`. Partial component data is still preserved
  (never discarded) for transparency.
- **Confidence**: `high` (coverage ≥90% AND average data age ≤3 years),
  `medium` (coverage ≥60%), `low` (anything below that a purpose's own
  threshold might allow through). Confidence is only ever set alongside
  a real score.

Every score is fully reproducible from its documented components — see
the `components[]` array on any `PurposeSuitability` result (factor,
raw/normalized value, contribution, weight, data year, source, status).

## Model versioning

Each purpose has its own `<purpose>-v1` model version
(`app/src/intelligence/methodology.ts`). A future change to a purpose's
factors or weights should bump that purpose's version, not silently
reuse `v1` — a score is traceable to its model version, and a version
bump signals "this number means something different now" rather than
rewriting history under the same label.

## Coverage (as of the generation run committed with this change)

Real, measured numbers — not claimed, not rounded up:

| Purpose | Sufficient data | Avg. coverage |
|---|---|---|
| Tourism | 190/194 (98%) | 92% |
| Work | 186/194 (96%) | 91% |
| Education | 186/194 (96%) | 88% |
| Medical | 188/194 (97%) | 92% |
| Immigration | 183/194 (94%) | 88% |
| Investment | 185/194 (95%) | 91% |
| Wellness | 192/194 (99%) | 92% |

Countries with insufficient tourism data: Eritrea, North Korea, South
Sudan, Vatican City — exactly the small/data-poor economies one would
expect to be genuinely under-covered by World Bank/OWID series, not an
implementation gap. The full per-purpose, per-factor breakdown (including
each purpose's own insufficient-data country list and per-factor
observation counts) is regenerated at
`app/scripts/countryIntelligenceCoverage.json` every time the pipeline
runs — read that file for the current numbers rather than trusting this
table to stay current by itself.

**Country exists in the dataset ≠ data exists ≠ data is fresh ≠ data
meets the scoring threshold** — these are four different, independently
tracked facts here, never conflated.

## Freshness

Indicator years are whatever the underlying World Bank/OWID snapshot
observed (see `recommendationIndicators.json`'s own per-indicator
`year` fields — 2023-2025 for most factors at the time this was
generated). `generatedAt` on every result is when THIS pipeline last ran,
never confused with the underlying observation year. There is no
separate freshness SLA defined yet beyond "regenerate when the underlying
snapshots are refreshed" — see "Automation" below.

## Traveler Budget / visa safety

Unaffected by this work, both deliberately:

- **Traveler Budget** stays `CANCELLED / OUT OF SCOPE`
  (`app/scripts/TRAVEL_COST_INDEX.md`) — this round did not discover a
  new legitimate SAR/day source, and did not invent one.
- **Visa** stays `unknown` unless a real provider is configured
  (`worker/src/visa.ts`) — never used as a scoring input here, and never
  penalized/rewarded when `unknown`.

## Automation

None was built this round. The generator
(`app/scripts/generate-country-intelligence.mjs`) is pure computation
over already-committed snapshots with no network fetch of its own, so it
has no separate "source went down" failure mode to automate around — it
only needs re-running after `recommendationIndicators.json`/
`travelCostIndex.json`/`tourismInsights.json` are refreshed by their OWN
existing monthly automation
(`.github/workflows/update-travel-cost-index.yml`,
`update-tourism-insights.yml`). A future round could add a workflow step
that re-runs this generator right after those, following the same
constraints those two already document (monthly + manual dispatch,
least-privilege permissions, fixture-only pre-flight tests, atomic
writes, never a silent unopened PR on the known `gh pr create`
repository-setting blocker) — not built here because it wasn't asked for
and the manual `node app/scripts/generate-country-intelligence.mjs`
re-run is a one-line, sub-second operation in the meantime.

## Known gaps / deliberately excluded

Every purpose's `excluded[]` list in `methodology.ts` names a candidate
factor and why it isn't scored (no trustworthy structured source,
editorial-only coverage on the 30 original destinations rather than all
194, or a hard exclusion like visa/climate). Nothing in this layer claims
"all countries fully covered" — see "Coverage" above for the real,
per-purpose numbers, including which specific countries fall short and
why (small/data-poor economies, not an implementation gap).

## Testing

- `app/src/intelligence/normalize.test.ts` — normalization boundaries,
  outliers, missing data, degenerate populations, log transform.
- `app/src/intelligence/methodology.test.ts` — structural invariants
  (weights sum to 100, real sources, purpose-specific factor sets, no
  visa/climate factor, documented exclusions).
- `app/src/intelligence/score.test.ts` — score bounds, insufficient-data
  threshold, missing-data handling, determinism, model versioning.
- `app/src/data/countryIntelligence.test.ts` — the REAL committed
  snapshot: every effective country covered, no excluded country, score
  bounds, model version consistency.
- `worker/src/intelligence.test.ts` — the detail API: validation, IL
  exclusion, 404/400 handling, real source resolution.
- `worker/src/analytics.test.ts` — the admin health summary against the
  real committed snapshot.
- `app/src/components/CountrySuitability.test.tsx` — the UI: real data
  rendering, insufficient-data state, AR/EN, lazy detail fetch and its
  failure path.
- `app/src/engine/phase14WeightsBaseline.test.ts` — proves Phase 14 is
  untouched.
- Playwright visual QA (ephemeral, not shipped): 4 representative
  countries (excellent coverage/Arabic name — Saudi Arabia; large
  economy/high coverage — Japan; medium coverage — Afghanistan;
  insufficient data/tiny population — Vatican City) × desktop/mobile ×
  AR/EN × light/dark = 32 combinations, 0 findings. Admin dashboard
  extension re-verified with the existing `app/scripts/
  admin-visual-check.mjs` sweep, also 0 findings.
