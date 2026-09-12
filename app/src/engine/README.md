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
the 194 countries and proves that every country can reach the top five for at
least one purpose. A second deterministic test samples 4,800 real questionnaire
paths and requires every country to appear. This prevents a catalog country
from becoming unreachable while avoiding a country-name question that would
simply ask the user to choose the answer directly.

## Tie-breaking and location

Scores are always the primary order. With no location, exact ties use the
stable destination id. When the user has explicitly shared a location, exact
ties use straight-line distance to the country centroid and the results page
discloses that proximity was used. Location never changes the score and precise
coordinates remain in memory only.
