# engine/

Phase 3. Pure TypeScript functions ported from the original `<script>` block:

- `scoreDestination.ts`
- `rankDestinations.ts`
- `buildWhyText.ts`

Accompanied by Vitest tests (`*.test.ts` / `__tests__/`) verifying the
migrated engine produces the same *scores* as `wejhaty.html`'s own
live source for representative inputs (`__tests__/parity.test.ts`,
loading the original via `loadOriginalEngine.ts` — not a hand-copied
reference).

## Phase 14 audit (reinspected from current source, not assumed)

Reinspected `scoreDestination.ts`/`rankDestinations.ts`/`buildWhyText.ts`
directly before changing anything, per this phase's own "verify before
editing" requirement.

### Scoring architecture, as it actually is today

- **Per-question fit** (`scoreDestination.ts`), by `q.kind`:
  - `target`: `fit = max(0, 100 - |dest[destKey] - answer| / scale * 100)`
    (scale defaults to 100).
  - `importance`: `effWeight = q.weight * (answer / 100)`;
    `fit = dest[destKey]` directly (the destination's own raw score for
    that dimension, 0-100).
  - `category`: exact match against `dest[destKey]` -> 100, else a
    fixed 45 (not 0 — a non-match is "weak fit", not "no fit").
  - `climate`: looked up in `CLIMATE_COMPAT[answer][dest.climate]`,
    falling back to 50 if either side is missing from the matrix.
  - An answer that is `undefined` (question skipped/unanswered) is
    excluded from both `totalWeighted` and `totalWeight` entirely —
    neither rewarded nor penalized, not defaulted to a fit of 50.
- **Purpose fit**: a fixed-weight (25) implicit component using the
  destination's own baseline `pTourism`/`pWork`/etc. score for the
  selected purpose, or the unweighted 7-purpose average for `'other'`.
  This weight and its treatment are unchanged from the original and
  from before this phase.
- **Final score**: `round(totalWeighted / totalWeight)`, clamped to
  [0, 100]. `totalWeight > 0` always holds in practice (the purpose
  component alone contributes 25), so the `50`-fallback branch for
  `totalWeight === 0` is unreachable with the current question banks
  — a low-severity latent guard, not a bug, left as-is (removing a
  defensive branch is not this phase's job).
- **Reasons**: every scored question (plus the implicit purpose
  component, `id: '__purpose'`) becomes a `Reason { id, weight, fit }`,
  sorted by `weight * fit` descending — i.e. by actual contribution to
  the total, not by raw weight or raw fit alone. `buildWhyText()` takes
  the top 3 reasons with `weight > 1` and maps their `id` through
  `REASON_LABELS[lang]`.
- **Ranking** (`rankDestinations.ts`): scores every entry in
  `DESTINATIONS` (the 30 curated, recommendation-ready destinations —
  confirmed IL/ISR is not among them, see "Exclusion audit" below) for
  the given purpose/answers, then sorts.

### Weaknesses found (with evidence)

1. **No explicit tie-breaker** (real, confirmed — not theoretical):
   `rankDestinations` sorted purely by `b.score - a.score`. Re-running
   the parity test's own answer variants surfaced real ties (e.g.
   Italy/KSA both scoring 70 under one profile) whose relative order
   depended entirely on `Array.prototype.sort`'s stability plus
   `DESTINATIONS`' own array order in `data/destinations.json` — an
   insertion-order accident, not a documented guarantee. **Fixed**
   (see below).
2. **Missing-destination-data / `totalWeight === 0` path**: not
   actually reachable with the current question banks (see above) —
   noted, not changed, since fixing an unreachable branch isn't a real
   improvement and risks masking a real future misconfiguration
   differently than today's `50` fallback would.
