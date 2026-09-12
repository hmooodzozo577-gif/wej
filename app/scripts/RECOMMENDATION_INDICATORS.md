# Worldwide recommendation indicators

`generate-recommendation-indicators.mjs` creates the committed
`src/data/generated/recommendationIndicators.json` snapshot used to make all
194 effective countries eligible for deterministic recommendations.

The snapshot uses country identity/geography from `world-countries` 5.1.0 and
the World Bank Indicators API for urban population, PPP income per capita,
modelled unemployment, life expectancy, health spending, tertiary enrolment,
FDI, GDP growth, and intentional homicide. The existing UN Tourism arrivals
snapshot and World Bank price-level snapshot are joined by the generator so
the recommendation runtime does not eagerly load their complete histories.

The UI does not present normalized recommendation values as raw facts. Values
are winsorized at the fifth and ninety-fifth percentiles and normalized to a
0–100 comparison scale. Missing numeric observations use the global median;
each profile records `dataCoverage` and `imputedKeys`. The original 30
editorial profiles retain their reviewed climate category; other countries use
a broad latitude-derived band. Coast/island and area come directly from country
geography.

This model is a deterministic discovery aid. It does not create live prices,
availability, cultural compatibility, or personal-trait inferences.
