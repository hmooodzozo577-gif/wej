# Secret management (Phase 13.2 design, Phase 13.3+ actual use)

This file documents the intended process for the future Amadeus API
credential. **No secret — real, placeholder, or fake-looking — exists
anywhere in this repository, in any generated file, or in any build
output.** This document describes a process, not a value.

## What will eventually be needed

Phase 13.3 (a later, separately-authorized step) will integrate Amadeus
for Developers' Flight Offers Search API, which requires an API
key/secret pair issued by Amadeus.

## Where it will live

The credential will be stored **only** as a Cloudflare Worker secret,
scoped to the `wejhaty-travel-worker` Worker (see `worker/wrangler.toml`):

```
cd worker
npx wrangler secret put AMADEUS_API_KEY
# (prompts for the value interactively; wrangler must already be
#  authenticated via `wrangler login` or a CLOUDFLARE_API_TOKEN env var)
```

This stores the value encrypted at rest in Cloudflare's platform. It is
injected into the Worker's `env` object at request time by the Cloudflare
runtime itself — it is never written to `wrangler.toml`, never committed
to git, and never present in any file this repository tracks.

## What is explicitly forbidden (and has not been done)

- Putting the key in the React app (`app/`) in any form.
- Putting the key in a `VITE_*` environment variable (Vite inlines
  `VITE_*` variables into the built JS bundle at build time — anything
  there ships to every visitor's browser as plain, readable text).
- Committing the key to source control, in any branch, in any file.
- Putting the key in a generated JS/JSON file (e.g. under
  `app/src/data/generated/`).
- Publishing the key as part of the GitHub Pages build output
  (`app/dist`).
- Creating a fake key or a placeholder value that merely *looks* like a
  real secret (e.g. `AMADEUS_API_KEY=demo-key-123`) — even as a
  non-functional example, this risks being mistaken for a real credential
  or copy-pasted into a real environment later.

## How the frontend will reach it without ever holding it

The React app never talks to Amadeus directly. It calls
`app/src/travel/travelService.ts`, which calls the Worker's
`POST /api/travel/flights` endpoint over HTTPS. The Worker — running on
Cloudflare's infrastructure, not in the visitor's browser — is the only
thing that ever holds the Amadeus credential, and it never returns that
credential (or anything derived from it, like a signed request URL
containing it) back to the browser.

## Current state (Phase 13.2)

`worker/src/index.ts` declares an `Env` interface with a *commented-out*
`AMADEUS_API_KEY?: string` field, purely as forward-looking documentation
of the shape the secret will take. The Worker does not read this field,
does not call Amadeus, and does not require any secret to be configured
to run its current (validation-only) logic.
