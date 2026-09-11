# Phase 16.5 Production Debug Record

Current status: **TECHNICALLY FIXED AND LIVE VERIFIED — PENDING FINAL USER
ACCEPTANCE AND BACK/UNDO DECISION — NOT COMPLETE**.

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

## Verification completed locally

- Frontend: 60 test files, 1078 tests passed; production build passed.
- Worker after the structured-output hardening: 9 test files, 181 tests
  passed; TypeScript check and `wrangler deploy --dry-run` passed.

## Required next step

1. Obtain the user's final production acceptance.
2. Decide whether preference removal/re-resolution is sufficient or true
   turn-by-turn Back/Undo must be implemented before Phase 16.5 closes.
3. Keep Phase 17 unopened until both decisions are resolved.
