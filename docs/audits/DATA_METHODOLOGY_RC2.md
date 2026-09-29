# Data methodology and attribution audit — v1.1.0 RC2

Scope: the three Personal Match travel needs added in v1.1 (official
language, mapped mosques, halal-tagged places). Read-only analysis of the
committed data; one scoring correction came out of it (section 5).

The analysis scripts ran locally against
`app/src/data/generated/islamicTravelEvidence.json` (snapshot
2026-09-26T01:03:03.727Z, 193 of 194 countries with data) and the real
Personal Match engine. Nothing was fetched or regenerated.

## 1. What the source says and what Wejhaty adds

| Layer | Owner | What it is |
|---|---|---|
| Source fact | OpenStreetMap contributors | The number of objects inside a country's `admin_level=2` boundary tagged `amenity=place_of_worship` + `religion=muslim`, and the number tagged `diet:halal=yes\|only` (Overpass `out count`, nodes + ways + relations). |
| Interpretation | Wejhaty | The thresholds that turn those counts into a Personal Match factor (section 2). OpenStreetMap does not rate countries. |
| Source fact | world-countries (mledoze/countries) | Each country's official languages. |
| Interpretation | Wejhaty | One of your languages is official there, so that's a good fit. No official match is not counted. |

## 2. Rules as implemented (`app/src/personalization/travelNeeds.ts`)

The rules as they stood in RC1 (`personal-match-1.1`):

- **Mosques:**
  - ≥ 200 mapped, or ≥ 20 mapped at a density of ≥ 5 per 1,000 km²: fit 100.
  - Otherwise ≥ 20 mapped: fit 60 ("partial").
  - Fewer than 20: not counted.
- **Halal:** ≥ 20 tagged places: fit 100. Otherwise not counted.
- **Language:** an official-language match gives fit 100. Otherwise not counted.

The density uses `areaKm2` from world-countries (total area).

## 3. Sensitivity audit

The audit covers all 193 countries with data, not a hand-picked handful.

### 3.1 Threshold sweeps (mosques)

Each row is compared with the current rule (200 / 20 / 5).

| Strong / floor / density | Good | Partial | Not counted | Countries that change |
|---|---|---|---|---|
| 200 / 20 / 5 (current) | 77 | 33 | 83 | 0 |
| 200 / 20 / 2 | 79 | 31 | 83 | 2 |
| 200 / 20 / 8 or 10 | 76 | 34 | 83 | 1 |
| 200 / 30 / 5 | 77 | 27 | 89 | 6 |
| 200 / 10 / 5 | 77 | 49 | 67 | 16 |
| 100 / 20 / 5 | 89 | 21 | 83 | 12 |
| 500 / 20 / 5 | 68 | 42 | 83 | 9 |

The density rule is insensitive. Moving it from 2 to 10 changes at most 2
countries, and no country sits within ±25 % of it. Seven countries are
"good" only because of it: Brunei (119 mapped), Cyprus (170), Djibouti
(149), Montenegro (169), Mauritius (84), Singapore (76) and Trinidad and
Tobago (71).

The absolute thresholds move a handful of countries each. Eighteen
countries sit within ±25 % of 20 or 200:

- Near 20: PL 19, HR 18, BI 18, BY 17, ZM 17, BW 15, IE 21, PT 21.
- Near 200: TD 163, ME 169, CY 170, AT 181, TM 182, RS 188, MM 195, GM 204,
  ES 226, BE 229.

The monthly refresh can flip these.

### 3.2 Threshold sweeps (halal)

| Floor | Good | Changes vs 20 |
|---|---|---|
| 5 | 93 | 31 |
| 10 | 78 | 16 |
| 15 | 69 | 7 |
| **20** | **62** | 0 |
| 30 | 49 | 13 |
| 50 | 40 | 22 |

Thirteen countries sit within ±25 % of 20:

