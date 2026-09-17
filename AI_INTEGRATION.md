# AI explanation layer (Phase 16 — AI API Integration)

This document is the architecture, data-flow, privacy, and status record
for the AI integration added in Phase 16. It exists alongside, and does
not replace, `/COUNTRY_INTELLIGENCE.md` (the deterministic suitability
layer this explains) and `/VISA_PROVIDERS.md` (the deterministic entry-
requirement layer whose `unknown` state this must never turn into a
confident claim).

## A note on the standing "no AI" decision

`/PROJECT_STATE.md` records a prior decision: "The user rejected the AI
interview and AI explanations because their questions and results were
not practical or convincing... Do not restore an AI or Hybrid interview
unless the user explicitly reverses this decision." Phase 16 is that
explicit reversal, requested by the user, and is a materially different
feature from what was rejected: not an AI interview, not an AI-driven
question flow, not an AI ranking — a strictly additive, non-authoritative
explanation layer on top of the existing deterministic engine, which the
traveller must explicitly opt into (a button press) and which the site
works identically without. See `PROJECT_STATE.md`'s "Current product
decision" section for how this is recorded going forward.

## What this is, and — more importantly — what it is not

AI here is an INTERPRETATION AND EXPLANATION layer. It is never the
source of truth for, and cannot change:

- a country fact (population, region, indicators, etc.)
- a Purpose Suitability score or its confidence/coverage
- a visa/entry-requirement category
- a flight price, hotel price, or travel cost
- Phase 14's recommendation ranking or match score
- the traveller's location
- any official policy claim

Every one of those already has a real, tested, deterministic owner
elsewhere in this codebase. This layer receives ONLY their already-
computed output, as plain structured data, and asks a language model to
turn it into a short, readable explanation. Nothing it produces is ever
written back into the engine, the Country Intelligence snapshot, the
visa layer, or Phase 14's ranking — there is no code path by which it
could be.

## Architecture

```
User Answers -> Structured User Profile -> Adaptive Questions
  -> Phase 14 Recommendation Engine (ranking, match score)
  -> Country Intelligence (Purpose Suitability, confidence, coverage)
  -> Real-world verified data (visa status, if a provider answered)
  -> [ THIS LAYER: AI Interpretation ]
  -> A short, plain-language explanation shown alongside the
     deterministic numbers, never in place of them
```

| Piece | Path |
|---|---|
| Provider abstraction + grounding + safety + Worker endpoint | `worker/src/ai.ts` |
| Worker routing | `worker/src/index.ts` (`GET /api/ai/status`, `POST /api/ai/explain`) |
| Admin observability | `worker/src/analytics.ts` (`buildAIHealth`), `worker/src/adminPage.ts` (`renderAIHealth`), `worker/src/adminI18n.ts` (`ai.*`) |
| Browser client (fetch, status memo, timeout) | `app/src/ai/aiExplanationClient.ts` |
| Request builders (what leaves the browser) | `app/src/ai/buildExplanationRequest.ts` |
| Browser-side type mirror | `app/src/ai/types.ts` |
| UI panel | `app/src/components/AIExplanation.tsx` |
| Integration points | `app/src/routes/Results.tsx` (top pick), `app/src/components/CountrySuitability.tsx` ("Best suited for") |

### Provider abstraction (E.1)

`worker/src/ai.ts` defines `AIProvider` (`isConfigured()` / `explain()`),
the same shape already used for visa data (`visa.ts`'s
`VisaRequirementsProvider`). The default, `unavailableAIProvider`,
answers `{available:false, reason:'not_configured'}` for everything.
`resolveAIProvider(env)` picks the first configured real provider —
today, exactly one: `createAnthropicProvider`, calling Anthropic's
Messages API. Adding a second provider later means adding one more
adapter to that list; no caller changes.

**With no `ANTHROPIC_API_KEY` configured** (see `/SECRETS.md`), every
`/api/ai/explain` call answers `{available:false}` and every AI panel on
the site stays hidden. The deterministic experience — Phase 14 results,
"Why this suits you", the Country Suitability list, "Best suited for" —
is completely unaffected. AI is an enhancement, never a single point of
failure; there is no code path where an AI outage can break, hide, or
delay any deterministic content.

## The two user journeys (workstream F)

