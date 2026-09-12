# Data

Typed runtime data is exposed through the TypeScript modules in this directory.
Most source payloads live under `generated/`.

- `destinations.ts`: 30 richer editorial `Destination` profiles retained for
  their extended detail-page content.
- `basicCountries.ts`: the other effective countries with factual identity
  data and `recommendationReady: false` (the flag now means “no rich editorial
  profile”; it no longer means exclusion from recommendations).
- `worldCatalog.ts`: the 194-country effective catalog after the absolute
  `IL`/`ISR` exclusion.
- `questionBanks.ts`: 320+ bilingual conditional nodes. A real path visits only
  the branch selected by the traveler and one question per canonical dimension.
- `worldRecommendation.ts`: normalized, deterministic profiles for all 194
  effective countries, built from the sourced indicator snapshots.
- `countryInfo.ts`: factual worldwide country information.
- `destinationVisuals.ts`: 194 reviewed local destination images sourced from
  the generated manifest.
- `tourismInsights.ts`: UN Tourism-derived tourism data.
- `travelCostIndex.ts`: World Bank relative price-level data.

The 164 basic countries remain distinct from the richer editorial type. Their
recommendation eligibility comes from the separate sourced/derived worldwide
profile layer; missing observations are median-imputed and disclosed rather
than being cast into invented editorial fields.