3. No other scoring weight, formula, or purpose/category/climate
   treatment issue was found that meets this phase's own bar for a
   change ("documented rationale + before/after fixtures + tests +
   evidence it improves semantic consistency, not optimizing against a
   handful of handpicked countries") — see the three decision gates
   below for what WAS evaluated and explicitly not integrated.

### Fix: deterministic tie-breaking

`rankDestinations.ts` now sorts by
`b.score - a.score || a.dest.id.localeCompare(b.dest.id)` — score
descending, then the destination's own canonical `id` ascending among
exact ties. `id` was chosen specifically because it carries zero
semantic weight toward "this destination is better" (unlike distance,
tourism popularity, or price level — see below) and is guaranteed
unique (verified: 30/30 unique ids in `data/destinations.json`).
**Before**: tie order depended on `DESTINATIONS`' array order.
**After**: tie order is fixed and reproducible regardless of how the
underlying data file happens to be ordered. `__tests__/parity.test.ts`
was updated to compare the two engines' SCORES as an order-independent
set (this phase's own deliberate ranking change, not a parity
regression) and to assert our own output is genuinely sorted this way;
`__tests__/rankDestinations.tiebreak.test.ts` unit-tests the
tie-breaker directly against a small synthetic dataset (mocked
`DESTINATIONS`) so it doesn't depend on which real destinations
happen to tie under which real answers.

## Decision gates (Phase 14 requirement — evaluated, not assumed)

### Location -> recommendation score: NOT INTEGRATED — semantics do not justify it

Checked `data/generated/questionBanks.json` (all 8 purposes): no
question anywhere asks about proximity, travel distance, or "nearby/
easy to reach" preference. Per this phase's own rule, silently making
`closer = better` for every user would be an unauthorized assumption
about what the user actually wants — a traveler filling out this quiz
is not necessarily asking for the nearest country. `scoreDestination`/
`rankDestinations` take no location parameter and were not given one.
Location (now globally available — see Workstream C) remains
informational/advisory: travel-distance context on the destination
page (`TravelInfo.tsx`, already existed) and nearby-country browsing
in Explore (`LocationPersonalize.tsx`). If a future phase adds an
explicit "I want somewhere close/easy to reach" question, proximity
could then legitimately inform scoring or tie-breaking for users who
actually chose that preference — not for everyone by default.

### Price Level Index -> recommendation score: NOT INTEGRATED — kept informational

A real budget/cost preference DOES exist in the questionnaire: every
purpose has a `target`-kind question against `destKey: costLevel`
(`budget`, `colTolerance`, `col`, or `tuition` depending on purpose;
weights 8-25 depending on purpose — e.g. `other`'s `budget` is
weighted 25, tied with the purpose-fit component itself). So the
"does a real preference exist" half of this gate is yes.

The "can PLI legitimately improve it" half is where this stops:
`costLevel` is a hand-curated 1-4 tier already scored per destination
by the ORIGINAL, verbatim-ported formula (`scoreDestination.ts`'s own
header comment: "Do not alter the formula, weights, or purpose-scoring
treatment"). `PA.NUS.GDP.PLI` coverage is real but not universal even
across just the 30 recommendation-ready destinations, is a general
economy-wide price level (not specifically "cost of visiting/living
here" the way `costLevel` was curated to mean), and blending a
continuous real-world value into a hand-tuned categorical scoring
formula would need: a documented mapping methodology, a coverage/
fallback story for destinations PLI doesn't cover, before/after
fixtures across many destinations (not a handful picked to look good),
and evidence the blend produces MORE semantically consistent rankings
— none of which this pass produced with real rigor, and guessing at a
blend formula here would be exactly the "arbitrary multiplier" this
phase explicitly forbids. PLI stays informational (the separate Travel
Cost Index card) — not fed into scoring.

### Tourism arrivals/receipts -> recommendation score: NOT INTEGRATED — semantics do not justify it

Checked all 8 purposes' question banks again for any "popular/lively"
or "avoid crowds" preference: none exists. Per this phase's own rule,
scoring a destination higher merely because more tourists visit it
(popularity) is not the same as it being more SUITABLE for this
particular user's answers, and doing so without an explicit preference
would silently reward popularity as if the user asked for it. Tourism
data stays informational (the Tourism Insights card) — never fed into
`scoreDestination`/`rankDestinations`.

## Exclusion audit (Israel / IL / ISR)

`DESTINATIONS` (`data/destinations.json`, the recommendation
candidate pool `rankDestinations` iterates) — verified directly:
30 entries, **zero** with `countryCode === 'IL'`. `rankDestinations`
and `scoreDestination` take no country-code parameter beyond each
`Destination` object already drawn from that pre-excluded list, so
there is no path for an excluded country to enter a recommendation
result. No Monaco (MC/MCO) substitution anywhere in this codebase —
confirmed via the same `excludedCountriesData.json` grep sweep used
throughout this project. No second, hardcoded exclusion mirror was
introduced for this phase; the existing shared
`app/src/data/excludedCountriesData.json` (consumed by
`excludedCountries.ts`, the travel-cost and tourism ingestion scripts)
remains the single source of truth — the recommendation engine simply
never sees an excluded destination in the first place, one layer
upstream of needing its own check.
