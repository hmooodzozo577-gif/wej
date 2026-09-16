# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

- State document version: 12
- Last verified date: 2026-09-16
- Working branch: `claude/modest-cray-34bvoa`
- Previous production frontend commit: `f60efd93`
- Production Worker source commit: `a2ecc2f1` (the Worker has NOT been
  redeployed since this round's changes — see Provider and external state)
- Git state re-verified directly before writing this: working tree clean, no
  merge/rebase in progress, branch pushed to
  `origin/claude/modest-cray-34bvoa`.
- 2026-09-16 USER ACCEPTANCE ROUND. The user personally tested the deployed
  build and reported 14 findings. All 14 are implemented and verified
  locally (718/718 frontend tests, 90/90 worker tests, TypeScript, oxlint,
  the production build, a Wrangler dry-run, and a Playwright visual sweep
  across Arabic RTL / English LTR x 390px / 1280px x light / dark). NOT yet
  deployed and NOT yet user-accepted.
- Two external dependencies remain and are unchanged by this round:
  Cloudflare D1/R2 (`Authentication error [code: 10000]`) and, new this
  round, a visa-data provider account. Neither is a code defect.

Always recover with `git branch --show-current`, `git status --short`,
`git fetch origin`, and `git log --oneline -30`.

## Product

Wejhaty (وجهتي) is a bilingual, no-login destination discovery and
recommendation app. Arabic is the default language; English is supported. The
React/Vite frontend deploys to GitHub Pages. A separate Cloudflare Worker hosts
server-side travel-provider integrations.

## Non-negotiable product rules

- Phase 14 is the deterministic final ranking authority. Questionnaire code may
  choose which supported question to ask next but may not invent scores,
  dimensions, or weights. The visa layer is not an exception: it lives outside
  the engine, changes no weight and no match score, and may only reorder
  destinations whose Phase 14 scores are already within 3 points of each
  other (see Passport and visa system).
- Israel (`IL`/`ISR`) is excluded from every effective catalog, routing,
  search, recommendation, image, and calculation path. Monaco (`MC`/`MCO`) is
  valid.
- Never fabricate flight prices, hotel prices, availability, inventory, or
  traveler budgets. Real provider prices and estimates must stay distinct.
- Never infer religion, ethnicity, politics, values, or cultural adaptability
  from location, nationality, language, or locale.
- Location and passport are different concepts and must never be conflated.
  Location (from the browser, always optional) answers "where is the traveller
  now" and drives proximity, land-border adjacency, and nearest/farthest.
  Passport (self-reported, optional, skippable) answers "what travel document
  will they travel on" and drives entry requirements only. Neither is ever
  inferred from the other: a Saudi passport holder currently in Germany is not
  a German passport holder. Only a passport COUNTRY is ever collected — never
  a passport number.
- Never fabricate a visa or entry-requirement claim. Two distinct things now
  exist and must not be confused:
  (a) the editorial easy/medium/hard visa label on a destination page, which
      is a general reference and must stay explicitly disclosed as not
      personalized to the viewer;
  (b) a passport-specific entry requirement, which may ONLY be shown when a
      real provider returned it, and only alongside that provider's name and
      a check date. With no provider configured the honest answer is
      "unknown", and that is what the system returns. Scraped or unofficial
      passport-index datasets are not an acceptable source.
- Precise coordinates remain in memory only and are not sent to external
  recommendation services, and are never exposed or transmitted beyond what a
  feature actually needs.
- Secrets never belong in the frontend or a `VITE_*` value.
- Preserve accepted destination and questionnaire layouts unless the user asks
  for a design change.
- `PROJECT_STATE.md` is the canonical current-state memory for this project.
  When it conflicts with current Git/code, current repository evidence wins
  and this file must be corrected, not the other way around.

## Current product decision: no AI

The user rejected the AI interview and AI explanations because their questions
and results were not practical or convincing. The current local implementation
removes natural-language interpretation, AI-generated turns, AI explanations,
frontend AI/profile orchestration, Worker `/api/ai/*` routes and provider
code, the `env.AI` binding, and AI deployment variables/smoke tests.

Do not restore an AI or Hybrid interview unless the user explicitly reverses
this decision.

## Questionnaire and ranking

- Phase 14 remains the deterministic ranking authority and scores all 194
  effective countries through a separate worldwide recommendation-profile
  layer. AI does not select questions, create fields, score, or explain.
- The questionnaire is deterministic and answer-driven. Each purpose declares
  its OWN ordered dimension list and its OWN wording for every dimension;
  there is no shared default bank. A real journey asks at most ten questions
  and resolves each canonical dimension once.
- Per-purpose dimensions (2026-09-16 audit). Coastal, island and tourism
  popularity are NOT asked for work, education, medical or investment — those
  questions cannot earn their place when choosing where to study, work, be
  treated or invest. Immigration keeps the coastal preference (a real question
  about somewhere to live) but not the island one. The dimensions removed were
  replaced by relevant ones drawn from indicator data the engine already has
  (job opportunities and economic growth for work; education indicators and
  post-graduation opportunities for education; health-system and income
  indicators for medical), so every purpose still has at least eight scored
  dimensions. A question's profileKey is unique within its purpose, which is
  enforced structurally — a previous build had a tourism question that could
  never be reached or scored because it duplicated an already-asked dimension.
- Location-dependent questions (proximity, land travel) are asked ONLY when
  there is real location context. Without it they are absent from the bank
  entirely, and if location is later lost, both the answers and the asked-path
  entries are dropped rather than surviving as stale preferences.
- Region, subregion, latitude/longitude band, and compass-direction questions
  are absent.
- The optional land-travel question narrows ranked candidates to countries
  sharing a direct land border with the nearest-centroid-resolved current
  country (an approximation, the same technique as the nearby-country
  feature); it never claims open crossings, visa eligibility, or a currently
  drivable route, and it falls back to the unfiltered catalog rather than ever
  returning zero results (e.g. an island nation with no land borders).
- "Why this suits you" is written in the traveller's own words, not in engine
  terminology. It is built deterministically from the chain: the answer, its
  canonical meaning, the destination's real profile value, then a match or a
  trade-off. The option label the traveller picked is quoted back; a trade-off
  names the real DIRECTION of the gap, computed from the profile. Two to four
  matched factors are named, and one trade-off only when a genuinely weak
  answered factor exists. Arabic uses a nominal clause so it cannot disagree
  in gender with any of 194 country names. Nothing claims a perfect or
  guaranteed fit, and no factor is named that was not actually answered and
  actually scored.
- Selecting an option advances automatically. A brief transition indicates that
  the next question is being prepared.
- After five answered questions, the traveler may show results now or continue
  answering to improve the result.
- The passport question is the LAST step of the questionnaire, immediately
  before the results transition — never a card below the results, where it
  could not affect them. It is optional and skippable, and skipping clears any
  earlier choice rather than quietly keeping it.
- Back remains available. Changing an earlier answer truncates stale downstream
  answers and recomputes the branch.
- Budget options retain the canonical approximate numeric SAR ranges. Only the
  question stem varies by purpose.
- Ranking inputs use the committed World Bank indicator snapshot, existing
  World Bank price-level snapshot, UN Tourism/OWID arrivals snapshot, and
  country geography. Missing numeric observations use the worldwide median,
  with direct coverage and imputed dimensions recorded and disclosed.
- Every country has a tested ideal answer profile that places it in the top
  five for at least one purpose. A fixed 40,000-path deterministic sample
  (5,000 per purpose, fixed seed, so it never flakes) additionally requires
  every one of the 194 to appear at least once; this proves tested
  reachability, not equal appearance frequency.
- If the traveler explicitly shared location, distance breaks exact score ties
  only. It does not change match scores, and the Results page displays a note
  when the proximity tie-break is used.
- Latest full frontend verification: 718/718 tests passed in one complete run
  (2026-09-16). TypeScript, oxlint, and the production build pass.

### Current recommendation limitation

All 194 countries are recommendation candidates, but the source datasets are
not complete for every indicator. Missing observations are median-imputed and
disclosed, so a match percentage is an estimate rather than a guarantee. The
40,000-path test is broad deterministic coverage, not an exhaustive
enumeration of the questionnaire's combinatorial answer space.

## Passport and visa system

- The traveller may optionally name the PASSPORT they would travel with. Only
  the passport COUNTRY is collected; no passport number is asked for, stored,
  or representable anywhere in the request shape.
- The recommendation engine never talks to a visa vendor. It talks to
  `VisaRequirementsProvider` (`worker/src/visa.ts`), which returns Wejhaty's
  own canonical vocabulary: `visaFree`, `visaOnArrival`, `eVisa`,
  `authorizationRequired`, `embassyVisaRequired`, `unknown`.
- Provider research and the decision record are in `/VISA_PROVIDERS.md`. IATA
  Timatic/AutoCheck, VisaHQ and Sherpa were evaluated; all three require a
  commercial account, partnership or approved key. Scraped "passport index"
  datasets were evaluated and REJECTED as unofficial and unverifiable. Sherpa
  is the chosen first adapter.
- With no provider configured — today's state — every lookup answers
  `unknown`, the UI says the visa service is not enabled, and ranking is
  unaffected. Provider failure, timeout, non-2xx and malformed JSON all
  resolve to `unknown`. There is no fabricated fallback anywhere in the path.
- RANKING BOUNDARY, deliberately narrow: the visa layer is outside the engine.
  It changes no Phase 14 weight, dimension or semantic, and no match score —
  the percentage shown is identical with and without a passport. It may only
  reorder destinations whose Phase 14 scores are already within 3 points of
  each other, so a materially better match can never be pushed below a
  materially worse one. Without a passport, or for an `unknown` requirement,
  it does nothing at all.
- A score-blending design (adding a visa term to the weighted total) would be
  a Phase 14 weight change and is deliberately NOT implemented. It is the one
  open product decision from this round: see Roadmap gate.
- Display always carries the provider name and the check date, plus a standing
  caveat that requirements change and must be re-checked before booking.
  Nothing promises entry, visa approval, an open border, or legal eligibility
  beyond what the provider returned.
- Status: `READY — PROVIDER ACCOUNT/CREDENTIALS REQUIRED`.

## Country pages and optional information

- All 194 effective countries have a factual country-information layer:
  identity, capital, region, area, currencies, languages, calling code, and
  borders where available. Countries outside the original editorial 30 now
  receive a country-specific factual overview instead of an insufficient-data
  notice.
- Planning sections for Travel, Accommodation, Travel Cost, and Tourism are
  conditionally mounted. They stay hidden on every entry path until the user
  chooses “Show additional information”.
- Hidden optional sections do not initiate dynamic provider/data work.
- The 30 original destinations retain richer editorial descriptions, cities,
  strengths, and weaknesses. Equivalent verified editorial coverage for the
  other 164 is not yet complete; their recommendation eligibility and factual
  overview must not be described as equivalent hand-written editorial content.
- A separate optional "Prominent cities" section covers all 194 effective
  countries with one to five entries each (829 cities; 810 carry at least one
  distinguishing fact). Each city shows SOURCED FACTS, not prose: its role
  (capital / largest known city / Nth-largest by source population), its
  administrative region, its IANA time zone, its approximate population, the
  straight-line distance and eight-point compass bearing from the national
  capital, and the nearest IATA-coded airport WITHIN THE SAME COUNTRY. A field
  the source does not have is omitted, never filled in.
  The previous build printed one of two fixed sentences chosen by whether the
  city was the capital, so five cities in a country differed only by name and
  population — the user reported exactly that.
  What is deliberately NOT generated: "known for", notable attractions, or
  character descriptions. There is no licensed offline source covering those
  for ~830 cities, and inventing them is ruled out. The card says so in both
  languages rather than implying the facts are hand-written editorial, and
  region and airport names are disclosed as appearing in their source
  language. Its toggle label reads "Show more"/"Show less" (Arabic: "إظهار
  المزيد"/"إظهار أقل"), reflecting real open/closed state.
- The auto-generated overview paragraph for the 164 non-editorial countries no
  longer restates facts already shown in the adjacent Country Information
  card (capital, area, currency, languages); that card, "why this suits you"
  (when present), and the recommendation-profile summary are the overview.
- The destination hero's name/subtitle color is fixed (not `var(--white)`,
  which dark theme redefines to a dark surface color) plus a stronger text
  shadow, so it stays legible over any hero photo in both themes.
- The editorial easy/medium/hard visa label carries an explicit note that it
  is a general reference, not personalized to the viewer. It is a DIFFERENT
  thing from the passport-specific entry requirement (see Passport and visa
  system) and the two must never be presented as one.
- Every destination page ends with its own 1-5 star rating form (see
  Anonymous product data, ratings, and feedback).

## Destination discovery, navigation, and theme

- Explore sorting supports default order, localized A–Z/Z–A, largest/smallest
  area, lower/higher relative price level, and — only with real location
  context — nearest AND farthest. Both distance sorts exclude the traveller's
  own (nearest-centroid-resolved) country. Without location neither is
  offered, and a short note says why rather than silently omitting them; a
  distance sort saved before location was lost falls back to default order
  instead of claiming to sort by distance. Missing/imputed price observations
  do not outrank direct sourced values.
- Location resolution runs from the shared coordinates HOWEVER they were
  granted — the app-wide first-visit prompt, Explore's own card, or a grant
  already in app state. (A previous build resolved only inside Explore's own
  click handler, so granting via the app-wide prompt left that card showing
  its heading and nothing else.)
- Browser geolocation is a two-stage request: a fast coarse attempt that
  accepts a recent cached fix, escalating to a high-accuracy attempt only
  after TIMEOUT or POSITION_UNAVAILABLE. A PERMISSION_DENIED is final and is
  never re-prompted. Each request returns a coordinate-free diagnostic
  (phase, per-stage deadline/duration/outcome) so a browser-phase failure can
  be told apart from app-side country/city resolution, which is timed
  separately. A recoverable failure no longer poisons app-wide location
  state: the app-wide prompt offers a retry instead of disappearing.
- "Surprise me" is a TRAVEL COMPASS: a dial with real tick marks, localized
  cardinal letters, and a gold needle that sweeps while real candidate flags
  cycle in its centre window. When the traveller has shared their location the
  needle settles on the destination's real great-circle bearing from them and
  the result is captioned with that direction; with no location it settles due
  north and no direction is claimed. Selection is unchanged: equal chance from
  the current filtered catalog, crypto random, and no repeat during the
  browser session until candidates are exhausted. A reduced-motion preference
  skips the sweep while still moving the needle to its real bearing.
- Destination pages preserve the list context from Explore or Results. The
  previous/next controls live INSIDE the hero image, at its inline start and
  end edges, as translucent blurred 44px circles; the hero's own text reserves
  those gutters so the country title never runs underneath them. The
  destination name is the control's accessible name and native tooltip — an
  inline expanding label cannot fit this hero without covering the title.
  Direct links use localized alphabetical order; surprise entries keep their
  single return link below the hero.
- Every dropdown in the app is a custom listbox, not a native `<select>`. The
  previous build styled only the closed control, so the OPEN menu was still
  drawn by the browser/OS with no Wejhaty identity and no dark-theme
  awareness. The listbox implements the WAI-ARIA contract (arrow keys,
  Home/End, PageUp/PageDown, Enter/Space to commit, Escape to close with focus
  return, Tab to close, type-ahead, aria-activedescendant), flips above the
  trigger when there is no room below, and has a searchable variant used by
  the ~194-option passport selector. No dependency was added.
- Theme supports system, light, and dark modes. System is the default, tracks
  live device changes, manual choice persists locally, and the pre-render boot
  script prevents a wrong-theme flash. The System option uses a SUN icon, not
  a monitor glyph. Below 640px the control collapses to its icon and chevron
  so the nav row fits a 390px screen.
- All visible numbers render as Latin digits in both languages. Two separate
  leaks existed and both are closed at `data/format.ts`: locale-aware
  formatters (pinned to 'en-US' digits regardless of UI language) and literal
  Arabic-Indic digits typed into translated content and destination data
  (normalized at the data boundary, so a re-extraction of the generated files
  cannot reintroduce them). Two regression layers enforce it — a data-level
  scan of every dictionary, destination, country record, featured city and
  question bank, and a render-level scan of real Arabic screens that walks
  text nodes plus aria-label/title/placeholder/alt.

## Anonymous product data, ratings, and feedback

- The frontend records bounded anonymous product events for page use,
  questionnaire choices, Explore filters, surprise use, theme, permission
  outcome, coarse device/browser class, load timing, and safe client-error
  categories. It does not transmit search text, precise coordinates, IP
  addresses, fingerprints, stack traces, or arbitrary model content. The
  location diagnostic added this round carries stage timings and outcomes
  only — the type itself cannot hold coordinates.
- Two rating levels, both 1-5 stars plus an optional free-text comment:
  'results' rates a whole recommendation set, 'destination' rates one country
  page and carries the country plus the coarse route the traveller arrived by
  ('results', 'explore', 'surprise', 'direct'). The per-country "useful / not
  useful" votes and the reason pills are gone. Submit is disabled and the
  requirement stated before the traveller tries; the request has a loading
  state; success and failure are both explicit, and a failure offers a retry
  that keeps what was typed. Ratings never change Phase 14 scores or order.
- The shared star control is a real radio group: arrow keys move the
  selection and a screen reader announces "3 of 5".
- Global and country-specific feedback accepts a categorized message, optional
  email, and optional bounded image attachment, then returns a reference ID.
  Worker validation, per-session rate limiting, private R2 storage, and optional
  Turnstile are implemented.
- Cloudflare D1 migrations define sessions, events, ratings, feedback, and daily
  aggregate tables. Migration 0002 adds the rating kind, comment, country and
  origin columns additively — existing rows keep their meaning and default to
  kind 'results'. A scheduled job retains aggregates, deletes raw events and
  ratings after 90 days, and removes feedback contact/device/screenshot links
  after 90 days while preserving the issue record.
- `/admin` is a separate developer dashboard shell. Its data endpoint requires
  `ADMIN_TOKEN` and uses constant-time bearer validation. The secret is not
  configured in Git. Cloudflare Access is recommended as an additional account
  layer before operational use.
- D1 REALITY — none of this persists in production. Worker verification:
  90/90 tests, TypeScript, and a Wrangler dry-run pass. Product-data requests
  return `503 product_data_unavailable` because D1/R2 provisioning was
  rejected by Cloudflare with authentication error `10000`; the rating UI
  therefore shows its error-and-retry state honestly. Last verified from the
  "Deploy Cloudflare Worker" GitHub Actions run logs on 2026-09-15 (run for
  commit `a2ecc2f1`): `Authentication error [code: 10000]` on
  `/accounts/*/d1/database`; the worker itself still deploys without the
  D1/R2 bindings via the workflow's documented fallback path. This is an
  external Cloudflare account/token permission gap (`CLOUDFLARE_API_TOKEN`
  lacks D1/R2/Workers edit access), not a code defect —
  `READY — USER/ACCOUNT CONFIGURATION REQUIRED`. Do not describe rating or
  feedback persistence as working until this is resolved.

### Next-stage analytics plan (kept, not started)

Explicitly preserved so it is not lost: Cloudflare D1 + R2, migrations,
`ADMIN_TOKEN`, Turnstile, Cloudflare Access, real production telemetry
persistence, and an analytics dashboard covering overview, traffic,
questionnaire funnel, recommendation quality, country performance, feedback,
reports, and errors, with date/device/language/purpose filters and export
support later. The full admin dashboard is deliberately NOT implemented in
this round and must not be started without an explicit instruction.

## Destination images

- Local coverage is 194/194 effective countries; `IL`/`ISR` is absent.
- Photos now appear on Explore and Results cards as well as destination heroes.
  Card and hero crops are audited separately; per-country object-position
  overrides correct the reviewed edge cases without replacing accepted layout.
- Every current image was visually reviewed on 2026-09-12. It depicts an
  in-country landmark, notable cityscape, nationally important site, or
  representative natural landscape.
- The old Commons free-search path allowed embassies abroad, US place-name
  homonyms, maps, documents, toys, vehicles, and random objects. The pipeline
  now starts from the human-edited Wikivoyage country article, retrieves exact
  license/attribution metadata from Wikimedia Commons, applies semantic/file/
  aspect filters, and supports reviewed exact-title overrides.
- `app/scripts/destinationImageAudit.json` records the approved source for
  every country. Tests fail if a regenerated manifest silently differs.
- Manifest: `app/src/data/generated/destinationImages.json`.
- Assets: `app/public/destinations/*.webp`.
- Status: implemented, visually reviewed, deployed, and production-verified.

## Architecture map

| System | Path |
|---|---|
| Frontend | `app/` |
| Deterministic ranking | `app/src/engine/`, `app/src/data/worldRecommendation.ts` |
| Deterministic question selection | `app/src/adaptive/selectNextQuestion.ts` |
| Questionnaire route | `app/src/routes/Quiz.tsx` |
| Catalog | `app/src/data/worldCatalog.ts` |
| Rich 30-country editorial profiles | `app/src/data/generated/destinations.json` |
| Worldwide recommendation inputs | `app/src/data/generated/recommendationIndicators.json` |
| Basic worldwide facts | `app/src/data/generated/basicCountries.json`, `countryInfo.json` |
| Image pipeline/review | `app/scripts/generate-destination-images.mjs`, `destinationImageAudit.json` |
| Destination route | `app/src/routes/Destination.tsx` |
| Visa provider abstraction | `worker/src/visa.ts` |
| Visa client / bounded ranking layer | `app/src/visa/` |
| Custom listbox | `app/src/components/Select.tsx` |
| Digit/number formatting layer | `app/src/data/format.ts` |
| Hero edge navigation | `app/src/components/DestinationHeroNav.tsx` |
| Rating forms | `app/src/components/ResultRating.tsx`, `DestinationRating.tsx` |
| Travel Worker | `worker/` |
| Amadeus adapter | `worker/src/amadeus.ts` |
| Tourism data | `app/src/data/tourismInsights.ts` |
| Relative price-level data | `app/src/data/travelCostIndex.ts` |

## Provider and external state

- The travel-only Cloudflare Worker is deployed and production-verified. The
  production flight route preserves its CORS and validation contracts; removed
  AI routes return 404.
- Amadeus code is ready. Live offers require external
  `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` provisioning.
- Live hotel integration is not implemented. `app/HOTEL_INTEGRATION.md` is an
  architecture note.
- Tourism uses UN Tourism data via OWID. Relative price level uses World Bank
  `PA.NUS.GDP.PLI`; PLI is not a traveler budget or hotel/flight price.
- Data-refresh workflow code is ready. Automatic PR creation was last reported
  to require the external GitHub setting allowing Actions to create and approve
  pull requests; re-check before relying on that report.
- Product-data code is ready. The Worker deployment workflow creates D1/R2 and
  applies migrations when its Cloudflare token has D1, R2, and Workers edit
  permissions. The current repository token is verified to lack D1 access.
  `ADMIN_TOKEN`, Turnstile keys, and optional Cloudflare Access are external
  account configuration and are not yet verified.
- Visa data: no provider is configured. The abstraction, the canonical
  vocabulary, request validation (including the IL exclusion), the Sherpa
  adapter and its category mapping, failure behaviour, the Worker endpoint,
  the passport UX and the bounded ranking layer are all implemented and
  tested. `SHERPA_API_KEY` (and `SHERPA_BASE_URL` for the sandbox) are Worker
  secrets, never committed and never in the frontend.
  `READY — PROVIDER ACCOUNT/CREDENTIALS REQUIRED` — see `/VISA_PROVIDERS.md`
  for the comparison, the decision, and the exact switch-on steps.
- The Worker has NOT been redeployed since the 2026-09-16 round. The visa
  endpoint and the extended ratings endpoint exist in source and pass a
  Wrangler dry-run, but are not live.

## Cancelled/out-of-scope features

Do not resurrect without an explicit user decision:

- numeric accommodation cost without legitimate live provider data;
- numeric traveler budget / fabricated SAR-per-day;
- cultural compatibility ranking.

## Roadmap gate and immediate backlog

Phase 17 has not started. Current order:

1. Deploy the 2026-09-16 acceptance round and obtain the user's own
   production test. Nothing from that round is user-accepted yet.
2. AWAITING A PRODUCT DECISION — visa scoring. The current visa layer only
   reorders destinations already within 3 Phase 14 points of each other. The
   alternative, NOT implemented, is to blend visa convenience into the
   weighted score itself. That would be a Phase 14 weight/semantic change,
   which the user approved visa data affecting suitability but did NOT
   pre-approve, so it is a decision to take before any such change:
     - proposed shape: one additional scored dimension, `visaConvenience`,
       normalized 0-100 from the canonical category (visaFree 100,
       visaOnArrival 80, eVisa 60, authorizationRequired 40,
       embassyVisaRequired 0, unknown excluded rather than defaulted),
       weighted alongside the existing dimensions;
     - proposed weight: 8-11, i.e. between `island` (5) and `safety` (11),
       so it is a real factor but not a dominant one;
     - it would only apply when a passport is given AND a provider answered,
       so most users would see no change at all today;
     - it needs re-running the per-country reachability and the 40,000-path
       coverage tests, because adding a dimension changes both.
   Accept, reject, or amend before it is built.
3. Obtain a visa-data provider account (Sherpa first — see
   `/VISA_PROVIDERS.md`), verify the category mapping against a real sandbox
   response, confirm in writing what the terms permit (caching, storage,
   attribution, and whether the data may inform ranking as well as display),
   then set `SHERPA_API_KEY` as a Worker secret.
4. Update the repository `CLOUDFLARE_API_TOKEN` with D1, R2, and Workers edit
   permissions, rerun the Worker workflow, and production-verify event, rating,
   feedback, retention, and admin-summary persistence.
5. Configure `ADMIN_TOKEN`, Turnstile keys, and preferably Cloudflare Access for
   operational feedback and dashboard use.
6. Decide whether sourced rich editorial descriptions, strengths, and
   weaknesses — and city "known for" narrative, which no licensed offline
   source currently covers — are required for the remaining 164 countries.
7. Reassess the roadmap with the user before Phase 17.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
