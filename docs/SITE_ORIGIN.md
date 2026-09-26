# Site origin, base path and the free domain (v1.1)

## One site configuration

`app/build/site.ts` is the only place the app's address is decided:

| Variable (build time) | Default | Root-domain example |
|---|---|---|
| `WEJHATY_SITE_ORIGIN` | `https://hmooodzozo577-gif.github.io` | `https://wejhaty.eu.org` |
| `WEJHATY_BASE_PATH` | `/wej/` | `/` |

An empty value means "not set" (an unset repository variable reaches the
build as an empty string); a root build must say `/` explicitly. The
origin must be a bare `https` origin. From these the build derives Vite's
`base`, the router basename, canonical links, the sitemap, robots.txt,
Open Graph URLs, share links, the manifest and the structured data
(`app/src/site/site.ts` exposes them to the app). There is no runtime
string replacement.

The Pages workflow passes the optional repository variables
`SITE_ORIGIN` and `SITE_BASE_PATH` to the build. With both unset the
output is byte-identical to the default build (616 files, verified).

Both builds are verified with `app/scripts/verify-seo-build.mjs`: the
`/wej/` build and a root build (`WEJHATY_SITE_ORIGIN=https://wejhaty.eu.org
WEJHATY_BASE_PATH=/`), which contains no `github.io` and no `/wej/`.

## The free domain — status: PENDING HUMAN APPROVAL

Candidate: `wejhaty.eu.org` (EU.org, free of charge). Checked on
2026-09-26 from a GitHub runner with the read-only
`.github/workflows/domain-status.yml` (runs 36203816604, 36203879114):

- DNS: no NS, SOA, A, AAAA or CNAME record — the name is not delegated
  (not registered or not yet approved).
- WHOIS (`whois.eu.org`, port 43): not reachable from the runner.
- Official pages read (nic.eu.org home, `policy.html`, `opendomains.html`):
  the service's goal is free subdomains for users and non-profits;
  registration needs a sign-in/sign-up on nic.eu.org; small commercial
  sites are accepted only as a last resort (Wejhaty is free and
  non-commercial); non-European sites are welcome; owners must follow the
  RFCs and must not spam or phish. The pages do not state an approval
  time — it is not assumed here.

Why an agent cannot finish it: registration needs the owner's own account
and contact details on nic.eu.org, and a DNS host for the name. No card,
no paid plan and no paid DNS product is involved; a free DNS host (for
example the free Cloudflare plan the project already uses for the Worker)
is enough. The release does not wait for it.

## Switch-over checklist (only after the name resolves)

1. Owner: register `wejhaty.eu.org` on nic.eu.org with a free DNS host;
   wait for approval; confirm with the Domain status workflow.
2. DNS: point the name at GitHub Pages (Pages custom-domain records), then
   set the custom domain in Settings → Pages and enable HTTPS.
3. Repository variables: `SITE_ORIGIN=https://wejhaty.eu.org`,
   `SITE_BASE_PATH=/`; redeploy Pages.
4. Worker CORS: add the new origin to `worker/src/shared.ts`
   (`ALLOWED_ORIGIN` → an allow-list) and redeploy the Worker — until then
   every Worker call from the new origin fails CORS. This is the one code
   change, deliberately deferred so v1.1 does not redeploy the Worker.
5. Ops scripts: change `app/scripts/lib/productionUrls.mjs` (smoke, SEO,
   uptime defaults) in the same commit.
6. Verify: `verify-seo-build.mjs` on the root build, production smoke with
   `seo_checks`, and the uptime monitor.

GitHub Pages keeps serving `/wej/` meanwhile; there is no hosting move.
