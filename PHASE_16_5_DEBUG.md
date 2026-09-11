# Phase 16.5 Production Debug Record

Current status: **IMPLEMENTED — TESTED — DEPLOYED — FULL AUTOMATED PRODUCTION
PATH VERIFIED — PENDING FINAL USER ACCEPTANCE AND BACK/UNDO DECISION — NOT
COMPLETE**.

This file records bounded evidence for the current Capability C incident.
It does not contain credentials, precise coordinates, raw model output, or
private reasoning.

## Reproduction evidence — 2026-09-11

Production frontend:
`https://hmooodzozo577-gif.github.io/wej/`

Production Worker:
`https://wejhaty-travel-worker.hmooodzozo577.workers.dev`

Scenario:

`أبغى دولة باردة وهادئة وفيها طبيعة`

Verified observations:

- The published Pages bundle contains the production Worker URL and
  `/api/ai/next-turn`.
- The Worker route is deployed and its CORS response permits the Pages origin.
- On Quiz entry, the frontend sent Capability C before preference confirmation,
  with an empty `confirmedProfile`.
- That real request returned HTTP 502 `ai_provider_error` after about 20 seconds.
- The separate interpretation request returned HTTP 200 and mapped
  `climate=cold` and `naturecity=15`; the Nature/Cities inversion did not recur.
- A bounded direct Capability C request using the captured real catalog with
  cold/nature marked confirmed returned HTTP 504 `ai_timeout` after about 48
  seconds.
- A third, minimal one-dimension Capability C request returned HTTP 502
  `ai_provider_error` after about 7.4 seconds. Catalog size alone therefore does
  not explain the invalid response.

The original deployed Worker collapsed provider parse failures and semantic
validation failures into the same safe 502 response. The corrective deployment
added bounded fixed-category diagnostics without exposing raw content.

## Corrective work and deployment evidence

- The frontend now treats an in-flight request as belonging to one exact
  interview context. Preference confirmation, answer edits, language/purpose
  changes, or a fresh session start a current request and detach the obsolete
  subscriber. An obsolete success, failure, or completion cannot mutate the
  current interview. StrictMode reuses the identical-context promise.
- Gemma 4's current Cloudflare binding is generated as a Chat Completions
  model and requires the `{ name, schema }` JSON Schema envelope. A first
  corrective deployment used the bare-schema contract of Cloudflare's older
  native text-generation models and production rejected it immediately (502 in
  0.7 seconds). The adapter now follows the model-specific generated contract.
- Capability C now requests one complete five-field JSON envelope, disables the
  model's default thinking for this short decision, limits completion output,
  and uses deterministic sampling. This targets the rapid invalid-response
  evidence and the observed timeout without changing Phase 14 or the Phase 15
  fallback policy.
- The corrected model-specific envelope reached inference in production and
  returned a structured choice in 3.96 seconds, but server validation rejected
  its option updates as `choice_options`. The schema is therefore now generated
  from the current request catalog: target dimension ids and each dimension's
  exact canonical values are constrained before model output, while the same
  server validator remains the final authority.
- Safe 502 diagnostics expose only a fixed category such as `output_json`,
  `target_dimensions`, or `choice_options`. Raw provider/model content never
  leaves the Worker.

The final catalog-derived schema was deployed in commit `6a93efa`. A direct
Arabic Capability C request with cold/nature already resolved returned HTTP 200
in 4.77 seconds and generated a budget question with canonical values. A fresh
production-browser run of the original Arabic scenario then confirmed
`climate=cold` and `naturecity=15`, rendered the generated budget question, and
did not enter the Phase 15 fallback.

## Corrective pass after the user's full-interview failure

The user's later full production test superseded that first-turn-only check:
the page replaced every answered question with a loading card and eventually
showed an ordinary Phase 15 question. The exact historical HTTP response and
fixed diagnostic category were not captured, so the specific model-validation
failure for that session remains unknown.

Verified causes and corrections:

- The loading behavior was deterministic frontend behavior: resolving or
  skipping a generated turn cleared `state.followup` immediately, so `Quiz`
  rendered a standalone loading card for the full next-turn request.
- Generated questions had also been changed from the accepted `q-card` /
  radio-option / select-then-Next controls to small immediate-action buttons.
  That unrequested design change was removed.
- `Quiz` now retains the answered turn while its successor is requested.
  The selected option remains visible, the existing controls are disabled, and
  an accessible busy status is announced without replacing the question card.
- Capability C previously entered Phase 15 after one syntactically or
  semantically invalid model response. The Worker now makes one bounded second
  AI attempt for those response categories only. Timeouts, provider failures,
  missing configuration, and a second invalid result still use the existing
  Phase 15 fallback.

Commit `aef8e87` contains this corrective implementation. Cloudflare Worker
deployment run `34608471869` and GitHub Pages deployment run `34608471857`
both completed successfully.

A fresh full production-browser run on 2026-09-12 used:

`أبغى دولة باردة وهادئة وفيها طبيعة`

The interpretation response was HTTP 200 and preserved `climate=cold` plus
`naturecity=15`. Four real Capability C responses were HTTP 200 (approximately
6.1 s, 5.5 s, 3.4 s, and 5.3 s). The interview gathered budget, beach/mountain,
adventure, and culture preferences through generated turns, then reached the
AI completion card with six confirmed dimensions. No Phase 15 question was
rendered. This is automated production verification; final user acceptance is
still pending.

## Verification completed locally

- Frontend: 60 test files, 1080 tests passed; TypeScript, lint, production
  build, and visual AR/EN + desktop/mobile checks passed.
- Worker: 9 test files, 183 tests passed; TypeScript check and
  `wrangler deploy --dry-run` passed.

## Required next step

1. Obtain the user's final production acceptance.
2. Decide whether preference removal/re-resolution is sufficient or true
   turn-by-turn Back/Undo must be implemented before Phase 16.5 closes.
3. Keep Phase 17 unopened until both decisions are resolved.
