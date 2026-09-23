# Wejhaty v1.0.0-rc1 — release candidate record

Phase 20 record for release candidate `wejhaty-v1.0.0-rc1`. Status:
**PHASE 20 — FINAL WEJHATY / RELEASE CANDIDATE / AWAITING USER
ACCEPTANCE.** Nothing here is user-accepted or final until the user says
so. Current truth lives in `PROJECT_STATE.md`; this file records what the
candidate is, how it was checked, and what was left out.

Evidence labels: CODE-VERIFIED (read in the code), TEST-VERIFIED (automated
tests), BROWSER-VERIFIED (driven in a real browser engine),
PRODUCTION-VERIFIED (checked against the deployed site), USER-VERIFIED
(confirmed by the user), UNVERIFIED, DEFERRED, BLOCKED.

## 1. What the candidate is

- Branch `claude/marhaba-kxry8l` (deploy branch) and the snapshot branch
  `release/wejhaty-v1.0.0-rc1` at the same commit. A local tag of the same
  name exists; the Git proxy used for development refuses tag pushes, so
  the branch is the shared snapshot.
- Rollback points kept: `backup/phase18-refinement-pre-phase19` (64ea036,
  before Phase 19) and the pre-Phase-18 checkpoint (4dc8018).
- Live site: https://hmooodzozo577-gif.github.io/wej/ — Worker:
  https://wejhaty-travel-worker.hmooodzozo577.workers.dev (unchanged by
  Phase 19/20).

## 2. Product freeze (20.1)

In the candidate: the Phase 14 recommendation engine and weights, Country
Suitability (7 purpose models), Phase 17 visuals, Phase 18 Personal Match
(`personal-match-1.0`), the 194-country catalog with the Israel exclusion,
Explore/Surprise/Destination pages, anonymous analytics/ratings/feedback,
and Phase 19 passport entry information (official sources, information
only). From here until acceptance, only fixes for acceptance findings and
the user-approved security Pass 2 fixes go in. Phase 21 is not started.

## 3. User-acceptance checklist (20.2) — for the user

Each item is AWAITING USER until the user confirms it.

1. Home (AR and EN, Light and Dark, phone and desktop): hero photo, copy,
   "194" stat, orange buttons, compass on tablet widths.
2. Phone menu: the theme list opens inside the screen.
3. Questionnaire for a few purposes; the optional passport step says
   coverage is partial; skipping works.
4. Results: order and percentages; with a passport, the "entry
   requirements" panel below the results shows status, official link and
   last-checked date for covered destinations and "not covered" otherwise.
5. Destination page: Country Suitability, "why this suits you", and (with
   a passport chosen in the same tab) the entry card.
6. Explore: filters, personal sort, reset preferences, Surprise.
7. Feedback and rating forms.
8. Arabic wording of the new passport and entry texts.
9. Decision: accept the candidate, or list changes.

## 4. Data verification (20.3)

- Catalog: 194 destinations; IL/ISR excluded at load by
  `excludedCountries.ts` (the generated `basicCountries.json` source still
  carries the row; the loader drops it; tests assert the exclusion).
  TEST-VERIFIED.
- Country intelligence: 1,358 purpose entries for 194 countries, models
  `tourism-v1` … `wellness-v1`, generated 2026-09-16; no IL entry.
  TEST-VERIFIED.
- Entry-requirements snapshot `entry-sources-1.0`, generated
  2026-09-23T15:49:45Z by the GitHub-runner workflow from official pages:
  34 destinations; tables uk 192, schengen 149, canada 191, singapore 193,
  saudi 67, maldives 193 nationalities; no IL/ISR anywhere. Parser tests
  run against the exact captured lists. TEST-VERIFIED; the source reads
  themselves ran on GitHub's runner (logs in the workflow runs).
- Personal Match version `personal-match-1.0` unchanged. CODE-VERIFIED.

## 5. Production verification (20.4, 20.10)

- Pages deploy run 35893619205 (commit d607244): success. Deployed bundle
  `assets/index-ClIifV4P.js` / `assets/index-D5vePYB5.css` — the same
  hashes as the locally verified build.
