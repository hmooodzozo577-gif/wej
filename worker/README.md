# wejhaty-travel-worker

Cloudflare Worker backend for Wejhaty's travel API and anonymous product-data
service. This is a **structurally separate project** from `app/` (the Vite/React GitHub
Pages frontend):

- Its own `package.json`, `tsconfig.json`, and dependencies — nothing here
  is imported by, or bundled into, the frontend build.
- `.github/workflows/deploy-pages.yml` only watches `app/**`; this
  directory does not participate in that workflow at all.
- Independently deployable via `wrangler`, on its own schedule, entirely
  separate from the GitHub Pages deploy.

## Status: travel Worker deployed; Amadeus credential state must be re-checked

This Worker is now deployed via `.github/workflows/deploy-worker.yml`
(GitHub Actions, using the repository's `CLOUDFLARE_API_TOKEN`/
`CLOUDFLARE_ACCOUNT_ID` secrets) — real public URL:
`https://wejhaty-travel-worker.hmooodzozo577.workers.dev`. Redeploys
automatically on a push touching `worker/**`, or on demand via
`workflow_dispatch`.

Application endpoints are:

- `POST /api/travel/flights` for validated Amadeus flight searches.
- `POST /api/events` for bounded anonymous product events.
- `POST /api/ratings` for result-quality ratings.
- `POST /api/feedback` for user reports and optional private screenshots.
- `GET /api/admin/summary` for token-protected product data.
- `GET /admin` for the developer dashboard shell.

Current external
secret/account state can change outside Git and must be checked before claiming
live Amadeus offers. Missing or rejected credentials fail safely with a generic
`provider_error`; the Worker never fabricates an offer.

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

Running an actual local Worker dev server uses the repository-pinned
`wrangler` development dependency. `npm test`/`npm run typecheck` exercise the real logic in
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

`ADMIN_TOKEN` protects the product-data summary API. `TURNSTILE_SECRET_KEY`
enables server-side Turnstile verification for feedback, paired with the public
Pages build variable `VITE_TURNSTILE_SITE_KEY`. These values must be configured
outside Git before the corresponding production protection is active.

## Product-data storage and retention

The deploy workflow creates and binds a private D1 database named
`wejhaty-product-data` and a private R2 bucket named
`wejhaty-feedback-screenshots`, then applies `migrations/*.sql`. The repository's
Cloudflare token therefore needs D1, R2, and Workers edit permissions.

The browser creates a random session identifier in `sessionStorage`; there is
no login and no cross-session fingerprint. Exact coordinates, IP addresses,
and fingerprint fields are rejected in both browser and Worker validation.
Cloudflare's two-letter edge country may be stored. A scheduled job retains
daily aggregates, deletes raw events and ratings after 90 days, and removes
feedback contact/device/screenshot links after 90 days while preserving the
issue text and status as an operational record.

## Types

`tsconfig.json` uses `lib: ["ES2022", "DOM"]` to type-check against the
standard `Request`/`Response`/`Headers`/`URL`/`AbortController` APIs this
Worker uses — the same Fetch-standard APIs Cloudflare Workers implement
natively. D1 and R2 are represented by small local interfaces so product-data
request validation and retention remain unit-testable without an account
connection.