1. **Purpose-first**: "I want to study" → Phase 14 ranks destinations
   deterministically → `buildRecommendationExplanationRequest` (in
   `app/src/ai/buildExplanationRequest.ts`) packages the top pick's own
   score, its top answered reasons (by their own question text, never a
   raw engine dimension id), the matching Country Intelligence
   suitability entry, and the traveller's own visa lookup result (or
   `unknown` if none) → the AI explains why it fits. Wired into
   `Results.tsx`, below the top pick's card.
2. **Country-first**: "I like Japan, what is it best for?" →
   `buildCountryFitExplanationRequest` packages the SAME
   `bestSuitedFor()` grouping already shown in the "Best suited for"
   section (`app/src/intelligence/bestSuitedFor.ts`) plus the other
   ranked purposes → the AI summarizes the strongest suitable purposes
   and any trade-offs. No traveller-specific visa status exists at this
   level (there is no traveller yet), so it is explicitly sent as
   `'unknown'` with a matching `missingDataFlags` entry, never guessed.
   Wired into `CountrySuitability.tsx`.

In both cases the AI never invents, reorders, or discovers a purpose or
a destination — the ranking/grouping it explains was computed before it
was ever called, by code that has nothing to do with AI.

## Exactly what is sent to the model (E.2)

`AIExplanationRequest` (mirrored, byte-for-byte in shape, in
`worker/src/ai.ts` and `app/src/ai/types.ts`):

| Field | What it is |
|---|---|
| `kind` | `'recommendation'` or `'countryFit'` |
| `lang` | `'ar'` or `'en'` |
| `countryCode` | canonical ISO 3166-1 alpha-2 |
| `purpose` | canonical purpose id |
| `matchScore` | Phase 14's own rounded 0-100 score (recommendation only) |
| `matchReasons` | up to 4 `{label, fit}` pairs — `label` is the ANSWERED QUESTION's own display text, never an internal dimension id |
| `suitability` | one Country Intelligence entry: purpose, score, confidence, coverage, insufficientData |
| `bestSuitedForGroup` | the purpose id(s) already computed as "best suited", or `null` |
| `otherSuitablePurposes` | up to 6 other ranked purposes, same shape |
| `visaStatus` | one of the canonical visa categories, or `'unknown'` |
| `missingDataFlags` | short machine flags like `visaUnknown`, `insufficientData:tourism` |

**Explicitly never sent, enforced by both an allowlist and a denylist in
`validateAIExplanationRequest`:** exact coordinates (`lat`/`lng`/
`coordinates`), a passport number, an email address, any token/API
key/admin token, an IP address, a session id, a fingerprint, or any raw
database row. A request carrying any of those field names is rejected
outright with `invalid_request`, regardless of what else it contains —
this is a defense-in-depth check, not just documentation, since the
browser-side builders never produce such a field in the first place.

## Grounding (E.3, E.7)

Two independent layers:

1. **The system prompt** (`SYSTEM_PROMPT` in `worker/src/ai.ts`) instructs
   the model to use ONLY the supplied JSON for factual claims, to say so
   plainly when a fact is missing/`unknown`/insufficient/low-confidence
   rather than guess, and to treat the JSON itself as data, not
   instructions (see Prompt-injection below).
