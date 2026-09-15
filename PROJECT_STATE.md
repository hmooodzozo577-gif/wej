# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

- State document version: 10
- Last verified date: 2026-09-15
- Working branch: `claude/marhaba-kxry8l`
- Production frontend commit: `e70ff5d2a02fd7aa7a763055b1a76cec9aa12339` (pre-dates
  this session's changes — see below for what is implemented but not yet
  deployed)
- Production Worker source commit: `a2ecc2f18293727bc74575529befb9e0fc6e2c15`
  (unchanged this session — no `worker/` files were touched)
- Latest verified implementation commit: see Git log for this session's commit
  on `claude/marhaba-kxry8l`
- The latest discovery, cities, theme, ratings, and feedback UI is deployed and
  production-verified. Worker code is deployed, but D1/R2 storage is unavailable
  until the Cloudflare API token receives the required account permissions —
  re-verified live via GitHub Actions run logs on 2026-09-15 (see Provider and
  external state): still `Authentication error [code: 10000]`.
- The worldwide deterministic questionnaire, 194-country ranking, factual
  overview, external-card image, and crop changes are deployed and
  production-verified. User acceptance is pending.
- 2026-09-15 polish/correction pass (15 approved items: overview
  deduplication, hero readability, select/dropdown redesign, destination
  pager placement, "Show more/less" wording, Latin-digit formatting audit, an
  optional land-travel filter question, a location-reuse fix on Explore, a
  Surprise Me redesign, excluding the user's own country from "nearest",
  purpose-specific question wording, a dynamic "why this suits you"
  explanation, optional nationality with honest visa-limitation disclosure,
  and re-verification of the result-feedback UX and D1/R2 external state) is
  implemented and passes the full test suite (567/567 frontend, 57/57
  worker), TypeScript, oxlint, and the production build locally. It has been
  committed to this branch but its deployment status must be re-checked
  against the GitHub Actions run for the commit that introduces it before it
  is called production-verified.

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
  dimensions, or weights.
- Israel (`IL`/`ISR`) is excluded from every effective catalog, routing,
  search, recommendation, image, and calculation path. Monaco (`MC`/`MCO`) is
  valid.
- Never fabricate flight prices, hotel prices, availability, inventory, or
  traveler budgets. Real provider prices and estimates must stay distinct.
- Never infer religion, ethnicity, politics, values, or cultural adaptability
  from location, nationality, language, or locale.
- Precise coordinates remain in memory only and are not sent to external
  recommendation services.
- Secrets never belong in the frontend or a `VITE_*` value.
- Preserve accepted destination and questionnaire layouts unless the user asks
  for a design change.

## Current product decision: no AI

The user rejected the AI interview and AI explanations because their questions
and results were not practical or convincing. The current local implementation
removes natural-language interpretation, AI-generated turns, AI explanations,
frontend AI/profile orchestration, Worker `/api/ai/*` routes and provider
code, the `env.AI` binding, and AI deployment variables/smoke tests.

Do not restore an AI or Hybrid interview unless the user explicitly reverses
this decision.

## Questionnaire and ranking

- Phase 14 remains the deterministic ranking authority and now scores all 194
  effective countries through a separate worldwide recommendation-profile
  layer. AI does not select questions, create fields, score, or explain.
- The questionnaire is deterministic and answer-driven. It contains 80
  bilingual concrete preference questions across eight purposes. A real journey
  asks at most ten questions and resolves each canonical dimension once.
- It starts with the explicit proximity preference. That answer opens climate
  or cost first, and later answers deterministically change which useful
  unresolved dimension is asked next. Region, subregion, latitude/longitude
  band, and compass-direction questions are absent.
- Every purpose's shared dimension questions (climate, budget, popularity,
  coastal, island) use purpose-neutral or purpose-templated wording, not
  hardcoded tourism/"trip" phrasing — Education, Work, Medical, Investment,
  Immigration, and Wellness no longer ask a tourism-worded question.