- Below 20: GH 15, KG 15, PE 15, BH 17, AL 18, LB 18, LV 19.
- 20 or above: GR 20, RS 21, TZ 21, KR 22, LK 22, BG 23.

### 3.3 Group view

The groups are for this audit only. The "Muslim-majority" list is a
general-knowledge grouping of 44 catalog countries, not a sourced
dataset, and the product never uses it.

| Group | Countries | Mosques 1.1 | Mosques 1.2 | Halal |
|---|---|---|---|---|
| Muslim-majority (audit grouping) | 44 | good 42, partial 1, no data 1 | good 42, not counted 1, no data 1 | good 22, not counted 21, no data 1 |
| Highly mapped Western / East Asian | 21 | good 8, partial 12, not counted 1 | good 8, not counted 13 | good 21 |
| Very large (> 2 million km²) | 12 | good 8, partial 3, not counted 1 | good 8, not counted 4 | good 9, not counted 3 |
| Very small (< 1,000 km²) | 25 | good 3, not counted 22 | good 3, not counted 22 | good 2, not counted 23 |

### 3.4 Representative sample

| Country | Mapped mosques | Halal-tagged | Area km² | Mosques / 1,000 km² | Mosques 1.1 | Mosques 1.2 | Halal |
|---|---|---|---|---|---|---|---|
| Saudi Arabia | 13,331 | 140 | 2,149,690 | 6.20 | good | good | good |
| Egypt | 2,362 | 97 | 1,002,450 | 2.36 | good | good | good |
| Türkiye | 46,832 | 361 | 783,562 | 59.77 | good | good | good |
| Indonesia | 75,620 | 1,277 | 1,904,569 | 39.70 | good | good | good |
| Malaysia | 6,658 | 1,473 | 330,803 | 20.13 | good | good | good |
| Brunei | 119 | 45 | 5,765 | 20.64 | good (density) | good (density) | good |
| Singapore | 76 | 331 | 710 | 107.04 | good (density) | good (density) | good |
| Maldives | 322 | 422 | 300 | 1,073.33 | good | good | good |
| Qatar | 683 | 27 | 11,586 | 58.95 | good | good | good |
| Oman | 2,126 | 10 | 309,500 | 6.87 | good | good | not counted |
| Senegal | 2,950 | 3 | 196,722 | 15.00 | good | good | not counted |
| Afghanistan | 3,575 | 2 | 652,230 | 5.48 | good | good | not counted |
| Turkmenistan | 182 | 2 | 488,100 | 0.37 | partial | not counted | not counted |
| Chad | 163 | 7 | 1,284,000 | 0.13 | partial | not counted | not counted |
| France | 1,092 | 2,657 | 551,695 | 1.98 | good | good | good |
| United Kingdom | 1,411 | 1,024 | 242,900 | 5.81 | good | good | good |
| Germany | 1,632 | 1,529 | 357,114 | 4.57 | good | good | good |
| Italy | 128 | 238 | 301,336 | 0.42 | partial | not counted | good |
| Japan | 44 | 87 | 377,930 | 0.12 | partial | not counted | good |
| South Korea | 13 | 22 | 100,210 | 0.13 | not counted | not counted | good |
| United States | 1,207 | 1,577 | 9,372,610 | 0.13 | good | good | good |
| Canada | 337 | 378 | 9,984,670 | 0.03 | good | good | good |
| Australia | 124 | 107 | 7,692,024 | 0.02 | partial | not counted | good |
| Brazil | 41 | 12 | 8,515,767 | 0.00 | partial | not counted | not counted |
| Russia | 4,627 | 296 | 17,098,242 | 0.27 | good | good | good |
| Montenegro | 169 | 7 | 13,812 | 12.24 | good (density) | good (density) | not counted |
| Mauritius | 84 | 5 | 2,040 | 41.18 | good (density) | good (density) | not counted |
| Djibouti | 149 | 0 | 23,200 | 6.42 | good (density) | good (density) | not counted |
| Palestine | — | — | — | — | no data | no data | no data |

