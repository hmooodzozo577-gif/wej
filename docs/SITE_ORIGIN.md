# Site origin, base path and the free domain (v1.1)

## Primary site and redirects — 2026-10-16

**The site is `https://tilqaa.pages.dev`** (Cloudflare Pages project
`tilqaa`). The other two hosts build the same source with
`WEJHATY_REDIRECT_TO=https://tilqaa.pages.dev`, and the `postbuild` step
(`app/scripts/redirect-site.mjs`, logic in `scripts/lib/redirectSite.mjs`)
replaces their `dist/` with redirect documents only:

| Host | Build | Set by |
|---|---|---|
| `tilqaa.pages.dev` | full site (no `WEJHATY_REDIRECT_TO`) | — |
| `hmooodzozo577-gif.github.io/wej/` | redirect build | `deploy-pages.yml` |
| `wej.pages.dev` | redirect build | owner: `WEJHATY_REDIRECT_TO` in the `wej` project (Production) |

Each page document becomes a document at the same path with a canonical
link, `<meta http-equiv="refresh" content="0; url=…">` (works without
JavaScript) and `location.replace(…)` (keeps query and hash); `404.html`
(noindex) moves any other path to the same path on the primary site;
`robots.txt` allows crawling. A build that would redirect to its own origin
fails. Ops scripts (`scripts/lib/productionUrls.mjs`: smoke, SEO, uptime)
and the `production-smoke.yml` default/allow-list check `tilqaa.pages.dev`.
Browser storage (favorites, theme) is per origin: visitors moved from
github.io start with an empty favorites list on the primary site.
To serve the full site on GitHub Pages again, remove the
`WEJHATY_REDIRECT_TO` line from `deploy-pages.yml`.

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

## Cloudflare Pages (https://wej.pages.dev)

Cloudflare Pages serves the build from the domain root. Its build
environment sets `CF_PAGES=1`; `build/site.ts` then defaults to
`https://wej.pages.dev` and `/` instead of the GitHub Pages values.
`WEJHATY_SITE_ORIGIN` / `WEJHATY_BASE_PATH` set in the Cloudflare project
still override those defaults. Without this, the page loaded
`/wej/assets/…`, got 404 and rendered blank.

Worker-backed features need `VITE_TRAVEL_WORKER_URL` in the Cloudflare
project **and** the site's origin in the Worker's CORS allow-list
(`ALLOWED_ORIGINS`, `worker/src/shared.ts`). Since 2026-10-16 both are
set for `tilqaa.pages.dev` (the variable by the owner in the `tilqaa`
project, the origin in code). `wej.pages.dev` is deliberately NOT in the
allow-list: its pages declare `tilqaa.pages.dev` as canonical, and it
keeps working without the Worker-backed features.

## Branded Cloudflare URL (`tilqaa.pages.dev`) — status: PROJECT CREATED; canonical switched in code

**2026-10-16.** The owner created the Pages project `tilqaa` and confirmed
the hostname `https://tilqaa.pages.dev`. Its first deploy (production
`d613cd5`) is reported by Cloudflare's GitHub check as successful (preview
`460dd540.tilqaa.pages.dev`); it was not fetched live from the agent
sandbox, which cannot reach `*.pages.dev`. Follow-up done:
`CLOUDFLARE_PAGES_SITE_ORIGIN` in `app/build/site.ts` is now
`https://tilqaa.pages.dev`, so every Cloudflare build — the `tilqaa`
project and the old `wej` project alike — declares the branded URL as
canonical (Open Graph, robots, sitemap, manifest too). `wej.pages.dev`
keeps serving the site; retiring or redirecting it is still a separate,
explicit decision (step 7). The history below is kept as the record.

Goal: serve the Cloudflare build at a hostname that matches the brand,
without downtime for `https://wej.pages.dev`.

**Why it is an owner step.** A Pages project's `*.pages.dev` hostname
comes from the project name chosen at creation; Cloudflare does not offer
renaming a project (per Cloudflare's documentation — not tested here).
So `wej.pages.dev` cannot be turned into `tilqaa.pages.dev`: a second Pages
project named `tilqaa` is needed, and only Cloudflare decides, when the
project is created, whether it gets `tilqaa.pages.dev` or a suffixed name.
Agents in this repository have no Cloudflare credentials, and the agent
sandbox cannot reach `api.cloudflare.com` or `*.pages.dev`.

**Evidence, 2026-10-12** (`domain-status.yml` on a GitHub runner, `dig
@1.1.1.1`, runs 38314917062–38314928059; DNS is NOT an authoritative
availability check):

| Name | DNS | Reading |
|---|---|---|
| `wej.pages.dev` | Cloudflare NS, A/AAAA | the current project answers in DNS |
| `tilqaa.pages.dev` | no records | no live project uses it today |
| `zz-tilqaa-control-93d1.pages.dev` | no records | `pages.dev` has no wildcard, so the empty answer above means something |
| `tilqaa.com` | Google Cloud DNS NS, A records | registered and in use by someone else |
| `tilqaa.app` | no records | possibly unregistered (no WHOIS check) |

**No code change is needed for the new project.** The build already reads
`WEJHATY_SITE_ORIGIN` (`app/build/site.ts`). Verified locally:
`CF_PAGES=1 WEJHATY_SITE_ORIGIN=https://tilqaa.pages.dev npm run build`
gives canonical, `og:url`, `og:image`, robots `Sitemap:`, sitemap `<loc>`s
and the manifest on `https://tilqaa.pages.dev`, no `wej.pages.dev`
anywhere, and `verify-seo-build.mjs … https://tilqaa.pages.dev/` passes
5224/5224.

**Owner steps (keeps `wej` untouched and live):**

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the
   GitHub repository `hmooodzozo577-gif/wej`.
2. Project name `tilqaa`. The subdomain Cloudflare shows for it is the
   authoritative answer; if it is not exactly `tilqaa.pages.dev`, stop and
   choose again (for example `tilqaa-travel`) rather than accept a random
   suffix.
3. Same settings as the `wej` project: production branch
   `claude/marhaba-kxry8l`, root directory `app`, build command
   `npm run build`, output `dist`, framework preset React (Vite).
4. Production environment variables: `WEJHATY_SITE_ORIGIN` =
   `https://tilqaa.pages.dev` (the exact hostname from step 2) and
   `WEJHATY_BASE_PATH` = `/`. Without them the new project's canonical
   links would point at `wej.pages.dev`.
5. Save and deploy, then open `https://tilqaa.pages.dev`. Both projects now
   build every push to the production branch; `wej.pages.dev` keeps
   working.
6. Tell the agent the confirmed hostname. Follow-up change (one constant
   and its tests): `CLOUDFLARE_PAGES_SITE_ORIGIN` in `app/build/site.ts`
   becomes the new origin, so the `wej` project's pages also declare the
   branded URL as canonical (one search-engine identity, no redirect
   needed); plus this document and `PROJECT_STATE.md`.
7. Later, only on an explicit decision: retire or redirect the `wej`
   project. Do not delete it before the new hostname is verified.

Not affected at the time: GitHub Pages (`/wej/`) and the Worker. Later
(2026-10-16) the Worker was connected to `tilqaa.pages.dev` — see the note
at the top of this file's Cloudflare section.

A custom domain (option 1 in the brief) needs a domain the owner buys and
controls; `tilqaa.com` is taken. Candidates to check with a registrar:
`tilqaa.app`, `tilqaa.travel`, `tilqaa.sa`, `gotilqaa.com`. Then: Pages
project → Custom domains → add it, and set `WEJHATY_SITE_ORIGIN` to it.

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