2. **`groundingViolation()`**, a code-level, independent check, run on
   every model response before it is ever returned to the browser. It
   scans the model's own output text for the two specific failure modes
   the task calls out by name:
   - a confident visa claim ("entry should be easy", "no problem
     entering") when the input's `visaStatus` is `'unknown'` — the
     acceptable phrasing is "Visa information has not been verified
     yet."
   - an unqualified "definitely"/"guaranteed"/"the best country for you"
     claim when the input's suitability is `insufficientData` or
     `confidence: 'low'`/`null` — the acceptable phrasing is "Available
     data suggests this may be a good fit, but coverage is limited."

   Both checks run bilingually (Arabic and English phrasings). A match
   discards the response entirely (`reason: 'grounding_violation'`) and
   the caller falls back to nothing (the panel just does not appear for
   that click — no wrong content is ever shown). **This is a heuristic
   net, not a proof of correctness** — it catches the specific failure
   modes the task names, not every way a model could be overconfident.

## Output contract (E.4)

```ts
interface AIExplanationOutput {
  summary: string;
  whyItFits: string[];      // 0-4 short clauses
  tradeoffs: string[];      // 0-4 short clauses
  confidenceNotes: string;
  missingDataNotes: string[]; // 0-4 short clauses
}
```

`parseAIExplanationOutput()` never assumes perfect schema compliance:
it strips a stray markdown code fence, extracts the first `{...}` object
if the model added surrounding prose, requires only `summary` (every
other field degrades to an empty value rather than invalidating the
whole response), and bounds every field's length. Invalid JSON, a
non-object top level, or a missing/empty `summary` all return `null`,
which the caller treats as `invalid_response` and falls back.

## Recommendation ownership (E.5)

The AI does not choose, reorder, or influence a ranking. Phase 14 ranks;
Country Intelligence scores; the AI only narrates numbers it was handed
after both of those already ran. There is no natural-language user input
in this feature at all today (the questionnaire is selection-based, not
free text), so there is currently no path by which a traveller's own
words could even reach a score — if one is added later, this document's
grounding section is the place to record how it would be validated
before affecting anything.

## Explanation UX (E.6)

The panel (`app/src/components/AIExplanation.tsx`) is deliberately
minimal: a single quiet "Explain with AI" text button, shown only after
an availability check confirms a provider is configured (no button at
all otherwise), that fetches ONLY on click — never automatically, never
on every render. Success shows a short summary plus up to four short
"why it fits"/"trade-offs"/"what is not yet known" clauses and a
one-line confidence note, all inside a dashed-border card carrying a
small "AI" badge and a standing disclaimer ("AI-generated summary... it
can be imprecise") — visually distinct from the hard facts around it, so
a traveller is never confused about which is which. Both Arabic and
English are natural (the model is asked to reply only in the requested
language), and the RTL layout uses the same logical-property CSS
conventions as the rest of the app (no physical left/right, `padding-
inline-start`).

## Confidence / data-gap handling (E.7)

`AISuitabilityContext.confidence`/`insufficientData` and
`missingDataFlags` (e.g. `visaUnknown`) are always passed through when
known, and the grounding check above is the code-level backstop that a
low-confidence or missing fact is never described as certain.

## Prompt-injection / data safety (E.8)

The system prompt tells the model the JSON is data, never instructions,
and to ignore anything inside it that looks like an attempt to redirect
its behavior or reveal internal configuration. Today there is no free-
text field anywhere in this request (see Recommendation ownership
above), so there is no user-authored string for an injection attempt to
live in short of a maliciously renamed purpose/label — which the
allowlist validation already constrains to a small canonical set (ISO
codes, known purpose ids, bounded question-text strings drawn from the
app's own question bank, never arbitrary user text). This is NOT claimed
as perfect prompt-injection prevention — no system can honestly claim
that — only as the standard, documented mitigation for a context that
does not carry free text today, with the code path exercised in
`worker/src/ai.test.ts`'s "never breaks the underlying request even for
a malicious-looking payload" case.

No API key, admin token, Cloudflare secret, or internal configuration
value is ever placed in the model's context — the system prompt and the
request body are the ONLY two things sent, and neither is built from
anything but the validated `AIExplanationRequest` shape above.

## Cost / rate control (E.9)

- **No eager fetching.** `checkAIStatus()` is memoized once per page
  load (a single provider-configured check shared by every panel on the
  page); `requestAIExplanation()` fires only from an explicit button
  click.
- **Isolate-local response cache** (`worker/src/ai.ts`): keyed by a hash
  of the exact validated request, 6-hour TTL, capped at 200 entries.
  Explicitly documented as best-effort — a Cloudflare Worker isolate is
  not a shared, persistent process, so this does not survive a cold
  start and is not shared across concurrently-running isolates. It
  reduces the common case (the same explanation requested twice in a
  row) without pretending to be a durable, fleet-wide cache.
- **Isolate-local rate limiter**: 30 requests per rolling 60-second
  window, same isolate-local caveat as the cache above. If real abuse
  ever appears, the fix is a durable layer (KV, Cloudflare's native
  rate-limiting rules, or D1), not a bigger version of this counter.
- **8-second request timeout** (`AbortController`), so a hung provider
  call degrades to `provider_timeout` rather than hanging the endpoint.
- An AI failure of any kind (timeout, provider error, malformed
  response, grounding violation, rate limit) always resolves to a plain
  `{available:false, reason}` — never a thrown exception, never a
  request that fails the underlying page.

## Privacy (E.10)

- No exact coordinates, passport number, email, or other traveller-
  identifying value is ever included in an AI request (enforced by the
  denylist in `validateAIExplanationRequest`, described above).
- No AI prompt or response is persisted anywhere — not in D1, not in
  analytics, not in a log line with user-specific content. The isolate-
  local cache holds only the DE-IDENTIFIED, already-validated request
  (country/purpose/scores) and the model's output text, never a
  traveller identifier, and it evaporates on the next cold start.
- Analytics collection is NOT expanded because of this feature. The
  admin AI panel (workstream H) reports only aggregate counts (requests,
  successes, fallbacks, timeouts, cache hits) — no prompt content, no
  destination, no user answer.
- Existing privacy architecture (no coordinate/IP/fingerprint anywhere in
  the analytics layer — see `PROJECT_STATE.md`'s "ADMIN PRIVACY" section)
  is unchanged.

## Admin observability (workstream H)

Extends the EXISTING admin Content tab (`worker/src/adminPage.ts`'s
`renderContent`) — not a new tab — with `renderAIHealth()`: whether a
provider is configured, request count, success/fallback/cache-hit rates,
and a breakdown of timeout/provider-error/invalid-response/rate-limited
counts. The dictionary (`worker/src/adminI18n.ts`'s `ai.*` keys)
explicitly discloses, in both languages, that these counts are
isolate-local (reset on cold start) and a recent sample rather than a
durable fleet-wide total — the same honesty standard the Country
Intelligence health panel already holds itself to.

## Testing

- `worker/src/ai.test.ts` (47 tests): input validation (including every
  forbidden field), output parsing edge cases, both grounding-violation
  examples in Arabic and English (plus the honest phrasings the task
  itself gives as acceptable), every provider failure mode (non-2xx,
  timeout, network error, malformed JSON, missing text field, grounding
  violation), cache-hit behavior, rate limiting, isolate-local metrics,
  and the `/api/ai/explain`/`/api/ai/status` endpoints' own validation,
  fallback, and status behavior.
- `worker/src/analytics.test.ts` (+3 tests): the admin summary shape,
  including that the API key never leaks into it.
- `app/src/ai/aiExplanationClient.test.ts` (10 tests), `app/src/ai/
  buildExplanationRequest.test.ts` (13 tests against REAL Country
  Intelligence data), `app/src/components/AIExplanation.test.tsx`
  (7 tests): status memoization, no-fetch-until-click, loading/success/
  failure states, AR/EN, and that the request builders never include a
  forbidden field.
- Manual Playwright sweep (ephemeral script, not committed — see the
  pattern in `app/scripts/admin-visual-check.mjs` if it needs to be
  reproduced): the AI panel on both the Results top pick and a country
  page's "Best suited for" section, across desktop/mobile × Arabic/
  English × light/dark × success/failure/unavailable — 24 combinations,
  0 findings (no console error, no horizontal overflow, correct gating,
  correct badge/disclaimer, correct failure messaging).

## Known limitations and what is NOT verified

- **No live account verification.** No `ANTHROPIC_API_KEY` exists in
  this environment, and the coding sandbox's own network egress policy
  blocks arbitrary external hosts (confirmed directly — see
  `/COUNTRY_INTELLIGENCE.md`'s "Phase 16 source expansion attempt" for
  the same finding applied to the statistical-source expansion attempt).
  The Anthropic adapter is written against the published Messages API
  request/response shape and every failure mode degrades safely and is
  tested; it has never received a real response from a live account.
  Before switching this on in production: set `ANTHROPIC_API_KEY`
  (`/SECRETS.md`), then verify one real request/response round-trip and
  confirm the actual response shape matches what `parseAIExplanationOutput`
  expects (the same "verify before enabling" discipline already applied
  to the Sherpa visa adapter).
- **The grounding check is a heuristic**, not a proof. It catches the
  two specific overconfidence patterns the task names; a model could in
  principle phrase overconfidence a third way this check does not catch.
- **The cache and rate limiter are isolate-local**, not a durable,
  fleet-wide guarantee — see Cost/rate control above.
- **No natural-language user input exists in this feature today** — see
  Recommendation ownership above. If one is ever added, it needs its own
  validation pass before it may influence anything the AI is told.