- `production-smoke.yml` run 35893809271 against the live site from
  GitHub's runner: **78/78 checks passed** in Chromium, Firefox and WebKit
  (Playwright's Linux WebKit, not Safari) — current bundle and CSS, lazy
  entry snapshot served without IL, "194", no horizontal overflow, CTA
  `#c0532c` in AR/EN × Light/Dark × phone/desktop, phone theme menu inside
  the viewport, and the passport flow (partial-coverage notice, five entry
  rows, cleared on reload, nothing stored or sent). Worker requests were
  blocked in the browser, so the run wrote no production data.
  PRODUCTION-VERIFIED.
- The Worker was not redeployed by Phase 19/20. The development sandbox
  cannot reach github.io directly; every production check runs on
  GitHub's runner.

## 6. Security and privacy status (20.5)

- **Not signed off.** Security audit Pass 1's MEDIUM finding S1 is open:
  public write endpoints (ratings, feedback, `/api/events`) rely on a
  client-generated session id for abuse control, `/api/events` has no
  limit, and Turnstile is not configured. The user approved Pass 2
  (Worker-side per-IP rate limits, Turnstile hardening without enabling
  it, city-cache title allowlist, admin JSON content type, CI hardening,
  malformed-URI handling, client write timeout, shared CORS/exclusion
  helpers, removal of an unused admin token field); it runs next.
- Privacy (CODE-, TEST- and BROWSER-VERIFIED): no login; the passport
  country stays in the tab's memory and is never stored, logged, sent to
  the Worker or put in a URL (the analytics event records only whether a
  passport was chosen); no passport number anywhere; location is coarse,
  optional and never stored raw; the personalization profile stays in the
  browser.
- No AI code or provider in the product.
- **Addendum — Security Pass 2 applied after rc1.** As the freeze allows,
  the user-approved Pass 2 fixes were added on the deploy branch on top of
  this candidate (the `release/wejhaty-v1.0.0-rc1` snapshot itself is
  unchanged). S1 is fixed in code: per-address edge rate limits on the
  three public write endpoints, Turnstile hardened but still not enabled,
  analytics payload cap. Details and production results: `PROJECT_STATE.md`
  state v37. Security is still not "fully signed off": Turnstile is off and
  the items the user deferred remain.

## 7. Accessibility sign-off (20.6)

Technical sign-off with known limitations, not a formal audit:
- axe-core 4.13 over Home, Purpose, Quiz, Results, Explore and two
  Destination pages × AR/EN × Light/Dark × desktop/phone: no critical or
  serious violation. BROWSER-VERIFIED (Chromium).
- Remaining: `heading-order` (moderate) — card titles are h3 directly
  under the page h1 on Purpose, Explore and Destination.
- Contrast (10th percentile of photo pixels behind text): Light hero text
  ≥5.06:1, orange buttons 4.65:1. Dark mode was left unchanged by request;
  its "nearby destinations" note relies on a text halo over the photo and
  measures below 4.5:1 without it.
- Screen-reader use (VoiceOver/TalkBack/NVDA) and real-device zoom were not
  tested. UNVERIFIED.

## 8. Performance baseline (20.7)

Local production build, Chromium, median of 3 cold loads; mobile = 4× CPU
and ~1.6 Mbps / 150 ms RTT. BROWSER-VERIFIED (lab numbers, not field data).

| Page | Mobile FCP | Mobile LCP | Mobile TBT | Desktop FCP | JS transferred |
|---|---|---|---|---|---|
| Home | 4.21 s | 4.49 s | 0.54 s | 0.58 s | 624.8 kB |
| Explore | ≈6.5 s | ≈6.5 s | ≈3.1 s | ≈1.0 s | 624.8 kB |
| Destination (France) | 4.32 s | 4.56 s | 0.65 s | 0.61 s | 624.8 kB |

Phase 19 changed none of these beyond noise (main script +3.2 kB). The
main cost is one 2.4 MB (≈620 kB gzip) script carrying every flag SVG and
dataset, and Explore's ≈11,600 DOM nodes.

## 9. Deferred register (20.12)

| Item | Status | Why / what unblocks it |
|---|---|---|
| Security Pass 2 fixes (S1 and the rest of the approved list) | DONE after rc1 | See the addendum in section 6 and `PROJECT_STATE.md` v37 |
| Turnstile in production | DEFERRED | User decision; keys not configured |
| Paid visa providers (Sherpa, VisaHQ, Timatic) | BLOCKED | No working credentials; not needed for current coverage |
| Entry coverage beyond 34 destinations (e.g. USA, Japan) | BLOCKED / DEFERRED | travel.state.gov and mofa.go.jp refuse automated access; others need unambiguous official lists |
| Automatic PRs from data workflows | BLOCKED | Repo setting "Allow GitHub Actions to create and approve pull requests" is off |
| Thmanyah Arabic font | BLOCKED | License forbids web hosting/embedding without written permission |
| Real Safari / iOS Safari / Edge checks | UNVERIFIED | No such browsers in the sandbox; Firefox and WebKit run only on the runner |
| Screen-reader testing | UNVERIFIED | Needs a person with assistive technology |
| `heading-order` (moderate) | DEFERRED | Heading levels change accepted page structure; low impact |
| Dark hero note contrast without halo | DEFERRED | Dark mode kept unchanged by request |
| Lazy-loading flags and datasets; Explore DOM size | DEFERRED | Largest measurable performance win; needs its own measured change |
| Rating persistence / R2 screenshots / admin access in production | DEFERRED | Needs production configuration and checks |
| Dependency upgrades, CSP for the main site, action SHA pinning | DEFERRED | Listed as deferred by the security Pass 2 scope |
