# Wejhaty Project State

Canonical, vendor-neutral CURRENT state snapshot for any AI coding agent or
human engineer. The repository remembers Wejhaty — not any one agent's chat
history. Answers: "what does a fresh engineer or agent need to know about
Wejhaty RIGHT NOW?" Not a changelog, not a transcript, not an exhaustive
architecture doc — see Source-of-Truth Priority below whenever this file and
reality disagree.

Agent-specific tooling/policy lives in that agent's own files (for Claude
Code: `CLAUDE.md` + `.claude/skills/`). This file and `AGENTS.md` are the
vendor-neutral pair every agent should read first.

## State Metadata

- State document version: 2
- Last verified date: 2026-09-11
- Last verified branch: `claude/marhaba-kxry8l`
- Last verified HEAD: `c468ed3e7bac0c474826b42fcbd47d4bf9d8597d`

**Branch and HEAD above are recovery references, not permanent
requirements.** Always verify current Git state before starting work
(`git branch --show-current`, `git status --short`, `git log --oneline`).
Do not assume a Claude-named branch is permanently mandatory for other
agents/tools.

## Product

Wejhaty (وِجهتي) — no-login destination-recommendation web app. A traveler
answers a purpose-specific question bank (or describes their trip in free
text; AI interprets it), a deterministic engine ranks ~194 destinations, and
AI can drive an adaptive interview and explain the ranking. React/Vite
frontend on GitHub Pages, Cloudflare Worker backend for AI + travel APIs.

## Non-Negotiable Product Rules

- Arabic + English; Arabic is the default language.
- No login/account requirement anywhere.
- Phase 14 (deterministic `app/src/engine/scoreDestination.ts`/
  `rankDestinations.ts`) is the FINAL ranking authority. AI may interpret/
  interview/explain but must never invent ranking weights or rank countries
  itself.
- Real provider price ≠ estimated/derived price. Never fabricate a
  flight/hotel/accommodation price from distance, cost level, or PLI.
- Israel (IL/ISR) exclusion from every effective catalog/AI-context/search/
  routing path is absolute. Monaco (MC/MCO) is a valid, included
  destination — never confuse the two.
- No precise coordinates are ever sent to the AI (a coarse country name
  only, and only when location was granted).
- No secrets/API keys anywhere in the frontend (`app/`) or in any
  `VITE_*` variable — Worker-only, via Cloudflare Worker secrets.
- Never infer religion, ethnicity, politics, personal values, or cultural
  tolerance from location, nationality, language, or device locale.
- Cancelled roadmap features (see below) must not be silently resurrected.

## Current Roadmap Position

- Phase 14 — COMPLETE — TESTED
- Phase 15 — COMPLETE — TESTED (deterministic adaptive question ordering;
  also the AI-failure fallback driver for Phase 16.5)
- Phase 16 — COMPLETE — LIVE VERIFIED (Capabilities A/B: preference
  interpretation, recommendation explanation). *REPORTED*: live
  production verification happened in an earlier session; not
  independently re-checked from every later session (no guaranteed
  network path to the deployed Worker URL from every environment).
