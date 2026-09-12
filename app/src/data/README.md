# Data

Typed runtime data is exposed through the TypeScript modules in this directory.
Most source payloads live under `generated/`.

- `destinations.ts`: 30 complete, recommendation-ready `Destination` profiles.
- `basicCountries.ts`: the other effective countries with factual identity
  data and `recommendationReady: false`.
- `worldCatalog.ts`: the 194-country effective catalog after the absolute
  `IL`/`ISR` exclusion.
- `questionBanks.ts`: bilingual canonical questions/options and climate
  compatibility.
- `countryInfo.ts`: factual worldwide country information.
- `destinationVisuals.ts`: 194 reviewed local destination images sourced from
  the generated manifest.
- `tourismInsights.ts`: UN Tourism-derived tourism data.
- `travelCostIndex.ts`: World Bank relative price-level data.

The 164 basic countries must not be cast into `Destination` or assigned
synthetic Phase 14 values. Worldwide recommendation coverage requires a
separate sourced enrichment process.
