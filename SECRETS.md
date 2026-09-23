# Secret management (Phase 13.2 design, Phase 13.3 implementation)

This file documents the process for the Amadeus API credentials. **No
secret — real, placeholder, or fake-looking — exists anywhere in this
repository, in any generated file, or in any build output.** This
document describes a process, not a value.

## What is needed

Phase 13.3 integrates Amadeus for Developers' Flight Offers Search API
(OAuth2 client-credentials flow), which requires two values issued by
Amadeus when you register an app at
https://developers.amadeus.com/my-apps:

- `AMADEUS_API_KEY` — the app's API Key (OAuth2 `client_id`).
- `AMADEUS_API_SECRET` — the app's API Secret (OAuth2 `client_secret`).

The product-data service has two additional production secrets:

- `ADMIN_TOKEN` — a long random value required by `/api/admin/summary`.
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile server verification for
  feedback. Its paired site key is public and belongs in the GitHub Actions
  variable `VITE_TURNSTILE_SITE_KEY`, never in this file.

## Where they live

Both are stored **only** as Cloudflare Worker secrets, scoped to the
`wejhaty-travel-worker` Worker (see `worker/wrangler.toml`):

```
cd worker
npx wrangler secret put AMADEUS_API_KEY
npx wrangler secret put AMADEUS_API_SECRET
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TURNSTILE_SECRET_KEY
# (each prompts for the value interactively; wrangler must already be
#  authenticated via `wrangler login` or a CLOUDFLARE_API_TOKEN env var)
```

This stores each value encrypted at rest in Cloudflare's platform. Both
are injected into the Worker's `env` object at request time by the
Cloudflare runtime itself — neither is ever written to `wrangler.toml`,
never committed to git, and never present in any file this repository
tracks. `worker/src/amadeus.ts` is the only module that reads them, and
it never logs them, never includes them in a thrown error's message, and
never returns them (or the OAuth token derived from them) in any
response.

## Environment: sandbox vs. production

`worker/wrangler.toml` sets one **non-secret** variable, `AMADEUS_ENV`,
under `[vars]` (deliberately separate from the two secrets above, so an
environment change is visible in a plain diff of a committed file):

- `AMADEUS_ENV = "test"` (the committed default) — Amadeus' test/sandbox
  API (`https://test.api.amadeus.com`), which uses a separate API
  key/secret pair from production and returns synthetic/limited data,
  not real bookable inventory.
- `AMADEUS_ENV = "production"` — Amadeus' live API
  (`https://api.amadeus.com`). **Requires a separate, production-tier
  Amadeus API key/secret pair** — a test-environment key will not work
  against the production host, and vice versa.

`worker/src/amadeus.ts`'s `resolveAmadeusBaseUrl()` treats anything other
than the exact string `"production"` (including unset, empty, or
misspelled) as `"test"` — there is no way to silently end up on
production. Switching environments is a deliberate two-step change:
update `AMADEUS_ENV` in `wrangler.toml` (a visible, reviewable diff) AND
put the matching production credentials with `wrangler secret put`
(secrets are per-Worker, not per-environment-value, so make sure the
currently-set `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` actually match the
`AMADEUS_ENV` you switch to before deploying).

## What is explicitly forbidden (and has not been done)

