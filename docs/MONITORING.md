# Monitoring and operations checks (v1.1)

All free: GitHub Actions on the public repository. None of them writes
production data or uses a credential.

| Workflow | When | What |
|---|---|---|
| `uptime-monitor.yml` | hourly (`17 * * * *`) + manual | 4 GET checks: home page (app shell), `/destination/japan/` (its own static page and canonical), Worker `GET /api/intelligence/SA/tourism` (200, JSON), admin boundary `GET /api/admin/summary` (401 without credentials). At most two attempts per check, 5-minute job timeout. A failure turns the run red, which GitHub reports to the repository owner; no issue or comment is opened, so an outage cannot become notification spam. First run 36203757208: 4/4 up. |
| `production-smoke.yml` | manual | the read-only production smoke: Chromium, Firefox, WebKit, Edge; optional desktop Safari, iOS Simulator, VoiceOver; Worker and admin checks; `seo_checks` for every page document over HTTP. Worker requests from the browsers are aborted, so nothing is written. |
| `domain-status.yml` | manual | public DNS, EU.org WHOIS and the official EU.org policy pages for a candidate domain (see `docs/SITE_ORIGIN.md`). |
| `update-*.yml` data workflows | monthly + manual | regenerate a data snapshot, compare the data (ignoring the run stamp) and open a pull request only when something really changed. |

The URLs the ops scripts check live in one place,
`app/scripts/lib/productionUrls.mjs`.
