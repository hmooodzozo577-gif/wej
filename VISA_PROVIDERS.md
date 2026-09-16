# Visa data provider evaluation (item #12A)

Researched 2026-09-16 for Wejhaty's passport-aware entry-requirement
feature. This records what was checked, what was chosen, and what is
still blocked. It is a decision record, not a roadmap — update it when a
provider's terms or Wejhaty's access actually change.

## What Wejhaty needs

| Requirement | Why |
|---|---|
| Passport-country × destination-country lookup | The traveller supplies a passport country; the catalog supplies 194 destinations. |
| 194-country destination coverage | Anything less leaves the recommendation layer inconsistent across the catalog. |
| An explicit "unknown" answer | A recommendation product must be able to say it does not know. |
| Freshness/check timestamp | Entry rules change; displaying a requirement without a check date is a false claim. |
| Licence permitting use in recommendations | The passport choice influences ordering, not just display. |
| Caching terms | A per-render live call per destination is not viable for a five-result page. |
| No passport-number handling | Wejhaty never collects one. |

## Candidates evaluated

### IATA Timatic / Timatic AutoCheck

- The reference source the airline industry itself uses for travel-document
  decisions: passport, visa, health, customs and pet rules, compiled from a
  large official network and updated many times a day.
- Reachable as Timatic Web, via CRS/DCS integration, and via a REST API
  (Timatic AutoCheck), so the integration shape Wejhaty needs exists.
- **Blocker:** it is an IATA commercial product. Access is a subscription
  or contract, ordered through IATA and invoiced; the API path is
  positioned at organisations with an integration team. There is no
  self-serve or free tier a project can start from.
- Accuracy and authority: the strongest of the three. If Wejhaty ever
  carries a personalised entry-requirement claim at scale, this is the
  source to buy.

### VisaHQ

- Advertises a REST API covering entry requirements for 200+ countries,
  OAuth 2.0, a sandbox, documentation, and webhook notifications, aimed at
  airlines, TMCs, HR platforms and job boards.
- Access is through a partnership arrangement — white-label, marketplace or
  co-sell — with tiered volume pricing or revenue share, rather than public
  signup. The airline path advertises activation from an email address, but
  it is still an account with commercial terms attached.
- **Blocker:** a commercial account and agreed terms. Whether ranking use
  (as opposed to display) is permitted has to be confirmed in the contract,
  not assumed.

### Sherpa

- Requirements API with a documented `/v3/trips` resource that returns
  entry requirements for a trip context (origin, destination, date), with
  visa requirements arriving as an `informationGroups` entry of type
  `VISA_REQUIREMENTS`; a standalone `/v2/procedures` resource also exists.
- Provides separate sandbox and production credentials, and an explicit
  "request API access" path for a travel platform or app.
- **Blocker:** credentials are issued on request/approval, not self-serve.
- Chosen as the **first adapter** because it has the clearest public REST
  contract of the three, a sandbox to verify against, and an access route
  that does not presuppose being an airline.

### Open "passport index" datasets on GitHub

- Several exist (MIT and GPL-licensed CSV/JSON dumps of passport ×
  destination matrices, some scraped from passportindex.org or Wikipedia).
- **Rejected.** They are unofficial and scraped, carry no accuracy
  commitment, and have no freshness guarantee for a rule that can change
  overnight. The brief forbids both scraping visa sites and picking an
  inferior source to avoid requiring an account. Using one would let
  Wejhaty state a personalised entry requirement it cannot stand behind.

## Decision

| | Chosen |
|---|---|
| First adapter | **Sherpa** Requirements API |
| Default when unconfigured | `unavailableProvider` — answers `unknown` |
| Rejected | scraped/unofficial passport-index datasets |
| Deferred | IATA Timatic (authoritative, needs a commercial contract), VisaHQ (needs a partnership agreement) |

The recommendation engine never talks to a vendor. It talks to
`VisaRequirementsProvider` (`worker/src/visa.ts`), which returns Wejhaty's
own canonical vocabulary: `visaFree`, `visaOnArrival`, `eVisa`,
`authorizationRequired`, `embassyVisaRequired`, `unknown`. Adding VisaHQ or
Timatic later is a new adapter in one list, with no caller or engine change.

## Status

**READY — PROVIDER ACCOUNT/CREDENTIALS REQUIRED.**

All software-side work that can be done without credentials is done and
tested: the abstraction, the canonical vocabulary, request validation
(including the IL exclusion), the Sherpa adapter, its category mapping,
failure behaviour, the Worker endpoint, the passport UX, and the bounded
ranking layer.