## 4. Anomalies

### A1 — The partial mosque level lowered scores (structural; corrected)

Personal Match is a weighted average:
`round((Σ w·fit + 8·50) / (Σ w + 8))`.

A factor at fit 60 pulls the result **down** whenever the country's other
factors average above 60. So under 1.1, a country with 20–199 mapped
mosques could score **below** a country with fewer than 20, whose factor
is simply not counted. More evidence gave a lower result.

This was measured with the real engine: 320 profiles (4 purposes, every
option combination of their first three questions, importance 100 and 60)
across the 33 partial countries.

- The mosque factor **lowered** the Personal Match in **3,664 of 10,560
  cases (34.7 %)**.
- The drop was up to 7 points (median 2), and all 33 countries were
  affected.

For example, one tourism profile gives:

| Country | Mapped mosques | Without the answer | With "very important" |
|---|---|---|---|
| Italy | 128 | 76 | 73 |
| Greece | 61 | 75 | 72 |
| Poland | 19 | 70 | 70 (unchanged) |

This contradicted the documented rule that thin evidence is "not counted,
never a low score". The 1.1 docs also claimed that a partial fit "is never
a penalty", which was wrong.

### A2 — Halal tags measure tagging culture (source limitation; kept, documented)

Tagging habits differ by region:

- Median halal tags per mapped mosque: **0.015** in the Muslim-majority
  audit group and **1.056** in the Western / East Asian group.
- **31 countries** with ≥ 200 mapped mosques have fewer than 20
  halal-tagged places, for example Sudan, Afghanistan, Yemen, Syria,
  Senegal, Oman, Somalia and Mali.
- All 21 Western / East Asian countries clear the floor. Only 22 of 43
  Muslim-majority countries with data do.

No floor fixes this. Even at 5 tags, 28 of 43 clear it, against 21 of 21.

The rule stays because the only corrections would infer halal
availability from something other than halal evidence, such as mosque
counts, which is close to the forbidden "Muslim-majority, therefore
halal". A "not counted" halal factor leaves that country's score exactly
as if the question had not been answered.

The limitation is relative. For someone for whom halal food matters,
countries with tagged places get a boost that halal-default countries do
not. The explanation says so in the traveller's language: "in many
countries halal is the norm and simply not tagged". The docs now state it
with these numbers.

### A3 — Absolute count vs country size (defensible; kept)

A large country reaches 200 with a low density; the United States has
0.13 mosques per 1,000 km². Travellers are in cities rather than spread
evenly, so a national total is used as "there are mosques to find", never
as a density claim.

