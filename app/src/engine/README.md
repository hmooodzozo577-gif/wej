# Deterministic recommendation engine

The engine ranks all 194 effective catalog countries. AI is not part of the
questionnaire, scoring, or explanation path.

## Inputs

- Answers come from the conditional bilingual bank in `data/questionBanks.ts`.
- Each differently worded branch node maps to one canonical profile key.
- Worldwide profiles come from `data/worldRecommendation.ts` and the committed
  source snapshot documented in `scripts/RECOMMENDATION_INDICATORS.md`.
- `IL`/`ISR` is absent because candidates come only from `WORLD_CATALOG`.

## Scoring

Answered target dimensions use distance from the selected value; category
dimensions require an exact match; importance dimensions scale their weight;
climate uses the compatibility table. One fixed purpose component is added.
The result is a deterministic weighted mean clamped to 0–100.

Branch variants that resolve the same canonical dimension cannot count twice.
Unanswered dimensions do not contribute. Every score records its contributing
reasons for the user-facing explanation.

## Coverage and missing observations

All 194 countries have a profile. Directly observed numeric values are
normalized against the worldwide dataset. A missing observation uses the
worldwide median and is recorded in `imputedKeys`; `dataCoverage` reports the
direct-observation share. The results UI calls the percentage an estimate and
discloses this treatment.

The country-reachability test builds a valid ideal answer profile for each of
the 194 countries and, when the traveler explicitly enables proximity from
that country's location, proves that every country can reach the top five for
at least one purpose. A second deterministic test samples 16,000 varied real
questionnaire paths and requires at least 190 countries to appear. This avoids
restoring vague region and compass-direction questions solely to satisfy a
coverage test.

## Tie-breaking and location

When the traveler answers that proximity matters and has explicitly shared a
location, straight-line distance to each country centroid contributes one
bounded deterministic scoring component. If either condition is absent,
location has no effect. The results page discloses whether proximity was used
or unavailable; precise coordinates remain in memory only.