- Putting either value in the React app (`app/`) in any form.
- Putting either value in a `VITE_*` environment variable (Vite inlines
  `VITE_*` variables into the built JS bundle at build time — anything
  there ships to every visitor's browser as plain, readable text).
- Committing either value to source control, in any branch, in any file.
- Putting either value in a generated JS/JSON file (e.g. under
  `app/src/data/generated/`).
- Publishing either value as part of the GitHub Pages build output
  (`app/dist`).
- Creating a fake key/secret or a placeholder value that merely *looks*
  like a real credential (e.g. `AMADEUS_API_KEY=demo-key-123`) — even as
  a non-functional example, this risks being mistaken for a real
  credential or copy-pasted into a real environment later.
- Returning the Amadeus OAuth access token, or any Authorization header
  built from it, in any Worker response to the browser.

## How the frontend reaches Amadeus without ever holding credentials

The React app never talks to Amadeus directly. It calls
`app/src/travel/travelService.ts`, which calls the Worker's
`POST /api/travel/flights` endpoint over HTTPS. The Worker — running on
Cloudflare's infrastructure, not in the visitor's browser — is the only
thing that ever holds the Amadeus credentials or the OAuth token derived
from them, and it never returns either (or anything derived from them,
like a signed request URL containing them) back to the browser.

## Current state (Phase 13.3)

`worker/src/amadeus.ts` declares `Env` with `AMADEUS_API_KEY: string`,
`AMADEUS_API_SECRET: string`, and `AMADEUS_ENV?: string`, and actually
performs the OAuth2 client-credentials flow and Flight Offers Search call.
No value is stored in this repository. The Worker has previously been deployed,
but current Cloudflare secret values are external state and must be checked in
the account before claiming that live Amadeus offers are configured.

---

# Every secret and setting this project reads, 2026-09-16

The rules above apply to all of them: Worker secrets only, never a `VITE_*`
variable, never committed, never printed. A `VITE_*` value is inlined into
the public bundle by Vite and is readable by every visitor — so anything in
that column below is, by definition, not a secret and must never be one.

| Name | Where | Kind | Effect when unset |
|---|---|---|---|
| `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` | Worker secret | **secret** | Flight offers are unavailable; the app says so |
| `AMADEUS_ENV` | Worker `[vars]` | mode switch, not a secret | Sandbox API is used |
| `SHERPA_API_KEY` | Worker secret | **secret** | No visa provider; the Worker's `/api/visa/*` lookups answer `unknown`. The frontend no longer calls them (Phase 19): passport entry information comes from the official-source snapshot |
| `SHERPA_BASE_URL` | Worker `[vars]` | host override for the sandbox | Production Sherpa host is used |
| `TURNSTILE_SECRET_KEY` | Worker secret | **secret** | Reports and ratings are accepted without a challenge (today's state). Once set, verification fails closed (missing/rejected token, error, 5 s timeout) |
| `EVENTS_RATE_LIMITER`, `RATINGS_RATE_LIMITER`, `FEEDBACK_RATE_LIMITER`, `CITY_DESCRIPTIONS_RATE_LIMITER` | Worker bindings in `wrangler.toml` `[[ratelimits]]` | configuration, not secrets | Without them (local runs) there is no per-address edge limit; production declares all four |
| `ADMIN_TOKEN` | Worker secret | **secret** | With no `ADMIN_ACCESS_AUD` either, `/api/admin/*` returns 503 and serves nothing |
| `ADMIN_ACCESS_AUD` | Worker `[vars]` | Cloudflare Access application audience tag | Access enforcement is off; `ADMIN_TOKEN` is used instead |
| `ADMIN_ACCESS_TEAM_DOMAIN` | Worker `[vars]` | e.g. `example.cloudflareaccess.com` | As above |
| `CITY_DESCRIPTIONS` | Worker `[vars]` | set to `off` to stop outbound description fetching | Descriptions are fetched and cached normally |
| `VITE_TRAVEL_WORKER_URL` | Pages build | **public** — the Worker's public origin | The app runs with no Worker at all and degrades honestly |
| `VITE_TURNSTILE_SITE_KEY` | Pages build | **public** — Turnstile site keys are public by design | No challenge widget is rendered anywhere |

## Admin access, in order of preference

**Cloudflare Access (preferred).** Put an Access application in front of the
Worker's `/admin` and `/api/admin/*` paths, then set `ADMIN_ACCESS_AUD` to
that application's Audience (AUD) tag and `ADMIN_ACCESS_TEAM_DOMAIN` to the
Zero Trust team domain. The Worker then verifies the Access JWT itself —
RS256 signature against the team's published keys, plus audience and expiry —
so a request that merely *reaches* the Worker is not trusted on that basis
alone.

Once Access is configured, **`ADMIN_TOKEN` stops working**. That is
deliberate: a bearer token that could bypass Access would make adding Access
a downgrade.

**`ADMIN_TOKEN` (fallback).** For an account without Cloudflare Zero Trust:

```
npx wrangler secret put ADMIN_TOKEN
```

Use a long random value (`openssl rand -base64 32`). It is compared in
constant time and is never echoed in any response.

**Neither configured:** every admin data path returns 503. The surface never
falls open.

## Turnstile

Both halves are independent, so they can be switched on in either order
without a window where submissions are rejected:

- Worker: `npx wrangler secret put TURNSTILE_SECRET_KEY`. Until it is set,
  verification is skipped.
- Pages: `VITE_TURNSTILE_SITE_KEY` in the build environment. Until it is set,
  no widget is rendered and no token is sent.

Challenged: the report dialog, the results rating, the destination rating —
the three places a stranger can write text into the database. **Not
challenged:** analytics events, which carry no free text and are automatic.

## Cloudflare API token (CI only)

`CLOUDFLARE_API_TOKEN` is a GitHub Actions secret, not a Worker secret. It
needs, at the account level:

- Workers Scripts: **Edit**
- D1: **Edit**
- Workers R2 Storage: **Edit**

The deploy workflow prints a per-capability diagnostic before provisioning,
so a failure names the missing permission rather than leaving it to be
guessed. It never prints the token.
