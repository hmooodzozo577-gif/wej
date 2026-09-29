# Data sources for the v1.1 travel needs

These sources are used only by Personal Match (`personal-match-1.2`, see
`docs/PERSONAL_MATCH_V1_1.md`), and only as positive evidence. They are
never used by Phase 14, Country Suitability, the Passport or any ranking
outside Personal Match.

Each source separates two things:

- the **source fact**: what the dataset records;
- **Wejhaty's interpretation**: the thresholds, which are Wejhaty's own
  and never an OpenStreetMap or dataset rating.

The sensitivity audit behind these rules is in
`docs/audits/DATA_METHODOLOGY_RC2.md`.

## 1. Official languages — `world-countries` (mledoze/countries)

| | |
|---|---|
| Exact source | npm package **`world-countries`**, version **5.1.0** (`app/package-lock.json`: `resolved` registry.npmjs.org/world-countries/-/world-countries-5.1.0.tgz, integrity `sha512-CXR6EBvTbArDlDDIWU3gfKb7Qk0ck2WNZ234b/A0vuecPzIfzzxH+O6Ejnvg1sT8XuiZjVlzOH0h08ZtaO7g0w==`), a devDependency used only at generation time |
| Upstream | https://github.com/mledoze/countries (maintainer Mohammed Le Doze) |
| Not to be confused with | `world_countries` (underscore) or other country lists (`countries-list`, `i18n-iso-countries`); none of them is installed or used |
| Licence | **ODC Open Database License (ODbL) 1.0**. It is the text of `node_modules/world-countries/LICENSE`, and the README's License section links it. The package.json has **no** `license` field, so npm metadata shows none. The flags in that dataset are excluded from the ODbL; Wejhaty's flags come from `flag-icons` instead. |
| Files used | the package's main export (`countries`) via `app/scripts/generate-world-countries.mjs` → `app/src/data/generated/countryInfo.json` (field `languagesEn` = `Object.values(country.languages)`), plus the package's `data/<iso3>.geo.json` boundaries → `countryBoundaries.json` (location only) |
| What it measures | The README defines `languages` as the "list of official languages" |
| What it does NOT measure | Which languages people actually use with visitors, or how widely any language, English included, is spoken |
| Coverage | 195/195 countries have at least one official language (the catalog's 194 included) |
| Wejhaty's transformation | 17 selectable languages, each mapped to the dataset's own names (German → German, Swiss German, Austro-Bavarian German; Persian → Persian (Farsi), Dari). Every option matches at least one catalog country (tested). |
| Threshold / rule | One of your languages is official there: fit 100. No match: **not counted**. |
| Missing-data semantics | No match, or no language data, is not counted. It is never a low score and never a claim that communication is hard. |
| Known limitations | "Official" is a legal status. Many countries use other languages widely (English, French, Russian…), and some official languages are little used day to day. |
| Redistribution | `countryInfo.json` and `countryBoundaries.json` are derived databases shipped in the public bundle and repository, under the ODbL |
| Attribution | Under "why this destination suits you", when the language factor is used: "Official languages come from the world-countries database (mledoze/countries), available under the ODbL", with links to the repository and the licence. City facts keep their existing "City data source" link. |

## 2. Mapped mosques and halal-tagged places — OpenStreetMap

| | |
|---|---|
| Exact source | **OpenStreetMap**, © OpenStreetMap contributors, read through the public **Overpass API** (`https://overpass-api.de/api/interpreter`, overridable with `OVERPASS_ENDPOINT`) |
| Licence | **ODbL 1.0**. OpenStreetMap's copyright page (text of `openstreetmap-website` `config/locales/en.yml`): "You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors. If you alter or build upon our data, you may distribute the result only under the same license." |
| Retrieval | `app/scripts/generate-islamic-travel-evidence.mjs` (the only network step) with the pure, tested `app/scripts/lib/islamicTravelIngest.mjs`. There is one query per country inside its `admin_level=2` boundary, with two `out count` blocks. Other safeguards: a 2.5 s pause between countries, backoff on 429/503/504, and an atomic write only after validation. |
| Queries | Mosques / Muslim places of worship: `nwr["amenity"="place_of_worship"]["religion"="muslim"]`. Halal: `nwr["diet:halal"~"^(yes\|only)$"]`. |
| Stored snapshot | `app/src/data/generated/islamicTravelEvidence.json`, `snapshotUpdatedAt` **2026-09-26T01:03:03.727Z**, 194 countries asked, **193 with data**. Palestine (`PS`) is "unavailable" because OpenStreetMap has no `ISO3166-1=PS` country boundary. The file carries its own `source` and `license: "ODbL-1.0"` fields. |
| What it measures | How many objects contributors have **mapped** with those tags inside the boundary: nodes, ways and relations |
| What it does NOT measure | How many mosques or halal places exist. How easy prayer or halal food is near a given hotel. Any country's or society's religiosity. Absence of mapped places is not evidence of absence. |
| Wejhaty's transformation | National counts only; nothing is inferred from religion statistics, an official religion, a name or a region |
| Thresholds (Wejhaty's) | **Mosques:** ≥ 200 mapped, or ≥ 20 at ≥ 5 per 1,000 km² (world-countries area): fit 100; anything less is **not counted**. **Halal:** ≥ 20 tagged places: fit 100; fewer is **not counted**. |
| Missing-data semantics | Not counted, or no data, lowers coverage and confidence, never the score. The score is exactly what it would be had the question not been answered. |
| Distribution | Mosques: 77 good / 116 not counted / 1 no data. Halal: 62 good / 131 not counted / 1 no data. |
| Refresh | `.github/workflows/update-islamic-travel-evidence.yml`, on the 2nd of each month at 05:00 UTC and on demand. It opens a pull request only when the data changed. |
| Redistribution | The snapshot is a derived database shipped in the public bundle and repository under the ODbL |
| Attribution | Under "why this destination suits you", when the Islamic-practice or halal factor is used: "Mosque and halal counts come from OpenStreetMap data (© OpenStreetMap contributors), available under the ODbL". The credit links to https://www.openstreetmap.org/copyright and "ODbL" to the licence. The notice adds that the thresholds are Wejhaty's own method, not an OpenStreetMap rating. Each factor line also names OpenStreetMap as the source of its count. |

### Why one level, and why density

- **One level.** A lower "partial" fit would pull a Personal Match down
  whenever the country's other factors score above it. Under 1.1 that
  meant more mapped mosques could give a lower result than fewer: this
  happened in 34.7 % of the audited cases. Enough evidence is a good fit;
  anything less is not counted. For halal there is a second reason: where
  halal is the default it is rarely tagged, so a tag count cannot say one
  country is "less halal-friendly" than another.
- **Density.** An absolute count alone would call a small country with
  many mosques for its size not counted. The density rule adds Brunei,
  Cyprus, Djibouti, Montenegro, Mauritius, Singapore and Trinidad and
  Tobago, and is stable from 2 to 10 per 1,000 km².

### Known limitations and biases

- **Tagging culture (halal).** Median halal tags per mapped mosque are
  0.015 in Muslim-majority countries and 1.056 in highly mapped Western
  and East Asian ones. 31 countries with ≥ 200 mapped mosques have fewer
  than 20 halal tags, for example Sudan, Afghanistan, Yemen, Senegal and
  Oman. They are not counted, not low. The explanation says halal is
  often the norm and simply not tagged. For someone for whom halal
  matters, countries with tagged places still gain a boost the others do
  not; no threshold removes this, and inferring halal from mosques would
  mean inferring from a Muslim presence, which Wejhaty does not do.
- **Mapping completeness.** It varies by country and contributor
  activity; a country near a threshold can change tier at the monthly
  refresh. At the last snapshot, 18 countries were within ±25 % of a
  mosque threshold and 13 of the halal floor.
- **Boundaries.** The `admin_level=2` boundary can include overseas parts
  (France's includes its overseas departments), while the density uses
  world-countries' area. A place mapped twice (a node and an area) counts
  twice. Counts are approximate national totals.

### How the current snapshot reached the repository

Workflow run 36202043431 generated and validated the snapshot. It uploaded
it as artifact 10893952496 (zip sha256
`6ed3db238f9ff322777581355597e4d5e429758eb61cc111326808335cf611e7`). It
then could not push its data branch, because the deploy branch had changed
a workflow file during the 80-minute run.

The artifact store is not reachable from the development environment. So
the snapshot was rebuilt from the generator's own per-country output lines
in that run's log (`N/194 CC: mosques=M halal=H`), using the same
`buildSnapshot()` and `validateEntries()` and the run's write time. It is
the same data.

The workflow now copies the new snapshot onto the deploy branch's
**latest** head before committing. A local simulation of that step (the
deploy branch changing a workflow file mid-run) produced a branch that
differs from the new head only by the snapshot file. The live proof is the
next scheduled run.

## 3. Licence obligations, in short

Both sources are ODbL databases. Wejhaty:

- conveys derived databases (the generated JSON files) under the same
  licence, recorded here and in each generator;
- shows a notice with the display that uses them, naming each database
  and linking the licence (ODbL §4.3);
- credits "© OpenStreetMap contributors" with a link to OpenStreetMap's
  copyright page, as that page asks.

Wejhaty claims no ownership of either dataset.