- An optional, deterministic land-travel question is appended to a purpose's
  bank only when the app already has the user's location. Answering "yes"
  narrows ranked candidates to countries sharing a direct land border with
  the nearest-centroid-resolved current country (an approximation, same
  technique as the existing nearby-country feature); it never claims open
  crossings, visa eligibility, or a currently drivable route, and it falls
  back to the unfiltered catalog rather than ever returning zero results
  (e.g. an island nation with no land borders).
- "Why this suits you" is generated from the same real per-destination
  `Reason` weights the ranking engine already produces: the match-strength
  phrasing varies with the real score, the strongest matched factor is named
  first, and one honest trade-off (an actually-answered, meaningfully
  weaker-fitting factor) is named only when one exists — never invented.
- Selecting an option advances automatically. A brief transition indicates that
  the next question is being prepared.
- After five answered questions, the traveler may show results now or continue
  answering to improve the result.
- Back remains available. Changing an earlier answer truncates stale downstream
  answers and recomputes the branch.
- Budget options retain the canonical approximate numeric SAR ranges.
- Ranking inputs use the committed World Bank indicator snapshot, existing
  World Bank price-level snapshot, UN Tourism/OWID arrivals snapshot, and
  country geography. Missing numeric observations use the worldwide median,
  with direct coverage and imputed dimensions recorded and disclosed.
- Every country has a tested ideal answer profile that places it in the top
  five for at least one purpose. A fixed 4,800-path deterministic sample also
  requires every country to appear at least once; this proves tested
  reachability, not equal appearance frequency.
- If the traveler explicitly shared location, distance breaks exact score ties
  only. It does not change match scores, and the Results page displays a note
  when the proximity tie-break is used.
- Latest full frontend verification: 553/553 tests passed in one complete
  run. TypeScript, oxlint, the production build, AR/EN browser checks, and
  mobile overflow checks pass.

### Current recommendation limitation

All 194 countries are recommendation candidates, but the source datasets are
not complete for every indicator. Missing observations are median-imputed and
disclosed, so a match percentage is an estimate rather than a guarantee. The
4,800-path test is broad deterministic coverage, not an exhaustive enumeration
of the questionnaire's combinatorial answer space.

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
- A separate optional “Prominent cities” section covers all 194 effective
  countries with one to five entries selected from sourced capital and
  population data. Each city discloses its capital/major-city classification,
  approximate population when available, source link, and data caveat. This is
  factual coverage, not unique hand-written tourism editorial for every city;
  many Arabic city names honestly fall back to their source-language spelling.
  Its toggle label reads "Show more"/"Show less" (Arabic: "إظهار
  المزيد"/"إظهار أقل"), reflecting real open/closed state.
- The auto-generated overview paragraph for the 164 non-editorial countries no
  longer restates facts already shown in the adjacent Country Information
  card (capital, area, currency, languages); that card, "why this suits you"
  (when present), and the recommendation-profile summary are the overview.
- The destination hero's name/subtitle color is fixed (not `var(--white)`,
  which dark theme redefines to a dark surface color) plus a stronger text
  shadow, so it stays legible over any hero photo in both themes. Optional
  nationality (self-reported, skippable, never inferred from location, never
  scored) can be set on the Results page; every existing generic
  easy/medium/hard visa label now carries an explicit note that it is a
  general reference, not personalized to the user's nationality — Wejhaty has
  no verified per-nationality visa data.

## Destination discovery, navigation, and theme

- Explore sorting supports default order, localized A–Z/Z–A, largest/smallest
  area, lower/higher relative price level, and nearest when location exists.
  Missing/imputed price observations do not outrank direct sourced values.
  "Nearest" excludes the user's own (nearest-centroid-resolved) country from
  its own results; other sort/filter modes are unaffected.
- Explore's location card previously kept showing its "share your location"
  prompt even after location was already granted elsewhere in the app
  (e.g. via the Home first-visit prompt); it now hides that prompt once
  granted, since app-wide location state was already shared correctly and
  only that one line failed to check it.
- “Surprise me” chooses equally from the current filtered catalog and avoids
  repeating a destination during the browser session until candidates are
  exhausted. It now shows a short reel of real candidate flags while
  choosing (previously an abstract color wheel with no flags/names at all),
  settles on the same winner with one restrained pop, and skips the reel
  entirely under a reduced-motion preference.