- **Phase 16.5 — PRODUCTION E2E FAILED — NOT COMPLETE.** The user's
  latest production test succeeded at initial cold/nature interpretation,
  then showed the old Phase 15 questions after loading instead of a
  Capability C AI-generated adaptive question.
  - **VERIFIED on 2026-09-11:** a fresh browser run sent Capability C
    immediately on Quiz entry with an EMPTY confirmed profile. It returned
    HTTP 502 / ai_provider_error / unexpected response after about 20s.
    Initial interpretation separately returned HTTP 200 with climate=cold
    and naturecity=15; proposals in this run were low-confidence, so the
    automation did not complete preference confirmation. This is failure
    evidence, not a successful post-confirmation E2E.
  - **VERIFIED:** one additional production C request, based on the captured
    real catalog with cold/nature explicitly marked confirmed, returned
    HTTP 504 / ai_timeout after about 48s. The exact model-output or
    validation cause of the earlier 502 remains UNKNOWN; do not assume
    the timeout and 502 have the same cause.
  - **FIRST CORRECTIVE DEPLOYMENT FAILED LIVE VERIFICATION:** the confirmed
    frontend request-context race is fixed and regression-tested; obsolete
    success/error/complete responses cannot mutate the current interview. The
    first Worker correction used a bare JSON Schema and production rejected it
    immediately (502 in 0.7 seconds): Gemma 4's current Cloudflare binding is a
    Chat Completions model and requires `{name, schema}`. The follow-up adapter
    correction restores that model-specific envelope while retaining the new
    complete response shape, disabled thinking, bounded output, and safe fixed
    diagnostics. A fresh deployment and live verification are still required.
    That envelope reached inference and produced a structured response in 3.96
    seconds, but the Worker correctly rejected its non-canonical option updates
    with diagnostic `choice_options`. The next local correction derives the
    output schema's eligible ids and exact allowed values from the request
    catalog; it is not production-verified yet.
  - GitHub authentication is now available and commit `08e6728` was pushed;
    both Worker deployment #14 and Pages deployment #65 succeeded. Local
    Wrangler authentication is still unavailable, but CI deployment access is
    sufficient for this branch.
  - Turn-by-turn Back/Undo is NOT implemented for the AI-active
    interview. The edit mechanism today is: remove a confirmed
    preference (the "already accounted for" chip's × control), which
    un-resolves that one dimension and lets the AI reconsider it. No
    multi-step undo history exists. Needs a user/product decision
    before Phase 16.5 is considered fully closed.
- Phase 17 — NOT STARTED. **Do not start Phase 17 without an explicit,
  current task instruction to do so.**
- Phase 18 / 19 / 20 — NOT STARTED.

## Architecture Map

Navigation, not exhaustive documentation — inspect the files for detail.

| System | Path |
|---|---|
| Frontend app | `app/` |
| Recommendation engine (Phase 14) | `app/src/engine/` (`scoreDestination.ts`, `rankDestinations.ts`) |
| Adaptive interview (Phase 15 fallback + orchestration) | `app/src/adaptive/` (`selectNextQuestion.ts`, `useAdaptiveInterview.ts`, `followupTemplates.ts`) |
| Quiz route (UI entry point) | `app/src/routes/Quiz.tsx` |
| Travel Profile (read-only state view) | `app/src/profile/travelProfile.ts` |
| AI frontend service | `app/src/ai/` (`aiService.ts`, `buildDimensionCatalog.ts`, `buildLocationContext.ts`, `mapQuestionsForAi.ts`, `types.ts`) |
| Location system | `app/src/geo/` (`geolocation.ts`, `permissionsApi.ts`, `useGeolocationPermission.ts`) |
| Preference summaries | `app/src/data/summaryMeta.ts` |
| Cloudflare Worker | `worker/` |
| AI Worker routes/types/providers | `worker/src/ai/` (`provider.ts`, `types.ts`, `prompts.ts`, `validate.ts`, `cloudflareWorkersAiProvider.ts`, `mockProvider.ts`), routed from `worker/src/index.ts` |
| Amadeus (flights) integration | `worker/src/amadeus.ts` |
| Destination image pipeline | `app/scripts/generate-destination-images.mjs`, manifest `app/src/data/generated/destinationImages.json`, consumed via `app/src/data/destinationVisuals.ts` |
| Tourism data | `app/src/data/tourismInsights.ts`, `app/scripts/generate-tourism-insights.mjs`, `app/scripts/TOURISM_INSIGHTS.md` |
| Travel-cost / PLI data | `app/src/data/travelCostIndex.ts`, `app/scripts/generate-travel-cost-index.mjs`, `app/scripts/TRAVEL_COST_INDEX.md` |
| Hotel architecture note (not yet built) | `app/HOTEL_INTEGRATION.md` |
| Secrets policy | `SECRETS.md` |
| CI/CD workflows | `.github/workflows/` |

## AI Architecture

```
Traveler
  → AI-guided adaptive interview (Capability C, next-turn decision loop)
  → structured Travel Profile
  → canonical Answers adapter
  → deterministic Phase 14 (final ranking authority)
  → ranked destinations
  → grounded AI explanation (Capability B)
```

- Provider: Cloudflare Workers AI, native `env.AI` binding
  (`worker/wrangler.toml`'s `[ai] binding = "AI"`) — no API key of any
  kind; an account-scoped Cloudflare binding, not a bearer credential.
- **PRODUCTION vs. LOCAL/CI TEST ENVIRONMENT — do not conflate these.**
  Once the Worker is deployed with the `[ai]` binding active (it is),
  `env.AI` is populated automatically in production and
  `resolveAiProvider()` (`worker/src/ai/provider.ts`) returns a real
  provider there. In any LOCAL/CI environment without a real runtime
  binding (every Vitest test's plain `Env`, `wrangler deploy --dry-run`),
  `env.AI` is `undefined` by construction and resolution correctly
  returns `null` — a **test-environment fact**, not evidence production
  is unconfigured. Never state "Workers AI is unconfigured" without
  saying which of the two you mean.
- Current model (verified in code,
  `worker/src/ai/cloudflareWorkersAiProvider.ts`):
  `@cf/google/gemma-4-26b-a4b-it`.
- Phase 16 Capabilities A/B: REPORTED live-verified in an earlier session;
  Capability A additionally returned HTTP 200 in the 2026-09-11 browser
  investigation. Capability C returned real 502/504 failures during that
  investigation; its production path remains open (roadmap caveat above).
- Phase 15 (`app/src/adaptive/selectNextQuestion.ts`) is the AI-failure
  fallback ONLY — `state.interviewStatus` is a one-way switch to
  `'fallback'` on any Capability-C failure (timeout/error/invalid/
  unavailable/quota), never flaps back to `'active'`.

## Adaptive Interview

- AI chooses the next contextual information need during normal
  operation (not a fixed deterministic template bank).
- AI-generated CHOICE questions and short FREE-TEXT clarifications are
  both supported (`PendingFollowup.questionType`); free-text renders as
  the PRIMARY UI when the AI picks it, never a secondary toggle.
- One answer/option may resolve multiple supported dimensions at once.
- A resolved dimension is not re-asked — enforced both server-side
  (`worker/src/ai/validate.ts`) and client-side
  (`state.askedDimensionIds`).
- Phase 15 is the failure fallback only; it continues from the CURRENT
  confirmed profile, never restarts, never re-asks a resolved dimension.
- Persistent, human-readable summaries always come from canonical
  metadata (`app/src/data/summaryMeta.ts`) — an AI turn's own generated
  wording is never the persistent summary.
- The free-text entry ("أخبرنا عن رحلتك") renders before the progress
  indicator, which renders directly above the current question/card, in
  every state (AR/EN, active/fallback).
- Active-mode progress is profile-completion-based (resolved/total
  ranking-supported dimensions), never a fixed "Question X of Y" the AI
  path cannot honor.
- Known canonical mapping — `naturecity` dimension: `15 = Nature`,
  `50 = Mix`, `90 = Cities`.
- Edit limitation (truthful, not a bug): preference removal/
  re-resolution exists; a full turn-by-turn AI-interview Back/Undo
  stack does not.

## Location

- Explicit user opt-in only; no automatic browser geolocation prompt.
- Permissions API pre-detection implemented — granted/prompt/denied/
  unsupported handled distinctly. Querying permission state never
  itself triggers the OS prompt or calls `getCurrentPosition`.
- Coordinates stay memory-only, never persisted, never sent to the AI —
  only a coarse country name reaches the AI, and only when granted.
- A denied/unavailable location never breaks the interview.

## Travel / Amadeus

- Code/provider architecture: READY (`worker/src/amadeus.ts` — real
  OAuth2 client-credentials flow, Flight Offers Search, fully tested).
- Required Worker secret names (values never stored anywhere in this
  repo or requested in chat): `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`.
- One known provisioning method (not the only possible one): Cloudflare
  Worker secrets via `cd worker && npx wrangler secret put
  AMADEUS_API_KEY` (and `_SECRET`) from a machine with Wrangler
  authenticated. These are Cloudflare Worker secrets, not GitHub
  Actions secrets.
- Status: **READY — CREDENTIAL PROVISIONING REQUIRED** (EXTERNAL STATE
  — re-check before assuming still true).
- Real provider data ≠ a deterministic estimate: flight time/distance
  estimates stay clearly labeled "ESTIMATED"; a real Amadeus offer is
  clearly labeled live. No fake flight prices.

## Hotels

Do not overstate. Current accurate state:

- Provider candidates audited; Amadeus Hotel Search/Booking API
  preferred conceptually (same credentials as flights, no new vendor).
- Architecture documented in `app/HOTEL_INTEGRATION.md` (planned Worker
  route/provider module, planned frontend service, explicit
  no-fabricated-price rule) — verify this file is still present before
  trusting this line.
- Worker hotel route/provider code: **NOT implemented.**
- Frontend live hotel integration: **NOT implemented.**
- Live hotel availability/pricing: **NOT implemented.**
- Provider/account/credential setup is ALSO still required, on top of
  the missing code.

**Status: `HOTEL LIVE INTEGRATION — NOT IMPLEMENTED — ARCHITECTURE
PLANNED — PROVIDER/CREDENTIAL SETUP ALSO REQUIRED`.** Do not call this
`READY — CREDENTIAL PROVISIONING REQUIRED` — code is not the only gap.

## Destination Images

Pipeline and coverage are separate facts — do not conflate them.

- Pipeline (`app/scripts/generate-destination-images.mjs` +
  `.github/workflows/generate-destination-images.yml`): **COMPLETE —
  TESTED — DEPLOYED.** Runs on GitHub-hosted runners (real internet
  access) since Wikimedia is not reachable from every sandboxed agent
  environment.
- Coverage as of last verification (iso2-keyed — the correct key;
  `app/src/data/destinationVisuals.ts` keys by
  `CatalogEntry.countryCode`, NOT array/object index): **163 / 194.**
  Re-verify before trusting this number for long.
- Remaining 31, FALLBACK/REVIEW REQUIRED, with the pipeline's own real
  per-country rejection reason (not a vague "blocked"):
  - COUNTRY_RELEVANCE (candidate found, rejected as not clearly about
    the country / homonym risk): AO, BA, BG, BF, CF, CD, GN, LR, LI,
    MH, MU, SN, SD
  - NO_CANDIDATE (no search results at all): BI, SZ, GM, KN, ST, SR,
    TO, VA
  - INVALID (candidate found, failed landscape/aspect-ratio
    validation): SE, CL, EC, ER, KI, NR, SO, SS, TJ, VU
- Do not describe the image FEATURE as complete merely because the
  pipeline works — 31 real destinations still show a fallback image.

## Tourism / Cost Data

- Tourism: `app/src/data/tourismInsights.ts`, sourced via UN Tourism
  data (through Our World in Data), refreshed by
  `app/scripts/generate-tourism-insights.mjs` — see
  `app/scripts/TOURISM_INSIGHTS.md` for current source/date coverage
  detail (verify before quoting a specific year).
- PLI (Travel Cost Index): World Bank `PA.NUS.GDP.PLI`, a RELATIVE
  price-level context — NOT a traveler daily budget, never converted to
  a SAR/day or any other currency figure. See
  `app/scripts/TRAVEL_COST_INDEX.md`.

## Data Refresh Automation

- Workflow implementation (`update-travel-cost-index.yml`,
  `update-tourism-insights.yml`): READY — branch→validate→PR, never a
  direct push to the working branch, built-in `GITHUB_TOKEN` only.
- Last live evidence: branch creation succeeds (real upstream data
  fetched/validated/pushed to a fresh per-run branch); PR creation
  fails with the GitHub API's own error "GitHub Actions is not
  permitted to create or approve pull requests."
- Required fix: repo admin → **Settings → Actions → General →
  Workflow permissions → "Allow GitHub Actions to create and approve
  pull requests."**
- Status: **READY — REPOSITORY SETTING REQUIRED** (EXTERNAL STATE — a
  repository setting can change outside Git; re-check before treating
  this as still current).

## Cancelled / Out of Scope

User decisions, not blockers — do not resurrect without the user
explicitly reopening the topic:

- Numeric Accommodation Cost derived without real live provider data —
  CANCELLED / OUT OF SCOPE.
- Numeric Traveler Budget / fabricated SAR-per-day estimate —
  CANCELLED / OUT OF SCOPE.
- Cultural Compatibility Ranking (a score/percentage feeding Phase 14)
  — CANCELLED / OUT OF SCOPE.

Preserved, NOT cancelled — do not delete or reinterpret as blocked:
- Qualitative accommodation cost LEVEL (`app/src/components/AccommodationInfo.tsx`).
- PLI / Travel Cost Index relative-price context.
- Cultural preference as plain interview CONTEXT, no ranking score.

## Current Backlog / External Actions

1. Publish the tested request-context guard and safe C diagnostics once
   deployment access is available; isolate and fix the real C 502/504
   failures using fresh evidence. Preserve NO HYBRID and current-error
   fallback; never accept mocks as proof of production success.
2. Fresh successful production C request and browser E2E, followed by
   final user acceptance.
3. Decide whether true turn-by-turn AI-interview Back/Undo is required
   before Phase 16.5 is considered fully closed.
4. Provision `AMADEUS_API_KEY` (Cloudflare Worker secret).
5. Provision `AMADEUS_API_SECRET` (Cloudflare Worker secret).
6. Implement live hotel Worker/frontend integration if desired
   (architecture ready, code is not).
7. Enable the GitHub Actions repo setting for PR creation.
8. 31 destination images remain review/fallback (see Destination
   Images above for exact codes/reasons).

Do not list the 3 cancelled items as blockers. Reconcile this list with
current repository facts before trusting it long-term.

## Verification Commands

Frontend (`app/`):
```
cd app
npx vitest run
npx tsc -b
npx oxlint
npm run build
```

Worker (`worker/`):
```
cd worker
npx vitest run
npx tsc --noEmit
npx wrangler deploy --dry-run
```

## Evidence Conventions

Used throughout this file and expected in any future update:

- **VERIFIED** — directly established from current repository code/
  tests/configuration during the relevant audit.
- **REPORTED** — stated by a previous agent/report, not independently
  re-verified this time.
- **EXTERNAL STATE** — depends on GitHub/Cloudflare/provider/account
  configuration outside the repository; can change without a commit.
- **USER ACCEPTANCE PENDING** — technically implemented/tested/
  deployed, still awaiting real user E2E acceptance.
- **UNKNOWN** — insufficient evidence either way.

Never silently upgrade REPORTED or EXTERNAL STATE to VERIFIED without
actually checking.

## Current Git / Deployment Reference

- Branch: `claude/marhaba-kxry8l` (last verified — re-check, don't
  assume permanent).
- Last verified HEAD: `c468ed3e7bac0c474826b42fcbd47d4bf9d8597d`.
- Pages deploys automatically on push touching `app/**`
  (`.github/workflows/deploy-pages.yml`).
- Worker deploys automatically on push touching `worker/**`
  (`.github/workflows/deploy-worker.yml`).
- Do not treat any specific workflow-run ID as a standing guarantee —
  always re-check current Actions runs for the CURRENT state.
- 2026-09-11 recovery: branch/HEAD fetched and verified. Latest successful
  Worker deploy ef0d253 and Pages deploy eee8f23 contain the same relevant
  source/config as recovery HEAD c468ed3. The published Pages bundle
  index-I626fm-B.js contains the expected Worker URL and /api/ai/next-turn;
  live GET on that route returns 405 with the correct CORS origin. No
  deployment mismatch was demonstrated by those checks.
- Current request-context/diagnostic changes are local and uncommitted;
  neither workflow has deployed them. See PHASE_16_5_DEBUG.md for bounded
  reproduction evidence, verification results, and the next diagnostic step.

## Source-of-Truth Priority

When sources conflict, resolve in this order:

1. Current repository code/tests/configuration.
2. Current Git state (`git log`, `git status`, deployed workflow runs).
3. Current root `PROJECT_STATE.md` (this file).
4. Root `AGENTS.md`.
5. A vendor-specific agent's own instructions (e.g. `CLAUDE.md`).
6. Historical reports/chat summaries — lowest priority; never trust a
   remembered conversation over what the repository actually contains.

External service state (GitHub repo settings, Cloudflare account
configuration, provider credentials) must still be re-checked when
relevant — the repository itself cannot prove current external
configuration; see Evidence Conventions above.

## Agent Handoff Rule

Before ending substantial work, any agent should:

- Update this file if something MATERIAL changed (a phase completed/
  started, an architecture decision changed, a feature was cancelled,
  a blocker resolved, a provider/credential got configured, a major
  deployment status changed, an important backlog item completed, the
  canonical branch changed, or a critical product decision changed).
  Do not update for routine commits or anything that doesn't change
  the state described here.
- Record current truth, not an exhaustive history.
- Distinguish repository evidence from external/reported state (see
  Evidence Conventions).
- Keep cancelled features cancelled.
- Record the final branch/HEAD as a last-verified reference, not a
  permanent command.
- Leave Git clean when appropriate; never store secrets anywhere in
  this file.
- Do not depend on conversation memory for future recovery — the next
  agent may have zero chat history.
