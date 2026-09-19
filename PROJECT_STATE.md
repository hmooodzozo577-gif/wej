# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

### Current verified state — 2026-09-19

- State document version: 22.
- Working/deployment branch: `claude/marhaba-kxry8l`. The pre-resume local
  work was preserved separately at local branch
  `codex/pre-resume-backup-20260919` before this branch was fast-forwarded to
  the current remote history.
- Phase 16 (AI) remains CANCELLED/SKIPPED. Phase 17 — UI/UX Evolution is now
  IMPLEMENTED and TEST-VERIFIED locally, with Pages deployment and final user
  acceptance still pending. Phase 18 and Phase 21 remain NOT STARTED.
- The selected identity is **Travel Briefing Folio / ملف الرحلة التحريري**:
  warm ruled paper and deep ink surfaces, restrained terracotta/teal accents,
  strong catalog-backed destination imagery, low-radius folio geometry, and
  compact evidence-first layouts. `PRODUCT.md` records product truth and
  `DESIGN.md` is the current design-system reference.
- Phase 17 covers the shared shell and visual system plus Home, Purpose/Quiz,
  Results, Explore, Destination, forms, async states, light/dark/system themes,
  and responsive AR/EN layouts. The Home hero now uses a real destination
  image with eager priority; repeated catalog imagery remains lazy-loaded.
- The page contains exactly one `مناسب لـ / Suitable for` section above
  Additional information. It shows only the highest-rated eligible purpose by
  default; an accessible 44px Show more/less control exposes the remaining
  purposes in the existing deterministic descending order. Percentages,
  confidence, insufficient-data behavior, methodology details, and sources are
  preserved. Results and destination rating surfaces are compact without
  removing validation, submission, success, or failure behavior.
- Final local verification: frontend 926/926 and Worker 201/201 tests pass;
  frontend and Worker TypeScript are clean; frontend and Worker oxlint are
  clean; the production frontend build and Worker Wrangler dry-run pass. No
  runtime dependency was added; the current build reports 10.53 kB gzip CSS
  and 622.45 kB gzip for the primary JS chunk. Playwright browser QA covered
  16 representative AR/EN,
  RTL/LTR, phone/tablet/desktop, light/dark combinations with zero horizontal
  overflow or alert errors; system mode followed both dark and light OS
  preferences. Keyboard disclosure, form enablement, 44px touch targets, and
  corrected contrast were verified in the browser.
- No recommendation scoring, question branching, geolocation behavior,
  privacy rules, country exclusion, provider logic, or Worker code changed.
  Turnstile remains intentionally inactive. AI remains absent; visa claims,
  Traveler Budget, and fabricated prices remain prohibited/deferred as before.
- The pre-Phase-17 acceptance baseline is USER-VERIFIED: the same physical
  tablet location retest succeeded; Contact, Suggestion, and Report persist to
  D1 in production; verified Arabic city descriptions render with attribution.
- Delivery commit and Pages workflow run: PENDING. Worker deployment is not
  required because `worker/**` is unchanged. After Pages production
  verification, Phase 17 may be labelled READY FOR FINAL USER ACCEPTANCE, not
  complete or accepted.

### Historical implementation notes

