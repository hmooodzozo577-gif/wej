# wejhaty-travel-worker

Cloudflare Worker backend for Wejhaty's travel API (Phase 13). This is a
**structurally separate project** from `app/` (the Vite/React GitHub
Pages frontend):

- Its own `package.json`, `tsconfig.json`, and dependencies — nothing here
  is imported by, or bundled into, the frontend build.
- `.github/workflows/deploy-pages.yml` only watches `app/**`; this
  directory does not participate in that workflow at all.
- Independently deployable via `wrangler`, on its own schedule, entirely
  separate from the GitHub Pages deploy.

## Status: deployed (AI live; Travel/Amadeus credentials still unconfigured)

This Worker is now deployed via `.github/workflows/deploy-worker.yml`
(GitHub Actions, using the repository's `CLOUDFLARE_API_TOKEN`/
`CLOUDFLARE_ACCOUNT_ID` secrets) — real public URL:
`https://wejhaty-travel-worker.hmooodzozo577.workers.dev`. Redeploys
automatically on a push touching `worker/**`, or on demand via
`workflow_dispatch` (which can also opt into a small live Workers AI
smoke test — see that workflow's `run_smoke_test` input).

- **Phase 16 AI (`/api/ai/*`)**: live. The Workers AI binding (`env.AI`,
  `wrangler.toml`'s `[ai]` block) needs no credential at all — verified
  with real Arabic and English requests against the deployed Worker
  (see the repository's Phase 16 live-deployment final report for the
  exact evaluation set and results).
- **Travel (`/api/travel/flights`, Amadeus)**: the Worker itself is
  deployed and reachable, but `AMADEUS_API_KEY`/`AMADEUS_API_SECRET`
  have never been set (`wrangler secret put`) — a request to this
  route will safely fail with a generic `provider_error`, never a
  fabricated flight offer (see `mapAmadeusErrorToResponseArgs` in
  `src/index.ts`). Setting those two secrets is the only remaining
  step to make Travel live too.

## What it does

A single endpoint, `POST /api/travel/flights`:

1. Validates the request body shape — IATA-looking origin/destination
   codes, ISO dates, `returnDate` not before `departureDate`, passenger
   count 1-9 if provided (defaults to 1) — before ever considering a
   network call. See `validateFlightSearchRequest` in `src/index.ts`.
2. For a valid request, calls Amadeus (`src/amadeus.ts`): obtains an
   OAuth2 client-credentials access token (cached in memory across
   requests on the same Worker isolate — never persisted, never a cache
   of flight prices/offers), then calls Flight Offers Search v2, and
   normalizes the response into this project's own `FlightOffer`/
   `TravelSegment`/`Airport` shape. **Never passes a raw Amadeus response
   to the caller.**
3. Maps every failure mode (auth failure, Amadeus 4xx/5xx, network
   failure, timeout, malformed provider response) to a safe, generic
   client-facing error — never a stack trace, never anything
   credential-shaped, never a fabricated successful offer standing in for
   a real failure.
4. Applies CORS restricted to exactly `https://hmooodzozo577-gif.github.io`
   (this app's GitHub Pages origin) — never `*`.

## Local development

```
cd worker
npm install
npm test         # runs the Vitest suite — every Amadeus call is mocked
npm run typecheck
npm run dev       # currently just prints a note — see below
```

Running an actual local Worker dev server (`npx wrangler dev`) needs
`wrangler` installed, which is intentionally not added as a dependency
yet. `npm test`/`npm run typecheck` exercise the real logic in
`src/index.ts`/`src/amadeus.ts` directly via the standard
`Request`/`Response`/`fetch` Web APIs (available natively in Node 18+),
with `fetch` injected as a mock in tests — no wrangler or Miniflare
needed, and no real network access or credentials required to run the
test suite.

## Secrets & environment

See `../SECRETS.md` for the full process. Summary: `AMADEUS_API_KEY` and
`AMADEUS_API_SECRET` are set only via `wrangler secret put` (never
committed); `AMADEUS_ENV` (`"test"` by default, `"production"` to opt
into the live API) is a plain, non-secret variable in `wrangler.toml`. No
secret value exists anywhere in this repository.

## Types

`tsconfig.json` uses `lib: ["ES2022", "DOM"]` to type-check against the
standard `Request`/`Response`/`Headers`/`URL`/`AbortController` APIs this
Worker uses — the same Fetch-standard APIs Cloudflare Workers implement
natively. It does not install `@cloudflare/workers-types`, since nothing
here touches a Workers-specific API (KV, Durable Objects, etc.); that
dependency should be added when a later phase actually needs those APIs.
