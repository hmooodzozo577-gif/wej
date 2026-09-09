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

## Where they live

Both are stored **only** as Cloudflare Worker secrets, scoped to the
`wejhaty-travel-worker` Worker (see `worker/wrangler.toml`):

```
cd worker
npx wrangler secret put AMADEUS_API_KEY
npx wrangler secret put AMADEUS_API_SECRET
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
performs the OAuth2 client-credentials flow and the Flight Offers Search
call using them. No value for any of the three has been set anywhere —
this repository contains no `.dev.vars`, no `wrangler secret` call was
run, and the Worker has not been deployed (see the final report's
Deployment section for the exact manual steps a repository owner would
run, with their own real Amadeus credentials, to actually deploy it).