- Destination pages preserve the list context from Explore or Results and show
  previous/next controls immediately beside the hero (previously a detached
  section at the bottom of the page), in that exact order. Direct links use
  localized alphabetical order; surprise entries return to the surprise
  experience.
- Theme supports system, light, and dark modes. System is the default, tracks
  live device changes, manual choice persists locally, and the pre-render boot
  script prevents a wrong-theme flash. The theme control, and every other
  select in the app (Explore's filters, feedback type), now share one
  reusable select shell with a leading icon (device/sun/moon for the theme
  control), a visible dropdown chevron, and a clear keyboard focus ring —
  previously a bare native `<select>` with no dropdown affordance.
- All visible numbers use Latin digits in both languages via a centralized
  `formatNumber()` helper; the two spots that previously formatted numbers
  with an `ar-SA` locale (producing Arabic-Indic digits) are fixed.

## Anonymous product data, ratings, and feedback

- The frontend records bounded anonymous product events for page use,
  questionnaire choices, Explore filters, surprise use, theme, permission
  outcome, coarse device/browser class, load timing, and safe client-error
  categories. It does not transmit search text, precise coordinates, IP
  addresses, fingerprints, stack traces, or arbitrary model content.
- Results include a 1–5 overall rating, optional reason tags, and optional
  useful/not-useful votes for each top-five country. Ratings never change Phase
  14 scores or order.
- Global and country-specific feedback accepts a categorized message, optional
  email, and optional bounded image attachment, then returns a reference ID.
  Worker validation, per-session rate limiting, private R2 storage, and optional
  Turnstile are implemented.
- Cloudflare D1 migrations define sessions, events, ratings, feedback, and daily
  aggregate tables. A scheduled job retains aggregates, deletes raw events and
  ratings after 90 days, and removes feedback contact/device/screenshot links
  after 90 days while preserving the issue record.
- `/admin` is a separate developer dashboard shell. Its data endpoint requires
  `ADMIN_TOKEN` and uses constant-time bearer validation. The secret is not
  configured in Git. Cloudflare Access is recommended as an additional account
  layer before operational use.
- Worker verification: 57/57 tests, TypeScript, local D1 migration, and Wrangler
  dry-run pass. The production `/admin` shell and updated Worker are live; the
  flight validation route remains healthy. Product-data requests currently
  return `503 product_data_unavailable` because D1/R2 provisioning was rejected
  by Cloudflare with authentication error `10000`. Re-verified 2026-09-15
  directly from the latest "Deploy Cloudflare Worker" GitHub Actions run logs
  (run for commit `a2ecc2f1`): the same `Authentication error [code: 10000]`
  on `/accounts/*/d1/database` still occurs; the worker code itself still
  deploys successfully without the D1/R2 bindings via the workflow's
  documented fallback path. This is an external Cloudflare account/token
  permission gap (`CLOUDFLARE_API_TOKEN` lacks D1/R2/Workers edit access), not
  a code defect — `READY — USER/ACCOUNT CONFIGURATION REQUIRED`.

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

## Cancelled/out-of-scope features

Do not resurrect without an explicit user decision:

- numeric accommodation cost without legitimate live provider data;
- numeric traveler budget / fabricated SAR-per-day;
- cultural compatibility ranking.

## Roadmap gate and immediate backlog

Phase 17 has not started. Current order:

1. Update the repository `CLOUDFLARE_API_TOKEN` with D1, R2, and Workers edit
   permissions, rerun the Worker workflow, and production-verify event, rating,
   feedback, retention, and admin-summary persistence.
2. Configure `ADMIN_TOKEN`, Turnstile keys, and preferably Cloudflare Access for
   operational feedback and dashboard use.
3. Obtain user acceptance for the deployed UI behavior.
4. Decide whether sourced rich editorial descriptions, strengths, and
   weaknesses are required for the remaining 164 countries.
5. Reassess the roadmap with the user before Phase 17.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
