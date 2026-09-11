# Wejhaty Project State

Canonical Claude-facing state snapshot. Answers: "what does a fresh Claude
session need to know RIGHT NOW before working?" Not a changelog, not a
report archive — see the source-of-truth priority rule below whenever
this file and reality disagree.

## State Metadata

- Last verified date: 2026-09-11
- Verified Git branch: `claude/marhaba-kxry8l`
- Verified HEAD: `eee8f23ba16883718b433568e7838865f64623f6`
- State-file version: 1

## Product

Wejhaty (وِجهتي) — no-login destination-recommendation web app. User answers
a purpose-specific question bank (or describes their trip in free text, AI
interprets it), a deterministic engine ranks ~194 destinations, AI can
generate an adaptive interview and explain the ranking. React/Vite frontend
on GitHub Pages, Cloudflare Worker backend for AI + travel APIs.

## Non-Negotiable Product Rules

- Arabic + English; Arabic is the default language.
- No login/account requirement anywhere.
- Phase 14 (deterministic `engine/scoreDestination.ts`/`rankDestinations`)
  is the FINAL ranking authority. AI may interpret/interview/explain but
  never ranks countries, never sets weights/scores directly.
- Real provider price ≠ estimated/derived price. Never fabricate a
  flight/hotel/accommodation price from distance, cost level, or PLI.
- Israel (IL/ISR) exclusion from the catalog/AI context/search/routing is
  absolute. Monaco (MC/MCO) is a valid, included destination — never
  confuse the two.
- No precise coordinates are ever sent to the AI (coarse country name
  only, when location was granted).
- No secrets/API keys anywhere in the frontend (`app/`) or in any
  `VITE_*` variable. Worker-only, via Cloudflare Worker secrets.

## Current Roadmap Position

- Phase 14 — COMPLETE
- Phase 15 — COMPLETE (deterministic adaptive question ordering; now also
  the AI-failure fallback driver for Phase 16.5 — see below)
- Phase 16 — COMPLETE — LIVE VERIFIED (Capabilities A/B: preference
  interpretation, recommendation explanation — REPORTED/EXTERNAL: live
  production verification happened in an earlier session; not
  re-verified from this sandbox, which has no network path to the
  deployed Worker URL)
