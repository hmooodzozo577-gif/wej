# Wejhaty Project State

Canonical, vendor-neutral current-state snapshot. Repository code, tests,
configuration, and current Git state outrank this document when they differ.

## State metadata

### Current verified state — 2026-09-23 (Phase 18 user-acceptance refinement)

- State document version: 35. **Phase 18 status: USER ACCEPTANCE
  REFINEMENT — READY FOR USER REVIEW** (not user-accepted). Phase 19 NOT
  STARTED. The Personal Match methodology (`personal-match-1.0`), Phase 14
  and privacy are unchanged; this round is presentation only.
- **Badges**: compact Personal Match badges show only `NN%` (no "لك");
  the accessible name/tooltip is "التوافق معك NN%" / "Personal match NN%".
  The label is "التوافق معك" / "Personal match" wherever a label is shown
  (Results ring, Destination hero chip and section, Explore note).
- **Explore**: sorts "التوافق معك: الأعلى أولًا" / "الأقل أولًا" (EN
  "Personal match: Highest first / Lowest first"); with a profile and no
  sort chosen in the visit the default is highest first
  (`AppState.exploreSortChosen`); unscored countries and hard-requirement
  misses never float up; ties keep the catalog order; nothing is hidden.
  A secondary "إعادة تعيين التفضيلات" with an inline confirmation clears
  only the profile (theme, language, filters kept), stays on Explore,
  returns a personal sort to the general default and offers "اختبر
  تفضيلاتك". The desktop toolbar gives the sort field room for its longest
  option.
- **Narrow Home Hero** (`@container hero-stage (max-width: 560px)`): its
  own composition — eyebrow above a balanced two-line headline, lead, CTA
  stack, a quiet text continuation link, then the whole compass (SVG now
  sized to its box; it used to spill 70px out of a 74px box and was
  clipped) with two orbit labels beside compact stacked stats, and a
  one-line catalog teaser; vertical scrim, one route, no inner frame.
  Frame height at 390px: 913 → 646px (AR), 957 → 672px (EN); ≥600px
  containers and the desktop Hero are unchanged. Orbit labels grow away
  from the dial, wrap to two balanced lines at most, hold still on phones
  (the needle carries the motion) and are paper pills in Light.
- Verification: 1015/1015 frontend tests (sorter over the full catalog,
  reducer sort choice, badge/sort/reset UI in AR and EN, narrow-Hero
  structure), `tsc -b`, oxlint 0, build (the existing >500 kB chunk
  warning is unchanged). Playwright acceptance matrix 648 checks × normal
  and reduced motion (AR/EN × light/dark × profile/none × 390, 430,
  800×1280, 1280×800, 1440), Phase 18 regression 226, Phase 17 regression
  120 × normal and reduced motion — 0 failures. Impeccable detector at
  390px, before vs after: the clipped-compass state is gone, the nearby
  note contrast improved (Light 1.1 → 4.4:1 median, still just under 4.5
  at pixel level), no new findings.

### Current verified state — 2026-09-23 (Phase 18 personalization)

- State document version 34 (superseded by 35 above). **Phase 18 status
  then: PERSONALIZATION READY FOR USER ACCEPTANCE.** Phase 17 final acceptance fixes are deployed
  (checkpoint below) and also await user acceptance. Phase 19 NOT STARTED —
  do not begin it without an explicit user decision.
- **What Phase 18 is**: anonymous, browser-local personalization. No
  account, no server storage, no AI, no fingerprinting. Methodology,
  formula and lifecycle: `app/src/personalization/README.md`
  (methodology version `personal-match-1.0`).
- **Three numbers, never merged**: *General suitability* ("مناسب لـ",
  Country Intelligence, unchanged) · *Phase 14 match* (candidate selection
  and baseline order, protected and unchanged) · *Personal Match*
  ("التوافق معك" / "Personal match") — how well a country fits this traveller's
  own answers. The UI always labels which one it shows.
- **Ranking relationship**: Phase 14 still scores all countries and
  selects the candidates; `refineRanking` reorders only within Phase 14's
  top 10 (eligible first → Personal Match → visa convenience → Phase 14
  score → id). No Phase 14 weight, score or test changed.
- **Profile**: `wejhaty.personalization.v1` in localStorage =
  `{schemaVersion 1, purpose, answers, path, createdAt, updatedAt}`.
  Strict validation on read (invalid → first-visit behaviour), a tested
  migration runner (`PROFILE_MIGRATIONS`, empty at v1), and graceful
  failure when storage throws or is full. Never stored: coordinates,
  passport, names or identifiers. Same browser/device only; no sync.
- **Scoring rules**: only answered questions count; "no preference" is
  neutral; data imputed in the recommendation dataset and distance
  without a shared location are *unavailable* (lower coverage, never the
  score); strength changes weight only; the land-border answer is the one
  hard constraint (fails sort last, never hidden); a neutral prior keeps
  one or two answers from ever showing a confident 100%; no evaluable
  preference → no number at all.
