# Wejhaty — release record

Status: **WEJHATY v1.1.1 — FINAL HOTFIX RELEASE — TECHNICALLY VERIFIED,
PRODUCTION-VERIFIED, USER-ACCEPTED, RELEASED (2026-09-30).**

- v1.1.1 RC1 was user-accepted on the real Android device ("ناجح") and
  is the basis of v1.1.1; it stays unchanged as a historical candidate.
- **WEJHATY v1.1.0 (2026-09-29)** is the previous final release,
  superseded by v1.1.1; its refs never move. Its RC1 and RC2 stay
  unchanged.
- **WEJHATY v1.0.0 (2026-09-24)** stays a released, immutable version.

Current truth lives in `PROJECT_STATE.md` (state v47 and its
known-limitations register). This file records what each release and
candidate is, and how it was checked.

# v1.1.1 — `wejhaty-v1.1.1` (final hotfix release)

## v1.1.1.1 What it is

- Reason: Android Chrome Hero compositing / paint stability hotfix.
- Branch `release/wejhaty-v1.1.1`, annotated tag `wejhaty-v1.1.1` and
  `backup/wejhaty-v1.1.1-final` → the release commit, whose parent is the
  accepted RC1 `39b156f`. The release commit changes documentation only;
  the `app/` tree (`16d6ab4`) is the one the user accepted and the one in
  production (deployment 6753324597).
- User acceptance: tested on the same physical Android device and Chrome
  that showed the dark Hero band; the required scroll-down / back-to-top
  sequence was repeated; result "ناجح". Automated runs never reproduced
  the paint artifact itself; they prove the root cause is gone. One device
  and one browser were tested; this is not a certification of other
  Android devices.
- Same product as v1.1.0 apart from the Hero fix, its tests, the smoke
  checks and version 1.1.1 (see RC1 below).

## v1.1.1.2 Verification

{{FINAL_VERIFICATION}}

## v1.1.1.3 Rollback

Roll back with the state-v42 procedure using tag `wejhaty-v1.1.0` (or
`wejhaty-v1.1.1-rc1`) as the source: history-preserving, no force push.
The only runtime difference from v1.1.0 is the Hero photo rule, so a
rollback brings the Android band back.

# v1.1.1 RC1 — `wejhaty-v1.1.1-rc1` (USER-ACCEPTED; basis of v1.1.1)

## v1.1.1-RC1.1 What it is

- Branch `release/wejhaty-v1.1.1-rc1` and annotated tag
  `wejhaty-v1.1.1-rc1` → the commit that records this candidate. It
  descends from v1.1.0 (`8643c85`) through the branch
  `hotfix/wejhaty-v1.1.1-android-hero`. It is not built on RC2 and does
  not rewrite v1.1.0.
- One product change, in `app/src/styles/wejhaty.css`: the Home Hero
  photo's settle animation fills `backwards` instead of `both`, and the
  photo's resting style is the animation's last keyframe
  (`scale(1.015)`, no filter). The reduced-motion rule keeps its
  still-photo look. Before, the finished animation kept holding the
  photo, so Chrome kept the photo and, over it, the scrim and the Hero
  copy as two lasting composited layers apart from the frame. On an
  Android device those two layers came back from a scroll cycle without
  their top part: an empty navy band inside the frame. Diagnosis:
  `PROJECT_STATE.md` state v46.
- Regression tests: `app/src/routes/Home.heroPhotoLayer.test.ts` (fails on
  v1.1.0) and new Hero checks in `app/scripts/production-smoke.mjs`
  (three fail on v1.1.0 locally).
- Version `1.1.1` (`app/package.json`); the footer shows v1.1.1.
- Nothing else changes: engine, Passport, Worker, data, Personal Match,
  Favorites, Compare, Share, SEO, attribution, privacy, Admin, analytics,
  header and footer are identical to v1.1.0.

## v1.1.1-RC1.2 User-acceptance checklist

On the Android device that showed the band (Chrome, Arabic, dark):

1. Open Home at the top. The photo fills the whole frame.
2. Scroll down one or two screens, then back to the top, slowly. No navy
   band; headline and eyebrow visible; photo reaches the frame's top edge.
3. Repeat fast (a flick), and with momentum, several times.
4. Rotate the device and repeat once in the other orientation.
5. Optional: English, and Light mode.

## v1.1.1-RC1.3 Integrity and production verification

- Local: frontend 1206/1206 (119 files); `tsc -b` 0; oxlint 0;
  `verify-seo-build` 4 804/4 804 on the `/wej/` and root builds; matrix
  1 200/1 200; axe 0 violations on 48 states; adversarial 49/49; flow
  27/27; Hero matrix 125 states / 4 887 checks (8 CPU-contention
  `scrollY` misses, 312/312 on re-run alone).
- `worker/` identical to v1.1.0; Phase 14 engine `75d09040b0f8`,
  Passport `cf4f8f719ea5` unchanged.
