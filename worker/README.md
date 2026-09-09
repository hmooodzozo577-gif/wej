# wejhaty-travel-worker

Cloudflare Worker backend for Wejhaty's future travel API (Phase 13). This
is a **structurally separate project** from `app/` (the Vite/React
GitHub Pages frontend):

- Its own `package.json`, `tsconfig.json`, and dependencies — nothing here
  is imported by, or bundled into, the frontend build.
- `.github/workflows/deploy-pages.yml` only watches `app/**`; this
  directory does not participate in that workflow at all.
- Independently deployable via `wrangler`, on its own schedule, entirely
  separate from the GitHub Pages deploy.

## Status: not deployed

This Worker is **not deployed** as part of Phase 13.2. It exists as
verified source + tests only. Deploying it requires a Cloudflare account
and `wrangler login` (or a `CLOUDFLARE_API_TOKEN`), neither of which this
task sets up, per Phase 13.2's explicit scope (foundation only, no live
provider calls).

## What it does right now

A single endpoint, `POST /api/travel/flights`, that:

1. Validates the request body shape (IATA-looking origin/destination
   codes, ISO dates, passenger count) — see `validateFlightSearchRequest`
   in `src/index.ts`.
2. Returns `501 { error: 'not_implemented', ... }` for any well-formed
   request. **It never calls Amadeus, Duffel, or any other provider, and
   it never returns fabricated flight offers.** Provider integration is
   explicit, separately-authorized future work (Phase 13.3).
3. Applies CORS restricted to exactly `https://hmooodzozo577-gif.github.io`
   (this app's GitHub Pages origin) — never `*`.

## Local development (not run in this step)

```
cd worker
npm install
npm test         # runs the Vitest suite against handleRequest() directly
npm run typecheck
npm run dev       # currently just prints a note — see below
```

Running an actual local Worker dev server (`npx wrangler dev`) needs
`wrangler` installed, which is intentionally not added as a dependency
yet — this step doesn't need to run the Worker, only to define and test
its logic. `npm test`/`npm run typecheck` exercise the real logic in
`src/index.ts` directly via the standard `Request`/`Response` Web APIs
(available natively in Node 18+), without needing wrangler or Miniflare.

## Secrets

See `../SECRETS.md`. No secret exists in this repository.

## Types

`tsconfig.json` uses `lib: ["ES2022", "DOM"]` to type-check against the
standard `Request`/`Response`/`Headers`/`URL` APIs this Worker's minimal,
validation-only logic uses — the same Fetch-standard APIs Cloudflare
Workers implement natively. It does not install `@cloudflare/workers-types`
yet, since this step's logic doesn't touch any Workers-specific API (KV,
Durable Objects, etc.); that dependency should be added when a later phase
actually needs those APIs.