To switch it on:

1. Request Sherpa API access and obtain sandbox credentials.
2. Verify `SHERPA_CATEGORY_BY_VALUE` and `extractSherpaRequirement()` in
   `worker/src/visa.ts` against a real sandbox response. They are written
   against the published shape, and anything unrecognised maps to
   `unknown` — so an unverified table fails safe, but it fails to
   `unknown` for everything, which is not useful. **This verification is a
   prerequisite, not an optimisation.**
3. Confirm in writing what the terms permit: caching duration, storage,
   attribution, and whether the data may inform ranking as well as display.
4. `npx wrangler secret put SHERPA_API_KEY` (and `SHERPA_BASE_URL` for the
   sandbox). The key is never committed and never reaches the frontend.

Until then the endpoint answers `category: "unknown"` with
`providerConfigured: false`, the UI says visa information is unavailable,
and ranking is unaffected. No fabricated fallback exists anywhere in the
path.

## Caching

Not yet implemented, deliberately. Caching rules are a licence question and
the licence is not agreed. The lookup is a single Worker endpoint, so a
cache added later needs no client change. When it is added it must record
`checkedAt` from the moment the provider answered — not from the moment the
cache was read — so the freshness shown to a traveller stays truthful.

## Privacy

Only a passport COUNTRY (ISO 3166-1 alpha-2) is ever sent. Wejhaty does not
collect, store or transmit a passport number, and the request shape has no
field for one. The passport choice is optional and skippable, is never
inferred from location, and is not used for any purpose other than this
lookup. Provider credentials live in Worker secrets only — never in the
frontend, never in a `VITE_*` variable, never committed.

---

## Re-check, 2026-09-16

Re-tested rather than assumed. Every probe below is a real request made
during this round.

| Host | Result |
|---|---|
| `api.joinsherpa.com` | **403 at the egress proxy** (`connect_rejected`) |
| `developers.joinsherpa.com` | **403 at the egress proxy** |
| `joinsherpa.com` | **403 at the egress proxy** |
| `api.visahq.com` | **403 at the egress proxy** |
| `www.iata.org` | **403 at the egress proxy** |
| `timaticweb2.iata.org` | **403 at the egress proxy** |

So none of the four things the brief asks to confirm before activation can
be confirmed from here, and none of them is being guessed:

1. the current API contract and its field names;
2. the account and access requirements;
3. the semantics — passport-country input, destination input, requirement
   vocabulary, whether purpose is expressible, freshness guarantees;
4. the terms — attribution, caching and storage duration, and **whether the
   data may inform ranking as well as display**.

### What was done instead

The adapter's mapping is now under a **contract harness** rather than a
claim. `worker/src/visa.contract.test.ts` asserts today what is actually
verifiable — with no credentials the app answers `unknown` on every path, an
unrecognised provider value maps to `unknown`, and a drifted response shape
neither throws nor invents — and states in a test that the mapping itself is
UNVERIFIED. Drop one real sandbox response per category into
`worker/fixtures/sherpa/` (see its README) and that same file turns into a
real mapping test; a wrong mapping then fails the build.

### Status

`READY — PROVIDER ACCOUNT/CREDENTIALS REQUIRED`

### The exact next account action

This is the user's to take; it cannot be done from here.

1. Request sandbox access at Sherpa's developer portal (or the provider you
   prefer — the adapter interface is the only thing another provider has to
   satisfy, see `resolveVisaProvider`).
2. In the contract or the developer terms, get an answer in writing to each
   of the four questions above. The fourth matters most: if the terms do not
   permit the data to inform ordering, Wejhaty shows entry requirements and
   the bounded tie-breaker stays switched off.
3. Capture one sandbox response per requirement category and commit them to
   `worker/fixtures/sherpa/` after stripping anything sensitive.
4. `npx wrangler secret put SHERPA_API_KEY`, and `SHERPA_BASE_URL` while on
   the sandbox host.

The moment the key exists, `/api/visa/status` starts reporting
`providerConfigured: true`, the passport step's copy switches from "not
switched on yet" to the active wording by itself, and the bounded tie-break
begins to apply. Nothing else needs changing.

### What still must NOT happen

- No Phase 14 weight change. The 8–11 visa weight remains a proposal the
  user has not approved, and is not implemented.
- No visa influence on ordering without verified provider data. This is
  enforced in code, not by intention: `applyVisaRanking` returns the input
  untouched when there is no passport or no requirement, and the client never
  stores an `unknown` requirement — so with no provider the map is empty and
  the reorder is a strict no-op.