- **Phase 16.5 — IMPLEMENTED — TESTED — DEPLOYED — PENDING USER
  PRODUCTION E2E ACCEPTANCE.** TRUE AI-driven adaptive interview
  (Capability C, `/api/ai/next-turn`) replaces the old deterministic
  template-bank follow-up as the NORMAL interview driver. Caveats,
  explicit (do not silently drop these):
  - Capability C itself has NOT yet received a fresh live
    production/provider verification call (Capabilities A/B were;
    C is new this pass — worker tests use the mock provider and an
    `env.AI`-mocked adapter, never a real paid call).
  - Turn-by-turn Back/Undo is NOT implemented for the AI-active
    interview path. The edit mechanism today is: remove a confirmed
    preference (the existing "already accounted for" chip's × button),
    which un-resolves that one dimension and lets the AI reconsider it.
    There is no multi-step undo history. This is a real product-UX gap,
    not a bug — needs a user/product decision before Phase 16.5 can be
    called fully closed.
- Phase 17 — NOT STARTED
- Phase 18 — NOT STARTED
- Phase 19 — NOT STARTED
- Phase 20 — NOT STARTED

## AI Architecture

```
Traveler
  → AI-guided adaptive interview (Capability C, next-turn decision loop)
  → structured Travel Profile (profile/travelProfile.ts, read-only view)
  → canonical Answers adapter
  → deterministic Phase 14 (final ranking authority)
  → ranked destinations
  → grounded AI explanation (Capability B)
```

- Provider: Cloudflare Workers AI, native `env.AI` binding
  (`worker/wrangler.toml`'s `[ai] binding = "AI"`) — no API key of any
  kind; this is an account-scoped Cloudflare binding, not a bearer
  credential.
- **PRODUCTION binding vs. LOCAL TEST ENVIRONMENT — do not conflate
  these:** once the Worker is deployed with the `[ai]` binding active
  (it is — confirmed live in `worker/wrangler.toml`, and every
  `deploy-worker.yml` run this session succeeded), `env.AI` is
  populated automatically in production; `resolveAiProvider()` returns
  a real provider there. In any LOCAL/CI environment without that real
  runtime binding — every Vitest test's plain object `Env`, `wrangler
  deploy --dry-run` — `env.AI` is `undefined` by construction, and
  `resolveAiProvider()` correctly returns `null` there. That is a
  **test-environment fact**, not evidence that production is
  unconfigured. Never write "Workers AI is unconfigured" without
  specifying which of the two you mean.
- Current model (verified in code,
  `worker/src/ai/cloudflareWorkersAiProvider.ts`):
  `@cf/google/gemma-4-26b-a4b-it`.
- Phase 16 Capabilities A/B: REPORTED live-verified in production in an
  earlier session (see repo history — this sandbox cannot independently
  re-check a live URL).
- Phase 16.5 Capability C: code-complete, worker+frontend tests green,
  but needs a fresh production E2E check (see roadmap caveat above).
- Phase 15 (`adaptive/selectNextQuestion.ts`) is the AI-failure
  fallback ONLY — `state.interviewStatus` is a one-way switch to
  `'fallback'` on any Capability-C failure (timeout/error/invalid/
  unavailable/quota), never flaps back.

## Current Interview UX

- "أخبرنا عن رحلتك" (free-text entry) renders before the progress
  indicator, which renders directly above the actual interview
  question/card, in every state (AR/EN, active/fallback).
- A confirmed AI-interpreted or AI-turn-resolved preference eliminates
  its question from the remaining interview — never re-asked.
- Persistent summaries always come from canonical metadata
  (`data/summaryMeta.ts`'s `summarizeAnswer`) — an AI turn's own
  generated prompt/option wording is NEVER the persistent summary.
- Nature/City canonical mapping (`naturecity` dimension):
  `15 = Nature`, `50 = Mix`, `90 = Cities`.
- AI-generated CHOICE and FREE-TEXT turns both exist
  (`PendingFollowup.questionType`); free-text renders as the PRIMARY
  UI when the AI picks it, not a secondary toggle.
- One answer/option may resolve multiple dimensions at once
  (`NextTurnOption.updates` / `FollowupOption.satisfies` are maps).
- Duplicate prevention is dimension-level, enforced both server-side
  (`worker/src/ai/validate.ts`'s `validateNextTurnResult`) and
  client-side (`state.askedDimensionIds`).
- Phase 15 fallback continues from the CURRENT confirmed profile —
  never restarts, never re-asks an already-resolved dimension.
- Progress in the AI-active path is profile-completion-based
  (resolved/total ranking-supported dimensions), never a fixed
  "Question X of Y" the AI path can't honor.

## Location

- Explicit opt-in only; no automatic browser permission prompt on load.
- Permissions API pre-detection implemented
  (`app/src/geo/permissionsApi.ts` + `useGeolocationPermission.ts`):
  granted/prompt/denied/unsupported all handled distinctly. Querying
  permission state NEVER itself triggers the OS prompt or calls
  `getCurrentPosition` — only an explicit user click does.
- Coordinates live in memory only (`state.location.coords`), never
  persisted, never sent to the AI — only a coarse country NAME
  (`ai/buildLocationContext.ts`) reaches the AI, and only when granted.

## Travel / Amadeus

- Code architecture: READY. Real OAuth2 client-credentials flow +
  Flight Offers Search (`worker/src/amadeus.ts`), fully tested.
- Required Worker secret names (values NEVER stored here or requested
  in chat): `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`.
- Provisioning path: Cloudflare Worker secrets via
  `cd worker && npx wrangler secret put AMADEUS_API_KEY` (and
  `_SECRET`) from a machine with Wrangler authenticated — NOT a GitHub
  Actions secret, no GitHub UI location applies.
- Status: **READY — CREDENTIAL PROVISIONING REQUIRED.**
- Rule preserved: real provider data ≠ a deterministic/derived
  estimate. Flight time/distance estimates stay clearly labeled
  "ESTIMATED"; a real Amadeus offer is clearly labeled live.

## Hotels

Do not overstate this. Current accurate state:

- Provider candidates audited; Amadeus Hotel Search/Booking API
  selected conceptually (same credentials as flights, no new vendor).
- Architecture documented in `app/HOTEL_INTEGRATION.md` (planned Worker
  route/provider module, planned frontend service, explicit
  no-fabricated-price rule).
- Worker hotel route/provider code: **NOT implemented** (verified —
  `worker/src/` has no hotel-related file).
- Frontend live hotel integration: **NOT implemented** (verified —
  `app/src/` has no hotel-related file).
- Live hotel availability/pricing: **NOT implemented.**
- Credentials/account configuration also still required on top of the
  missing code.

**Status: `HOTEL LIVE INTEGRATION — NOT IMPLEMENTED — ARCHITECTURE
PLANNED — PROVIDER/CREDENTIAL SETUP ALSO REQUIRED`.** Do NOT call this
`READY — CREDENTIAL PROVISIONING REQUIRED` until the Worker route and
frontend service actually exist — credentials are not the only gap.

## Images

Pipeline and coverage are separate facts — do not conflate them.

- Destination Image Pipeline (`app/scripts/generate-destination-images.mjs`
  + `.github/workflows/generate-destination-images.yml`): **COMPLETE —
  TESTED.** Network-enabled GitHub Actions run (this sandbox cannot
  reach Wikimedia directly — confirmed, `connect_rejected`); real,
  live remediation runs succeeded this session.
- Current verified coverage (re-checked 2026-09-11, iso2-keyed — this
  is the correct key; `destinationVisuals.ts` keys by
  `CatalogEntry.countryCode`, NOT array index): **163 / 194.**
- Remaining 31, FALLBACK/REVIEW REQUIRED, with the pipeline's own
  real rejection reason per country (not a vague "blocked"):
  - COUNTRY_RELEVANCE (candidate found, rejected as not clearly about
    the country / homonym risk): AO, BA, BG, BF, CF, CD, GN, LR, LI,
    MH, MU, SN, SD (13)
  - NO_CANDIDATE (no search results at all): BI, SZ, GM, KN, ST, SR,
    TO, VA (8)
  - INVALID (candidate found, failed landscape/aspect-ratio
    validation): SE, CL, EC, ER, KI, NR, SO, SS, TJ, VU (10)
- Do not describe the image FEATURE as 100% complete merely because the
  PIPELINE works — 31 real destinations still show a fallback image.

## Data Refresh Automation

- Workflow implementation (`update-travel-cost-index.yml`,
  `update-tourism-insights.yml`): READY — branch→validate→PR, never a
  direct push to `claude/marhaba-kxry8l`, `GITHUB_TOKEN` only.
- Live verification (2026-09-11, this session): branch creation
  succeeds (real World Bank data fetched/validated/pushed to a fresh
  per-run branch); PR creation fails with the GitHub API's own error
  `GitHub Actions is not permitted to create or approve pull requests`.
- Required manual fix: repo admin → **Settings → Actions → General →
  Workflow permissions → "Allow GitHub Actions to create and approve
  pull requests."**
- Status: **READY — REPOSITORY SETTING REQUIRED.**

## Cancelled / Out of Scope

These are user decisions, not blockers — never resurrect them without
the user explicitly reopening the topic:

- Numeric Accommodation Cost derived without real live provider data —
  CANCELLED / OUT OF SCOPE.
- Numeric Traveler Budget / fabricated SAR-per-day estimate —
  CANCELLED / OUT OF SCOPE.
- Cultural Compatibility Ranking (a score/percentage feeding Phase 14)
  — CANCELLED / OUT OF SCOPE.

Preserved, NOT cancelled (do not delete or reinterpret as blocked):
- Qualitative accommodation cost LEVEL (`AccommodationInfo.tsx`).
- PLI / Travel Cost Index relative-price information (unaffected).
- Cultural preference as plain interview CONTEXT, no ranking score
  (exactly what the AI's cultural-novelty clarification already does).

## Backlog / User-Action Items

1. Real production user E2E for Phase 16.5 Capability C (next-turn).
2. Decide whether true turn-by-turn Back/Undo is required before
   Phase 16.5 is considered fully closed.
3. Provision `AMADEUS_API_KEY` (Cloudflare Worker secret).
4. Provision `AMADEUS_API_SECRET` (Cloudflare Worker secret).
5. Hotel implementation (Worker route + frontend service) still
   required if live hotel data is wanted — architecture is ready,
   code is not.
6. Enable the GitHub Actions repo setting for PR creation (see Data
   Refresh Automation above).
7. 31 destination images remain review/fallback (see Images above for
   exact codes/reasons).

Do not list the 3 cancelled items above as blockers.

## Current Skills (project-local)

- `impeccable` — design-direction/critique/audit workflow, the primary
  one for any UI change.
- `emil-design-eng` — interaction-polish/animation-decision reference
  (concrete implementation judgment, e.g. should-this-animate/easing/
  duration) — never overrides Wejhaty's own identity.
- `apple-design` — motion/interaction PRINCIPLES reference only; never
  a mandate to make Wejhaty look/feel like an Apple product. Invoke
  only for a specific motion/gesture/transition question.
- `playwright-skill` — real rendered-browser QA (screenshots, flows).
- `web-design-guidelines` — usability/accessibility review.
- `react-best-practices` — frontend quality/performance review.
- `find-skill` — use ONLY when a genuinely missing specialized
  capability is identified, never for trivial tasks.
- `caveman` — terse communication mode, used per-session on request.
- `strategic-compact` — suggests manual `/compact` at logical task
  boundaries rather than arbitrary auto-compaction; directly relevant
  to keeping this state file accurate across a compaction.
- Relevant Superpowers-style process skills (`systematic-debugging`,
  `test-driven-development`, `verification-before-completion`) — used
  for architecture/regression diagnosis, new-behavior development, and
  pre-completion verification respectively.

## Current Git / Deployment

- Branch: `claude/marhaba-kxry8l`.
- Latest verified HEAD (this task): `eee8f23ba16883718b433568e7838865f64623f6`.
- Pages deployment: auto-deploys on push touching `app/**`
  (`.github/workflows/deploy-pages.yml`) — last confirmed successful
  run was for this exact HEAD.
- Worker deployment: auto-deploys on push touching `worker/**`
  (`.github/workflows/deploy-worker.yml`) — last confirmed successful
  run was for the Capability C commit (`worker/` has not changed
  since).
- Do not treat any specific workflow-run ID as permanent truth — always
  re-check `git log`/Actions runs for the CURRENT state; the IDs above
  are historical evidence from this task's own verification, not a
  standing guarantee.

## Before Starting Any New Phase

A fresh Claude session must, in order:

1. Read this file (`.claude/PROJECT_STATE.md`).
2. Verify the actual Git branch/HEAD against what this file claims.
3. Inspect `CLAUDE.md`.
4. Inspect the relevant current code before implementing anything.
5. Treat Git/current code as authoritative wherever this file is stale
   (see the priority rule below).
6. Update this file after any MATERIAL roadmap/state change (see
   Update Policy below) — not after every commit.

## Source-of-Truth Priority

When sources conflict, resolve in this order:

1. Current repository code/tests/configuration.
2. Current Git state (`git log`, `git status`, deployed workflow runs).
3. Current `.claude/PROJECT_STATE.md` (this file).
4. Current `CLAUDE.md`.
5. Historical reports/chat summaries — lowest priority; never trust a
   remembered conversation over what the repository actually contains.

## Context-Compaction / Reset Recovery

Before or immediately after a major context compaction/reset, or when
continuing an old/handed-off conversation:

- Reload this file and `CLAUDE.md`.
- Verify the branch and HEAD against Git directly — do not trust
  remembered session/harness metadata (a prior session saw a branch
  mismatch between harness-reported metadata and the actual working
  branch; the correct Wejhaty branch remains `claude/marhaba-kxry8l`
  unless the user explicitly changes it).
- Inspect the current working tree state (`git status --short`).
- Do not rely on remembered file contents — re-read anything you are
  about to modify.

## Secrets / Privacy

This file must NEVER contain: API secret values, tokens, passwords,
Cloudflare credentials, GitHub credentials, precise user coordinates,
or personal user information unrelated to the project. Secret NAMES
(e.g. `AMADEUS_API_KEY`) are fine when needed for configuration
documentation — never a value, never a placeholder that looks real.

## Update Policy

Update this file only when something MATERIAL changes: a phase
completes or starts, an architecture decision changes, a feature is
cancelled, a blocker resolves, a provider/credential gets configured,
a major deployment status changes, an important backlog item
completes, the canonical branch changes, or a critical product
decision changes. Do NOT update it for routine commits, CSS tweaks, or
anything that doesn't change the state described above.