- Deploy: Pages run 36680050325 → github-pages deployment 6753324597
  (`e6138ae`; bundle `index-Q4TA26ho.js` / `index-xnUlk2Vq.css`).
- Production smoke run 36680147185: four engines 261/261 (the new Hero
  checks included), SEO 2 182/2 182, Worker 19/19, Admin 15/15, desktop
  Safari 16/16, iOS Simulator passed, VoiceOver 4/4. The earlier run
  36678242211 (260/261) failed only on a passport-storage false alarm
  caused by the Hero's random Saudi Arabia code; the check is fixed in
  `e6138ae` (details in `PROJECT_STATE.md` state v46).
- Not verified here: the physical Android device (register V8) and a
  physical iPhone (U3).

Evidence labels: CODE-VERIFIED, TEST-VERIFIED, BROWSER-VERIFIED,
PRODUCTION-VERIFIED, USER-VERIFIED, USER-ACCEPTED, UNVERIFIED, DEFERRED,
BLOCKED, FROZEN, CANCELLED, PENDING HUMAN APPROVAL.

# v1.1.0 — `wejhaty-v1.1.0` (final release; superseded by v1.1.1)

## v1.1.0.1 What it is

The user-accepted RC2, released as is. The release commit changes
documentation only; no product behaviour changed after the acceptance.

v1.1.0 adds to v1.0.0:

- **Discoverability**: a real HTTP-200 page document for each of the 194
  destinations, one metadata system, sitemap, robots, structured data,
  Open Graph image, icons and manifest.
- **Sharing**, **Favorites** (local, in the header) and **Compare** (2–3
  destinations, real data, no winner).
- **The passport selector's location default**: an initial value only,
  never stored or sent.
- **Personal Match 1.2**, with optional, local-only questions on language,
  ease of Islamic practice and halal food.
  - Positive evidence only, at one level: official languages; places
    mapped or tagged in OpenStreetMap.
  - Wejhaty's own thresholds, credited under the ODbL.
  - Thin or missing evidence is not counted, never a low score.
- **Operations**: the footer version from one source, one site-origin
  configuration, hourly uptime monitoring, and data workflows that open a
  PR only on a real change.

| Item | Value |
|---|---|
| User acceptance | RC2 USER-ACCEPTED ("ناجح") — 2026-09-29 |
| Release commit | the commit that adds this section (read its hash from the refs below) |
| Branch | `release/wejhaty-v1.1.0` → release commit |
| Tag | `wejhaty-v1.1.0` (annotated) → release commit |
| Final checkpoint | `backup/wejhaty-v1.1.0-final` → release commit |
| Parent | `7f42a24` (RC2, tree `ea4bbec4e41aada5ef2737c24939091b9749045d`) |
| App source | `app/` tree `f4b7f9d7fd426792974d3a6e8c0ebcdd24c81206`, identical to RC2; `assets/index-CpqLXvsI.js`, `assets/index-DpoUvE_F.css` |
| Protected code | `app/src/engine`, `app/src/entry`, `worker/` byte-identical to v1.0.0 (same git tree hashes) |
| Pages deploy | run 36603816570 on `7f42a24`, deployment 6740977228 |
| Worker | not redeployed — version `b1c2815a-5557-41fd-a3d8-025af15524ff` |
| Tests | frontend 1203/1203, Worker 273/273; `tsc`, oxlint, build and `wrangler deploy --dry-run` clean; `verify-seo-build` 4 804/4 804 (`/wej/` and root) |
| Browser checks (local) | matrix 1 200/1 200; axe 0 violations on 48 states; footer/header/notice 340/340; Favorites/Compare 49/49 and 27/27 |
| Production smoke | run 36604356348 — Chromium/Firefox/WebKit/Edge 243/243 (0 CSP violations), SEO without JavaScript 2 182/2 182, Worker 19/19, admin 15/15, desktop Safari 16/16, iOS Simulator 16/16, real VoiceOver 4/4; read-only |
| GitHub Release | none; the repository does not use GitHub Releases (v1.0.0 had none), and the annotated tag is the release record |

## v1.1.0.2 Known limitations

See the known-limitations register in `PROJECT_STATE.md`. In short:

- **FROZEN**: Passport.
- **CANCELLED**: Thmanyah.
- **DEFERRED**:
  - Traveler Budget, Turnstile, and paid providers with their limiters;
  - the Worker CORS entry for a new origin;
  - the `Quiz.tsx` and CSS size;
  - the English header wrap between 861 and ~930 px (already present
    before v1.1).
- **PENDING HUMAN APPROVAL**: the free domain `wejhaty.eu.org`.
- **UNVERIFIED**: a physical iPhone and other screen readers.
- **DOCUMENTED**: OpenStreetMap evidence limits, including the halal
  tagging-culture gap.

## v1.1.0.3 Rollback

