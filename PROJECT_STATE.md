# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

- State document version: 15
- Last verified date: 2026-09-16 (admin AR/EN language switcher round: 164
  worker tests, 736 frontend tests, TypeScript and oxlint clean on both,
  frontend production build, worker `wrangler deploy --dry-run`, and the
  extended admin Playwright sweep at 0 findings)
- Working branch: `claude/modest-cray-34bvoa`
- Previous production frontend commit: `f60efd93`
- Production Worker source commit: `3fa14fa3` — DEPLOYED 2026-09-16 from run
  35126621883 (Version ID `f1e2b232-6d61-4b9d-b155-11eb1c32ab32`). The run's
  overall conclusion is `failure`, and that is by design: the workflow
  deploys the Worker without the D1/R2 bindings and then exits 1 so the
  provisioning failure is not concealed. The visa endpoints, the city
  description endpoint and the admin surface are live; D1 and R2 are not
  bound, so everything that needs them answers 503.
- Production FRONTEND commit: `3fa14fa3` — DEPLOYED 2026-09-16 from Pages run
  35126621769 (`build` success, `deploy` success, environment URL
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
     re-read and is not being guessed. See /VISA_PROVIDERS.md.
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
- D1 REALITY — nothing persists in production yet. Product-data requests
  return `503 product_data_unavailable`; the rating UI therefore shows its
  error-and-retry state honestly, which is exactly the message the user
  reported and is NOT hidden.
  MEASURED 2026-09-16, worker run 35126621883, the new read-only capability
  diagnostic — the token's exact capability, no longer inferred:

      OK       identity (whoami)
      OK       Workers: list
      FAILED   D1: list          — Authentication error [code: 10000]
                                   on /accounts/*/d1/database
      FAILED   R2: list buckets  — Authentication error [code: 10000]
                                   on /accounts/*/r2/buckets

  So `CLOUDFLARE_API_TOKEN` CAN deploy Workers and CANNOT touch D1 or R2.
  That is an account/token permission gap, not a code defect —
  `READY — USER/ACCOUNT CONFIGURATION REQUIRED`. Required grants, at the
  account level: Workers Scripts:Edit, D1:Edit, Workers R2 Storage:Edit
  (see SECRETS.md).
  Do not describe rating or feedback persistence as working until a deploy
  run shows the provisioning step succeeding AND a row is confirmed in D1.

### Analytics plan — now BUILT, awaiting D1

What was previously "kept, not started" is implemented: migrations, the
dashboard, the filters, Turnstile, Cloudflare Access support and the full
panel set above. Two things are deliberately still open:

- **Export.** Not built. Nothing depends on it and no one has asked for it.
- **Real data.** Every panel is verified against realistic stubbed shapes
  (`app/scripts/admin-visual-check.mjs`, desktop and mobile, 0 findings) but
  has never run against a populated D1, because D1 does not exist yet. The
  queries are covered by tests; their OUTPUT is unverified until the account
  gap above is closed.

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
- Product-data code is ready, including migrations 0003 (city description
  cache) and 0004 (report workflow). The Worker deployment workflow creates
  D1/R2 and applies migrations when its Cloudflare token has D1, R2 and
  Workers edit permissions; it now prints a read-only per-capability
  diagnostic first, so a failure names the missing permission. The last
  observed state of the repository token is that it lacks D1 access.
  `ADMIN_TOKEN` (or `ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`),
  `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` are external account
  configuration and are not yet set. SECRETS.md lists every one of them, what
  it does, and what happens while it is unset.
- Visa data: no provider is configured. The abstraction, the canonical
  vocabulary, request validation (including the IL exclusion), the Sherpa
  adapter and its category mapping, failure behaviour, the Worker endpoint,
  the passport UX and the bounded ranking layer are all implemented and
  tested. `SHERPA_API_KEY` (and `SHERPA_BASE_URL` for the sandbox) are Worker
  secrets, never committed and never in the frontend.
  `READY — PROVIDER ACCOUNT/CREDENTIALS REQUIRED` — see `/VISA_PROVIDERS.md`
  for the comparison, the decision, and the exact switch-on steps.
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
- numeric traveler budget / fabricated SAR-per-day;
- cultural compatibility ranking.

## Roadmap gate and immediate backlog

Phase 17 has not started. Current order:

1. **UPDATE `CLOUDFLARE_API_TOKEN`.** This is now the single blocker holding
   back the most product value. Until it has Workers Scripts:Edit, D1:Edit and
   Workers R2 Storage:Edit at the account level:
     * no rating or report can persist — the user's "تعذر حفظ التقييم الآن"
       is correct and will keep appearing;
     * no city description can be cached, so every card re-fetches (it still
       works, just without a cache);
     * the admin dashboard has nothing to show;
     * R2 report screenshots cannot be stored.
   The deploy workflow prints a per-capability diagnostic, so the next run's
   log names exactly what is missing. Exact grants: SECRETS.md.
2. AWAITING THE USER'S OWN PRODUCTION TEST of the six acceptance findings.
   Nothing in this round is user-accepted. The live app cannot be reached
   from the agent sandbox (403 at the egress proxy for `github.io` and
   `workers.dev`), so NO claim in this document is live-UI-verified; the
   deploy facts come from the GitHub Actions runs themselves.
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
5. Once D1 exists: production-verify event, rating, feedback, retention, city
   description caching and the admin panels against real rows — and confirm
   the failure path still fails honestly by a controlled safe test.
6. Configure admin access (`ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`
   preferred, else `ADMIN_TOKEN`) and, if abuse appears, the two Turnstile
   keys. All are documented in SECRETS.md and all are inert until set.
7. Decide whether sourced rich editorial descriptions, strengths and
   weaknesses are required for the remaining 164 countries. Note that city
   "known for" narrative is now covered by the Wikipedia description layer,
   so that part of this item is done.
8. Reassess the roadmap with the user before Phase 17.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