- **Surfaces**: Results (featured ring = Personal Match with confidence
  and the labelled general suitability beside it; secondary cards
  "NN%" badges; edit / reset / new trip; rebuilt from the profile after a
  reload), Destination ("لماذا تناسبك هذه الوجهة؟" with factors grouped
  positive / partial / weaker / not counted; without a profile the
  invitation "اكتشف مدى توافقها معك" instead of a number; "مناسب لـ"
  unchanged), Explore (per-card badge, Personal Match sorts that hide
  nothing), Surprise (random pick among the 15 best-fitting eligible
  countries with a profile, unchanged without), Home (quiet "متابعة
  بتفضيلاتي السابقة" link for a returning traveller), and a reset
  confirmation on the purpose page.
- **Controls**: edit replays the saved questionnaire with the answers
  pre-selected; reset removes only the profile key (theme, language and
  other preferences untouched); a new trip keeps the saved profile until
  a new questionnaire completes.
- Verification: 996/996 frontend tests (43 in `app/src/personalization/`,
  including a 400-profile × 194-country bounds sweep and UI tests for every
  surface with and without a profile, AR and EN), `tsc -b`, oxlint 0,
  build; Worker untouched. Playwright Phase 18 matrix — AR/EN ×
  light/dark × 390/430/800×1280/1280×800/1440 over Results, Destination
  (with and without a profile), Explore, Home and reset, plus the full
  lifecycle (quiz → save → reload → edit → new trip → reset) and a
  shared-location run proving coordinates never reach storage — 222 checks,
  0 failures, and the same 222 under reduced motion, 0 failures.
- Deployed: Phase 18 head `c305249` by GitHub Pages run `35823230980`
  (success). Production verification: EGRESS_BLOCKED — this sandbox's
  proxy refuses github.io and the Actions artifact store (HTTP 403). The
  same commit was verified on a local production build instead: the
  Phase 18 matrix above, the Phase 17 120-check matrix (0 failures), and
  an explicit location-DENIED flow (no distance question asked, Personal
  Match shown, no coordinates stored). Performance: Personal Match for all
  194 countries ≈0.55 ms; main bundle +7 KB gzip (+1.2%), CSS +0.7 KB gzip.
- Known limits: a location-based preference is unavailable after a
  reload until location is shared again (coordinates are memory-only by
  design); one profile per browser (completing a questionnaire for another
  purpose replaces it); the rollback tag is local-only (see below).

### Current verified state — 2026-09-23 (Phase 17 final acceptance fixes)

- State document version 33 (superseded by 34 above). Phase 17 status:
  FINAL ACCEPTANCE FIXES APPLIED / READY FOR USER REVIEW. This commit is
  the PRE-PHASE-18 checkpoint (see "Pre-Phase-18 rollback checkpoint" below).
- **Light Home Hero inverted, not lightened** (`[data-theme='light']` only;
  Dark unchanged): the navy scrim is replaced by a warm paper gradient
  (`rgba(242,238,229,…)`, i.e. `--paper`) rising from the TEXT side
  (inline-start: right in Arabic, left in English) plus a paper rise from
  the bottom, dissolving into the photograph. The Round 6 8px white mat,
  outline and inner orange frame are removed — no frame. Copy is ink
  (`--ink`/`--ink-2`), label/notes/stat icons stay orange (`--gold`),
  the ghost CTA and stats use light-theme borders, routes turn orange.
- **Light Destination Hero**: paper radial + bottom gradient from the
  text corner (bottom inline-start) replaces the navy scrim; ink title
  and metadata; the upper photograph is untouched. The browse/match chip
  lost its inline white style (class `detail-match-browse`) so it themes.
- **Light Results featured card** (`.top-pick`): paper surface, ink text,
  light score ring/rank badge/tags, orange CTA and top rule; the match
  percentage stays outside the image. Dark keeps the navy card.
- **Planes — full-route rule**: every plane now runs one linear
  `offset-distance: 0% → 100%` cycle of a path that begins and ends beyond
  a clipped edge; the Round 6 opacity-fade keyframes and band edge masks
  (which made planes appear mid-route) are deleted, and the Home secondary
  plane's path is written in its travel direction (no reversed keyframes).
  Paths live in `app/src/components/flightPaths.ts`; each context has its
  own composition: Explore header two wide edge-to-edge routes, Surprise
  one small plane + compass, Quiz two faint planes (both on screen at
  load via negative delays), Destination one route across the upper sky,
  How It Works / Purpose ambient swoops in the open side. Reduced motion
  stops every plane at a visible route point. BROWSER-VERIFIED by a
  25-point full-cycle audit (hidden at 0% and 100%, one contiguous
  visible run) at 1440/800/390px; TEST-VERIFIED by
  `TravelRouteDecor.test.tsx`.
- Verification: 953/953 frontend tests, `tsc -b`, oxlint 0, build;
  Playwright 120-check matrix (Home, Purpose, Explore, Quiz, Results,
  Destination × AR/EN × light/dark × 390/430/800/1280/1440) plus the same
  120 checks under reduced motion — 0 failures.

### Pre-Phase-18 rollback checkpoint

- **PRE_PHASE18_COMMIT = `4dc8018a554fb4b221e0cf0e8ae96ea18096c565`**
  (tree `37f3e390987dee7afd8929761bcc6912c816db82`), created 2026-09-23.
  This commit is the complete project immediately before Phase 18:
  Phase 17 final acceptance fixes, 953/953 frontend tests, `tsc -b` clean,
  oxlint 0, production build OK, deployed by GitHub Pages run
  `35820019442` (success).
- Preserved by:
  - remote branch `backup/phase17-final-pre-phase18` → `4dc8018…`
    (VERIFIED with `git ls-remote`).
  - annotated tag `phase17-final-pre-phase18` → `4dc8018…`, created in the
    session's clone. Pushing the tag was refused by the session's git
    proxy (HTTP 403, policy denial on tag refs), so the tag is NOT on
    GitHub yet; push it from any normal clone with
    `git push origin phase17-final-pre-phase18` (or create it in the
    GitHub UI at commit `4dc8018`). The remote branch alone is sufficient
    for the rollback below.
  Neither ref may ever be moved, amended or force-pushed. Phase 18 lives
  only in later commits on `claude/marhaba-kxry8l`.
- To remove Phase 18 completely (history-preserving, no force push):
  ```
  git fetch origin backup/phase17-final-pre-phase18 claude/marhaba-kxry8l
  git checkout claude/marhaba-kxry8l
  git restore --source=4dc8018a554fb4b221e0cf0e8ae96ea18096c565 --staged --worktree :/
  git commit -m "Rollback: remove Phase 18, restore tree to pre-Phase-18 checkpoint"
  git diff 4dc8018a554fb4b221e0cf0e8ae96ea18096c565 HEAD --stat   # must print nothing
  git push origin claude/marhaba-kxry8l                           # redeploys Pages
  ```
  (`origin/backup/phase17-final-pre-phase18` or the tag may be used in
  place of the hash; all three name the same commit.)
  `git restore` with a source also deletes files added after the
  checkpoint, so Phase 18 code, tests, docs and config all disappear —
  including this very paragraph's hash record, which is expected: the
  refs above keep the checkpoint findable forever.
- Browser storage after a rollback: Phase 18 stores the personalization
  profile in localStorage. After a rollback that key may remain in some
  users' browsers; the restored Phase 17 code never reads it, so it is
  inert. The checkpoint is not modified to clean it.

### Current verified state — 2026-09-23 (round 6, user acceptance repair)

- State document version: 32. Phase 17 status: USER ACCEPTANCE REPAIR /
  READY FOR FINAL USER REVIEW — not complete. Phase 18 NOT STARTED. Driven
  by the user's Android-tablet production screenshots (authoritative).
- **Portrait Home Hero recomposed (not scaled down).** The old fixed
  620/680/690px frame heights and the absolutely positioned compass/badge
  under `@media (max-width: 980/760/420px)` were deleted. `.home-hero-stage`
  is now a `hero-stage` inline-size container; `@container hero-stage
  (max-width: 930px)` lays the Hero out as a copy column (title, label,
  lead, CTA) plus a visual column (catalog destination card as an upright
  mini-card at the top, then the nearby note + flourish, then the centered
  compass with its orbit labels), with the stats row as the closing line.
  The third stat "أسئلة قليلة تحدد وجهتك" was NOT moved. A `≤560px` stage
  sub-layout covers phones (compact compass beside the title; side orbit
  labels hidden). BROWSER-VERIFIED 360–962px, AR/EN, light/dark: no
  element/orbit overlaps in AR, no horizontal overflow.
- **Light mode surfaces (theme-scoped `[data-theme='light']`, Dark
  unchanged — computed values re-checked identical):** Hero band
  `.home-hero-cinematic` #091827 → transparent (paper); `.home-hero-frame`
  #0b1b2a + white-alpha border → 8px `var(--white)` cream mat + warm
  outline; catalog card → paper mini-card; `.disclaimer-bar`
  ("توصيات وجهتي…") `var(--ink)` → `var(--white)` with ink text and a
  gold-tinted hairline border and gold info icon; `.footer` (the block directly
  below it, `components/layout/Footer.tsx`) `var(--ink)` → `var(--paper-3)`
  with ink text and a 2px gold top rule. The photograph and its text-side
  scrim stay dark by design.
- **Airplanes rebuilt.** Deleted: the static plane inside the site-wide
  `TravelBackdrop` SVG pattern (it tiled motionless copies across every
  page), the Purpose card-grid decor that peeked between cards, and the
  stretched `how`/`explore`/`drift` variants. Every secondary plane now uses
  one "flight band" system in `TravelRouteDecor.tsx`: a uniform-scale SVG
  (box keeps the viewBox aspect ratio, so planes are never distorted)
  placed only in open space, flying its own visible dashed route with a
  fade in/out. Variants: `band` (How-It-Works, Purpose and Explore page
  heads), `surprise`, `destination`, `quiz`, `home-portrait` (top/bottom
  margin flights that replace the landscape routes in the portrait Hero).
  Landscape Home Hero routes are unchanged (secondary plane opacity .38 →
  .6). BROWSER-VERIFIED: every visible plane moves 33–175px per 2s and is
  motionless under `prefers-reduced-motion`.
- Verification: 948/948 frontend tests, `tsc -b`, oxlint (0), production
  build; 200-combination Playwright matrix (5 pages × AR/EN × light/dark ×
  5 viewports) with zero overflow and zero stopped planes.

### Current verified state — 2026-09-22 (round 3, repair pass)

- State document version: 31. This round is a production-evidence-driven
  repair pass, triggered by real screenshots from the user's own Android
  tablet (Chrome) that surfaced defects the round-2 report had claimed as
  satisfied. Per explicit user instruction, any such gap reopened the
  underlying requirement rather than being treated as a new, separate ask.
  Phase 17 remains READY FOR USER REVIEW, not complete; Phase 18/21 remain
  NOT STARTED. Local commit `dd49023` on `claude/marhaba-kxry8l` carries
  this round's work on top of round 2's history (not amended).
- **Vertical hero tagline re-locked:** "اختر • قارن • انطلق" / "CHOOSE •
  COMPARE • GO", replacing round 1's "استكشف • احلم • اكتشف" / "EXPLORE •
  DREAM • DISCOVER" per explicit user instruction this round.
- **Fluid-first responsive principle:** the prior round's rigid
  `@media (min-width: 700px) and (max-width: 1179px)` "tablet = 3 columns"
  Explore-grid override was explicitly rejected and replaced with
  `grid-template-columns: repeat(auto-fit, minmax(236px, 1fr))` plus one
  consistent fluid card-image aspect ratio; BROWSER-VERIFIED across the
  full 320–1920px width list (natural 1→2→3→4 column progression, no
  forced jump). The same fluid-clamp principle was applied to the
  Destination-page hero (image height ceiling and heading size reduced,
  not swapped for a fixed pixel value).
- **P0 Hero scroll-return corruption (Android Chrome, user-reported):**
  remains UNREPRODUCED after 5 distinct attempts across this and the prior
  round (instant scroll, wheel+smooth-scroll, SPA navigation, and CDP
  touch-emulated swipes in both orientations, re-run again against this
  round's final build). Defensive `contain: layout paint` /
  `will-change: transform` hardening applied to `.home-hero-stage` and its
  full-bleed route decor — explicitly disclosed as unconfirmed hardening,
  not a confirmed fix. Needs the user to re-test on the real device after
  deploy.
- **Results primary card redesigned** (conic-gradient match-ring badge
  replacing the old small text pill, refined background/border) —
  secondary result cards and all scoring/ranking logic untouched.
- Two new low-contrast, slow (27s/35s, `linear`) background planes added
  behind How-It-Works, reused as ambient motion on the Purpose and Explore
  page heroes via a new `TravelRouteDecor` `"how"` variant.
- Full evidence and per-item verification detail: see this round's
  pre-push report in the session transcript rather than duplicating it
  here.

### Current verified state — 2026-09-22 (round 2)

- State document version: 30. Supersedes version 29's framing of the FINAL
  UI/UX ACCEPTANCE PASS as Home-hero-only — this round extended the same
  pass to Purpose, Quiz, Explore, Surprise, the global travel background,
  and site-wide button feedback, per explicit further user instruction in
  the same session. Phase 17 remains READY FOR USER REVIEW, not complete;
  Phase 18/21 remain NOT STARTED. Two local checkpoint commits from the
  first sub-round (`53ea04c`, `b7df189`) are preserved as history, not
  amended; this round's work is additional commit(s) on top.
- **Hero copy, locked per explicit user decision:** eyebrow is now
  "محرك توصية للسفر" (`بدون حساب` removed) / "A travel recommendation
  engine"; the third hero stat no longer shows a fabricated "0%" — it now
  reads "أسئلة قليلة تحدد وجهتك" / "A few quick questions decide your
  destination" with a sparkle icon, no numeral. "رحلتك تبدأ من هنا" and
  "وجهات أقرب إليك" are unchanged and got a stronger editorial type
  treatment (larger size, RTL Cairo at weight 600). A separate kicker line
  above the h1 ("رحلات أفضل .. لحياة أوسع") was explicitly tried and then
  explicitly rejected by the user this round — it must NOT be
  reintroduced.
- **Compass orbit badges:** now genuinely orbit — four distinct elliptical
  `@keyframes` (one per badge), staggered delays (0/1.7/3.2/4.5s) and
  durations (9–12.8s), verified via computed `animationName`/`duration`/
  `delay` in a real browser, not just CSS presence. Restyled as lightweight
  pill markers (999px radius, low-opacity navy glass, a small orange dot
  leader) rather than gray buttons. The underlying dynamic, session-stable,
  anti-repeat, evidence-backed destination pool is UNCHANGED — only visual
  treatment and motion changed. `prefers-reduced-motion: reduce` freezes
  all four (`animationName` verified `none` in a real reduced-motion
  browser context).
- **Flight routes:** the primary route's plane animates over `16s`
  (unchanged token) along an original, authored top-down silhouette
  (fuselage/wings/tail as separate subpaths, not traced from any
  reference). A second, quieter plane now also moves — `21s`, opposite
  direction, lower opacity/scale — along the route's other path, which
  was previously just a static empty dashed line. DESIGN.md's Motion
  section was updated to describe two live routes instead of one plane
  alone, per explicit user decision (documented as evidence-driven, not
  silently reinterpreted).
- **Global travel background** (`TravelBackdrop.tsx`, used app-wide via
  `RootLayout`): opacity roughly doubled (light `.055→.13`, dark
  `.075→.16`) after browser evidence confirmed the prior value was too
  faint to read as intended. Applied as one uniform bump rather than a
  fully differentiated per-section intensity system (Hero/secondary/dense
  sections) — a scope simplification, disclosed here rather than silently
  claimed as a full hierarchy implementation.
- **Light mode:** browser evidence (screenshots of Explore, Purpose, and
  Home secondary sections in light theme) showed the existing e240ecc-era
  light system already uses warm paper surfaces, dark text, and orange
  accents — genuinely distinct from dark mode, not a recolored dark theme.
  This claim in the round's brief did not match rendered reality, and per
  this session's own source-of-truth rule (rendered UI over documentation
  or claims), no light-mode card rebuild was performed. Added the one
  concretely missing piece: a thin orange gradient transition edge between
  the navy Hero and the paper page below it.
- **Density passes** (padding/min-height only, no logic changes): Purpose
  cards (`min-height` 136→108px desktop, 126→100px mobile; icon 46→38px);
  Quiz (`.quiz-wrap` bottom padding 100→56px, `.q-card` padding max
  54→36px, `.quiz-nav` margin-top 30→18px) — verified by screenshot, the
  large dead space below quiz options is gone; Explore's location-request
  card collapsed to a single compact row in its idle state (title +
  truncated explanation + button on one line) via a new
  `explore-location-card-idle` scoped class, leaving the richer
  post-grant state (nearby list) unchanged; Surprise Me strip (compass
  74→58px, image 168→132px, padding 18/22→14/20px); the Home location
  banner (padding 14/18→9/16px).
- **Explore grid:** added an explicit 700–1179px breakpoint forcing 3
  columns (was falling into a 2-column bucket below 960px and the
  desktop-default 3 only in a narrow 961–1179px gap) — verified via
  computed `gridTemplateColumns` at 900px width. Card image aspect
  narrowed to 16:9 in that band; `.dest-why` description clamp reduced
  3→2 lines; `.dest-body` padding reduced (this is a shared class, so
  Results-page cards get the same modest tightening as a side effect, not
  separately requested but not excluded either).
- **Orange signature line:** the section-heading kicker bar and the new
  Hero transition edge (above) are the two concrete instances added this
  round; deliberately not applied to every card/section per the round's
  own "don't outline everything" constraint.
- **Global button press feedback:** `.btn:active { transform: scale(.97) }`
  added — previously no button anywhere in the app had a press state
  (found during this round's design-engineering review, see below); this
  matches the existing `.purpose-card:active` precedent already in the
  codebase.
- **Design review this round:** `impeccable detect` returned zero findings
  on every touched file, both sub-rounds. `impeccable`'s own craft-floor
  check caught a real problem — a kicker line above the h1 — which was
  built, flagged, and removed within the same round (documented above).
  "Taste Skill" (named in the round's brief) does not exist in this
  environment; `emil-design-eng` — CLAUDE.md's own designated secondary
  design-engineering critique skill — was used in its place, and that
  substitution is disclosed here rather than silently assumed equivalent.
- **Verification:** frontend 948/948 (one `RootLayout.explore.test.tsx`
  timeout under full-suite parallel load, confirmed a pre-existing flake
  by passing 10/10 in isolation on the same code, not a regression);
  worker 202/202 (worker untouched this round, no worker deploy
  performed); both typechecks and oxlint clean; production build clean
  (JS gzip 617.93 kB, unchanged from baseline — the documented ~617 kB
  bundle-size warning is neither solved nor worsened this round; CSS gzip
  17.19 kB, up from 16.57 kB baseline, consistent with the CSS actually
  added). A 64-combination structural matrix (AR: small/large phone,
  tablet portrait/landscape, desktop; EN: phone/tablet/desktop; × light/
  dark theme; × Home/Purpose/Quiz/Explore) found zero horizontal overflow
  and zero clipped elements. A separate 320–2400px width sweep (a
  zoom-equivalent range, since Playwright has no native browser-zoom API)
  on the same four routes found zero horizontal overflow. Destination
  page prev/next arrows and the hybrid hero/editorial layout were
  visually confirmed intact (unchanged this round). Forms (9/10-character
  Send behavior) were not re-touched this round; their existing passing
  tests are the evidence, not a fresh re-debug, per the round's own
  instruction not to re-open a closed bug without a reproduced regression.
- Still pushed nowhere: this round's commits, like the prior sub-round's,
  remain local on `claude/marhaba-kxry8l` pending explicit push
  authorization — the session's sandboxed auto-mode classifier blocks
  `git push` to this branch (tagged "Production Deploy") without the
  user's own action, documented in the session transcript, not a choice
  made here.
- Working/deployment branch: `claude/marhaba-kxry8l`, fast-forwarded from
  `origin/claude/marhaba-kxry8l` at `e240ecc` earlier this round (a separate
  agent session's Phase 17 work, verified as a real, ancestor-preserving
  history — see the version-28 entry below for the full reconciliation
  record). This round completes the scoped "FINAL UI/UX ACCEPTANCE PASS"
  increment the user asked for on top of that baseline, against a single
  user-supplied Home hero visual reference. It does not touch Phase 17's
  "ready for review" status, does not begin Phase 18, and is not itself a
  claim that Phase 17 is complete — that remains the user's call.
- Home hero restyle against the visual reference (`app/src/routes/Home.tsx`,
  `app/src/components/TravelRouteDecor.tsx`, `app/src/styles/wejhaty.css`,
  `app/src/data/i18n/{ar,en}.ts`, `app/src/data/types.ts`):
    * The four orbiting compass-cluster destination badges now carry a small
      embedded flag chip (`FlagChip`, never emoji/remote) next to the
      country name, and gently float (a vertical `translate` oscillation,
      6.5–8.5s, staggered per node) with `prefers-reduced-motion: reduce`
      disabling the animation. The underlying selection mechanism —
      session-stable, evidence-backed pool, cross-session anti-repeat,
      featured destination excluded — is UNCHANGED; only the badges' visual
      treatment changed. The reference image's fixed Saudi/Italy/Thailand/
      UAE badge set was NOT adopted (visual examples only, per explicit user
      decision) — the dynamic pool stays authoritative.
    * A low-contrast bilingual vertical decorative flourish ("استكشف • احلم
      • اكتشف" / "EXPLORE • DREAM • DISCOVER", localized by active language)
      sits beside the compass cluster on desktop, hidden below the existing
      980px single-column breakpoint, `aria-hidden`. Positioned with `top` +
      explicit `dir`-gated `left`/`right` rather than logical
      `inset-inline-*`, which resolves against an element's OWN
      writing-mode (`vertical-rl` here) rather than the physical direction
      the reader expects — using it first collapsed the tagline to a
      ~16×45px box in the wrong place before this was found and fixed.
    * Hero CTA buttons gained icons (arrow on the secondary action; the
      primary compass icon already existed); the 3 hero stats gained
      leading icons (globe/briefcase/shield); the destination badge gained a
      small map-pin icon before the destination name.
    * H1 copy updated to match the reference ("اكتشف وجهتك القادمة" /
      "Discover your next destination"). The reference's separate kicker
      line ABOVE the headline was built, then REMOVED after the
      `impeccable` craft-floor check flagged it as an explicit, brief-proof
      ban ("a kicker or eyebrow above a heading... no brief earns it back");
      the existing eyebrow-BELOW-h1 subhead line was left as-is.
    * The route plane silhouette was redrawn as an original, simplified
      top-down airplane (fuselage/wings/tail as separate subpaths in one
      `d`, authored for this project, not traced from the reference icon),
      plus a second, quieter, static (non-animated) plane on the route's
      second path — DESIGN.md reserves the travel-slow animation for one
      plane only.
    * Explicitly OUT of scope, per user decision when shown the reference
      and asked directly: no "من نحن" (About) nav item, no search icon —
      neither exists as a real feature and DESIGN.md's own rule against
      implying an inactive feature is active rules out a non-functional
      placeholder.
  Verified: `impeccable detect` clean on the changed files; `Home.stats.test.tsx`
  (2 new tests — flag chip present and matched per badge, vertical tagline
  localized/`aria-hidden`); full frontend suite 948/948; worker suite
  202/202; both typechecks; oxlint; frontend build; worker `wrangler deploy
  --dry-run`; a Playwright matrix across AR/EN × light/dark × desktop/
  tablet/mobile (6 combinations) plus a `prefers-reduced-motion: reduce`
  pass, all clean — badge/flag count, tagline visibility and localization,
  CTA/stat icon presence, destination-badge pin, and keyboard focus outline
  verified in every combination.

### Current verified state — 2026-09-20

- State document version: 28.
- Working/deployment branch: `claude/marhaba-kxry8l`. The pre-resume local
  work was preserved separately at local branch
  `codex/pre-resume-backup-20260919` before this branch was fast-forwarded to
  the current remote history.
- Phase 16 (AI) remains CANCELLED/SKIPPED. Phase 17 — UI/UX Evolution's final
  acceptance implementation and the approved Destination-page hybrid-design
  follow-up are IMPLEMENTED, TESTED, DEPLOYED, and PRODUCTION-VERIFIED. Phase
  17 is READY FOR USER REVIEW, not phase-complete; final user acceptance
  remains pending. Phase 18 and Phase 21 remain NOT STARTED.
- The final acceptance pass reproduced concrete Contact/Suggestion/Report UI
  defects: Footer's white text leaked into the light paper dialog, making
  labels and success copy effectively invisible; the 10-character requirement
  disabled Send without explaining why; and two native clicks in one browser
  task could both pass React's pre-render `saving` state and issue duplicate
  requests. The dialog now owns semantic theme colors, explains the minimum,
  traps focus, localizes its image picker, and uses a synchronous ref lock in
  addition to the rendered disabled state. The exact cause in the user's older
  session remains UNKNOWN; Turnstile was inactive and is not claimed as that
  cause. Fresh post-fix production UI submissions each issued exactly one
  request, returned HTTP 201, and rendered references: Arabic/mobile Suggestion
  `WJH-20260920-573978`, English/desktop Site bug `WJH-20260920-2A516D`, and
  Arabic/tablet general Contact (`other`) `WJH-20260920-2E4C8B`. A browser-level
  forced network failure preserved the entered text and announced the error.
  The current form path is PRODUCTION-VERIFIED; user acceptance remains pending.
- The selected identity is **Cinematic Compass Atlas / أطلس البوصلة
  السينمائي**: verified destination photography, a modern compass and quiet
  route cartography, ink/navy and warm paper grounds, restrained orange
  wayfinding, and evidence-first information layouts. `PRODUCT.md` records
  product truth; `DESIGN.md` and `.impeccable/design.json` record the built
  system.
- Phase 17 covers the shared shell and visual system plus Home, Purpose/Quiz,
  Results, Explore, Destination, forms, async states, light/dark/system themes,
  and responsive AR/EN layouts. Home selects one eligible hero destination per
  browser session from the sourced/editorially-ready pool, keeps it stable
  across navigation/language/theme, and avoids recent choices. Four additional
  unique labels are selected from the same pool for the compass, exclude the
  featured destination, stay stable in-session, and keep an eight-country
  cross-session anti-repeat history. The locked journey/nearby microcopy is
  integrated around the primary action and compass. The 16-second plane follows
  a long curved route on a layer outside the clipped photograph; a sparse
  theme-aware route pattern continues across public pages. Reduced motion
  freezes continuous flight while retaining the route. IL/ISR stays excluded;
  Monaco remains valid.
- The page contains exactly one `مناسب لـ / Suitable for` section above
  Additional information. It shows only the highest-rated eligible purpose by
  default; an accessible 44px Show more/less control exposes the remaining
  purposes in the existing deterministic descending order. Percentages,
  confidence, insufficient-data behavior, methodology details, and sources are
  preserved. Results and destination rating surfaces are compact without
  removing validation, submission, success, or failure behavior.
- Final acceptance-pass local verification: frontend 946/946 tests pass;
  frontend TypeScript and oxlint are clean and the production build passes.
  Worker code did not change, so its previously verified 202/202 suite was not
  rerun and no Worker deployment was performed. No runtime dependency was
  added. The final build reports 16.33 kB gzip CSS and 617.77 kB gzip for the
  primary JS chunk, +1.65 kB and +1.39 kB respectively against the prior
  documented build. Independent Impeccable then Taste review returned `ship`
  with no P0/P1/P2 findings after the focus, orbit-label, motif-density, file
  input, and touch-target repair round.
- Fresh production Playwright acceptance verified AR/EN, RTL/LTR, dark/light/
  system themes, 390px and 430px phones, 820px portrait tablet, 1180px landscape
  tablet, and desktop with zero horizontal overflow or Hero title/orbit overlap.
  Zoom-equivalent 100/90/80/75/67/50% viewports kept both CTA and compass inside
  the stable 610px desktop frame. The plane moved 377px in 4.1 seconds and its
  route layer extended above and below the photograph. Purpose/Quiz, all 194
  Explore cards, compact Surprise, and protected previous/next destination
  arrows worked. Reduced motion froze the plane at a visible route point. The
  production Hero decoded a 1240×607 eager high-priority WebP. Headless lab
  observation measured LCP 348ms and CLS 0.022; these are test-session values,
  not field performance claims.
- No recommendation scoring, question branching, geolocation behavior,
  privacy rules, country exclusion, or provider logic changed. Worker city
  narrative output is now limited to two complete sentences/280 characters,
  with the frontend applying the same bound to old cached responses.
  Turnstile remains intentionally inactive. AI remains absent; fabricated
  visa difficulty, Traveler Budget, and fabricated prices remain prohibited.
  `VISA_RESEARCH.md` records that a global verified visa answer still requires
  a provider contract or maintained official-source registry.
- The pre-Phase-17 acceptance baseline is USER-VERIFIED: the same physical
  tablet location retest succeeded; Contact, Suggestion, and Report persist to
  D1 in production; verified Arabic city descriptions render with attribution.
- Latest frontend delivery commits: `abfa58b` (visual acceptance pass) and
  `0c670d8` (same-task feedback duplicate lock) on
  `claude/marhaba-kxry8l`. GitHub Pages workflow runs `35489324874` and
  `35489751480` both concluded success; the latter is the production-verified
  build. Worker code did not change, so no Worker deployment was required.
  Final USER ACCEPTANCE remains pending; Phase 17 is not closed.

### Historical implementation notes

- State document version: 20
- Last verified date: 2026-09-17. This entry adds a SECOND PRE-PHASE-17
  ACCEPTANCE round, against a fresh batch of production reports found
  after deploying the round below. Phase 17 is still NOT started.
  1. A prior round MISREAD "move the suitability card above Additional
     information" as "add a new standalone summary card" — that new
     `CountryBestSuitedFor` / "الأنسب لـ" card is DELETED (component, i18n
     keys, CSS, tests), not hidden. The ORIGINAL `CountrySuitability` /
     "مناسب لـ" full per-purpose card (descending order, "لماذا هذه
     النسبة؟" localization all preserved unchanged) is what now renders
     above "Additional information" instead. Exactly one suitability
     section exists on the page again.
  2. Explore showed TWO location-request surfaces stacked on one page:
     the app-wide `LocationIntro` (mounted for every route in
     `RootLayout`) and Explore's own `LocationPersonalize`. `RootLayout`
     now excludes `LocationIntro` specifically on `/explore`, since
     Explore already owns a full location surface; every other route is
     unaffected. Regression test renders the real route tree and counts
     CTAs across idle/requesting/granted/denied/unavailable.
  3. Tablet location failure: reviewed the full platform-independent
     geolocation state machine (`geo/geolocation.ts`,
     `geo/permissionsApi.ts`, `LocationPersonalize.tsx`) — no device-based
     branching exists anywhere, and denied/timeout/unavailable/unsupported
     are already distinctly messaged with retry where retry can help.
     Added explicit tests for "approximate succeeds, precise never
     attempted" and viewport-independence. A real Android tablet
     permission prompt could not be reproduced in this environment; the
     divergence from phone behavior is most likely real device
     hardware/OS GPS-assist differences, not a code defect — unverified
     either way from here.
  4. City descriptions still only showed the honest fallback in
     production despite the prior round's coordinate-key fix (which
     remains correct and deployed). Full path re-diagnosed
     (frontend -> Worker -> Wikipedia REST -> D1 cache -> render); no
     further structural bug found, but `FETCH_TIMEOUT_MS` in
     `worker/src/cityDescriptions.ts` was the shortest timeout of any
     outbound call in the whole system (6000ms vs. 9000ms everywhere
     else) for the ONE call that's a real third-party network request —
     raised to 9000ms to match. This sandbox cannot reach either the
     deployed Worker or Wikipedia directly (egress policy blocks both, as
     it did for the prior round's diagnosis), so production reachability
     is still NOT independently verified — this is NOT reported as fixed;
     see the round's own report for the exact next step.
  5. Contact/Suggestion Submit: reviewed `useTurnstile`/`FeedbackDialog`
     end to end; the previously-fixed "disabled forever" bug is still
     correctly fixed. Found and closed one real gap against the required
     state table: while the challenge is loading (required, not yet
     solved, not yet failed), NOTHING was shown at all — the empty
     `.turnstile-slot` has zero height until the widget renders, so Submit
     being disabled during that window had no explanation. Added a
     neutral "verifying" hint, distinct from the existing failed/retry
     message, which is unchanged. External Cloudflare Turnstile
     configuration (site key/secret pairing, allowed hostnames) could not
     be verified from here — if Submit still fails after this deploy, that
     is the next thing to check.
  Re-verified unaffected by any of the above: Nearest-to-me exclusion,
  Arabic "لماذا هذه النسبة؟" localization, descending purpose ordering,
  the geolocation/quiz race bounded wait, Phase 14 weights baseline (9/9),
  AI absence, visa `unknown` status, Traveler Budget BLOCKED/DEFERRED.
  921 frontend tests (was 909), 197 worker tests (unchanged), typecheck/
  lint clean on both, production build clean, wrangler dry-run clean, a
  Playwright sweep of the Japan country page (AR/EN x desktop/mobile),
  Explore (idle location state, exactly one CTA), and the Contact form
  (preserves text + shows an accessible error on a failed local submit)
  all at 0 findings.
- PRIOR ROUND, same day: a first PRE-PHASE-17 ACCEPTANCE-FIX round, run
  against direct production user reports, on top of the AI-cleanup round
  recorded further down this file. Seven issues were fixed:
  1. Nearest-to-me still showed the traveller's own current country in
     production. Root cause: `exploreCatalog.ts`'s `sortCatalog()` derived
     "current country" via `approximateCountryOf()` (nearest-CENTROID-only —
     the same technique already proven unreliable elsewhere in this
     codebase, e.g. Abha resolving to Eritrea), instead of the accurate
     boundary-polygon `resolveCurrentCountry()` already used by
     LocationPersonalize/TravelInfo/resolveTravelRequest. Proven with real
     coordinates: Dammam, Saudi Arabia resolved via centroid to Bahrain
     (66km), so Saudi Arabia was never excluded. Fixed by having
     `sortCatalog()` accept an already-resolved country code from its
     caller instead of deriving one itself; `Explore.tsx` resolves it via a
     new `useResolvedCountryCode()` hook wrapping the SAME accurate
     resolver. Unresolved/uncertain status means no exclusion, never a
     guess. Excludes from Nearest-to-me only; Search/Explorer/direct page
     unaffected.
  2. "Best suited for" is now its own top-level `.detail-card`
     (`CountryBestSuitedFor`), rendered immediately above the "Additional
     information" toggle on both the basic-country and editorial branches
     of `Destination.tsx`, instead of living inside that collapsed toggle
     alongside `CountrySuitability`'s full per-purpose list. No page
     redesign; same `.detail-card` visual convention every other section
     already uses.
  3. The full per-purpose "Suitable for" list was in fixed methodology
     order, not score order. `CountrySuitability.tsx` now renders it via
     `bestSuitedFor(entries).ranked` (already descending, insufficient-data
     last); `bestSuitedFor.ts` gained an explicit, documented tie-break for
     equal scores (higher confidence, then alphabetical purpose id).
  4. "Why this score?" leaked English factor names ("Safety",
     "Affordability", …) in Arabic mode — they came from the Worker's
     English-only `component.label`, which has no lang parameter at all.
     Fixed with a deterministic `factorLabels` EN/AR dictionary in
     `data/i18n/{en,ar}.ts`, keyed `purpose:factorKey` (the same factor key
     carries a different English label depending on which purpose
     methodology defines it), with full-coverage and no-cross-language-leak
     regression tests. No AI-generated text.
  5. City description paragraphs were missing for real cities. Root cause
     (found and fixed, not rebuilt): `generate-featured-cities.mjs`'s own
     `normalize()` dropped diacritics ("Zürich" -> "zrich") instead of
     transliterating them like the Worker's `normalizeCityKey()` does
     ("Zürich" -> "zurich"), so the coordinate-index key the generator
     wrote for any accented city name never matched what the Worker looked
     up — the description silently never fetched, and the same mismatch
     also broke same-city dedup (e.g. "Bogotá" and "Bogota" both listed)
     and capital-row matching. Fixed with one shared `cityKey.mjs` algorithm
     the generator now uses, matching the Worker's; both artifacts
     regenerated. Also added an honest "no verified description yet"
     fallback state (previously: nothing rendered at all when a
     description was unavailable) — never invented prose.
  6. Visa/passport documentation corrected from "PROVIDER ACCOUNT/
     CREDENTIALS REQUIRED" to "PROVIDER ACCESS REQUESTED — AWAITING
     VERIFIED TRAVEL REQUIREMENTS API CREDENTIALS", reflecting that the
     user has requested Sherpa API access and created a VisaHQ Business
     Portal account, with neither yet producing a verified working
     credential. No VisaHQ or Sherpa integration exists in this codebase;
     visa status stays `unknown` everywhere until one does.
  7. Geolocation race hardening (bounded wait in Quiz.tsx) was re-verified,
     not redesigned — no real defect found. All scenarios (immediate
     bounded wait, slow-but-successful resolution, timeout fallback, fast
     grant, denied, unavailable, no duplicate request, AR+EN copy) still
     pass.
  Also audited: no AI code/config/UI/secret has returned; Phase 14 weights
  baseline (9/9) unchanged; Admin auth unchanged; analytics privacy guard
  (forbidding lat/lng/coordinates/ip/fingerprint) unchanged; no passport
  number collected anywhere. Known deferred items (Admin manual acceptance
  checks, Traveler Budget 13.5c BLOCKED/DEFERRED, visa provider awaiting
  credentials, Country Intelligence source-expansion honestly incomplete)
  were left as-is, not reopened. Verified: 909 frontend tests (up from
  855), 197 worker tests (up from 180), TypeScript and oxlint clean on
  both, frontend production build, worker `wrangler deploy --dry-run`, and
  a Playwright sweep of the Japan country page (AR/EN x desktop/mobile,
  language switch verified via `document.documentElement.lang`,
  Best-suited-for placement, real descending scores, no horizontal
  overflow), the Arabic "Why this score?" panel, Explorer's nearest-to-me
  flow, and the Quiz entry path with geolocation left pending — all at 0
  findings. The city-description Wikipedia fetch itself cannot be
  exercised from this sandbox (egress to Wikipedia is blocked here, same
  constraint as previous rounds), so that layer's live behavior is proven
  by the Worker-side unit/contract tests plus the local honest-fallback
  render, not a live browser fetch.
- Working branch: `claude/modest-cray-34bvoa`. See Git log for the exact
  HEAD — this document does not hardcode a commit it is itself part of.
- DEPLOYMENT STATUS, 2026-09-17 (second acceptance round, this entry):
  pending this round's own deployment — see "Roadmap gate and immediate
  backlog" / the round's own report for exact commit and run IDs once
  pushed.
- DEPLOYMENT STATUS, 2026-09-17 (first acceptance round, prior entry):
  DEPLOYED.
  `claude/marhaba-kxry8l` merged `claude/modest-cray-34bvoa` at commit
  `7732ac0` via merge commit `1bbb719` (a real merge, not a history
  rewrite — verified first that `marhaba-kxry8l`'s only commit beyond the
  common ancestor was content-identical to one already on
  `modest-cray-34bvoa`, so nothing was lost) and pushed. Both workflows
  ran on that push and both concluded `success`:
  `deploy-worker.yml` run 35277692370 and `deploy-pages.yml` run
  35277692256, both on commit `1bbb719f82cac38cfbbb8fcc78752595de1a082f`.
- Previous production frontend commit: `f60efd93`
- Production Worker source commit: `077d76a5` — DEPLOYED 2026-09-16 from run
  35154518086 (Version ID `365c337c-7327-4559-baf6-e3f293a3349a`).
  **This run's overall conclusion is `success` — the first fully-green
  Worker deploy in this project's history.** The "Diagnose Cloudflare token
  capability" step, freshly measured on THIS run, now reads `OK` on all
  four checks (identity, Workers, D1, R2) where the prior round read
  `FAILED` on D1 and R2 with `Authentication error [code: 10000]`. The
  account/token permission gap is CLOSED — not something this round set out
  to fix; it was discovered as a side effect of deploying the admin
  language-switcher change and is recorded here rather than left buried in
  a deploy log. The Worker's own log confirms both bindings are live:
  `env.PRODUCT_DB (wejhaty-product-data)` D1 Database and
  `env.FEEDBACK_SCREENSHOTS (wejhaty-feedback-screenshots)` R2 Bucket.
  Migrations reported "No migrations to apply" (they were already current —
  applied in an earlier retried run, `deploy-worker.yml` run 35127073171,
  attempt 4, which also concluded `success`). The R2 bucket already existed
  and is owned by this account.
  **What is confirmed:** the bindings exist and the Worker deployed with
  them. **What is NOT independently verified in this round:** an actual
  end-to-end write (submitting a real rating/report against the live API
  and confirming a row lands in D1) — that is application-level
  verification, out of scope for "add a language switcher only", and should
  be the next thing checked before calling persistence production-accepted.
- Production FRONTEND commit: `077d76a5` — DEPLOYED 2026-09-16 from Pages run
  35154518098 (`build` success, `deploy` success, environment URL
  `https://hmooodzozo577-gif.github.io/wej/`). The Pages
  environment-protection blocker was cleared on 2026-09-16 by
  fast-forwarding `claude/marhaba-kxry8l`, the branch the environment
  permits; every deploy since has gone through its push trigger normally.
- Git state re-verified directly before writing this: working tree clean, no
  merge/rebase in progress; `origin/claude/modest-cray-34bvoa` and
  `origin/claude/marhaba-kxry8l` hold the same commit.
- ACCEPTANCE STATE, 2026-09-16 (second round). The user re-tested the
  deployed build and said "the rest is fine" apart from six findings.

  USER ACCEPTED (the user's own words, on the build they tested — everything
  outside the six findings below):
    * the deterministic questionnaire and its per-purpose dimensions
    * the custom listbox replacing native selects, and the theme control
    * Latin digits throughout
    * two-stage geolocation, nearest/farthest, and location-gated questions
    * "Why this suits you" in the traveller's own language
    * hero previous/next controls living inside the hero image
    * the structured per-city facts
    * the results and per-destination rating FORMS (their submission is a
      separate matter — see below)
  NOT accepted, because it has not been retested: all six findings of this
  round. NOT accepted, because it is external-state blocked: visa
  personalization. NOT accepted, because it has never succeeded: feedback
  persistence.

- THE SIX FINDINGS, and what happened to each:
  1. Arabic sort label. The reported string "الأقرب إلى موقعى" does NOT exist
     in this repository and never has — `sortNearest` has read "الأقرب إلى
     موقعي" since 1cec937, in every deployed commit. A real inconsistency in
     the same pair was found and fixed, and a test now guards the whole
     ya/alef-maqsura class across every Arabic string.
  2. Hero previous/next labels: SHIPPED at >=900px as a floating caption
     above the arrow, after measurement showed an expanding pill collides
     with the country title at every width. Below 900px the label is not
     rendered. See the Hero navigation section.
  3. City descriptions: IMPLEMENTED as a Worker service against Wikipedia's
     REST API with a coordinate-match guard, cached in D1. Coverage in
     production is unknown until deployed and is reported by the dashboard,
     not estimated. See /CITY_DESCRIPTIONS.md.
  4. Surprise Me: RESTORED to the pre-compass flag reel, recovered from Git.
  5. Passport explanation: REWRITTEN, and now driven by a real provider-status
     endpoint so it cannot claim an effect it does not have.
  6. Rating persistence: still blocked on D1. The error the user saw is
     correct and is NOT hidden.

- TWO external dependencies remain. Neither is a code defect and neither may
  be worked around unofficially:
  1. Cloudflare D1/R2 (`Authentication error [code: 10000]` as of the last
     deploy). The workflow now prints a per-capability diagnostic so a repeat
     failure names the missing permission — see SECRETS.md.
  2. A visa-data provider account. Re-checked 2026-09-16: every provider host
     is refused at the agent egress proxy, so the API contract could not be
     re-read and is not being guessed. The user has since requested Sherpa
     API access and created a VisaHQ Business Portal account, pursuing real
     Travel Requirements API access through both — neither has yet produced
     a verified, working credential, and no VisaHQ (or Sherpa) integration
     exists in this codebase. See /VISA_PROVIDERS.md.
  The third (GitHub Pages environment protection) was cleared on 2026-09-16.

Always recover with `git branch --show-current`, `git status --short`,
`git fetch origin`, and `git log --oneline -30`.

## Product

Wejhaty (وجهتي) is a bilingual, no-login destination discovery and
recommendation app. Arabic is the default language; English is supported. The
React/Vite frontend deploys to GitHub Pages. A separate Cloudflare Worker hosts
server-side travel-provider integrations.

## Non-negotiable product rules

- Phase 14 is the deterministic final ranking authority. Questionnaire code may
  choose which supported question to ask next but may not invent scores,
  dimensions, or weights. The visa layer is not an exception: it lives outside
  the engine, changes no weight and no match score, and may only reorder
  destinations whose Phase 14 scores are already within 3 points of each
  other (see Passport and visa system). The Phase 18 Personal Match layer
  (`app/src/personalization/`) is likewise outside the engine: it changes no
  Phase 14 weight or score and only reorders within Phase 14's top 10
  candidates; its number is always labelled apart from general suitability.
- Israel (`IL`/`ISR`) is excluded from every effective catalog, routing,
  search, recommendation, image, and calculation path. Monaco (`MC`/`MCO`) is
  valid.
- Never fabricate flight prices, hotel prices, availability, inventory, or
  traveler budgets. Real provider prices and estimates must stay distinct.
- Never infer religion, ethnicity, politics, values, or cultural adaptability
  from location, nationality, language, or locale.
- Location and passport are different concepts and must never be conflated.
  Location (from the browser, always optional) answers "where is the traveller
  now" and drives proximity, land-border adjacency, and nearest/farthest.
  Passport (self-reported, optional, skippable) answers "what travel document
  will they travel on" and drives entry requirements only. Neither is ever
  inferred from the other: a Saudi passport holder currently in Germany is not
  a German passport holder. Only a passport COUNTRY is ever collected — never
  a passport number.
- Never fabricate a visa or entry-requirement claim. Two distinct things now
  exist and must not be confused:
  (a) the editorial easy/medium/hard visa label on a destination page, which
      is a general reference and must stay explicitly disclosed as not
      personalized to the viewer;
  (b) a passport-specific entry requirement, which may ONLY be shown when a
      real provider returned it, and only alongside that provider's name and
      a check date. With no provider configured the honest answer is
      "unknown", and that is what the system returns. Scraped or unofficial
      passport-index datasets are not an acceptable source.
- Precise coordinates remain in memory only and are not sent to external
  recommendation services, and are never exposed or transmitted beyond what a
  feature actually needs.
- Secrets never belong in the frontend or a `VITE_*` value.
- Preserve accepted destination and questionnaire layouts unless the user asks
  for a design change.
- `PROJECT_STATE.md` is the canonical current-state memory for this project.
  When it conflicts with current Git/code, current repository evidence wins
  and this file must be corrected, not the other way around.

## Current product decision: no AI

The user rejected the AI interview and AI explanations because their questions
and results were not practical or convincing. The current local implementation
removes natural-language interpretation, AI-generated turns, AI explanations,
frontend AI/profile orchestration, Worker `/api/ai/*` routes and provider
code, the `env.AI`/`ANTHROPIC_API_KEY` binding, and AI deployment
variables/smoke tests.

Do not restore an AI or Hybrid interview unless the user explicitly reverses
this decision.

CORRECTED, 2026-09-17: an earlier round of this document briefly recorded
Phase 16 ("AI API Integration") as an active feature — a grounded AI
explanation layer was implemented (Worker provider, endpoint, frontend
panel, admin observability) because the roadmap still carried Phase 16
under that name. This was a mistake: the standing "no AI" decision above
was never reversed. The user has since clarified the product decision:

**Phase 16 — AI API Integration: CANCELLED / SKIPPED by product decision.**
Every AI/Anthropic code path, document, translation string, admin panel,
and test added for that attempt has been removed in the same round this
correction was written. No AI provider is configured, no AI API credential
(`ANTHROPIC_API_KEY` or otherwise) is required by anything in this
repository, and no AI functionality ships anywhere in the product. See
"Phase 16 — AI API Integration" below for the roadmap record, and
"Roadmap gate and immediate backlog" for what comes next (Phase 17).

## Questionnaire and ranking

- Phase 14 remains the deterministic ranking authority and scores all 194
  effective countries through a separate worldwide recommendation-profile
  layer. AI does not select questions, create fields, score, or explain.
- The questionnaire is deterministic and answer-driven. Each purpose declares
  its OWN ordered dimension list and its OWN wording for every dimension;
  there is no shared default bank. A real journey asks at most ten questions
  and resolves each canonical dimension once.
- Per-purpose dimensions (2026-09-16 audit). Coastal, island and tourism
  popularity are NOT asked for work, education, medical or investment — those
  questions cannot earn their place when choosing where to study, work, be
  treated or invest. Immigration keeps the coastal preference (a real question
  about somewhere to live) but not the island one. The dimensions removed were
  replaced by relevant ones drawn from indicator data the engine already has
  (job opportunities and economic growth for work; education indicators and
  post-graduation opportunities for education; health-system and income
  indicators for medical), so every purpose still has at least eight scored
  dimensions. A question's profileKey is unique within its purpose, which is
  enforced structurally — a previous build had a tourism question that could
  never be reached or scored because it duplicated an already-asked dimension.
- Location-dependent questions (proximity, land travel) are asked ONLY when
  there is real location context. Without it they are absent from the bank
  entirely, and if location is later lost, both the answers and the asked-path
  entries are dropped rather than surviving as stale preferences.
- Region, subregion, latitude/longitude band, and compass-direction questions
  are absent.
- The optional land-travel question narrows ranked candidates to countries
  sharing a direct land border with the nearest-centroid-resolved current
  country (an approximation, the same technique as the nearby-country
  feature); it never claims open crossings, visa eligibility, or a currently
  drivable route, and it falls back to the unfiltered catalog rather than ever
  returning zero results (e.g. an island nation with no land borders).
- "Why this suits you" is written in the traveller's own words, not in engine
  terminology. It is built deterministically from the chain: the answer, its
  canonical meaning, the destination's real profile value, then a match or a
  trade-off. The option label the traveller picked is quoted back; a trade-off
  names the real DIRECTION of the gap, computed from the profile. Two to four
  matched factors are named, and one trade-off only when a genuinely weak
  answered factor exists. Arabic uses a nominal clause so it cannot disagree
  in gender with any of 194 country names. Nothing claims a perfect or
  guaranteed fit, and no factor is named that was not actually answered and
  actually scored.
- Selecting an option advances automatically. A brief transition indicates that
  the next question is being prepared.
- After five answered questions, the traveler may show results now or continue
  answering to improve the result.
- The passport question is the LAST step of the questionnaire, immediately
  before the results transition — never a card below the results, where it
  could not affect them. It is optional and skippable, and skipping clears any
  earlier choice rather than quietly keeping it.
- Back remains available. Changing an earlier answer truncates stale downstream
  answers and recomputes the branch.
- Budget options retain the canonical approximate numeric SAR ranges. Only the
  question stem varies by purpose.
- Ranking inputs use the committed World Bank indicator snapshot, existing
  World Bank price-level snapshot, UN Tourism/OWID arrivals snapshot, and
  country geography. Missing numeric observations use the worldwide median,
  with direct coverage and imputed dimensions recorded and disclosed.
- Every country has a tested ideal answer profile that places it in the top
  five for at least one purpose. A fixed 40,000-path deterministic sample
  (5,000 per purpose, fixed seed, so it never flakes) additionally requires
  every one of the 194 to appear at least once; this proves tested
  reachability, not equal appearance frequency.
- If the traveler explicitly shared location, distance breaks exact score ties
  only. It does not change match scores, and the Results page displays a note
  when the proximity tie-break is used.
- Latest full frontend verification: 718/718 tests passed in one complete run
  (2026-09-16). TypeScript, oxlint, and the production build pass.

### Current recommendation limitation

All 194 countries are recommendation candidates, but the source datasets are
not complete for every indicator. Missing observations are median-imputed and
disclosed, so a match percentage is an estimate rather than a guarantee. The
40,000-path test is broad deterministic coverage, not an exhaustive
enumeration of the questionnaire's combinatorial answer space.

## Passport and visa system

- The traveller may optionally name the PASSPORT they would travel with. Only
  the passport COUNTRY is collected; no passport number is asked for, stored,
  or representable anywhere in the request shape.
- The recommendation engine never talks to a visa vendor. It talks to
  `VisaRequirementsProvider` (`worker/src/visa.ts`), which returns Wejhaty's
  own canonical vocabulary: `visaFree`, `visaOnArrival`, `eVisa`,
  `authorizationRequired`, `embassyVisaRequired`, `unknown`.
- Provider research and the decision record are in `/VISA_PROVIDERS.md`. IATA
  Timatic/AutoCheck, VisaHQ and Sherpa were evaluated; all three require a
  commercial account, partnership or approved key. Scraped "passport index"
  datasets were evaluated and REJECTED as unofficial and unverifiable. Sherpa
  is the chosen first adapter.
- With no provider configured — today's state — every lookup answers
  `unknown`, the UI says the visa service is not enabled, and ranking is
  unaffected. Provider failure, timeout, non-2xx and malformed JSON all
  resolve to `unknown`. There is no fabricated fallback anywhere in the path.
- `GET /api/visa/status` reports only whether a provider is configured, so
  the PASSPORT STEP can tell the traveller the truth before they answer —
  it has no destination yet and so cannot learn it from a lookup. It fails
  closed: any error, any missing Worker, any non-200 means "not active". The
  step's copy switches by itself the moment a provider key exists.
- The passport explanation (acceptance item #5) says, in this order: what the
  answer is FOR (entry and visa requirements), that it is NOT the traveller's
  location and neither is inferred from the other, what it does to the results
  TODAY (nothing, because no provider is live), and that no passport number is
  ever asked for. A test asserts all five points survive in both languages and
  that nothing shown today claims an effect on ordering.
- PROVIDER MAPPING IS UNVERIFIED and is not claimed otherwise. Every provider
  host is refused at the agent egress proxy, so the adapter has never run
  against a real response. `worker/src/visa.contract.test.ts` asserts what IS
  verifiable (no credentials -> `unknown` everywhere; an unrecognised value ->
  `unknown`; a drifted shape neither throws nor invents) and states the
  unverified status as an assertion. Dropping one real sandbox response per
  category into `worker/fixtures/sherpa/` turns it into a real mapping test.
- RANKING BOUNDARY, deliberately narrow: the visa layer is outside the engine.
  It changes no Phase 14 weight, dimension or semantic, and no match score —
  the percentage shown is identical with and without a passport. It may only
  reorder destinations whose Phase 14 scores are already within 3 points of
  each other, so a materially better match can never be pushed below a
  materially worse one. Without a passport, or for an `unknown` requirement,
  it does nothing at all.
- A score-blending design (adding a visa term to the weighted total) would be
  a Phase 14 weight change and is deliberately NOT implemented. It is the one
  open product decision from this round: see Roadmap gate.
- Display always carries the provider name and the check date, plus a standing
  caveat that requirements change and must be re-checked before booking.
  Nothing promises entry, visa approval, an open border, or legal eligibility
  beyond what the provider returned.
- Status: `PROVIDER ACCESS REQUESTED — AWAITING VERIFIED TRAVEL REQUIREMENTS
  API CREDENTIALS`. The user has requested Sherpa API access and created a
  VisaHQ Business Portal account; neither has yet produced a verified,
  working credential. No VisaHQ or Sherpa integration exists yet — see
  /VISA_PROVIDERS.md.

## Country pages and optional information

- All 194 effective countries have a factual country-information layer:
  identity, capital, region, area, currencies, languages, calling code, and
  borders where available. Countries outside the original editorial 30 now
  receive a country-specific factual overview instead of an insufficient-data
  notice.
- Planning sections for Travel, Accommodation, Travel Cost, and Tourism are
  conditionally mounted. They stay hidden on every entry path until the user
  chooses “Show additional information”.
- Hidden optional sections do not initiate dynamic provider/data work.
- The 30 original destinations retain richer editorial descriptions, cities,
  strengths, and weaknesses. Equivalent verified editorial coverage for the
  other 164 is not yet complete; their recommendation eligibility and factual
  overview must not be described as equivalent hand-written editorial content.
- A separate optional "Prominent cities" section covers all 194 effective
  countries with one to five entries each (829 cities; 810 carry at least one
  distinguishing fact). Each city shows SOURCED FACTS, not prose: its role
  (capital / largest known city / Nth-largest by source population), its
  administrative region, its IANA time zone, its approximate population, the
  straight-line distance and eight-point compass bearing from the national
  capital, and the nearest IATA-coded airport WITHIN THE SAME COUNTRY. A field
  the source does not have is omitted, never filled in.
  The previous build printed one of two fixed sentences chosen by whether the
  city was the capital, so five cities in a country differed only by name and
  population — the user reported exactly that.
  ABOVE those facts, each city now also shows a GENERAL DESCRIPTION where one
  could be verified (acceptance item #3). It is fetched by the WORKER from
  Wikipedia's public REST summary API — the build sandbox cannot reach
  Wikipedia, the deployed Worker can — cached in D1, and rendered with its
  source, a link to the article, and its CC BY-SA 4.0 licence.
  A namesake city can never be described in place of the real one: an article
  is accepted only when it is not a disambiguation page AND carries its own
  coordinates AND those coordinates sit within 45km of the city asked about.
  The reference coordinates live in the Worker
  (`worker/src/generated/cityCoordinates.json`, 810 cities); the browser
  never sends a coordinate of any kind. A city with no verified article shows
  its structured facts alone — there is no fallback text, because a fallback
  would be invented text. Real coverage is reported by the admin dashboard
  from the cache table, never estimated. Full provenance, licensing and the
  egress evidence are in /CITY_DESCRIPTIONS.md.
  Region and airport names are disclosed as appearing in their source
  language. The toggle label reads "Show more"/"Show less" (Arabic: "إظهار
  المزيد"/"إظهار أقل"), reflecting real open/closed state.
- The auto-generated overview paragraph for the 164 non-editorial countries no
  longer restates facts already shown in the adjacent Country Information
  card (capital, area, currency, languages); that card, "why this suits you"
  (when present), and the recommendation-profile summary are the overview.
- The destination hero's name/subtitle color is fixed (not `var(--white)`,
  which dark theme redefines to a dark surface color) plus a stronger text
  shadow, so it stays legible over any hero photo in both themes.
- The editorial easy/medium/hard visa label carries an explicit note that it
  is a general reference, not personalized to the viewer. It is a DIFFERENT
  thing from the passport-specific entry requirement (see Passport and visa
  system) and the two must never be presented as one.
- Every destination page ends with its own 1-5 star rating form (see
  Anonymous product data, ratings, and feedback).

## Country Intelligence + Purpose Suitability Scoring

Phase 11.x (country intelligence expansion) / Phase 14.x (purpose
suitability scoring) — added 2026-09-16. Full architecture, methodology,
source catalog, and coverage numbers are in `/COUNTRY_INTELLIGENCE.md`;
this is the summary.

- A COUNTRY SUITABILITY layer — how suitable a country is IN GENERAL for a
  purpose — deliberately separate from Phase 14's MATCH score (how well a
  country matches one traveller's OWN answers). Phase 14's
  `DIMENSIONS`/`PURPOSE_DIMENSIONS`/weights are UNCHANGED by this round —
  proven by `app/src/engine/phase14WeightsBaseline.test.ts`, which deep-
  compares the live `QUESTION_BANKS` against a baseline captured before
  this work began. Personal Match (blending suitability with a traveller's
  own preferences) is explicitly left for Phase 18 — not started here.
- Scored for 7 of Wejhaty's 8 purposes (`tourism`, `work`, `education`,
  `medical`, `immigration`, `investment`, `wellness`) across all 194
  effective countries. `other` is excluded — a catch-all fallback purpose
  with no defined identity (`pScoreKey: null`), so there is no methodology
  to build for it.
- Each purpose has its OWN factor set and weights (never reused from
  another purpose), built ONLY from indicators Wejhaty's own pipelines
  already fetch and commit with real provenance — no new network fetch for
  this layer, no invented values, no scraped rankings. Sources: 9 World
  Bank indicators (urbanization, income PPP, unemployment, life
  expectancy, health spend, tertiary enrollment, FDI, GDP growth,
  homicide rate) plus the already-committed price-level snapshot
  (`PA.NUS.GDP.PLI`) and UN Tourism/OWID arrivals snapshot. Visa/entry
  requirements are never a scoring input (task rule: `unknown` must never
  be penalized/rewarded); climate is never a scoring input (a traveller
  preference, not an objective quality).
  Real per-purpose measured coverage: tourism 190/194 sufficient (98%,
  avg 92% coverage), work 186/194 (96%, 91%), education 186/194 (96%,
  88%), medical 188/194 (97%, 92%), immigration 183/194 (94%, 88%),
  investment 185/194 (95%, 91%), wellness 192/194 (99%, 92%). Countries
  short of the 60% minimum-coverage threshold (Eritrea, North Korea,
  South Sudan, Vatican City for tourism, similar small/data-poor
  economies for the others) show "insufficient data", never a fabricated
  number — the full per-purpose list regenerates at
  `app/scripts/countryIntelligenceCoverage.json`.
  A score is a weighted average of NORMALIZED values actually observed,
  re-weighted over just the observed factors (a missing indicator does
  not silently drag the score down — the gap shows separately as
  coverage/confidence, never blended into the score itself). Normalized
  0-100 means "position within the winsorized 5th-95th percentile range
  of countries actually observed for that factor" — documented, bounded,
  outlier-robust, and never confused with a global rank/percentile.
  Confidence is `high`/`medium`/`low` from coverage % and data recency.
  Each purpose is versioned (`tourism-v1`, `work-v1`, etc.).
- Architecture: `app/src/intelligence/` is the pure, framework-free
  scoring engine (types, real source catalog, normalization, per-purpose
  methodology, scoring). `app/scripts/generate-country-intelligence.mjs`
  runs it (via Vite's SSR module loader, reusing the real tested TS code
  rather than a second JS copy) over the ALREADY-COMMITTED
  `recommendationIndicators.json`/`travelCostIndex.json`/
  `tourismInsights.json` snapshots — no network fetch of its own. Writes
  a compact summary bundled with the frontend
  (`app/src/data/generated/countryIntelligence.json`, ~9KB gzip) and a
  full per-component/per-source detail file bundled with the WORKER
  (`worker/src/generated/countryIntelligenceDetail.json`, ~133KB gzip) —
  the same "keep the frontend bundle light, serve full detail from the
  Worker" split already used for city descriptions. Deliberately NOT in
  D1: this is static, versioned, build-time-computed reference data, the
  same shape as the other generated snapshots, not user-generated data —
  see `/COUNTRY_INTELLIGENCE.md`'s "Why not D1" for the full reasoning.
  `worker/src/intelligence.ts` serves `GET /api/intelligence/:countryCode/
  :purpose` from the bundled detail JSON — no D1, no secret, no external
  fetch at request time.
- UI: a "Suitable for" card (`app/src/components/CountrySuitability.tsx`)
  inside Destination.tsx's existing "Show additional information" optional
  section, but as its OWN full-width row BELOW `.info-cards-grid` rather
  than a 5th item inside it — that 4-card grid is a hand-tuned named CSS
  grid with its own history of rejected/corrected layouts
  (`Destination.infoCardsLayout.test.tsx`); adding an untyped 5th item to
  it would have risked exactly that kind of accepted-layout regression.
  Shows each purpose's score/confidence/coverage (from the bundled
  summary, no network call) with a lazy "Why this score?" `<details>` per
  purpose that fetches the full component/source breakdown from the
  Worker only when opened — never eagerly. AR/EN, RTL/LTR-safe (logical
  CSS properties, no physical left/right), explicitly discloses it is a
  general estimate, "not personalized to you" (the Phase 18 Personal
  Match distinction, stated in-product).
- Admin observability: extends the EXISTING Content tab
  (`worker/src/adminPage.ts`'s `renderContent`, `worker/src/analytics.ts`'s
  `buildIntelligenceHealth`, `worker/src/adminI18n.ts`'s `intelligence.*`
  strings) rather than adding a new tab, per this round's own scope
  instruction to extend Admin/Content/Technical "without rewriting the
  Admin system." Shows countries covered, purposes scored, last generated
  date, and per-purpose sufficient-data count/avg coverage/high-confidence
  count. Reads the same bundled Worker JSON, not D1.
- Traveler Budget (Phase 13.5c) stays `BLOCKED / DEFERRED` — a
  sufficiently current, trustworthy, reusable source for generic traveler
  daily-cost values has not yet been verified; no such source was
  discovered or invented this round, and none may be until one actually
  is (see `app/scripts/TRAVEL_COST_INDEX.md`). This is not the same as
  cancelled: it remains a real candidate for a future pass. Visa stays
  `unknown` unless a real provider is configured, never used as a scoring
  input here.
- Tests: `app/src/intelligence/{normalize,methodology,score}.test.ts` (32
  tests — normalization boundaries/outliers/degenerate populations,
  structural methodology invariants, score bounds/insufficient-
  data/determinism/model-versioning), `app/src/data/
  countryIntelligence.test.ts` (5, against the real committed snapshot),
  `worker/src/intelligence.test.ts` (10) and `worker/src/analytics.test.ts`
  (6, both against the real committed data), `app/src/components/
  CountrySuitability.test.tsx` (8), `app/src/countryIntelligence/
  insights.test.ts` (5), and the Phase 14 regression guard (9). Playwright
  visual QA: 4 representative countries (excellent coverage/Arabic name —
  Saudi Arabia; large economy/high coverage — Japan; medium coverage —
  Afghanistan; insufficient data/tiny population — Vatican City) x
  desktop/mobile x AR/EN x light/dark = 32 combinations, 0 findings. Admin
  extension re-verified with the existing admin Playwright sweep, also 0
  findings.
- Full doc: `/COUNTRY_INTELLIGENCE.md`.

### Carry-over hardening additions on top of this layer (2026-09-17)

- **"Best suited for" / "الأنسب لـ"** (`app/src/intelligence/bestSuitedFor.ts`)
  — a deterministic Country -> Best Purposes interpretation built ONLY from
  the suitability scores above (no second scoring system). Eligibility
  requires a real score AND `high`/`medium` confidence (an `insufficientData`
  or low-confidence purpose can never become "best suited", though it still
  shows in the ranked list below). Ties within a fixed 5-point
  (`GROUPING_MARGIN_POINTS`) margin of the top eligible score group together
  ("Strong for Tourism, Work, and Investment") rather than picking an
  arbitrary winner; when no purpose is eligible, an honest insufficient-data
  message shows instead of a forced winner. Rendered as its own lead section
  in `CountrySuitability.tsx`, above the existing per-purpose list. 14 tests
  in `bestSuitedFor.test.ts` (including the task's own worked example) plus
  4 in `CountrySuitability.test.tsx` against real committed data (an
  isolated single winner — Afghanistan; a multi-purpose group — Saudi
  Arabia; an honest insufficient state — Vatican City; Arabic/RTL).
- **Source expansion attempted, network-blocked, honestly documented.**
  This round's own agent sandbox cannot reach ANY external host outside a
  short package-registry allowlist (confirmed with a control test against
  `example.com`, which failed identically to World Bank/WHO/ILO/UNESCO/
  IMF/OECD/UN-stats hosts) — the same constraint already recorded for the
  visa providers, and the same host (`api.worldbank.org`) the 11 indicators
  above were already fetched from. No new indicator was added, no source
  claimed verified, and no `excluded[]` limitation was removed. See
  `/COUNTRY_INTELLIGENCE.md`'s "Source expansion attempt" section for the
  full evidence and what running the existing generator script from an
  environment with real egress would need.

## Phase 16 — AI API Integration

**STATUS: CANCELLED / SKIPPED by product decision.**

An earlier round of this document briefly described Phase 16 as an active
AI explanation layer (a Worker-side Anthropic provider, an
`/api/ai/explain` endpoint, a frontend explanation panel on Results and
country pages, and an admin observability panel) — built because the
roadmap still carried this phase under the name "AI API Integration".
That was a mistake against the standing "no AI" product decision (see
"Current product decision" above), which was never actually reversed.

The user has since made the product decision explicit: **AI integration
is cancelled/skipped for this phase.** Every piece of that implementation
has been removed in the same round this correction was written:

- `worker/src/ai.ts` and its tests (the provider abstraction, the
  Anthropic Messages API adapter, grounding checks, caching, rate
  limiting, the `/api/ai/explain` and `/api/ai/status` endpoints).
- `app/src/ai/` in full (the browser client, request builders, types)
  and `app/src/components/AIExplanation.tsx` plus its tests.
- The AI wiring inside `worker/src/index.ts`, `worker/src/admin.ts`,
  `worker/src/analytics.ts` (`buildAIHealth`), `worker/src/adminPage.ts`
  (`renderAIHealth`), and `worker/src/adminI18n.ts` (`ai.*` strings).
- The AI panel wiring inside `Results.tsx` and `CountrySuitability.tsx`,
  the `ai.*` i18n dictionary entries in `en.ts`/`ar.ts`, the `AIStrings`
  type, and the `.ai-explanation*`/`.ai-badge` CSS rules.
- `/AI_INTEGRATION.md`, and every AI-specific row/section in
  `/SECRETS.md`.

**No AI provider is configured. No AI API credential (`ANTHROPIC_API_KEY`
or otherwise) is required by anything in this repository. No AI
functionality ships anywhere in the product.** Do not replace Anthropic
with another provider, and do not keep any dormant AI infrastructure "for
later" — none remains.

The non-AI carry-over hardening that was correctly part of this stage —
and is KEPT — is documented in its own place: the geolocation race fix
and "Best suited for" additions are recorded under "Destination
discovery, navigation, and theme" and "Country Intelligence + Purpose
Suitability Scoring" above; Nearest-to-me's regression coverage is under
"Destination discovery, navigation, and theme" as well.

Phase 16 stays in the roadmap under this name and status — it is not
renumbered or deleted — and the next official phase, once this cleanup
round is itself deployed and verified, is **Phase 17 — UI/UX Evolution**
(not started).

## Destination discovery, navigation, and theme

- Explore sorting supports default order, localized A–Z/Z–A, largest/smallest
  area, lower/higher relative price level, and — only with real location
  context — nearest AND farthest. Both distance sorts exclude the traveller's
  own (nearest-centroid-resolved) country. Without location neither is
  offered, and a short note says why rather than silently omitting them; a
  distance sort saved before location was lost falls back to default order
  instead of claiming to sort by distance. Missing/imputed price observations
  do not outrank direct sourced values. VERIFIED 2026-09-17 (Phase 16
  carry-over item #2): this exclusion was already implemented and correct
  (`app/src/data/exploreCatalog.ts`, labeled "Item #10" in its own comment)
  — not a bug, just missing regression coverage, now added in
  `exploreCatalog.test.ts` (10 tests: exclusion from both nearest and
  farthest, neighbor ordering, no global removal from the catalog or other
  sorts, accessibility via search/direct link, AR/EN parity).
- Location resolution runs from the shared coordinates HOWEVER they were
  granted — the app-wide first-visit prompt, Explore's own card, or a grant
  already in app state. (A previous build resolved only inside Explore's own
  click handler, so granting via the app-wide prompt left that card showing
  its heading and nothing else.)
- Browser geolocation is a two-stage request: a fast coarse attempt that
  accepts a recent cached fix, escalating to a high-accuracy attempt only
  after TIMEOUT or POSITION_UNAVAILABLE. A PERMISSION_DENIED is final and is
  never re-prompted. Each request returns a coordinate-free diagnostic
  (phase, per-stage deadline/duration/outcome) so a browser-phase failure can
  be told apart from app-side country/city resolution, which is timed
  separately. A recoverable failure no longer poisons app-wide location
  state: the app-wide prompt offers a retry instead of disappearing.
  FIXED 2026-09-17 (Phase 16 carry-over item #1 — the geolocation race
  condition): the real, narrow race was not "location is treated as
  permanently unavailable" (the reducer and `effectiveQuestionBank()` both
  re-derive live on every dispatch, so a later grant is never ignored) but
  a single decision point — the quiz finishing while location is still
  `requesting` — where the moment location would have mattered could pass
  before it settled. `app/src/state/waitForLocationSettle.ts` adds a bounded
  wait (2.5s timeout) at exactly that point in `Quiz.tsx`'s `onSelect`,
  showing "جارٍ تحديد موقعك…"/"Getting your location…" only in that narrow
  window, never claiming unavailability while still pending, and falling
  back to the unfiltered flow after the timeout. Denied/unavailable/error
  states proceed immediately with no wait. 14 new tests (6 for the wait
  helper's own timing/polling behavior, 8 driving the real `Quiz` component
  through fast/slow/denied/unavailable/mid-flow-resolution/timeout/AR
  scenarios with fake timers) — no duplicate `LOCATION_REQUEST` dispatch in
  any of them.
- "Surprise me" is a FLAG REEL: a gold-ringed badge that cycles real
  candidate flags and settles with one restrained pop. The travel-compass
  redesign that briefly replaced it was REJECTED by the user in the second
  acceptance round, and the reel was restored from commit 5838723 — recovered
  from Git history rather than rewritten. Do not reintroduce the compass dial,
  its ticks or its needle without an explicit instruction; a test asserts none
  of them is in the DOM.
  Kept from the compass round because they are fixes rather than design: the
  anti-repeat list survives a blocked sessionStorage, exactly ONE live region
  announces the outcome (so a screen reader hears "choosing…" then the
  destination, not eight flags), the reel itself stays out of the
  accessibility tree, and the result still carries the real great-circle
  direction from the traveller when a location has been shared — and claims
  no direction at all when one has not. Selection is unchanged: equal chance from
  the current filtered catalog, crypto random, and no repeat during the
  browser session until candidates are exhausted. A reduced-motion preference
  lands directly on the winner with no cycling.
- Destination pages preserve the list context from Explore or Results. The
  previous/next controls live INSIDE the hero image, at its inline start and
  end edges, as translucent blurred 44px circles; the hero's own text reserves
  those gutters so the country title never runs underneath them. Direct links
  use localized alphabetical order; surprise entries keep their single return
  link below the hero.
- HERO NAVIGATION LABELS (acceptance item #2), decided by measurement.
  `app/scripts/hero-label-qa.mjs` measures the real geometry across 12 widths
  x 2 languages x 2 themes x rest/hover/focus.
    * REJECTED: expanding the control itself into a labelled pill. It
      overlapped the country title at every width wide enough to justify a
      label — 26 findings. The control's row is y=118..165 inside the 280px
      hero and the title block starts at y=147..160 on desktop.
    * SHIPPED: a compact floating caption ("Previous country" / "الدولة
      السابقة" plus the destination name) in the clear photo band directly
      ABOVE the arrow, revealed on hover or keyboard focus. Measured at
      y=67..110, clearing the title by 37-52px. 0 findings, both languages,
      both themes, no overflow, no escape from the hero.
    * The collapsed control keeps the accepted 44px geometry EXACTLY. The
      caption is aria-hidden because the link's accessible name already
      carries the same words.
    * Below 900px the caption is not rendered at all: the hero's inner block
      wraps there and climbs into the caption's band, and a touch device has
      no hover to reveal it with. The accessible name and the native tooltip
      carry the name, as before.
  If this hero's height or title layout ever changes, re-run that script
  before assuming the caption still fits.
- Every dropdown in the app is a custom listbox, not a native `<select>`. The
  previous build styled only the closed control, so the OPEN menu was still
  drawn by the browser/OS with no Wejhaty identity and no dark-theme
  awareness. The listbox implements the WAI-ARIA contract (arrow keys,
  Home/End, PageUp/PageDown, Enter/Space to commit, Escape to close with focus
  return, Tab to close, type-ahead, aria-activedescendant), flips above the
  trigger when there is no room below, and has a searchable variant used by
  the ~194-option passport selector. No dependency was added.
- Theme supports system, light, and dark modes. System is the default, tracks
  live device changes, manual choice persists locally, and the pre-render boot
  script prevents a wrong-theme flash. Below 640px the control collapses to
  its icon and chevron so the nav row fits a 390px screen.
  FIXED 2026-09-16: the System option's icon is now the EFFECTIVE appearance
  (moon when the OS is dark, sun when light), tracked live via the same
  `prefers-color-scheme` listener the control already subscribed to — it
  previously always showed a sun regardless of the OS's actual theme, a real
  reported bug (`ThemeSwitch.tsx`'s `iconFor()` branched on the raw
  `'auto'|'light'|'dark'` preference value, never the OS query). The stored
  preference itself is unchanged by this fix — System never silently
  converts to explicit Light/Dark. A hint next to the "System" option label
  in the open dropdown also now shows the current effective mode. 11
  tests in `ThemeSwitch.test.tsx` cover explicit Light/Dark, System+OS-light,
  System+OS-dark, live OS changes in both directions while staying on
  System, persistence after reload, and the hint text in both languages.
- All visible numbers render as Latin digits in both languages. Two separate
  leaks existed and both are closed at `data/format.ts`: locale-aware
  formatters (pinned to 'en-US' digits regardless of UI language) and literal
  Arabic-Indic digits typed into translated content and destination data
  (normalized at the data boundary, so a re-extraction of the generated files
  cannot reintroduce them). Two regression layers enforce it — a data-level
  scan of every dictionary, destination, country record, featured city and
  question bank, and a render-level scan of real Arabic screens that walks
  text nodes plus aria-label/title/placeholder/alt.

## Anonymous product data, ratings, and feedback

- The frontend records bounded anonymous product events for page use,
  questionnaire choices, Explore filters, surprise use, theme, permission
  outcome, coarse device/browser class, load timing, and safe client-error
  categories. It does not transmit search text, precise coordinates, IP
  addresses, fingerprints, stack traces, or arbitrary model content. The
  location diagnostic added this round carries stage timings and outcomes
  only — the type itself cannot hold coordinates.
- Two rating levels, both 1-5 stars plus an optional free-text comment:
  'results' rates a whole recommendation set, 'destination' rates one country
  page and carries the country plus the coarse route the traveller arrived by
  ('results', 'explore', 'surprise', 'direct'). The per-country "useful / not
  useful" votes and the reason pills are gone. Submit is disabled and the
  requirement stated before the traveller tries; the request has a loading
  state; success and failure are both explicit, and a failure offers a retry
  that keeps what was typed. Ratings never change Phase 14 scores or order.
- The shared star control is a real radio group: arrow keys move the
  selection and a screen reader announces "3 of 5".
- Global and country-specific feedback accepts a categorized message, optional
  email, and optional bounded image attachment, then returns a reference ID.
  Worker validation, per-session rate limiting, private R2 storage, and optional
  Turnstile are implemented.
- Cloudflare D1 migrations define sessions, events, ratings, feedback, and daily
  aggregate tables. Migration 0002 adds the rating kind, comment, country and
  origin columns additively — existing rows keep their meaning and default to
  kind 'results'. A scheduled job retains aggregates, deletes raw events and
  ratings after 90 days, and removes feedback contact/device/screenshot links
  after 90 days while preserving the issue record.
- `/admin` is a real private developer dashboard, not a JSON dump: KPI cards,
  an inline SVG daily-trend chart, ranked tables with proportion bars, a
  searchable report queue, a report detail view, and a status workflow
  (new / triaged / in_progress / resolved / declined) with an internal note.
  One self-contained document with no external request of any kind.
  Panels: Overview, Funnel, Recommendation quality, Countries, Discovery,
  Location, Reports, Technical, Content. Every panel obeys one filter bar —
  date range, language, device, purpose, country, and min/max rating.
- ADMIN LANGUAGE — Arabic / English, a header pill switcher ("AR | EN"),
  independent of the public site's own language. Independent is correct
  here, not a compromise: the public site does not persist a language
  choice to localStorage at all (it defaults to Arabic every session — see
  Product below), so there was nothing shared to preserve. The admin's
  choice persists under its own key, `wejhaty.admin.lang`, defaulting to
  English, with a try/catch around every localStorage read/write so a
  blocked store (Safari private mode) degrades to "does not persist"
  rather than breaking the page.
  Switching sets `<html lang>`/`dir` and re-renders every panel from the
  data ALREADY on screen — no re-fetch, no re-authentication. The
  dictionary (`worker/src/adminI18n.ts`) is the single source of truth,
  typed so English and Arabic are forced to carry the same keys; it is
  serialized once per request into the page (`adminPage.ts` cannot
  literally reuse the public app's React-bundle i18n — different runtime,
  no build step — so it re-expresses the same flat-dictionary-plus-t()
  pattern instead). A missing key falls back to English, then to an empty
  string — NEVER to the raw key — enforced by both a static dictionary test
  and a runtime Playwright walk of every text node on the page.
  Report workflow statuses (new/triaged/in_progress/resolved/declined) and
  report types are translated as UI labels while the value sent to the API
  stays the fixed English enum code, the same pattern already used for the
  device/purpose filters. Country codes, dates, reference IDs and other
  underlying data values are deliberately left untranslated. A traveller's
  own free-text report/comment gets `dir="auto"` rather than inheriting the
  page's direction, so an English report does not right-align inside the
  Arabic dashboard — found and fixed during this round's RTL visual QA.
  Verified: `worker/src/adminI18n.test.ts` (dictionary completeness, no
  leftover English in the Arabic dictionary, no raw-key-shaped value),
  `worker/src/adminPage.test.ts` (the switcher and the embedded dictionary
  are actually in the generated page), and `app/scripts/admin-visual-check.mjs`
  extended to sweep Arabic/English × desktop/mobile (4 combinations) plus
  dedicated functional checks — click-to-switch, dir/lang correctness,
  persistence across a real reload, the blocked-storage fallback, and a
  full-page raw-translation-key scan — all at 0 findings.
- ADMIN AUTHENTICATION, two independent mechanisms (see SECRETS.md):
    * Cloudflare Access (preferred). Setting `ADMIN_ACCESS_AUD` and
      `ADMIN_ACCESS_TEAM_DOMAIN` makes the Worker verify the Access JWT
      itself — RS256 signature against the team's published keys, plus
      audience and expiry. Once Access is configured a bearer token can no
      longer get in, deliberately: a token that could bypass Access would
      make adding Access a downgrade.
    * `ADMIN_TOKEN`, compared in constant time, for an account without Zero
      Trust. The Bearer scheme is required, not stripped-if-present.
  With NEITHER configured every admin data path returns 503 and serves
  nothing. The surface never falls open. No secret is in Git or the bundle.
- ADMIN PRIVACY, enforced rather than promised. No analytics query reads or
  returns a coordinate, an IP or a fingerprint — a test asserts that no SQL
  in the analytics layer can even mention one. Every caller-supplied filter
  value is whitelist-parsed and then passed as a bound parameter; a test
  asserts an injected string reaches SQL only as a bound value. The only
  geography anywhere in the dashboard is the country Cloudflare attaches at
  the edge, at country granularity.
- TURNSTILE covers the three surfaces where a stranger can write text into
  the database: the report dialog, the results rating, and the destination
  rating. Analytics events are deliberately NOT challenged — they carry no
  free text and challenging them would mean challenging every page view. Both
  halves (`TURNSTILE_SECRET_KEY` on the Worker, `VITE_TURNSTILE_SITE_KEY` on
  the build) are independently inert when unset, so they can be switched on
  in either order without a window where submissions are rejected.
  FIXED 2026-09-16: `app/src/telemetry/turnstile.ts`'s `loadTurnstile()`
  previously listened only for the challenge script's `load` event. A
  blocked or failed script load — an ad blocker, a firewall, or any network
  policy that refuses `challenges.cloudflare.com` (reproduced directly
  against this sandbox's own blocked egress to that host before fixing) —
  never fires `load`, so the returned promise never settled and every
  caller waiting on it (the report dialog, both rating forms) hung
  indefinitely: Submit stayed disabled forever with zero explanation and no
  way out — the reported "cannot be pressed or completed" bug. Fixed in the
  shared `useTurnstile` hook: listens for the script's `error` event too
  (resolves to "failed" instead of hanging), an 8s timeout backstop for a
  network policy that drops the connection without ever firing `error`, and
  a new `failed` state distinct from a failed SEND — submission still stays
  blocked while `failed`, since a Turnstile load failure must never
  silently waive the challenge (that would be a trivial client-side bypass
  of the anti-abuse gate). All three forms show the same honest
  "verification could not load, retry" affordance when this happens; when
  Turnstile is not configured at all (today's production state) the
  behavior is unchanged from before. `FeedbackDialog.tsx` previously
  reimplemented Turnstile handling ad hoc instead of using the shared hook
  (missing `error-callback` entirely); it now uses `useTurnstile` like the
  other two forms. Verified: 6 new tests in
  `app/src/telemetry/turnstile.test.ts` (script error, load timeout,
  retry recovery, widget-level error-callback — `blocking` stays `true`
  throughout every failure case), 5 new/updated tests in
  `FeedbackDialog.test.tsx`, and a live browser reproduction against the
  real blocked-network failure mode both before and after the fix.
- D1 REALITY — UPDATED 2026-09-16, later the same day. The account/token
  permission gap described below is now CLOSED.
  MEASURED on worker run 35154518086 (the admin-language-switcher deploy),
  the same read-only capability diagnostic that previously read FAILED:

      OK       identity (whoami)
      OK       Workers: list
      OK       D1: list
      OK       R2: list buckets

  The Worker deployed WITH both bindings live:
  `env.PRODUCT_DB (wejhaty-product-data)` (D1) and
  `env.FEEDBACK_SCREENSHOTS (wejhaty-feedback-screenshots)` (R2). Migrations
  report current (applied in an earlier retried run, 35127073171 attempt 4).
  This run's overall conclusion is `success` for the first time — the
  workflow's deliberate `exit 1`-on-provisioning-failure path was not
  taken, because provisioning did not fail.
  **Not yet independently verified:** an actual end-to-end write (submit a
  real rating/report against the live API, confirm a row lands in D1). That
  is application-level verification and was out of scope for the round that
  found this; do it before describing rating/feedback persistence as
  production-accepted. Until then: the bindings existing is confirmed, a
  successful round-trip write is not.
  Earlier same-day reading, for the record: worker run 35126621883 measured
  `FAILED` on D1 and R2 with `Authentication error [code: 10000]` — that
  reading is superseded by the OK reading above, not merged with it; the
  underlying account permission changed between the two runs.
  Required grants for reference, at the account level: Workers
  Scripts:Edit, D1:Edit, Workers R2 Storage:Edit (see SECRETS.md).

### Analytics plan — BUILT; D1 is now bound, real-data verification still pending

What was previously "kept, not started" is implemented: migrations, the
dashboard, the filters, Turnstile, Cloudflare Access support, the AR/EN
language switcher, and the full panel set above. Two things are still open:

- **Export.** Not built. Nothing depends on it and no one has asked for it.
- **Real data.** Every panel is verified against realistic stubbed shapes
  (`app/scripts/admin-visual-check.mjs`, desktop and mobile in both
  languages, 0 findings) but has never run against a populated D1. D1 IS
  now bound in production (see D1 REALITY above), so this is reachable —
  it just has not been done yet, because it requires live traffic or a
  deliberate test write against the production API, which is
  application-level verification distinct from what any round so far has
  been scoped to do. The queries are covered by tests; their OUTPUT against
  real rows is unverified.

## Destination images

- Local coverage is 194/194 effective countries; `IL`/`ISR` is absent.
- Photos now appear on Explore and Results cards as well as destination heroes.
  Card and hero crops are audited separately; per-country object-position
  overrides correct the reviewed edge cases without replacing accepted layout.
- Every current image was visually reviewed under the stricter policy on
  2026-09-20. It depicts an
  in-country landmark, notable cityscape, nationally important site, or
  representative natural landscape.
- Thirty weak or ambiguous assets were replaced in the latest audit. Every
  country now also has a separate 960px WebP card derivative; cards never
  download the full Hero file, while Home and Destination heroes use responsive
  card/Hero source sets. Across all 194 countries the card set is 64.6% smaller
  than sending the Hero set to those surfaces, and every derivative is below
  200 kB.
- The old Commons free-search path allowed embassies abroad, US place-name
  homonyms, maps, documents, toys, vehicles, and random objects. The pipeline
  now starts from the human-edited Wikivoyage country article, retrieves exact
  license/attribution metadata from Wikimedia Commons, applies semantic/file/
  aspect filters, and supports reviewed exact-title overrides.
- `app/scripts/destinationImageAudit.json` records the approved source for
  every country. Tests fail if a regenerated manifest silently differs.
- Manifest: `app/src/data/generated/destinationImages.json`.
- Assets: `app/public/destinations/*.webp` for heroes and
  `app/public/destinations/cards/*.webp` for cards/mobile candidates.
- Status: implemented, visually reviewed, deployed, and production-verified.

## Architecture map

| System | Path |
|---|---|
| Frontend | `app/` |
| Deterministic ranking | `app/src/engine/`, `app/src/data/worldRecommendation.ts` |
| Deterministic question selection | `app/src/adaptive/selectNextQuestion.ts` |
| Questionnaire route | `app/src/routes/Quiz.tsx` |
| Catalog | `app/src/data/worldCatalog.ts` |
| Rich 30-country editorial profiles | `app/src/data/generated/destinations.json` |
| Worldwide recommendation inputs | `app/src/data/generated/recommendationIndicators.json` |
| Basic worldwide facts | `app/src/data/generated/basicCountries.json`, `countryInfo.json` |
| Image pipeline/review | `app/scripts/generate-destination-images.mjs`, `destinationImageAudit.json` |
| Destination route | `app/src/routes/Destination.tsx` |
| Visa provider abstraction | `worker/src/visa.ts` |
| Visa client / bounded ranking layer | `app/src/visa/` |
| Custom listbox | `app/src/components/Select.tsx` |
| Digit/number formatting layer | `app/src/data/format.ts` |
| Hero edge navigation | `app/src/components/DestinationHeroNav.tsx` |
| City descriptions (Worker) | `worker/src/cityDescriptions.ts` |
| City descriptions (browser) | `app/src/cities/cityDescriptionClient.ts` |
| Admin auth and routing | `worker/src/admin.ts` |
| Analytics queries | `worker/src/analytics.ts` |
| Admin dashboard UI | `worker/src/adminPage.ts` |
| Admin dashboard i18n dictionary | `worker/src/adminI18n.ts` |
| Turnstile (shared) | `app/src/telemetry/turnstile.ts` |
| Rating forms | `app/src/components/ResultRating.tsx`, `DestinationRating.tsx` |
| Travel Worker | `worker/` |
| Amadeus adapter | `worker/src/amadeus.ts` |
| Tourism data | `app/src/data/tourismInsights.ts` |
| Country Intelligence scoring engine | `app/src/intelligence/` |
| Country Intelligence generator | `app/scripts/generate-country-intelligence.mjs` |
| Country Intelligence frontend accessor | `app/src/data/countryIntelligence.ts` |
| Country Intelligence detail client / insights | `app/src/countryIntelligence/` |
| Country Intelligence UI | `app/src/components/CountrySuitability.tsx` |
| Country Intelligence detail API (Worker) | `worker/src/intelligence.ts` |
| Country Intelligence doc | `/COUNTRY_INTELLIGENCE.md` |
| Relative price-level data | `app/src/data/travelCostIndex.ts` |
| Country -> Best Purposes grouping | `app/src/intelligence/bestSuitedFor.ts` |
| Geolocation quiz-race bounded wait | `app/src/state/waitForLocationSettle.ts` |
| Personalization (profile, storage, Personal Match, explanations) | `app/src/personalization/` |
| Personal Match methodology doc | `app/src/personalization/README.md` |
| Shared answer vocabulary (Phase 14 text + Personal Match text) | `app/src/engine/answerVocabulary.ts` |
| Flight-path geometry for decorative planes | `app/src/components/flightPaths.ts` |

## Provider and external state

- The travel-only Cloudflare Worker is deployed and production-verified. The
  production flight route preserves its CORS and validation contracts; removed
  AI routes return 404.
- Amadeus code is ready. Live offers require external
  `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` provisioning.
- Live hotel integration is not implemented. `app/HOTEL_INTEGRATION.md` is an
  architecture note.
- Tourism uses UN Tourism data via OWID. Relative price level uses World Bank
  `PA.NUS.GDP.PLI`; PLI is not a traveler budget or hotel/flight price.
- Data-refresh workflow code is ready. Automatic PR creation was last reported
  to require the external GitHub setting allowing Actions to create and approve
  pull requests; re-check before relying on that report.
- Product-data code is ready, including migrations 0003 (city description
  cache) and 0004 (report workflow). The Worker deployment workflow creates
  D1/R2 and applies migrations when its Cloudflare token has D1, R2 and
  Workers edit permissions; it now prints a read-only per-capability
  diagnostic first, so a failure names the missing permission. As of
  2026-09-16 (worker run 35154518086) the token HAS D1, R2 and Workers
  access, and both bindings are live in production — see D1 REALITY above.
  `ADMIN_TOKEN` (or `ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`),
  `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` remain external
  account configuration and are not yet set. SECRETS.md lists every one of
  them, what it does, and what happens while it is unset.
- Visa data: no provider is configured. The abstraction, the canonical
  vocabulary, request validation (including the IL exclusion), the Sherpa
  adapter and its category mapping, failure behaviour, the Worker endpoint,
  the passport UX and the bounded ranking layer are all implemented and
  tested. `SHERPA_API_KEY` (and `SHERPA_BASE_URL` for the sandbox) are Worker
  secrets, never committed and never in the frontend.
  `PROVIDER ACCESS REQUESTED — AWAITING VERIFIED TRAVEL REQUIREMENTS API
  CREDENTIALS` — the user has requested Sherpa API access and created a
  VisaHQ Business Portal account, but neither has yet produced a verified,
  working credential, so no integration exists yet — see
  `/VISA_PROVIDERS.md` for the comparison, the decision, and the exact
  switch-on steps.
- The Worker IS deployed from `08ebdcb5` (2026-09-16, run 35094594557,
  Version ID `54c3994c-2298-4b17-af62-2a3e29b784d2`). The visa endpoint and
  the extended ratings endpoint are live. That run's conclusion is `failure`
  purely because the workflow deliberately exits 1 after reporting the D1/R2
  provisioning failure — the Worker upload itself succeeded in the same run.
- GITHUB PAGES DEPLOY IS UNBLOCKED (2026-09-16, resolved). Run 35094587702 on
  `claude/modest-cray-34bvoa`: the `build` job succeeded and uploaded the
  Pages artifact; the `deploy` job was rejected outright with
  `Branch "claude/modest-cray-34bvoa" is not allowed to deploy to
  github-pages due to environment protection rules.` Every previous
  successful Pages deploy came from `claude/marhaba-kxry8l`, which is the
  branch the environment permits.
  This is a repository-settings gate the repo owner controls, and it was
  deliberately NOT worked around. Of the two legitimate remedies, the user
  chose (b):
    (a) add `claude/modest-cray-34bvoa` to the `github-pages` environment's
        deployment branch policy (Settings -> Environments -> github-pages),
        then re-run workflow `deploy-pages.yml` on this branch; or
    (b) fast-forward `claude/marhaba-kxry8l` — the branch the environment
        already permits — whose `app/**` push trigger then deploys Pages
        normally. DONE: `4f3d419..e3f8e4a8`, a clean fast-forward (0 commits
        behind on the left side, 11 ahead), pushed without force and without
        rewriting history.
  Pages run 35097793153 then deployed `e3f8e4a8f798add2068dc60efd290952d690d8ad`:
  `build` success, `deploy` success, environment URL
  `https://hmooodzozo577-gif.github.io/wej/`.
  `RESOLVED`.

## Cancelled/out-of-scope features

Do not resurrect without an explicit user decision:

- numeric accommodation cost without legitimate live provider data;
- cultural compatibility ranking.

(Numeric traveler budget / SAR-per-day is NOT in this list — see "Country
Intelligence + Purpose Suitability Scoring" above: Phase 13.5c Traveler
Budget is `BLOCKED / DEFERRED`, not cancelled, pending a verified source.
The non-negotiable rule against ever fabricating one stands regardless —
see "Non-negotiable product rules" above.)

## Roadmap gate and immediate backlog

Phase 16 (AI API Integration) is CANCELLED/SKIPPED by product decision —
see "Phase 16 — AI API Integration" above. Phase 17 is implemented, deployed,
and production-verified. Current order:

0. **PHASE 17 DEPLOYMENT RESOLVED / PRODUCTION-VERIFIED.** Pages run
   `35484971643` deployed the Destination follow-up commit `e3e9f8a`; the
   production responsive-image and bilingual/theme checks passed in addition
   to the existing 16-case browser matrix. Worker deployment was unnecessary
   because Worker code did not change.
1. Obtain user acceptance for the Phase 17 final fixes and for Phase 18
   personalization. Do not call either complete before that acceptance, and
   do not begin Phase 19 automatically. If the user asks to remove Phase 18,
   follow "Pre-Phase-18 rollback checkpoint" exactly.
2. Production-check rating persistence and optional R2 screenshot storage;
   ordinary Contact, Suggestion, and Site Bug D1 writes are already
   production-verified.
3. AWAITING A PRODUCT DECISION — visa scoring. The current visa layer only
   reorders destinations already within 3 Phase 14 points of each other. The
   alternative, NOT implemented, is to blend visa convenience into the
   weighted score itself. That would be a Phase 14 weight/semantic change,
   which the user approved visa data affecting suitability but did NOT
   pre-approve, so it is a decision to take before any such change:
     - proposed shape: one additional scored dimension, `visaConvenience`,
       normalized 0-100 from the canonical category (visaFree 100,
       visaOnArrival 80, eVisa 60, authorizationRequired 40,
       embassyVisaRequired 0, unknown excluded rather than defaulted),
       weighted alongside the existing dimensions;
     - proposed weight: 8-11, i.e. between `island` (5) and `safety` (11),
       so it is a real factor but not a dominant one;
     - it would only apply when a passport is given AND a provider answered,
       so most users would see no change at all today;
     - it needs re-running the per-country reachability and the 40,000-path
       coverage tests, because adding a dimension changes both.
   Accept, reject, or amend before it is built.
4. Obtain a visa-data provider account (Sherpa first — see
   `/VISA_PROVIDERS.md`), verify the category mapping against a real sandbox
   response, confirm in writing what the terms permit (caching, storage,
   attribution, and whether the data may inform ranking as well as display),
   then set `SHERPA_API_KEY` as a Worker secret.
5. D1 IS bound and ordinary feedback/event writes are production-verified.
   Remaining checks are rating persistence, optional R2 screenshot storage,
   retention, and authenticated Admin panels against real rows.
6. Configure admin access (`ADMIN_ACCESS_AUD` + `ADMIN_ACCESS_TEAM_DOMAIN`
   preferred, else `ADMIN_TOKEN`) and, if abuse appears, the two Turnstile
   keys. All are documented in SECRETS.md and all are inert until set.
7. Decide whether sourced rich editorial descriptions, strengths and
   weaknesses are required for the remaining 164 countries. Note that city
   "known for" narrative is now covered by the Wikipedia description layer,
   so that part of this item is done.
8. Reassess the roadmap with the user before Phase 19.

## Handoff rule

Update this file after a material state change: phase status, production bug,
architecture decision, provider configuration, country/image coverage,
deployment verification, user acceptance, or cancelled/reopened scope. Keep
current truth only; do not turn it into a changelog.
