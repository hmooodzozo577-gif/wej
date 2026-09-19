# City descriptions — sources, licensing, coverage

Acceptance item #3. This records what was investigated, what was chosen, why,
and exactly how much coverage exists. It is the provenance record the brief
asks for; `PROJECT_STATE.md` carries the one-line status.

## Production verification — 2026-09-19

The deployed English path was verified with Tokyo, Riyadh, Zürich, Bogotá,
Reykjavík and Montréal. The Arabic path initially returned `wrong_place` for
correct articles because Wikipedia's Arabic REST summaries commonly omit the
inline `coordinates` object. The Worker now fetches the Arabic summary and its
English companion in parallel, accepts companion coordinates only when both
pages carry the exact same Wikidata entity, and still applies the 45 km city
guard. Arabic text and attribution continue to come from the Arabic article.

Legacy Arabic `wrong_place` cache rows from before the policy change are
refreshed once. A temporary companion-request failure returns `unavailable`
without storing a false seven-day rejection. Worker deployment run
`35456017713` succeeded; production returned verified Arabic descriptions for
Riyadh, Tokyo and Zürich. The Arabic Japan page then rendered Tokyo's prose,
source and licence without the fallback. This is sampled production proof;
full 810-city coverage remains measured by the Admin cache report rather than
claimed from the sample.

## What the user asked for

Each featured city should carry BOTH:

- **A.** a general description — what the city is known for, what kind of
  place it is, what makes it distinct;
- **B.** the structured facts already shipped (administrative region,
  population, time zone, distance and bearing from the capital, nearest
  IATA airport).

Explicitly rejected: any return to a per-city-type template
(`"[City] is one of the major cities of [Country]"`), and any fabricated,
generated or AI-written factual filler.

## Historical egress re-check, 2026-09-16

The previous round reported that the agent sandbox could not reach the
encyclopedic sources. That was re-tested from scratch this round, not
assumed. Every probe below is a real request made during this task.

| Host | Result |
|---|---|
| `en.wikipedia.org` | **403 at the egress proxy** (`connect_rejected`) |
| `ar.wikipedia.org` | **403 at the egress proxy** |
| `www.wikidata.org` | **403 at the egress proxy** |
| `query.wikidata.org` | **403 at the egress proxy** |
| `en.wikivoyage.org` | **403 at the egress proxy** |
| `api.wikimedia.org` | **403 at the egress proxy** |
| `dumps.wikimedia.org` | **403 at the egress proxy** |
| `dbpedia.org` | **403 at the egress proxy** |
| `api.geonames.org` | **refused — "Host not in allowlist"** |
| `secure.geonames.org` | **403 at the egress proxy** |
| `huggingface.co` | **403 at the egress proxy** |
| `registry.npmjs.org` | 200 (reachable) |
| `pypi.org` | 200 (reachable) |

So the sandbox's only at-scale data channel is a package registry.

## Package registries were searched, and have nothing

Searched npm for city/description/wikidata/wikivoyage/geonames datasets.
Every candidate that exists is **coordinates, population, time zone and
administrative area** — the same class of structured fact this project
already ships — and none carries descriptive prose:

- `city-timezones` (already used), `all-the-cities`, `cities.json`,
  `cities-1000-structured`, `world-cities-json`, `@worldkit/cities`,
  `country-state-city`, `countries-states-cities` — no descriptions.
- `wikibase-sdk`, `wikibase-dump-filter`, `wtf-plugin-wikivoyage`,
  `@bcye/structured-wikivoyage-types` — **clients and parsers, not data**.
  Every one of them needs live access to the wiki this sandbox cannot reach.

Wikidata's own `description` field, even if it were reachable, is a short
disambiguating phrase ("city in Catalonia, Spain") — which is precisely the
generic template class the user rejected, not a general description.

## The decision: fetch from the Worker, not from the build

The sandbox cannot reach Wikipedia. **The deployed Cloudflare Worker can** —
it runs on Cloudflare's network with ordinary outbound access. So the
description layer is a Worker service rather than a file baked at build time.

That is also the better design on its own merits: freshness is real rather
than frozen at build time, the app bundle does not grow by ~830 paragraphs
in two languages, and the cache lives in the same D1 database the rest of the
product-data layer uses.

### Source

**Wikipedia REST summary API** —
`https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}?redirect=true`

| | |
|---|---|
| **Source** | Wikipedia (`ar` and `en` wikis) |
| **Licence** | CC BY-SA 4.0 (article text; also GFDL) |
| **Attribution** | Rendered in the UI with every description: source name, a link to the article, and a link to the licence |
| **Access** | The documented public REST API, with a descriptive `User-Agent` as Wikimedia's API policy asks. Not scraping, and not a prohibited source — the brief names Wikipedia/Wikivoyage as acceptable "where licensing/use allows" |
| **Freshness** | Verified descriptions re-checked after 30 days; misses retried after 7 days. `fetched_at` is stored per row |
| **Coverage** | Unknown until the Worker runs against the live API — see below |

### Correctness guard: a namesake can never be described in place of a city

"Tripoli", "Santiago", "Córdoba" and "Valencia" all name several real
places. A summary is accepted **only** when:

1. the article's `type` is `standard` (a disambiguation page is rejected), and
2. the article carries its own coordinates, and
3. those coordinates are within **45 km** of the city we asked about.

The reference coordinates live in the Worker
(`worker/src/generated/cityCoordinates.json`, 810 cities, written by
`app/scripts/generate-featured-cities.mjs`). **The browser never sends a
coordinate of any kind** — it sends a country code and city names only.

An article that fails any check produces **no description at all**, and the
card renders its structured facts alone. There is no fallback text, because
a fallback would be invented text.

`worker/src/cityDescriptions.test.ts` pins this behaviour, including the real
Tripoli (Lebanon) vs Tripoli (Libya) collision in this catalog.

## Coverage today

| | |
|---|---|
| Cities with structured facts | **810 of 829** (unchanged) |
| Cities with a verified description in the 2026-09-19 production sample | **9/9 requests succeeded** — six English city samples plus Arabic Riyadh, Tokyo and Zürich |
| Full production coverage | Read from the Admin `city_descriptions` cache report; the small verification sample is not extrapolated to all 810 cities |

**No filler was written to claim a higher number.** The implementation is
complete and tested; the measurement is not something this environment can
produce, and it is not being guessed.

## Rejected alternatives

| Option | Why not |
|---|---|
| Baking a description file at build time | The build sandbox cannot reach any encyclopedic source. Also freezes freshness |
| Scraped `passport-index`-style community dumps | Already rejected for visa data on the same grounds — unofficial, unlicensed, unverifiable |
| Wikidata `description` | A one-line disambiguator, which is the rejected generic-template class |
| Deriving a description from data we hold (coastal / inland / administrative) | This is a template with more branches. The user rejected templates, not one particular template |
| Generating descriptions with a language model | Fabrication. Also, AI is removed from Wejhaty |

## What the user may want to change

Nothing is required — the feature is complete and will start returning
descriptions as soon as the Worker is deployed. Two optional switches exist:

- `CITY_DESCRIPTIONS=off` in the Worker's `[vars]` disables outbound
  description fetching entirely, leaving facts-only cards.
- If the agent sandbox's egress allowlist ever gains `en.wikipedia.org` and
  `ar.wikipedia.org`, coverage can also be measured directly from CI rather
  than only from the admin dashboard.
