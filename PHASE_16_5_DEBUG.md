# Phase 16.5 Production Debug Record

Current status: **PRODUCTION E2E FAILED — NOT COMPLETE**.

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

The deployed Worker intentionally collapses provider parse failures and
semantic validation failures into the same safe 502 response. The exact 502
category remains unknown until the local bounded diagnostics are deployed.

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

The model-specific request contract is verified against Cloudflare's generated
Gemma 4 type and real production responses. Whether the catalog-derived output
constraints resolve the final `choice_options` rejection remains unverified
until the follow-up deployment and a fresh successful real request.

## Verification completed locally

- Frontend: 60 test files, 1078 tests passed; production build passed.
- Worker after the structured-output hardening: 9 test files, 181 tests
  passed; TypeScript check and `wrangler deploy --dry-run` passed.

## Required next step

1. Run the complete Worker verification commands.
2. Publish both Worker and frontend from the current branch when authenticated
   deployment access is available.
3. Make one bounded production Capability C request. If it fails with 502, use
   only the fixed `diagnostic` category to choose the next investigation.
4. Re-run the Arabic browser scenario and verify that the first question after
   confirmation is AI-generated and does not target climate or nature/cities.
5. Keep Phase 16.5 open until the user accepts the production result and the
   Back/Undo product decision is made.