- State document version: 20
- Last verified date: 2026-09-17. This entry adds a SECOND PRE-PHASE-17
  ACCEPTANCE round, against a fresh batch of production reports found
  after deploying the round below. Phase 17 is still NOT started.
  1. A prior round MISREAD "move the suitability card above Additional
     information" as "add a new standalone summary card" — that new
     `CountryBestSuitedFor` / "الأنسب لـ" card is DELETED (component, i18n
     keys, CSS, tests), not hidden. The ORIGINAL `CountrySuitability` /
     "مناسب لـ" full per-purpose card (descending order, "لماذا هذه
     النسبة؟" localization all preserved unchanged) is what now renders
     above "Additional information" instead. Exactly one suitability
     section exists on the page again.
  2. Explore showed TWO location-request surfaces stacked on one page:
     the app-wide `LocationIntro` (mounted for every route in
     `RootLayout`) and Explore's own `LocationPersonalize`. `RootLayout`
     now excludes `LocationIntro` specifically on `/explore`, since
     Explore already owns a full location surface; every other route is
     unaffected. Regression test renders the real route tree and counts
     CTAs across idle/requesting/granted/denied/unavailable.
  3. Tablet location failure: reviewed the full platform-independent
     geolocation state machine (`geo/geolocation.ts`,
     `geo/permissionsApi.ts`, `LocationPersonalize.tsx`) — no device-based
     branching exists anywhere, and denied/timeout/unavailable/unsupported
     are already distinctly messaged with retry where retry can help.
     Added explicit tests for "approximate succeeds, precise never
     attempted" and viewport-independence. A real Android tablet
     permission prompt could not be reproduced in this environment; the
     divergence from phone behavior is most likely real device
     hardware/OS GPS-assist differences, not a code defect — unverified
     either way from here.
  4. City descriptions still only showed the honest fallback in
     production despite the prior round's coordinate-key fix (which
     remains correct and deployed). Full path re-diagnosed
     (frontend -> Worker -> Wikipedia REST -> D1 cache -> render); no
     further structural bug found, but `FETCH_TIMEOUT_MS` in
     `worker/src/cityDescriptions.ts` was the shortest timeout of any
     outbound call in the whole system (6000ms vs. 9000ms everywhere
     else) for the ONE call that's a real third-party network request —
     raised to 9000ms to match. This sandbox cannot reach either the
     deployed Worker or Wikipedia directly (egress policy blocks both, as
     it did for the prior round's diagnosis), so production reachability
     is still NOT independently verified — this is NOT reported as fixed;
     see the round's own report for the exact next step.
  5. Contact/Suggestion Submit: reviewed `useTurnstile`/`FeedbackDialog`
     end to end; the previously-fixed "disabled forever" bug is still
     correctly fixed. Found and closed one real gap against the required
     state table: while the challenge is loading (required, not yet
     solved, not yet failed), NOTHING was shown at all — the empty
     `.turnstile-slot` has zero height until the widget renders, so Submit
     being disabled during that window had no explanation. Added a
     neutral "verifying" hint, distinct from the existing failed/retry
     message, which is unchanged. External Cloudflare Turnstile
     configuration (site key/secret pairing, allowed hostnames) could not
     be verified from here — if Submit still fails after this deploy, that
     is the next thing to check.
  Re-verified unaffected by any of the above: Nearest-to-me exclusion,
  Arabic "لماذا هذه النسبة؟" localization, descending purpose ordering,
  the geolocation/quiz race bounded wait, Phase 14 weights baseline (9/9),
  AI absence, visa `unknown` status, Traveler Budget BLOCKED/DEFERRED.
  921 frontend tests (was 909), 197 worker tests (unchanged), typecheck/
  lint clean on both, production build clean, wrangler dry-run clean, a
  Playwright sweep of the Japan country page (AR/EN x desktop/mobile),
  Explore (idle location state, exactly one CTA), and the Contact form
  (preserves text + shows an accessible error on a failed local submit)
  all at 0 findings.
- PRIOR ROUND, same day: a first PRE-PHASE-17 ACCEPTANCE-FIX round, run
  against direct production user reports, on top of the AI-cleanup round
  recorded further down this file. Seven issues were fixed:
  1. Nearest-to-me still showed the traveller's own current country in
     production. Root cause: `exploreCatalog.ts`'s `sortCatalog()` derived
     "current country" via `approximateCountryOf()` (nearest-CENTROID-only —
     the same technique already proven unreliable elsewhere in this
     codebase, e.g. Abha resolving to Eritrea), instead of the accurate
     boundary-polygon `resolveCurrentCountry()` already used by
     LocationPersonalize/TravelInfo/resolveTravelRequest. Proven with real
     coordinates: Dammam, Saudi Arabia resolved via centroid to Bahrain
     (66km), so Saudi Arabia was never excluded. Fixed by having
     `sortCatalog()` accept an already-resolved country code from its
     caller instead of deriving one itself; `Explore.tsx` resolves it via a
     new `useResolvedCountryCode()` hook wrapping the SAME accurate
     resolver. Unresolved/uncertain status means no exclusion, never a
     guess. Excludes from Nearest-to-me only; Search/Explorer/direct page
     unaffected.
  2. "Best suited for" is now its own top-level `.detail-card`
     (`CountryBestSuitedFor`), rendered immediately above the "Additional
     information" toggle on both the basic-country and editorial branches
     of `Destination.tsx`, instead of living inside that collapsed toggle
     alongside `CountrySuitability`'s full per-purpose list. No page
     redesign; same `.detail-card` visual convention every other section
     already uses.
  3. The full per-purpose "Suitable for" list was in fixed methodology
     order, not score order. `CountrySuitability.tsx` now renders it via
     `bestSuitedFor(entries).ranked` (already descending, insufficient-data
     last); `bestSuitedFor.ts` gained an explicit, documented tie-break for
     equal scores (higher confidence, then alphabetical purpose id).
  4. "Why this score?" leaked English factor names ("Safety",
     "Affordability", …) in Arabic mode — they came from the Worker's
     English-only `component.label`, which has no lang parameter at all.
     Fixed with a deterministic `factorLabels` EN/AR dictionary in
     `data/i18n/{en,ar}.ts`, keyed `purpose:factorKey` (the same factor key
     carries a different English label depending on which purpose
     methodology defines it), with full-coverage and no-cross-language-leak
     regression tests. No AI-generated text.
  5. City description paragraphs were missing for real cities. Root cause
     (found and fixed, not rebuilt): `generate-featured-cities.mjs`'s own
     `normalize()` dropped diacritics ("Zürich" -> "zrich") instead of
     transliterating them like the Worker's `normalizeCityKey()` does
     ("Zürich" -> "zurich"), so the coordinate-index key the generator
     wrote for any accented city name never matched what the Worker looked
     up — the description silently never fetched, and the same mismatch
     also broke same-city dedup (e.g. "Bogotá" and "Bogota" both listed)
     and capital-row matching. Fixed with one shared `cityKey.mjs` algorithm
     the generator now uses, matching the Worker's; both artifacts
     regenerated. Also added an honest "no verified description yet"
     fallback state (previously: nothing rendered at all when a
     description was unavailable) — never invented prose.
  6. Visa/passport documentation corrected from "PROVIDER ACCOUNT/
     CREDENTIALS REQUIRED" to "PROVIDER ACCESS REQUESTED — AWAITING
     VERIFIED TRAVEL REQUIREMENTS API CREDENTIALS", reflecting that the
     user has requested Sherpa API access and created a VisaHQ Business
     Portal account, with neither yet producing a verified working
     credential. No VisaHQ or Sherpa integration exists in this codebase;
     visa status stays `unknown` everywhere until one does.
  7. Geolocation race hardening (bounded wait in Quiz.tsx) was re-verified,
     not redesigned — no real defect found. All scenarios (immediate
     bounded wait, slow-but-successful resolution, timeout fallback, fast
     grant, denied, unavailable, no duplicate request, AR+EN copy) still
     pass.
  Also audited: no AI code/config/UI/secret has returned; Phase 14 weights
  baseline (9/9) unchanged; Admin auth unchanged; analytics privacy guard
  (forbidding lat/lng/coordinates/ip/fingerprint) unchanged; no passport
  number collected anywhere. Known deferred items (Admin manual acceptance
  checks, Traveler Budget 13.5c BLOCKED/DEFERRED, visa provider awaiting
  credentials, Country Intelligence source-expansion honestly incomplete)
  were left as-is, not reopened. Verified: 909 frontend tests (up from
  855), 197 worker tests (up from 180), TypeScript and oxlint clean on
  both, frontend production build, worker `wrangler deploy --dry-run`, and
  a Playwright sweep of the Japan country page (AR/EN x desktop/mobile,
  language switch verified via `document.documentElement.lang`,
  Best-suited-for placement, real descending scores, no horizontal
  overflow), the Arabic "Why this score?" panel, Explorer's nearest-to-me
  flow, and the Quiz entry path with geolocation left pending — all at 0
  findings. The city-description Wikipedia fetch itself cannot be
  exercised from this sandbox (egress to Wikipedia is blocked here, same
  constraint as previous rounds), so that layer's live behavior is proven
  by the Worker-side unit/contract tests plus the local honest-fallback
  render, not a live browser fetch.
- Working branch: `claude/modest-cray-34bvoa`. See Git log for the exact
  HEAD — this document does not hardcode a commit it is itself part of.
- DEPLOYMENT STATUS, 2026-09-17 (second acceptance round, this entry):
  pending this round's own deployment — see "Roadmap gate and immediate
  backlog" / the round's own report for exact commit and run IDs once
  pushed.
- DEPLOYMENT STATUS, 2026-09-17 (first acceptance round, prior entry):
  DEPLOYED.
  `claude/marhaba-kxry8l` merged `claude/modest-cray-34bvoa` at commit
  `7732ac0` via merge commit `1bbb719` (a real merge, not a history
  rewrite — verified first that `marhaba-kxry8l`'s only commit beyond the
  common ancestor was content-identical to one already on
  `modest-cray-34bvoa`, so nothing was lost) and pushed. Both workflows
  ran on that push and both concluded `success`:
  `deploy-worker.yml` run 35277692370 and `deploy-pages.yml` run
  35277692256, both on commit `1bbb719f82cac38cfbbb8fcc78752595de1a082f`.
- Previous production frontend commit: `f60efd93`
- Production Worker source commit: `077d76a5` — DEPLOYED 2026-09-16 from run
  35154518086 (Version ID `365c337c-7327-4559-baf6-e3f293a3349a`).
  **This run's overall conclusion is `success` — the first fully-green
  Worker deploy in this project's history.** The "Diagnose Cloudflare token
  capability" step, freshly measured on THIS run, now reads `OK` on all
  four checks (identity, Workers, D1, R2) where the prior round read
  `FAILED` on D1 and R2 with `Authentication error [code: 10000]`. The
  account/token permission gap is CLOSED — not something this round set out
  to fix; it was discovered as a side effect of deploying the admin
  language-switcher change and is recorded here rather than left buried in
  a deploy log. The Worker's own log confirms both bindings are live:
  `env.PRODUCT_DB (wejhaty-product-data)` D1 Database and
  `env.FEEDBACK_SCREENSHOTS (wejhaty-feedback-screenshots)` R2 Bucket.
  Migrations reported "No migrations to apply" (they were already current —
  applied in an earlier retried run, `deploy-worker.yml` run 35127073171,
  attempt 4, which also concluded `success`). The R2 bucket already existed
  and is owned by this account.
  **What is confirmed:** the bindings exist and the Worker deployed with
  them. **What is NOT independently verified in this round:** an actual
  end-to-end write (submitting a real rating/report against the live API
  and confirming a row lands in D1) — that is application-level
  verification, out of scope for "add a language switcher only", and should
  be the next thing checked before calling persistence production-accepted.
- Production FRONTEND commit: `077d76a5` — DEPLOYED 2026-09-16 from Pages run
  35154518098 (`build` success, `deploy` success, environment URL
  `https://hmooodzozo577-gif.github.io/wej/`). The Pages
  environment-protection blocker was cleared on 2026-09-16 by
  fast-forwarding `claude/marhaba-kxry8l`, the branch the environment
  permits; every deploy since has gone through its push trigger normally.
- Git state re-verified directly before writing this: working tree clean, no
  merge/rebase in progress; `origin/claude/modest-cray-34bvoa` and
  `origin/claude/marhaba-kxry8l` hold the same commit.
- ACCEPTANCE STATE, 2026-09-16 (second round). The user re-tested the
  deployed build and said "the rest is fine" apart from six findings.

  USER ACCEPTED (the user's own words, on the build they tested — everything
  outside the six findings below):
    * the deterministic questionnaire and its per-purpose dimensions
    * the custom listbox replacing native selects, and the theme control
    * Latin digits throughout
    * two-stage geolocation, nearest/farthest, and location-gated questions
    * "Why this suits you" in the traveller's own language
    * hero previous/next controls living inside the hero image
    * the structured per-city facts
    * the results and per-destination rating FORMS (their submission is a
      separate matter — see below)
  NOT accepted, because it has not been retested: all six findings of this
  round. NOT accepted, because it is external-state blocked: visa
  personalization. NOT accepted, because it has never succeeded: feedback
  persistence.

- THE SIX FINDINGS, and what happened to each:
  1. Arabic sort label. The reported string "الأقرب إلى موقعى" does NOT exist
     in this repository and never has — `sortNearest` has read "الأقرب إلى
     موقعي" since 1cec937, in every deployed commit. A real inconsistency in
     the same pair was found and fixed, and a test now guards the whole
     ya/alef-maqsura class across every Arabic string.
  2. Hero previous/next labels: SHIPPED at >=900px as a floating caption
     above the arrow, after measurement showed an expanding pill collides
     with the country title at every width. Below 900px the label is not
     rendered. See the Hero navigation section.
  3. City descriptions: IMPLEMENTED as a Worker service against Wikipedia's
     REST API with a coordinate-match guard, cached in D1. Coverage in
     production is unknown until deployed and is reported by the dashboard,
     not estimated. See /CITY_DESCRIPTIONS.md.
  4. Surprise Me: RESTORED to the pre-compass flag reel, recovered from Git.
  5. Passport explanation: REWRITTEN, and now driven by a real provider-status
     endpoint so it cannot claim an effect it does not have.
  6. Rating persistence: still blocked on D1. The error the user saw is
     correct and is NOT hidden.

- TWO external dependencies remain. Neither is a code defect and neither may
  be worked around unofficially:
  1. Cloudflare D1/R2 (`Authentication error [code: 10000]` as of the last
     deploy). The workflow now prints a per-capability diagnostic so a repeat
     failure names the missing permission — see SECRETS.md.
  2. A visa-data provider account. Re-checked 2026-09-16: every provider host
     is refused at the agent egress proxy, so the API contract could not be
     re-read and is not being guessed. The user has since requested Sherpa
     API access and created a VisaHQ Business Portal account, pursuing real
     Travel Requirements API access through both — neither has yet produced
     a verified, working credential, and no VisaHQ (or Sherpa) integration
     exists in this codebase. See /VISA_PROVIDERS.md.
  The third (GitHub Pages environment protection) was cleared on 2026-09-16.

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
code, the `env.AI`/`ANTHROPIC_API_KEY` binding, and AI deployment
variables/smoke tests.

Do not restore an AI or Hybrid interview unless the user explicitly reverses
this decision.

CORRECTED, 2026-09-17: an earlier round of this document briefly recorded
Phase 16 ("AI API Integration") as an active feature — a grounded AI
explanation layer was implemented (Worker provider, endpoint, frontend
panel, admin observability) because the roadmap still carried Phase 16
under that name. This was a mistake: the standing "no AI" decision above
was never reversed. The user has since clarified the product decision:

**Phase 16 — AI API Integration: CANCELLED / SKIPPED by product decision.**
Every AI/Anthropic code path, document, translation string, admin panel,
and test added for that attempt has been removed in the same round this
correction was written. No AI provider is configured, no AI API credential
(`ANTHROPIC_API_KEY` or otherwise) is required by anything in this
repository, and no AI functionality ships anywhere in the product. See
"Phase 16 — AI API Integration" below for the roadmap record, and
"Roadmap gate and immediate backlog" for what comes next (Phase 17).

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
- `GET /api/visa/status` reports only whether a provider is configured, so
  the PASSPORT STEP can tell the traveller the truth before they answer —
  it has no destination yet and so cannot learn it from a lookup. It fails
  closed: any error, any missing Worker, any non-200 means "not active". The
  step's copy switches by itself the moment a provider key exists.
- The passport explanation (acceptance item #5) says, in this order: what the
  answer is FOR (entry and visa requirements), that it is NOT the traveller's
  location and neither is inferred from the other, what it does to the results
  TODAY (nothing, because no provider is live), and that no passport number is
  ever asked for. A test asserts all five points survive in both languages and
  that nothing shown today claims an effect on ordering.
- PROVIDER MAPPING IS UNVERIFIED and is not claimed otherwise. Every provider
  host is refused at the agent egress proxy, so the adapter has never run
  against a real response. `worker/src/visa.contract.test.ts` asserts what IS
  verifiable (no credentials -> `unknown` everywhere; an unrecognised value ->
  `unknown`; a drifted shape neither throws nor invents) and states the
  unverified status as an assertion. Dropping one real sandbox response per
  category into `worker/fixtures/sherpa/` turns it into a real mapping test.
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
- Status: `PROVIDER ACCESS REQUESTED — AWAITING VERIFIED TRAVEL REQUIREMENTS
  API CREDENTIALS`. The user has requested Sherpa API access and created a
  VisaHQ Business Portal account; neither has yet produced a verified,
  working credential. No VisaHQ or Sherpa integration exists yet — see
  /VISA_PROVIDERS.md.

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
  ABOVE those facts, each city now also shows a GENERAL DESCRIPTION where one
  could be verified (acceptance item #3). It is fetched by the WORKER from
  Wikipedia's public REST summary API — the build sandbox cannot reach
  Wikipedia, the deployed Worker can — cached in D1, and rendered with its
  source, a link to the article, and its CC BY-SA 4.0 licence.
  A namesake city can never be described in place of the real one: an article
  is accepted only when it is not a disambiguation page AND carries its own
  coordinates AND those coordinates sit within 45km of the city asked about.
  The reference coordinates live in the Worker
  (`worker/src/generated/cityCoordinates.json`, 810 cities); the browser
  never sends a coordinate of any kind. A city with no verified article shows
  its structured facts alone — there is no fallback text, because a fallback
  would be invented text. Real coverage is reported by the admin dashboard
  from the cache table, never estimated. Full provenance, licensing and the
  egress evidence are in /CITY_DESCRIPTIONS.md.
  Region and airport names are disclosed as appearing in their source
  language. The toggle label reads "Show more"/"Show less" (Arabic: "إظهار
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

## Country Intelligence + Purpose Suitability Scoring

Phase 11.x (country intelligence expansion) / Phase 14.x (purpose
suitability scoring) — added 2026-09-16. Full architecture, methodology,
source catalog, and coverage numbers are in `/COUNTRY_INTELLIGENCE.md`;
this is the summary.

- A COUNTRY SUITABILITY layer — how suitable a country is IN GENERAL for a
  purpose — deliberately separate from Phase 14's MATCH score (how well a
  country matches one traveller's OWN answers). Phase 14's
  `DIMENSIONS`/`PURPOSE_DIMENSIONS`/weights are UNCHANGED by this round —
  proven by `app/src/engine/phase14WeightsBaseline.test.ts`, which deep-
  compares the live `QUESTION_BANKS` against a baseline captured before
  this work began. Personal Match (blending suitability with a traveller's
  own preferences) is explicitly left for Phase 18 — not started here.
- Scored for 7 of Wejhaty's 8 purposes (`tourism`, `work`, `education`,
  `medical`, `immigration`, `investment`, `wellness`) across all 194
  effective countries. `other` is excluded — a catch-all fallback purpose
  with no defined identity (`pScoreKey: null`), so there is no methodology
  to build for it.
- Each purpose has its OWN factor set and weights (never reused from
  another purpose), built ONLY from indicators Wejhaty's own pipelines
  already fetch and commit with real provenance — no new network fetch for
  this layer, no invented values, no scraped rankings. Sources: 9 World
  Bank indicators (urbanization, income PPP, unemployment, life
  expectancy, health spend, tertiary enrollment, FDI, GDP growth,
  homicide rate) plus the already-committed price-level snapshot
  (`PA.NUS.GDP.PLI`) and UN Tourism/OWID arrivals snapshot. Visa/entry
  requirements are never a scoring input (task rule: `unknown` must never
  be penalized/rewarded); climate is never a scoring input (a traveller
  preference, not an objective quality).
  Real per-purpose measured coverage: tourism 190/194 sufficient (98%,
  avg 92% coverage), work 186/194 (96%, 91%), education 186/194 (96%,
  88%), medical 188/194 (97%, 92%), immigration 183/194 (94%, 88%),
  investment 185/194 (95%, 91%), wellness 192/194 (99%, 92%). Countries
  short of the 60% minimum-coverage threshold (Eritrea, North Korea,
  South Sudan, Vatican City for tourism, similar small/data-poor
  economies for the others) show "insufficient data", never a fabricated
  number — the full per-purpose list regenerates at
  `app/scripts/countryIntelligenceCoverage.json`.
  A score is a weighted average of NORMALIZED values actually observed,
  re-weighted over just the observed factors (a missing indicator does
  not silently drag the score down — the gap shows separately as
  coverage/confidence, never blended into the score itself). Normalized
  0-100 means "position within the winsorized 5th-95th percentile range
  of countries actually observed for that factor" — documented, bounded,
  outlier-robust, and never confused with a global rank/percentile.
  Confidence is `high`/`medium`/`low` from coverage % and data recency.
  Each purpose is versioned (`tourism-v1`, `work-v1`, etc.).
- Architecture: `app/src/intelligence/` is the pure, framework-free
  scoring engine (types, real source catalog, normalization, per-purpose
  methodology, scoring). `app/scripts/generate-country-intelligence.mjs`
  runs it (via Vite's SSR module loader, reusing the real tested TS code
  rather than a second JS copy) over the ALREADY-COMMITTED
  `recommendationIndicators.json`/`travelCostIndex.json`/
  `tourismInsights.json` snapshots — no network fetch of its own. Writes
  a compact summary bundled with the frontend
  (`app/src/data/generated/countryIntelligence.json`, ~9KB gzip) and a
  full per-component/per-source detail file bundled with the WORKER
  (`worker/src/generated/countryIntelligenceDetail.json`, ~133KB gzip) —
  the same "keep the frontend bundle light, serve full detail from the
  Worker" split already used for city descriptions. Deliberately NOT in
  D1: this is static, versioned, build-time-computed reference data, the
  same shape as the other generated snapshots, not user-generated data —
  see `/COUNTRY_INTELLIGENCE.md`'s "Why not D1" for the full reasoning.
  `worker/src/intelligence.ts` serves `GET /api/intelligence/:countryCode/
  :purpose` from the bundled detail JSON — no D1, no secret, no external
  fetch at request time.
- UI: a "Suitable for" card (`app/src/components/CountrySuitability.tsx`)
  inside Destination.tsx's existing "Show additional information" optional
  section, but as its OWN full-width row BELOW `.info-cards-grid` rather
  than a 5th item inside it — that 4-card grid is a hand-tuned named CSS
  grid with its own history of rejected/corrected layouts
  (`Destination.infoCardsLayout.test.tsx`); adding an untyped 5th item to
  it would have risked exactly that kind of accepted-layout regression.
  Shows each purpose's score/confidence/coverage (from the bundled
  summary, no network call) with a lazy "Why this score?" `<details>` per
  purpose that fetches the full component/source breakdown from the
  Worker only when opened — never eagerly. AR/EN, RTL/LTR-safe (logical
  CSS properties, no physical left/right), explicitly discloses it is a
  general estimate, "not personalized to you" (the Phase 18 Personal
  Match distinction, stated in-product).
- Admin observability: extends the EXISTING Content tab
  (`worker/src/adminPage.ts`'s `renderContent`, `worker/src/analytics.ts`'s
  `buildIntelligenceHealth`, `worker/src/adminI18n.ts`'s `intelligence.*`
  strings) rather than adding a new tab, per this round's own scope
  instruction to extend Admin/Content/Technical "without rewriting the
  Admin system." Shows countries covered, purposes scored, last generated
  date, and per-purpose sufficient-data count/avg coverage/high-confidence
  count. Reads the same bundled Worker JSON, not D1.
- Traveler Budget (Phase 13.5c) stays `BLOCKED / DEFERRED` — a
  sufficiently current, trustworthy, reusable source for generic traveler
  daily-cost values has not yet been verified; no such source was
  discovered or invented this round, and none may be until one actually
  is (see `app/scripts/TRAVEL_COST_INDEX.md`). This is not the same as
  cancelled: it remains a real candidate for a future pass. Visa stays
  `unknown` unless a real provider is configured, never used as a scoring
  input here.
- Tests: `app/src/intelligence/{normalize,methodology,score}.test.ts` (32
  tests — normalization boundaries/outliers/degenerate populations,
  structural methodology invariants, score bounds/insufficient-
  data/determinism/model-versioning), `app/src/data/
  countryIntelligence.test.ts` (5, against the real committed snapshot),
  `worker/src/intelligence.test.ts` (10) and `worker/src/analytics.test.ts`
  (6, both against the real committed data), `app/src/components/
  CountrySuitability.test.tsx` (8), `app/src/countryIntelligence/
  insights.test.ts` (5), and the Phase 14 regression guard (9). Playwright
  visual QA: 4 representative countries (excellent coverage/Arabic name —
  Saudi Arabia; large economy/high coverage — Japan; medium coverage —
  Afghanistan; insufficient data/tiny population — Vatican City) x
  desktop/mobile x AR/EN x light/dark = 32 combinations, 0 findings. Admin
  extension re-verified with the existing admin Playwright sweep, also 0
  findings.
- Full doc: `/COUNTRY_INTELLIGENCE.md`.

### Carry-over hardening additions on top of this layer (2026-09-17)

- **"Best suited for" / "الأنسب لـ"** (`app/src/intelligence/bestSuitedFor.ts`)
  — a deterministic Country -> Best Purposes interpretation built ONLY from
  the suitability scores above (no second scoring system). Eligibility
  requires a real score AND `high`/`medium` confidence (an `insufficientData`
  or low-confidence purpose can never become "best suited", though it still
  shows in the ranked list below). Ties within a fixed 5-point
  (`GROUPING_MARGIN_POINTS`) margin of the top eligible score group together
  ("Strong for Tourism, Work, and Investment") rather than picking an
  arbitrary winner; when no purpose is eligible, an honest insufficient-data
  message shows instead of a forced winner. Rendered as its own lead section
  in `CountrySuitability.tsx`, above the existing per-purpose list. 14 tests
  in `bestSuitedFor.test.ts` (including the task's own worked example) plus
  4 in `CountrySuitability.test.tsx` against real committed data (an
  isolated single winner — Afghanistan; a multi-purpose group — Saudi
  Arabia; an honest insufficient state — Vatican City; Arabic/RTL).
- **Source expansion attempted, network-blocked, honestly documented.**
  This round's own agent sandbox cannot reach ANY external host outside a
  short package-registry allowlist (confirmed with a control test against
  `example.com`, which failed identically to World Bank/WHO/ILO/UNESCO/
  IMF/OECD/UN-stats hosts) — the same constraint already recorded for the
  visa providers, and the same host (`api.worldbank.org`) the 11 indicators
  above were already fetched from. No new indicator was added, no source
  claimed verified, and no `excluded[]` limitation was removed. See
  `/COUNTRY_INTELLIGENCE.md`'s "Source expansion attempt" section for the
  full evidence and what running the existing generator script from an
  environment with real egress would need.

## Phase 16 — AI API Integration

**STATUS: CANCELLED / SKIPPED by product decision.**

An earlier round of this document briefly described Phase 16 as an active
AI explanation layer (a Worker-side Anthropic provider, an
`/api/ai/explain` endpoint, a frontend explanation panel on Results and
country pages, and an admin observability panel) — built because the
roadmap still carried this phase under the name "AI API Integration".
That was a mistake against the standing "no AI" product decision (see
"Current product decision" above), which was never actually reversed.

The user has since made the product decision explicit: **AI integration
is cancelled/skipped for this phase.** Every piece of that implementation
has been removed in the same round this correction was written:

- `worker/src/ai.ts` and its tests (the provider abstraction, the
  Anthropic Messages API adapter, grounding checks, caching, rate
  limiting, the `/api/ai/explain` and `/api/ai/status` endpoints).
- `app/src/ai/` in full (the browser client, request builders, types)
  and `app/src/components/AIExplanation.tsx` plus its tests.
- The AI wiring inside `worker/src/index.ts`, `worker/src/admin.ts`,
  `worker/src/analytics.ts` (`buildAIHealth`), `worker/src/adminPage.ts`
  (`renderAIHealth`), and `worker/src/adminI18n.ts` (`ai.*` strings).
- The AI panel wiring inside `Results.tsx` and `CountrySuitability.tsx`,
  the `ai.*` i18n dictionary entries in `en.ts`/`ar.ts`, the `AIStrings`
  type, and the `.ai-explanation*`/`.ai-badge` CSS rules.
- `/AI_INTEGRATION.md`, and every AI-specific row/section in
  `/SECRETS.md`.

**No AI provider is configured. No AI API credential (`ANTHROPIC_API_KEY`
or otherwise) is required by anything in this repository. No AI
functionality ships anywhere in the product.** Do not replace Anthropic
with another provider, and do not keep any dormant AI infrastructure "for
later" — none remains.

The non-AI carry-over hardening that was correctly part of this stage —
and is KEPT — is documented in its own place: the geolocation race fix
and "Best suited for" additions are recorded under "Destination
discovery, navigation, and theme" and "Country Intelligence + Purpose
Suitability Scoring" above; Nearest-to-me's regression coverage is under
"Destination discovery, navigation, and theme" as well.

Phase 16 stays in the roadmap under this name and status — it is not
renumbered or deleted — and the next official phase, once this cleanup
round is itself deployed and verified, is **Phase 17 — UI/UX Evolution**
(not started).

## Destination discovery, navigation, and theme

- Explore sorting supports default order, localized A–Z/Z–A, largest/smallest
  area, lower/higher relative price level, and — only with real location
  context — nearest AND farthest. Both distance sorts exclude the traveller's
  own (nearest-centroid-resolved) country. Without location neither is
  offered, and a short note says why rather than silently omitting them; a
  distance sort saved before location was lost falls back to default order
  instead of claiming to sort by distance. Missing/imputed price observations
  do not outrank direct sourced values. VERIFIED 2026-09-17 (Phase 16
  carry-over item #2): this exclusion was already implemented and correct
  (`app/src/data/exploreCatalog.ts`, labeled "Item #10" in its own comment)
  — not a bug, just missing regression coverage, now added in
  `exploreCatalog.test.ts` (10 tests: exclusion from both nearest and
  farthest, neighbor ordering, no global removal from the catalog or other
  sorts, accessibility via search/direct link, AR/EN parity).
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
  FIXED 2026-09-17 (Phase 16 carry-over item #1 — the geolocation race
  condition): the real, narrow race was not "location is treated as
  permanently unavailable" (the reducer and `effectiveQuestionBank()` both
  re-derive live on every dispatch, so a later grant is never ignored) but
  a single decision point — the quiz finishing while location is still
  `requesting` — where the moment location would have mattered could pass
  before it settled. `app/src/state/waitForLocationSettle.ts` adds a bounded
  wait (2.5s timeout) at exactly that point in `Quiz.tsx`'s `onSelect`,
  showing "جارٍ تحديد موقعك…"/"Getting your location…" only in that narrow
  window, never claiming unavailability while still pending, and falling
  back to the unfiltered flow after the timeout. Denied/unavailable/error
  states proceed immediately with no wait. 14 new tests (6 for the wait
  helper's own timing/polling behavior, 8 driving the real `Quiz` component
  through fast/slow/denied/unavailable/mid-flow-resolution/timeout/AR
  scenarios with fake timers) — no duplicate `LOCATION_REQUEST` dispatch in
  any of them.
- "Surprise me" is a FLAG REEL: a gold-ringed badge that cycles real
  candidate flags and settles with one restrained pop. The travel-compass
  redesign that briefly replaced it was REJECTED by the user in the second
  acceptance round, and the reel was restored from commit 5838723 — recovered
  from Git history rather than rewritten. Do not reintroduce the compass dial,
  its ticks or its needle without an explicit instruction; a test asserts none
  of them is in the DOM.
  Kept from the compass round because they are fixes rather than design: the
  anti-repeat list survives a blocked sessionStorage, exactly ONE live region
  announces the outcome (so a screen reader hears "choosing…" then the
  destination, not eight flags), the reel itself stays out of the
  accessibility tree, and the result still carries the real great-circle
  direction from the traveller when a location has been shared — and claims
  no direction at all when one has not. Selection is unchanged: equal chance from
  the current filtered catalog, crypto random, and no repeat during the
  browser session until candidates are exhausted. A reduced-motion preference
  lands directly on the winner with no cycling.
- Destination pages preserve the list context from Explore or Results. The
  previous/next controls live INSIDE the hero image, at its inline start and
  end edges, as translucent blurred 44px circles; the hero's own text reserves
  those gutters so the country title never runs underneath them. Direct links
  use localized alphabetical order; surprise entries keep their single return
  link below the hero.
- HERO NAVIGATION LABELS (acceptance item #2), decided by measurement.
  `app/scripts/hero-label-qa.mjs` measures the real geometry across 12 widths
  x 2 languages x 2 themes x rest/hover/focus.
    * REJECTED: expanding the control itself into a labelled pill. It
      overlapped the country title at every width wide enough to justify a
      label — 26 findings. The control's row is y=118..165 inside the 280px
      hero and the title block starts at y=147..160 on desktop.
    * SHIPPED: a compact floating caption ("Previous country" / "الدولة
      السابقة" plus the destination name) in the clear photo band directly
      ABOVE the arrow, revealed on hover or keyboard focus. Measured at
      y=67..110, clearing the title by 37-52px. 0 findings, both languages,
      both themes, no overflow, no escape from the hero.
    * The collapsed control keeps the accepted 44px geometry EXACTLY. The
      caption is aria-hidden because the link's accessible name already
      carries the same words.
    * Below 900px the caption is not rendered at all: the hero's inner block
      wraps there and climbs into the caption's band, and a touch device has
      no hover to reveal it with. The accessible name and the native tooltip
      carry the name, as before.
  If this hero's height or title layout ever changes, re-run that script
  before assuming the caption still fits.
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
  script prevents a wrong-theme flash. Below 640px the control collapses to
  its icon and chevron so the nav row fits a 390px screen.
  FIXED 2026-09-16: the System option's icon is now the EFFECTIVE appearance
  (moon when the OS is dark, sun when light), tracked live via the same
  `prefers-color-scheme` listener the control already subscribed to — it
  previously always showed a sun regardless of the OS's actual theme, a real
  reported bug (`ThemeSwitch.tsx`'s `iconFor()` branched on the raw
  `'auto'|'light'|'dark'` preference value, never the OS query). The stored
  preference itself is unchanged by this fix — System never silently
  converts to explicit Light/Dark. A hint next to the "System" option label
  in the open dropdown also now shows the current effective mode. 11
  tests in `ThemeSwitch.test.tsx` cover explicit Light/Dark, System+OS-light,
  System+OS-dark, live OS changes in both directions while staying on
  System, persistence after reload, and the hint text in both languages.
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
- `/admin` is a real private developer dashboard, not a JSON dump: KPI cards,
  an inline SVG daily-trend chart, ranked tables with proportion bars, a
  searchable report queue, a report detail view, and a status workflow
  (new / triaged / in_progress / resolved / declined) with an internal note.
  One self-contained document with no external request of any kind.
  Panels: Overview, Funnel, Recommendation quality, Countries, Discovery,
  Location, Reports, Technical, Content. Every panel obeys one filter bar —
  date range, language, device, purpose, country, and min/max rating.
- ADMIN LANGUAGE — Arabic / English, a header pill switcher ("AR | EN"),
  independent of the public site's own language. Independent is correct
  here, not a compromise: the public site does not persist a language
  choice to localStorage at all (it defaults to Arabic every session — see
  Product below), so there was nothing shared to preserve. The admin's
  choice persists under its own key, `wejhaty.admin.lang`, defaulting to
  English, with a try/catch around every localStorage read/write so a
  blocked store (Safari private mode) degrades to "does not persist"
  rather than breaking the page.
  Switching sets `<html lang>`/`dir` and re-renders every panel from the
  data ALREADY on screen — no re-fetch, no re-authentication. The
  dictionary (`worker/src/adminI18n.ts`) is the single source of truth,
  typed so English and Arabic are forced to carry the same keys; it is
  serialized once per request into the page (`adminPage.ts` cannot
  literally reuse the public app's React-bundle i18n — different runtime,
  no build step — so it re-expresses the same flat-dictionary-plus-t()
  pattern instead). A missing key falls back to English, then to an empty
  string — NEVER to the raw key — enforced by both a static dictionary test
  and a runtime Playwright walk of every text node on the page.
  Report workflow statuses (new/triaged/in_progress/resolved/declined) and
  report types are translated as UI labels while the value sent to the API
  stays the fixed English enum code, the same pattern already used for the
  device/purpose filters. Country codes, dates, reference IDs and other
  underlying data values are deliberately left untranslated. A traveller's
  own free-text report/comment gets `dir="auto"` rather than inheriting the
  page's direction, so an English report does not right-align inside the
  Arabic dashboard — found and fixed during this round's RTL visual QA.
  Verified: `worker/src/adminI18n.test.ts` (dictionary completeness, no
  leftover English in the Arabic dictionary, no raw-key-shaped value),
  `worker/src/adminPage.test.ts` (the switcher and the embedded dictionary
  are actually in the generated page), and `app/scripts/admin-visual-check.mjs`
  extended to sweep Arabic/English × desktop/mobile (4 combinations) plus
  dedicated functional checks — click-to-switch, dir/lang correctness,
  persistence across a real reload, the blocked-storage fallback, and a
  full-page raw-translation-key scan — all at 0 findings.
- ADMIN AUTHENTICATION, two independent mechanisms (see SECRETS.md):
    * Cloudflare Access (preferred). Setting `ADMIN_ACCESS_AUD` and
      `ADMIN_ACCESS_TEAM_DOMAIN` makes the Worker verify the Access JWT
      itself — RS256 signature against the team's published keys, plus
      audience and expiry. Once Access is configured a bearer token can no
      longer get in, deliberately: a token that could bypass Access would
      make adding Access a downgrade.
    * `ADMIN_TOKEN`, compared in constant time, for an account without Zero
      Trust. The Bearer scheme is required, not stripped-if-present.
  With NEITHER configured every admin data path returns 503 and serves
  nothing. The surface never falls open. No secret is in Git or the bundle.
- ADMIN PRIVACY, enforced rather than promised. No analytics query reads or
  returns a coordinate, an IP or a fingerprint — a test asserts that no SQL
  in the analytics layer can even mention one. Every caller-supplied filter
  value is whitelist-parsed and then passed as a bound parameter; a test
  asserts an injected string reaches SQL only as a bound value. The only
  geography anywhere in the dashboard is the country Cloudflare attaches at
  the edge, at country granularity.
- TURNSTILE covers the three surfaces where a stranger can write text into
  the database: the report dialog, the results rating, and the destination
  rating. Analytics events are deliberately NOT challenged — they carry no
  free text and challenging them would mean challenging every page view. Both
  halves (`TURNSTILE_SECRET_KEY` on the Worker, `VITE_TURNSTILE_SITE_KEY` on
  the build) are independently inert when unset, so they can be switched on
  in either order without a window where submissions are rejected.
  FIXED 2026-09-16: `app/src/telemetry/turnstile.ts`'s `loadTurnstile()`
  previously listened only for the challenge script's `load` event. A
  blocked or failed script load — an ad blocker, a firewall, or any network
  policy that refuses `challenges.cloudflare.com` (reproduced directly
  against this sandbox's own blocked egress to that host before fixing) —
  never fires `load`, so the returned promise never settled and every
  caller waiting on it (the report dialog, both rating forms) hung
  indefinitely: Submit stayed disabled forever with zero explanation and no
  way out — the reported "cannot be pressed or completed" bug. Fixed in the
  shared `useTurnstile` hook: listens for the script's `error` event too
  (resolves to "failed" instead of hanging), an 8s timeout backstop for a
  network policy that drops the connection without ever firing `error`, and
  a new `failed` state distinct from a failed SEND — submission still stays
  blocked while `failed`, since a Turnstile load failure must never
  silently waive the challenge (that would be a trivial client-side bypass
  of the anti-abuse gate). All three forms show the same honest
  "verification could not load, retry" affordance when this happens; when
  Turnstile is not configured at all (today's production state) the
  behavior is unchanged from before. `FeedbackDialog.tsx` previously
  reimplemented Turnstile handling ad hoc instead of using the shared hook
  (missing `error-callback` entirely); it now uses `useTurnstile` like the
  other two forms. Verified: 6 new tests in
  `app/src/telemetry/turnstile.test.ts` (script error, load timeout,
  retry recovery, widget-level error-callback — `blocking` stays `true`
  throughout every failure case), 5 new/updated tests in
  `FeedbackDialog.test.tsx`, and a live browser reproduction against the
  real blocked-network failure mode both before and after the fix.
- D1 REALITY — UPDATED 2026-09-16, later the same day. The account/token
  permission gap described below is now CLOSED.
  MEASURED on worker run 35154518086 (the admin-language-switcher deploy),
  the same read-only capability diagnostic that previously read FAILED:

      OK       identity (whoami)
      OK       Workers: list
      OK       D1: list
      OK       R2: list buckets

  The Worker deployed WITH both bindings live:
  `env.PRODUCT_DB (wejhaty-product-data)` (D1) and
  `env.FEEDBACK_SCREENSHOTS (wejhaty-feedback-screenshots)` (R2). Migrations
  report current (applied in an earlier retried run, 35127073171 attempt 4).
  This run's overall conclusion is `success` for the first time — the
  workflow's deliberate `exit 1`-on-provisioning-failure path was not
  taken, because provisioning did not fail.
  **Not yet independently verified:** an actual end-to-end write (submit a
  real rating/report against the live API, confirm a row lands in D1). That
  is application-level verification and was out of scope for the round that
  found this; do it before describing rating/feedback persistence as
  production-accepted. Until then: the bindings existing is confirmed, a
  successful round-trip write is not.
  Earlier same-day reading, for the record: worker run 35126621883 measured
  `FAILED` on D1 and R2 with `Authentication error [code: 10000]` — that
  reading is superseded by the OK reading above, not merged with it; the
  underlying account permission changed between the two runs.
  Required grants for reference, at the account level: Workers
  Scripts:Edit, D1:Edit, Workers R2 Storage:Edit (see SECRETS.md).

### Analytics plan — BUILT; D1 is now bound, real-data verification still pending

What was previously "kept, not started" is implemented: migrations, the
dashboard, the filters, Turnstile, Cloudflare Access support, the AR/EN
language switcher, and the full panel set above. Two things are still open:

- **Export.** Not built. Nothing depends on it and no one has asked for it.
- **Real data.** Every panel is verified against realistic stubbed shapes
  (`app/scripts/admin-visual-check.mjs`, desktop and mobile in both
  languages, 0 findings) but has never run against a populated D1. D1 IS
  now bound in production (see D1 REALITY above), so this is reachable —
  it just has not been done yet, because it requires live traffic or a
  deliberate test write against the production API, which is
  application-level verification distinct from what any round so far has
  been scoped to do. The queries are covered by tests; their OUTPUT against
  real rows is unverified.

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
| City descriptions (Worker) | `worker/src/cityDescriptions.ts` |
| City descriptions (browser) | `app/src/cities/cityDescriptionClient.ts` |
| Admin auth and routing | `worker/src/admin.ts` |
| Analytics queries | `worker/src/analytics.ts` |
| Admin dashboard UI | `worker/src/adminPage.ts` |
| Admin dashboard i18n dictionary | `worker/src/adminI18n.ts` |
| Turnstile (shared) | `app/src/telemetry/turnstile.ts` |
| Rating forms | `app/src/components/ResultRating.tsx`, `DestinationRating.tsx` |
| Travel Worker | `worker/` |
| Amadeus adapter | `worker/src/amadeus.ts` |
| Tourism data | `app/src/data/tourismInsights.ts` |
| Country Intelligence scoring engine | `app/src/intelligence/` |
| Country Intelligence generator | `app/scripts/generate-country-intelligence.mjs` |
| Country Intelligence frontend accessor | `app/src/data/countryIntelligence.ts` |
| Country Intelligence detail client / insights | `app/src/countryIntelligence/` |
| Country Intelligence UI | `app/src/components/CountrySuitability.tsx` |
| Country Intelligence detail API (Worker) | `worker/src/intelligence.ts` |
| Country Intelligence doc | `/COUNTRY_INTELLIGENCE.md` |
| Relative price-level data | `app/src/data/travelCostIndex.ts` |
| Country -> Best Purposes grouping | `app/src/intelligence/bestSuitedFor.ts` |
| Geolocation quiz-race bounded wait | `app/src/state/waitForLocationSettle.ts` |

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
- Product-data code is ready, including migrations 0003 (city description
  cache) and 0004 (report workflow). The Worker deployment workflow creates
  D1/R2 and applies migrations when its Cloudflare token has D1, R2 and
  Workers edit permissions; it now prints a read-only per-capability
  diagnostic first, so a failure names the missing permission. As of
  2026-09-16 (worker run 35154518086) the token HAS D1, R2 and Workers
  access, and both bindings are live in production — see D1 REALITY above.
  `ADMIN_TOKEN` (or `ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`),
  `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` remain external
  account configuration and are not yet set. SECRETS.md lists every one of
  them, what it does, and what happens while it is unset.
- Visa data: no provider is configured. The abstraction, the canonical
  vocabulary, request validation (including the IL exclusion), the Sherpa
  adapter and its category mapping, failure behaviour, the Worker endpoint,
  the passport UX and the bounded ranking layer are all implemented and
  tested. `SHERPA_API_KEY` (and `SHERPA_BASE_URL` for the sandbox) are Worker
  secrets, never committed and never in the frontend.
  `PROVIDER ACCESS REQUESTED — AWAITING VERIFIED TRAVEL REQUIREMENTS API
  CREDENTIALS` — the user has requested Sherpa API access and created a
  VisaHQ Business Portal account, but neither has yet produced a verified,
  working credential, so no integration exists yet — see
  `/VISA_PROVIDERS.md` for the comparison, the decision, and the exact
  switch-on steps.
- The Worker IS deployed from `08ebdcb5` (2026-09-16, run 35094594557,
  Version ID `54c3994c-2298-4b17-af62-2a3e29b784d2`). The visa endpoint and
  the extended ratings endpoint are live. That run's conclusion is `failure`
  purely because the workflow deliberately exits 1 after reporting the D1/R2
  provisioning failure — the Worker upload itself succeeded in the same run.
- GITHUB PAGES DEPLOY IS UNBLOCKED (2026-09-16, resolved). Run 35094587702 on
  `claude/modest-cray-34bvoa`: the `build` job succeeded and uploaded the
  Pages artifact; the `deploy` job was rejected outright with
  `Branch "claude/modest-cray-34bvoa" is not allowed to deploy to
  github-pages due to environment protection rules.` Every previous
  successful Pages deploy came from `claude/marhaba-kxry8l`, which is the
  branch the environment permits.
  This is a repository-settings gate the repo owner controls, and it was
  deliberately NOT worked around. Of the two legitimate remedies, the user
  chose (b):
    (a) add `claude/modest-cray-34bvoa` to the `github-pages` environment's
        deployment branch policy (Settings -> Environments -> github-pages),
        then re-run workflow `deploy-pages.yml` on this branch; or
    (b) fast-forward `claude/marhaba-kxry8l` — the branch the environment
        already permits — whose `app/**` push trigger then deploys Pages
        normally. DONE: `4f3d419..e3f8e4a8`, a clean fast-forward (0 commits
        behind on the left side, 11 ahead), pushed without force and without
        rewriting history.
  Pages run 35097793153 then deployed `e3f8e4a8f798add2068dc60efd290952d690d8ad`:
  `build` success, `deploy` success, environment URL
  `https://hmooodzozo577-gif.github.io/wej/`.
  `RESOLVED`.

## Cancelled/out-of-scope features

Do not resurrect without an explicit user decision:

- numeric accommodation cost without legitimate live provider data;
- cultural compatibility ranking.

(Numeric traveler budget / SAR-per-day is NOT in this list — see "Country
Intelligence + Purpose Suitability Scoring" above: Phase 13.5c Traveler
Budget is `BLOCKED / DEFERRED`, not cancelled, pending a verified source.
The non-negotiable rule against ever fabricating one stands regardless —
see "Non-negotiable product rules" above.)

## Roadmap gate and immediate backlog

Phase 16 (AI API Integration) is CANCELLED/SKIPPED by product decision —
see "Phase 16 — AI API Integration" above. Phase 17 is implemented and locally
verified. Current order:

0. Deploy the Phase 17 frontend through the existing Pages workflow and
   production-verify the real build in Arabic and English on phone, tablet,
   and desktop. Worker deployment is unnecessary because Worker code did not
   change.
1. Obtain final user acceptance for Phase 17. Do not call the phase complete
   and do not begin Phase 18 before that acceptance.
2. Production-check rating persistence and optional R2 screenshot storage;
   ordinary Contact, Suggestion, and Site Bug D1 writes are already
   production-verified.
3. AWAITING A PRODUCT DECISION — visa scoring. The current visa layer only
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
4. Obtain a visa-data provider account (Sherpa first — see
   `/VISA_PROVIDERS.md`), verify the category mapping against a real sandbox
   response, confirm in writing what the terms permit (caching, storage,
   attribution, and whether the data may inform ranking as well as display),
   then set `SHERPA_API_KEY` as a Worker secret.
5. D1 IS bound and ordinary feedback/event writes are production-verified.
   Remaining checks are rating persistence, optional R2 screenshot storage,
   retention, and authenticated Admin panels against real rows.
6. Configure admin access (`ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`
   preferred, else `ADMIN_TOKEN`) and, if abuse appears, the two Turnstile
   keys. All are documented in SECRETS.md and all are inert until set.
7. Decide whether sourced rich editorial descriptions, strengths and
   weaknesses are required for the remaining 164 countries. Note that city
   "known for" narrative is now covered by the Wikipedia description layer,
   so that part of this item is done.
8. Reassess the roadmap with the user before Phase 18.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