Refs and the history-preserving procedure are in `PROJECT_STATE.md`
(state v45 rollback table; procedure in state v42). No release, candidate
or checkpoint ref is ever moved, deleted or force-pushed.

# v1.1.0 RC2 — `wejhaty-v1.1.0-rc2` (USER-ACCEPTED; basis of v1.1.0)

## v1.1.0-RC2.1 What it contains

RC1 plus exactly:

1. **Footer cleanup** (the one issue found in the user's RC1 review). The
   footer no longer carries a Favorites link.
   - Favorites stays in the header at every width, and in the mobile menu
     below 861 px.
   - Between 861 and 1099 px, "How it works" steps aside instead, because
     five links do not fit on one line there.
2. **Personal Match 1.2**. The partial mosque level is removed.
   - It lowered a match below "not counted" in 3,664 of 10,560 audited
     cases.
   - Answering a travel need can now never lower a score.
   - Thresholds are unchanged.
3. **ODbL attribution** under «لماذا تناسبك هذه الوجهة؟» when a travel need
   is used.
   - It credits OpenStreetMap contributors and world-countries
     (mledoze/countries).
   - It states that the thresholds are Wejhaty's own.
   - Not-counted factors show the OpenStreetMap count.
4. **Source, licence and methodology documentation**:
   `docs/DATA_SOURCES_V1_1.md`, `docs/PERSONAL_MATCH_V1_1.md`,
   `docs/audits/DATA_METHODOLOGY_RC2.md`, `docs/PRIVACY_V1_1.md`.
5. **Tests and smoke checks** for the above:
   - per-suite time allowances for two heavy suites;
   - the Safari smoke waits for the page to load before checking styles.

Not changed: Phase 14 (`app/src/engine` byte-identical to v1.0.0), the
Passport (`app/src/entry` identical), Favorites storage, Compare, Share,
SEO architecture, Admin, the Worker, the visual identity, the app version
(1.1.0). Nothing is user-accepted yet.

## v1.1.0-RC2.2 Final visual check

Arabic first, then English; Light and Dark; a phone and a desktop.

1. The footer shows brand, «تواصل واقترح أو أبلغ عن مشكلة», the reference
   note and `وجهتي v1.1.0`. There is **no** «المفضلة» in the footer, and
   no gap where it was.
2. «المفضلة» is in the header on a desktop, on a tablet or narrow laptop
   window (about 900–1100 px wide), and in the phone menu. It opens your
   Favorites.
3. Favorites and Compare work as in RC1: save, reload, remove, compare two
   or three.
4. On a destination, with the Islamic-practice or halal question answered,
   «لماذا تناسبك هذه الوجهة؟» ends with a short source note:
   - «أعداد المساجد والأماكن الحلال من بيانات OpenStreetMap (© مساهمو
     OpenStreetMap)، متاحة بترخيص ODbL…»;
   - «…حدود احتسابها فمن منهجية وجهتي».
   The links open the OpenStreetMap copyright page, mledoze/countries and
   the licence.
5. A destination with few mapped mosques says the OpenStreetMap count, "أقل
   مما تشترطه منهجية وجهتي", and that this does not mean practice is hard.
   It is listed under «لم يُحتسب», never as a lower match.
6. Everything else from the RC1 checklist still behaves the same.

Say "accepted" (or list what to change). Nothing is marked accepted, and no
final v1.1.0 is cut, until you do.

## v1.1.0-RC2.3 Integrity and production verification

| Item | Value |
|---|---|
| RC2 commit | the commit that adds this section (read its hash from the refs below) |
| Branch | `release/wejhaty-v1.1.0-rc2` → RC2 commit |
| Tag | `wejhaty-v1.1.0-rc2` (annotated) → RC2 commit |
| App source | `app/` identical to `e0a6134`; the RC2 commit changes documentation only |
| Pages deploy | run 36597640040 (`e0a6134`); the app build is unchanged since `c8e01e0` (run 36590837434) |
| Worker | unchanged since v1.0.0 — version `b1c2815a-5557-41fd-a3d8-025af15524ff`, not redeployed; Worker tests 273/273, `tsc` 0 |
| Tests | frontend 1203/1203 (118 files, two consecutive runs); `tsc`, oxlint, build clean; `verify-seo-build` 4 804/4 804 on `/wej/` and root builds |
| Browser QA (local) | matrix 1 200/1 200; RC2 footer/header/notice 340/340; axe 0 violations on 48 states; Favorites/Compare adversarial 49/49 and flow 27/27; smoke on the RC2 build (Chromium) 68/68 |
| Production smoke | run 36597749469 (`e0a6134`) — Chromium/Firefox/WebKit/Edge 243/243 (0 CSP violations), SEO without JavaScript 2 182/2 182, Worker 19/19, admin 15/15, desktop Safari 26.6.2 16/16, iOS Simulator Mobile Safari 26.5 16/16, real VoiceOver 4/4; read-only; deployed `assets/index-CpqLXvsI.js` / `assets/index-DpoUvE_F.css`. Run 36595061886 failed only in the iOS Simulator (styles read before the stylesheet loaded on a slow simulator); fixed in the smoke script, not the site |
| RC1 | unchanged: `release/wejhaty-v1.1.0-rc1` and tag `wejhaty-v1.1.0-rc1` (object `aa2ee70`) → `cee6e75` |
| v1.0.0 | untouched: tag `wejhaty-v1.0.0` (object `e14eae3`) → `df54567`; `release/wejhaty-v1.0.0`, `backup/wejhaty-v1.0.0-final`, `backup/wejhaty-v1.0.0-pre-v1.1` → `df54567` |

# v1.1.0 RC1 — `wejhaty-v1.1.0-rc1` (historical; superseded by RC2)

## v1.1.0-RC1.1 What it contains

v1.0.0 plus: discoverability (a real HTTP-200 page document per route,
one metadata system, sitemap, robots, structured data, Open Graph image,
icons, manifest), sharing, Favorites, Compare, the passport selector's
location default, Personal Match 1.1 (language, Islamic practice, halal
food — local only), the footer version, one site-origin configuration,
hourly uptime monitoring, and the Anti-Koshary audits. Details and
evidence: `PROJECT_STATE.md` state v43 and the `docs/` files it lists.

Not changed: Phase 14, Country Suitability, every personal-match-1.0
factor, the Worker, admin analytics meanings, the hero, the Destination
Match and Edit-preferences flows, the canonical country set and IL/ISR
exclusion. Nothing is user-accepted yet.

## v1.1.0-RC1.2 User-acceptance checklist

Use a normal browser (Arabic first, then English; Light and Dark; a phone
and a desktop).

1. Footer shows `وجهتي v1.1.0` / `Wejhaty v1.1.0`.
2. Open a destination link directly (for example `…/wej/destination/japan/`)
   — it opens the page (no redirect to Home); the browser tab shows
   «اليابان للسفر | وجهتي».
3. Share on a destination: the phone share sheet opens, or the link is
   copied with a short confirmation; the link opens that destination.
4. Favorite on a destination and on an Explore card; reload — still
   saved; open «المفضلة» from the header (or the footer on a mid-size
   screen); remove one.
5. In Favorites, tick two or three and press Compare: a table with real
   data only — no winner, no combined score, no Passport, no budget; add
   and remove a destination; on a phone the table scrolls sideways inside
   its frame.
6. Take the questionnaire to the end (continue past "show results now"):
   after the usual questions come the language, Islamic-practice and
   halal questions; the language list lets you pick several and has a
   Continue button; "غير مهم" skips the language list.
7. On a destination with saved preferences, «لماذا تناسبك هذه الوجهة؟»
   explains the new factors; a destination without evidence says "لم
   يُحتسب" and what that does not mean — never a low score.
8. Allow location, then reach the passport step: the selector already
   shows your current country with no message about it; change it, and
   it stays as you chose; "skip" still works.
9. An old saved profile (from v1.0) still shows your Personal Match;
   "Edit my preferences" now also asks the three new questions.
10. Everything from the v1.0 checklist still behaves the same.

Say "accepted" (or list what to change) — nothing is marked accepted
until you do.

## v1.1.0-RC1.3 Integrity and production verification

| Item | Value |
|---|---|
| RC1 commit | the commit that adds this section (a file cannot contain its own hash; read it from the refs below) |
| Branch | `release/wejhaty-v1.1.0-rc1` → RC1 commit |
| Tag | `wejhaty-v1.1.0-rc1` (annotated) → RC1 commit |
| App source | `app/` identical to `deece16` (app tree `5c83c6eb69c416172daf50709efd19e7282d8bc1`); the RC1 commit changes documentation only |
| Build | 616 files (208 page documents, 404, sitemap, robots, manifest, icons); the Pages build adds the Worker URL, so its entry chunk name (`index-CJFiJ9H1.js`) differs from an unconfigured local build; CSS `index-CJlRP7S5.css` is identical |
| Pages deploy | run 36236954174 (`deece16`) |
| Worker | unchanged since v1.0.0 — version `b1c2815a-5557-41fd-a3d8-025af15524ff`, not redeployed |
| Tests | frontend 1187/1187 (115 files), Worker 273/273; `tsc`, oxlint, build clean; `verify-seo-build` 4 804/4 804 on `/wej/` and root builds |
| Production smoke | run 36237100496 — Chromium/Firefox/WebKit/Edge 215/215 (0 CSP violations), SEO without JavaScript 2 182/2 182, Worker 19/19, admin 15/15, desktop Safari 26.6.2 15/15, iOS Simulator Mobile Safari 15/15, real VoiceOver 4/4; read-only; deployed `assets/index-CJFiJ9H1.js` / `assets/index-CJlRP7S5.css` |
| Uptime | run 36203757208 — 4/4 up |
| v1.0.0 | untouched: tag `wejhaty-v1.0.0` → `df54567`; `release/wejhaty-v1.0.0`, `backup/wejhaty-v1.0.0-final`, `backup/wejhaty-v1.0.0-pre-v1.1` → `df54567` |

# v1.0.0 — `wejhaty-v1.0.0` (final release)

## v1.0.0.1 What it is

The user-accepted RC4 app plus the user-accepted Phase 21 admin, with the
documentation, smoke-script and configuration commits made after them.
No product change was made for the release: the release commit changes
documentation only.

| Item | Value |
|---|---|
| User acceptance | Phase 20 (RC4) USER-ACCEPTED; Phase 21 (Admin) USER-ACCEPTED — 2026-09-24 |
| Release commit | the commit that adds this section (a file cannot contain its own commit hash; read it from the refs below) |
| Branch | `release/wejhaty-v1.0.0` → release commit |
| Tag | `wejhaty-v1.0.0` (annotated) → release commit |
| Final checkpoint | `backup/wejhaty-v1.0.0-final` → release commit |
| Parent | `3535c02` (tree `80252601bbc40ebb25e14534897245b3bcc808ad`) |
| App source | build-identical to RC4 `bfddf89`: 398 files, equal sha256 each; `assets/index-DPgukpUn.js`, `assets/index-CaHEFjNR.css` |
| Worker source | `worker/` identical to `10d58ee` |
| Pages deploy | run 35944163602 (`66b230e`, same `app/` tree), artifact 10785868655 — not redeployed for the release |
| Worker deploy | run 35942253435 — version `b1c2815a-5557-41fd-a3d8-025af15524ff` — not redeployed for the release |
| Tests | frontend 1085/1085, Worker 273/273; `tsc`, oxlint, build and `wrangler deploy --dry-run` clean |
| Production smoke | run 35946079472 — Chromium/Firefox/WebKit/Edge 143/143 (0 CSP violations), Worker 19/19, admin 15/15, desktop Safari 15/15, iOS Simulator Mobile Safari 15/15, real VoiceOver 4/4; read-only |

## v1.0.0.2 Known limitations

See the final known-limitations register in `PROJECT_STATE.md`. In short:
Passport FROZEN; Thmanyah CANCELLED; Traveler Budget, Turnstile and paid
providers DEFERRED; automatic data PRs BLOCKED by a repository setting; a
physical iPhone and other screen readers UNVERIFIED; the admin D1 budget
(48 of 50 queries) DEFERRED / FUTURE OPTIMIZATION; historic anonymous QA
events DEFERRED TO RETENTION.

## v1.0.0.3 Rollback

Refs and the history-preserving procedure are in `PROJECT_STATE.md`
state v42 ("Rollback points"). No release, candidate or checkpoint ref is
ever moved, deleted or force-pushed.

# RC4 — `wejhaty-v1.0.0-rc4` (USER-ACCEPTED; basis of v1.0.0)

## RC4.1 What it contains

RC3 plus:

- **U19**: the Dark hero "nearby" note gets a feathered navy backplate.
  Every hero photo now reads at least 6:1 at the 10th percentile, up
  from 1.26:1.
- **CSP**: a Content-Security-Policy meta tag. Scripts are limited to the
  site, the hashed theme bootstrap and Turnstile, with no `unsafe-eval`.
- **Worker**: chunked request bodies are bounded (413 over the ceiling).
- **CI**: actions are pinned to verified SHAs; there are new iOS
  Simulator and VoiceOver smoke jobs, and the smoke checks CSP.
- **Removed**: the Thmanyah license-reader workflow (topic cancelled).

No product behaviour, copy, ranking, Personal Match or Passport change.
The RC1, RC2 and RC3 branches and tags stay untouched.

## RC4.2 User-acceptance checklist

Use the RC2.2 checklist, including item 4b from RC3.2. Also check:

- Home in Dark mode, on a bright photo (reload until a snowy or
  cloudy destination appears): "وجهات أقرب إليك" is readable on a soft
  dark backing. Light mode is unchanged.

## RC4.3 Integrity and production verification

| Item | Value |
|---|---|
| Commit | `bfddf89476e67a2f11eed498d5801c943100ad8a` |
| Tree | `7469ce0826cf2b58598380dee15004d169b9a31f` |
| Branch | `release/wejhaty-v1.0.0-rc4` → `bfddf89` |
| Tag | `wejhaty-v1.0.0-rc4` (annotated, tag object `348b48b`) → `bfddf89` |
| Checkpoint before Phase 21 | `backup/phase20-rc4-pre-phase21` + tag `wejhaty-phase20-rc4-pre-phase21` (tag object `40f774d`) → `bfddf89` |
| Pages deploy | run 35937978186 — `index-DPgukpUn.js` / `index-CaHEFjNR.css`, identical to the local production build |
| Worker deploy | run 35937978254 — version `0867e58d-ddf4-4653-a94c-682fa36f3ded` |
| Production smoke | run 35938066714: Chromium/Firefox/WebKit/Edge PASS; iOS Simulator Mobile Safari 15/15 PASS |
| Desktop Safari | first attempt stopped by its own guard; after the IPv4+IPv6 block fix, 15/15 PASS (runs 35939069990 and 35942408513) |
| VoiceOver | 4/4 on real macOS VoiceOver after the setup fixes (see the Phase 21 record below) |

**Production data note (disclosure).** Before the Worker block was proven
for both address families, some macOS real-browser runs loaded the site
while the Worker was still reachable over IPv6: the RC2 and RC3 desktop
Safari runs (about 2026-09-23 22:38 and 23:09 UTC), a trial VoiceOver run
(about 23:58 UTC), and the RC4 desktop Safari home load and VoiceOver
destination load (about 2026-09-24 00:22–00:24 UTC). They probably wrote
a handful of anonymous analytics events (sessions with browser Safari,
device desktop, edge country US). Nothing was deleted — deleting
production rows is a destructive change — and the 90-day retention job
removes them automatically by about 2026-12-23. Every macOS job now
blocks IPv4 and IPv6, flushes DNS and stops unless the Worker is proven
unreachable before the site opens.

# Phase 21 — Admin post-launch enhancements (on top of RC4; USER-ACCEPTED)

Admin only: the public site is byte-identical to RC4 (same
`index-DPgukpUn.js` / `index-CaHEFjNR.css` from a production-configured
build). Details: `PROJECT_STATE.md` state v41 and `ADMIN_METRICS.md`.

| Item | Value |
|---|---|
| Code commit | `10d58ee` (smoke retries in `871b0c6`) |
| Worker deploy | run 35942253435 — version `b1c2815a-5557-41fd-a3d8-025af15524ff` |
| Pages deploy | run 35942253427 (unchanged bundle) |
| Public regression | run 35942408513 — Chromium, Firefox, WebKit, Edge: 143/143 checks, 0 CSP violations (Worker requests aborted, no data written) |
| Admin smoke | run 35942408513 — 15/15: `/admin` 200 with its CSP, no framing, no-store, Phase 21 dashboard live; every admin data path 401 for anonymous and wrong-token callers; status change without credentials 401 |
| Desktop Safari 26.6.2 | run 35942408513 — 15/15, Worker proven blocked first |
| iOS Simulator Mobile Safari 26.5 (iPhone 17 Pro) | run 35942408513 — 15/15, Worker proven blocked first |
| Real VoiceOver (macOS) + Safari | run 35944167490 — 4/4: "heading level 1 اليابان", 10 level-2 section headings, Worker proven blocked. Earlier attempts failed in environment setup or never reached the page content; fixed in `871b0c6`, `7b3d337`, `66b230e` |
| iOS Simulator re-check | run 35943345397 — 15/15 (Mobile Safari launched by bundle id) |

Operator check (optional, needs the admin token or Cloudflare Access):
open `/admin`, switch to Arabic, and confirm that each figure has
«كيف يُحتسب؟», that the Questionnaire tab lists questions by their
wording with a drop-off column, and that no English code appears in the
tables.

# RC3 — `wejhaty-v1.0.0-rc3` (historical record)

## RC3.1 What it contains

RC2 plus the user's decisions of 2026-09-23:

- **"Edit my preferences" on a destination page** now returns to that
  destination with its updated Personal Match. The same button on Results
  still ends on Results.
- The production and real-Safari smoke tests also check that step.
- `read-font-license.yml`: a read-only runner job that re-reads the
  official Thmanyah license pages. The font is still not added; see U1 in
  the register.
- Docs.

Nothing else changed. Phase 14, Personal Match methodology, the Worker
and Passport (FROZEN) are as in RC2. The RC1 and RC2 branches and tags
stay untouched.

## RC3.2 User-acceptance checklist

Use the RC2.2 checklist below. It still applies unchanged, with one
addition:

4b. **Edit from a destination**: with saved preferences, open a
destination (e.g. Japan) and choose "تعديل تفضيلاتي". Change a few
answers and finish. You land back on that destination with its new
"التوافق معك" score. From Results, the same button still returns to
Results.

## RC3.3 Integrity and production verification

| Item | Value | Verified how |
|---|---|---|
| RC3 source commit | `9caa3d5bcd52fe5c3e9e1cf92bc1555c38602737` | `git rev-parse` |
| RC3 tree | `23400363306757d82b02d3e410fb5a53a21ccbf7` | `git rev-parse 9caa3d5^{tree}` |
| Branch `release/wejhaty-v1.0.0-rc3` | `9caa3d5…` | `git ls-remote` on origin |
| Tag `wejhaty-v1.0.0-rc3` | annotated tag object `9cdd83f5327460b6ae9910b6bc11ec8f1085073c` → commit `9caa3d5…` | `git ls-remote` (`^{}` peel); `create-release-tag.yml` run 35932011605 |
| RC1 tag (user decision) | `wejhaty-v1.0.0-rc1`: tag object `a75fd2c1b47287fbcd6d6b4ce83448649ce53d7f` → `38c8292…`, the RC1 branch commit | `git ls-remote`; run 35930180437 |
| RC1 / RC2 preserved | `release/wejhaty-v1.0.0-rc1` at `38c8292…`; `release/wejhaty-v1.0.0-rc2` and tag `wejhaty-v1.0.0-rc2` at `c0beb58…` (unchanged) | `git ls-remote` |
| Pages deploy | run 35931995175 (build job 107420455239, deploy job 107420595465), source `9caa3d5`: success | GitHub Actions |
| Deployed bundle | `assets/index-B1HrrLGA.js`, `assets/index-BaNVZnjM.css`, the same as a local build with the same Vite variables | smoke output and local build |
| Worker | not redeployed: no `worker/` change since RC2 (`git diff c0beb58 9caa3d5 -- worker` is empty). Version `2c26501e-8ecb-4907-9699-481d73db234d` | RC2 deploy log |
| Production smoke | run 35932067278 (dispatched on `release/wejhaty-v1.0.0-rc3`) | job logs |

Production smoke results (read-only; the Worker is blocked in the
browsers and in /etc/hosts for Safari):

- **Browsers, job 107420693800: 122/122 passed.** Engines: Playwright
  Chromium, Firefox, Linux WebKit (not Safari) and real Microsoft Edge
  152.0.4191.66. The job re-ran every RC2 check. It also checked the new
  step: "Edit my preferences" on Japan returns to `/destination/japan`,
  and the score moves 54% → 67% in every engine.
- **Worker hardening, same job: 17/17 passed.**
- **Real Safari 26.6.2 on macOS, job 107420694142: 14/14 passed.** This
  includes the new edit step.

Status: **PRODUCTION-VERIFIED** for the checks above. iOS Safari and real
screen readers stay UNVERIFIED (manual).

The commit that records this table touches documentation only and comes
after `9caa3d5`. It does not trigger a Pages or Worker deploy.

# RC2 — `wejhaty-v1.0.0-rc2` (historical record)

## RC2.1 What it contains

RC1 plus: the approved security Pass 2 fixes; the Destination Match fix
(a destination's "اكتشف مدى توافقها معك" now returns to that destination
with its Personal Match); section headings as h2 (no visual change); Explore
performance (`content-visibility`); the behavior-neutral security backlog
(constant-time digest compare, Access key cache, screenshot magic bytes,
declared-body ceilings, city-descriptions limiter); release/Safari/Edge
tooling; docs. Passport is FROZEN and unchanged. Phase 14, Country
Suitability and Personal Match (`personal-match-1.0`) are unchanged.

Snapshot: branch `release/wejhaty-v1.0.0-rc2` and annotated tag
`wejhaty-v1.0.0-rc2` (created by `create-release-tag.yml`). RC1 stays
untouched on `release/wejhaty-v1.0.0-rc1`. Exact commit, tree, deploy runs
and smoke results: RC2.4 below.

## RC2.2 User-acceptance checklist (for the user)

Each item is AWAITING USER until confirmed.

1. Home — Arabic and English, Light and Dark, phone and desktop.
2. Light/Dark switching; the phone theme menu opens inside the screen.
3. Questionnaire (a few purposes) and the general Results page.
4. **Destination match**: open a destination WITHOUT saved preferences
   (e.g. Japan) → "اكتشف مدى توافقها معك" → answer → you land back on
   that destination with "التوافق معك NN%" and its explanation. Also try a
   country that is not among your top results.
5. Personal Match on Results, Destination and Explore.
6. Explore: sorting (including personal sort), reset preferences, Surprise;
   scrolling the full list on a phone should feel lighter than before.
7. Destination pages in general.
8. Passport — regression only (no feature changes): optional step, entry
   panel for covered destinations, nothing kept after reload.
9. Contact / suggestion / problem report, and ratings.
10. Arabic and English wording; phone and desktop layouts.
11. Optional manual checks we cannot automate: iPhone Safari (home,
    destination match, Explore scroll) and a screen reader (VoiceOver or
    TalkBack: page headings list, destination sections, forms).
12. Decision: accept RC2, or list changes.

## RC2.3 Decisions the user is asked for (not implemented)

See the register in `PROJECT_STATE.md`: Thmanyah (U1), Traveler Budget
source (U5), Turnstile (U7), "Edit my preferences" return target (U10),
main-site CSP (U11), bundle lazy-loading scope (U18), Dark hero note (U19).

## RC2.4 Integrity and production verification

| Item | Value | Verified how |
|---|---|---|
| RC2 source commit | `c0beb5805c806999ef57ee6a50586b433e34fcbf` | `git rev-parse` |
| RC2 tree | `d648a0181d195dadd3fe1989264d2d114cf2932a` | `git rev-parse c0beb58^{tree}` |
| Branch `release/wejhaty-v1.0.0-rc2` | `c0beb58…` | `git ls-remote` on origin |
| Tag `wejhaty-v1.0.0-rc2` | annotated tag object `ab7f190eae3320c749ec5e6217d19f83b2c22013` → commit `c0beb58…`, tagger github-actions[bot] | `git ls-remote` (`^{}` peel) and the GitHub tag API; created by `create-release-tag.yml` run 35929296268 |
| RC1 preserved | branch `release/wejhaty-v1.0.0-rc1` still at `38c8292…` (unchanged) | `git ls-remote` |
| Pages deploy | run 35929247150 (build job 107411645020, deploy job 107411773371), source `c0beb58`: success | GitHub Actions |
| Deployed bundle | `assets/index-CLs2fRsE.js`, `assets/index-BaNVZnjM.css` — identical to a local build of `c0beb58` with the same Vite variables | smoke output and local build |
| Worker deploy | run 35929247157, source `c0beb58`: success. Version `2c26501e-8ecb-4907-9699-481d73db234d`. Bindings: D1, R2 and 4 rate limiters (events 120, ratings 10, feedback 5, city descriptions 60 per 60 s) | deploy log |
| Production smoke | run 35929343828 (dispatched on `release/wejhaty-v1.0.0-rc2`) | job logs |

Production smoke results (read-only: Worker requests blocked in the
browser; the Safari job blocks the Worker hostname in /etc/hosts):

- Browsers (job 107411955850): **114/114 passed** in Playwright Chromium,
  Firefox, WebKit (Linux WebKit — not Safari) and real Microsoft Edge
  152.0.4191.66: bundle and CSS, lazy entry snapshot without IL, "194", no
  horizontal overflow, CTA `rgb(192, 83, 44)` in AR/EN × Light/Dark ×
  390/1440 px, phone theme menu inside the viewport, Passport regression
  (partial-coverage notice, five entry rows, gone after reload, never
  stored or sent), and the destination match (Japan → questionnaire → back
  on `/destination/japan` showing "54%", no page errors).
- Worker hardening (same job): **17/17 passed** — CORS, malformed paths,
  untrusted city title, and per-address 429 with `Retry-After: 60` on
  feedback, ratings and events, with no 2xx (nothing stored).
- Real Safari 26.6.2 on macOS (job 107411956216): **11/11 passed** — home,
  "194", CTA colour, no overflow, RTL, Explore 194 cards, destination match
  back on Japan with its score, no passport data in storage.

Status: **PRODUCTION-VERIFIED** for the checks above. Not covered here:
iOS Safari and real screen readers (manual, UNVERIFIED); the new Worker
checks (body ceilings, screenshot bytes, key cache, city-descriptions
limit) are TEST-VERIFIED and deploy-verified (binding present), not
exercised against production, to avoid writing or abusing production.

The commit that records this table is documentation only and comes after
`c0beb58`, so the deploy branch head differs from the RC2 source by docs
alone; it does not trigger a Pages or Worker deploy (their path filters
cover `app/**` and `worker/**`).

# RC1 — `wejhaty-v1.0.0-rc1` (historical record)

## RC1.1 What the candidate is

- Branch `claude/marhaba-kxry8l` (deploy branch) and the snapshot branch
  `release/wejhaty-v1.0.0-rc1` at the same commit. A local tag of the same
  name exists; the Git proxy used for development refuses tag pushes, so
  the branch is the shared snapshot.
- Rollback points kept: `backup/phase18-refinement-pre-phase19` (64ea036,
  before Phase 19) and the pre-Phase-18 checkpoint (4dc8018).
- Live site: https://hmooodzozo577-gif.github.io/wej/ — Worker:
  https://wejhaty-travel-worker.hmooodzozo577.workers.dev (unchanged by
  Phase 19/20).

## RC1.2 Product freeze (20.1)

In the candidate: the Phase 14 recommendation engine and weights, Country
Suitability (7 purpose models), Phase 17 visuals, Phase 18 Personal Match
(`personal-match-1.0`), the 194-country catalog with the Israel exclusion,
Explore/Surprise/Destination pages, anonymous analytics/ratings/feedback,
and Phase 19 passport entry information (official sources, information
only). From here until acceptance, only fixes for acceptance findings and
the user-approved security Pass 2 fixes go in. Phase 21 is not started.

## RC1.3 User-acceptance checklist (20.2) — for the user

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

## RC1.4 Data verification (20.3)

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

## RC1.5 Production verification (20.4, 20.10)

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

## RC1.6 Security and privacy status (20.5)

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

## RC1.7 Accessibility sign-off (20.6)

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

## RC1.8 Performance baseline (20.7)

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

## RC1.9 Deferred register (20.12) — superseded by the register in PROJECT_STATE.md

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