The density rule exists for the opposite case, a small country with many
mosques for its size. It is stable (A1's sweep), and no country sits near
its threshold.

### A4 — Boundary scope (documented)

Counts come from OpenStreetMap's `admin_level=2` boundary, which can
include overseas parts. For example, France's includes its overseas
departments.

Areas come from world-countries. The count is an approximate national
total. An object mapped twice (a node and an area) can be counted twice.

### A5 — Language (defensible; kept)

The field is `languages`, which the world-countries README describes as the
"list of official languages". A match is positive evidence. No match is not
counted, and nothing assumes English or any other language is widely
usable.

## 5. Decisions

| Item | Decision | Why |
|---|---|---|
| Mosque partial level | **Corrected**: fewer than the good-match rule gives "not counted" | A1: structural, logically inconsistent, measured |
| Mosque thresholds 200 / 20 / 5 | Kept | Stable in the sweeps; not tuned to expectations |
| Halal floor 20, one level | Kept, bias documented | A2: a source limitation that no floor fixes |
| Language rule | Kept | A5 |

### The correction — `personal-match-1.2`

- **Before (1.1):** mosques good 77 / partial 33 / not counted 83 / no data 1.
- **After (1.2):** good 77 / not counted 116 / no data 1.
- **Affected:** 33 countries, only for travellers who answered the
  Islamic-practice question "very important" or "important":
  - MM, RS, TM, AT, TD, UA, IT, AU, GE, MG, CD, MZ, KH, MW, CH, NZ, ER
  - GY, SE, GR, RO, LR, JP, BR, DK, SR, NO, SS, VN, GA, FI, IE, PT
- **Coverage impact:** for those 33 countries the factor's weight (10 or 6)
  moves from evaluated to not counted. Coverage and confidence drop; the
  score is exactly what it would be without that answer.
- **Proof:**
  - After the change, 0 of the 10,560 cases are lowered.
  - A new regression test (`travelNeeds.monotonic.test.ts`) checks every
    purpose × two core profiles × each need at both importances × every
    country: answering a travel need never lowers a Personal Match.
- **Version:** `personal-match-1.1` → `personal-match-1.2`, as AGENTS.md
  requires for any threshold change. The profile schema (v2) is unchanged.
  The golden test still reproduces the v1.0.0 digests for profiles without
  the new answers.
- **Explanation copy:** a not-counted mosque or halal factor now shows the
  OpenStreetMap count, says it is below what Wejhaty's method needs, and
  says what that does not mean.

## 6. Licences and attribution

| Source | Package / upstream | Licence | Evidence |
|---|---|---|---|
| Official languages, country facts, boundaries | npm `world-countries` **5.1.0** (lockfile integrity `sha512-CXR6EBvT…O7g0w==`), upstream **github.com/mledoze/countries** | **ODC Open Database License 1.0** (flags excepted) | `node_modules/world-countries/LICENSE` is the ODbL text; the README's License section links it; the package.json has **no** `license` field; the upstream LICENSE (read from raw.githubusercontent.com) is the same ODbL |
| Mosques and halal places | OpenStreetMap via the public Overpass API (`overpass-api.de`) | **ODbL 1.0** | openstreetmap-website `config/locales/en.yml` (the text of openstreetmap.org/copyright): "credit OpenStreetMap and its contributors… you may distribute the result only under the same license"; "Provide credit to OpenStreetMap by displaying our attribution notice. Make clear that the data is available under the Open Database License… you may link to this copyright page" |

**Not the same project.** `world-countries` on npm (mledoze/countries) is
distinct from:

- similarly named country lists such as `world_countries` (with an
  underscore);
- `countries-list`;
- `i18n-iso-countries`.

Only `world-countries` is installed and used.

**What the licences ask of Wejhaty.** Both datasets ship inside the public
bundle as derived databases:

- `countryInfo.json`
- `countryBoundaries.json`
- `islamicTravelEvidence.json`

and the app displays results from them (a produced work).

ODbL §4.2 (conveying a derivative database) asks for the ODbL terms and
the licence URI with the database and its documentation. §4.3 (a produced
work) asks for a notice "reasonably calculated to make any Person … aware
that Content was obtained from the Database … and that it is available
under this License".

OpenStreetMap asks for "© OpenStreetMap contributors" and a clear ODbL
statement, typically a link to its copyright page. The OSMF attribution
guidelines page (osmfoundation.org) and the Open Data Commons site were
not reachable from the development environment; the requirements above
come from OpenStreetMap's own copyright-page text and the ODbL legal code
bundled with world-countries.

**Before RC2:**

- The UI named OpenStreetMap as the source of each count, but never
  showed "© OpenStreetMap contributors" or the licence.
- world-countries was credited only through the per-city "City data
  source" link.
- Two generator comments wrongly called world-countries "MIT".

**RC2:**

- Under "why this destination suits you", whenever a travel-need factor is
  part of the match, a short notice names each source, links "©
  OpenStreetMap contributors" to openstreetmap.org/copyright,
  mledoze/countries to its repository and "ODbL" to the licence. It also
  says the thresholds are Wejhaty's, not an OpenStreetMap rating.
- The generator comments are corrected.
- `docs/DATA_SOURCES_V1_1.md` records each source as a derived database
  under the ODbL.
