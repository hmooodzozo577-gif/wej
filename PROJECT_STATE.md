# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

- State document version: 7
- Last verified date: 2026-09-13
- Working branch: `claude/marhaba-kxry8l`
- Production implementation commit: `7dfa035662b8ce83852d3d7f64e6f55e03e7181d`
- The deterministic questionnaire, optional-information, AI-removal, and image
  changes are deployed and production-verified. User acceptance is pending.

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

- Phase 14 scoring is unchanged and remains the only ranking authority.
- The questionnaire is deterministic and answer-driven. It ranks unanswered
  Phase 14-supported questions by their ability to separate the current leading
  candidates; the previous answer selects a distinct useful branch.
- Selecting an option advances automatically. A brief transition indicates that
  the next question is being prepared.
- After five answered questions, the traveler may show results now or continue
  answering to improve the result.
- Back remains available. Changing an earlier answer truncates stale downstream
  answers and recomputes the branch.
- Budget options retain the canonical approximate numeric SAR ranges.
- Latest full frontend verification: 670/670 tests passed in one sequential
  run. TypeScript, oxlint, and the production build also pass.

### Current recommendation limitation

The effective catalog contains 194 countries, but only the original 30 have the
complete typed `Destination` profile required by Phase 14. Ranking therefore
still considers 30 countries. The other 164 have factual pages and reviewed
images but are not recommendation candidates. Their scores must not be guessed
or copied from regional averages. Expanding ranking to 194 requires a sourced,
reviewable enrichment model for every Phase 14 field and is the main remaining
product-data task.

## Country pages and optional information

- All 194 effective countries have the existing factual country-information
  layer: identity, capital, region, population, area, currencies, languages,
  calling code, time zones, and borders where available.
- Planning sections for Travel, Accommodation, Travel Cost, and Tourism are
  conditionally mounted. They stay hidden on every entry path until the user
  chooses “Show additional information”.
- Hidden optional sections do not initiate dynamic provider/data work.
- The 30 complete destinations retain richer editorial descriptions, cities,
  strengths, weaknesses, and recommendation metrics. Equivalent verified rich
  coverage for the other 164 is not yet complete.

## Destination images

- Local coverage is 194/194 effective countries; `IL`/`ISR` is absent.
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
| Deterministic ranking | `app/src/engine/` |
| Deterministic question selection | `app/src/adaptive/selectNextQuestion.ts` |
| Questionnaire route | `app/src/routes/Quiz.tsx` |
| Catalog | `app/src/data/worldCatalog.ts` |
| Complete 30-country profiles | `app/src/data/generated/destinations.json` |
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

## Cancelled/out-of-scope features

Do not resurrect without an explicit user decision:

- numeric accommodation cost without legitimate live provider data;
- numeric traveler budget / fabricated SAR-per-day;
- cultural compatibility ranking.

## Roadmap gate and immediate backlog

Phase 17 has not started. Current order:

1. Obtain user acceptance for the production questionnaire, optional
   information, AI removal, and reviewed images.
2. Design and implement sourced complete recommendation/editorial profiles for
   the remaining 164 countries without fabricated values.
3. Reassess the roadmap with the user before Phase 17.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
