# Anti-Koshary audit — post-v1.1 (Pass 1, read-only, then a bounded Pass 2)

Date: 2026-09-26. Commit audited: `73493ed` on `claude/marhaba-kxry8l`
(v1.1 development complete, before RC1). Skill: the same project-local
`anti-koshary` install reviewed in
[ANTI_KOSHARY_PRE_V1_1.md](ANTI_KOSHARY_PRE_V1_1.md). Pass 1 changed
nothing; the three Pass 2 fixes at the end were applied afterwards, each in
code v1.1 itself added, and each is recorded with its commit.

## Step 0 — orientation

- Stack: unchanged (React 19 + TypeScript + Vite 8, npm; Cloudflare Worker
  in TypeScript, npm; Node build and ops scripts).
- Scope: the v1.1 delta, `wejhaty-v1.0.0..73493ed` — 89 files under
  `app/src`, `app/build`, `app/scripts` and `.github`, +5 899 / −112 lines —
  plus a re-check of every pre-v1.1 finding. `worker/` has **no change**
  since v1.0.0.
- Tests: frontend 1 181/1 181 (114 files) on the audited commit; Worker
  273/273 (unchanged code). Claims below rest on that suite.
- Working tree: clean.

## Delta: pre-v1.1 findings

| ID | Pre-v1.1 | Now | Evidence |
|---|---|---|---|
| D1 site origin in 6 places | High | **Fixed for the app**: one config, `app/build/site.ts` (`VITE_SITE_ORIGIN`, `VITE_BASE_PATH`) → `app/src/site/site.ts`; both `/wej/` and root builds verified (`verify-seo-build.mjs`). The Worker allow-list is **DEFERRED** by design (Worker untouched; a one-line change when a domain is live). The ops scripts' defaults — see P1 | `app/build/site.test.ts`, `app/src/site/site.test.ts` |
| D2 theme-color drift | Medium | **Fixed**: one pair, `app/src/site/theme.ts`, used by the bootstrap, ThemeSwitch and the manifest | `seo.test.ts` (manifest and `index.html` theme-color) |
| D5 storage-may-throw copies | Medium | **Fixed for new code**: `app/src/site/safeStorage.ts` (Favorites, Compare). Existing callers not churned | `favorites.test.tsx` (bad JSON, quota, disabled) |
| H1 ThemeSwitch crashes without storage | High | **Fixed** | `ThemeSwitch.test.tsx` "keeps working when storage is blocked" |
| H2 no catch-all route | Medium | **Fixed**: localized `NotFound` for `*` and unknown destination ids; static `404.html` is noindex | `worldCatalog.routing.test.tsx`, `seo.test.ts` |
| L1 Destination.tsx size | Medium | **Held**: 513 → 511 lines; Favorite/Share/Compare live in `DestinationActions.tsx` | — |
| F1 wejhaty.css size | Medium | Still DEFERRED: 5 570 → 6 029 lines, v1.1 appended scoped sections only | — |
| D3, D4, F2, X1–X7 | Low | Unchanged; intentional or DEFERRED as recorded | — |

## 1. Layer collapse

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| — | — | Question selection | The travel-need questions would have been easy to wire into `Quiz.tsx`; instead `app/src/adaptive/questionnaire.ts` owns "Phase 14 first, then travel needs", used by both the reducer and the Quiz | No finding |
| — | — | Static SEO pages | One metadata module (`app/src/seo/meta.ts` + `document.ts`) feeds both the build-time pages (`app/build/seoPages.ts`) and the runtime `useDocumentMeta` | No finding |
| Q1 | Medium | `app/src/routes/Quiz.tsx` 300 → 351 lines, 22 changes in 60 days; v1.1 added telemetry filtering, the Phase-14-done location hold and the language multi-select reveal in place | The route mixes flow, telemetry and presentation; the next change to any of them has to read all three | DEFERRED: splitting the accepted questionnaire flow is a refactor, not a v1.1 need; the new behaviour is pinned by `Quiz.travelNeeds.test.tsx`, `Quiz.locationRace.test.tsx` and `questionnaire.test.ts` |

## 2. Duplicated logic

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| P1 | Medium | The production site and Worker URLs are the default in 8 ops scripts (`production-smoke`, `seo-smoke`, `verify-seo-build`, `safari-smoke`, `voiceover-smoke`, `admin-smoke`, `worker-smoke`, `lib/uptime`); v1.1 added two of them | A domain switch must edit every copy; a missed one keeps checking the old host and reports green | **Fixed in Pass 2** (below) |
| P2 | Low | `personalization/signals.ts` accepts importance answers as the literals `100 / 60 / 0`, while `travelNeeds.ts` defines `IMPORTANCE_VERY / IMPORTANCE_SOME` | Changing the option values in one place would silently drop every travel-need answer | **Fixed in Pass 2** |
| — | — | `isTravelNeedQuestion` (by kind) and `isTravelNeedQuestionId` (by id) | Two views of one rule, like the existing `isLocationDependentQuestionId`: stored answers and paths only have ids | Intentional; `travelNeeds.test.ts` asserts every travel-need question passes the id check |
| — | — | Frontend vs Worker validation | Defence in depth; v1.1 added no Worker surface | Intentional — keep |

## 3. Files that stopped being read

`wejhaty.css` (F1) and `Quiz.tsx` (Q1) as above. No new file over 250
lines except `app/src/compare/compareModel.ts` (240), which is one pure
model with its own tests.

## 4. Dead code

Every export added in v1.1 was searched across `app/src`, `app/build` and
`app/scripts`.

| ID | Priority | Symbol | Decision |
|---|---|---|---|
| X8 | Low | `TRAVEL_EVIDENCE_UPDATED_AT` (`app/src/personalization/travelNeeds.ts`) — exported, used nowhere | **Removed in Pass 2** |

About 25 further new exports are types and constants used inside their own
file (for example `CompareRow`, `FAVORITES_VERSION`, `MOSQUE_EVIDENCE`);
harmless, not reported one by one.

## 5. Reusable pieces

`safeStorage.ts` and `announce.ts` (one polite live region) are the two new
shared pieces; both have several callers. Nothing else pays for itself.

## 6. Health checks

- Network in new code: the Overpass generator backs off on 429/503/504,
  pauses between countries, and writes atomically only after validation;
  the uptime and domain-status workflows are GET-only with timeouts and at
  most two attempts. No finding.
- Storage in new code goes through `safeStorage.ts`; bad JSON, old or future
  versions, duplicates, unknown or excluded ids, quota and blocked storage
  are handled (unit tests plus 49 browser checks in the v1.1 QA run).
- Performance: the entry bundle grew from 603.6 KB to 615.0 KB gzip
  (+1.9 %); CSS from 20.9 KB to 22.2 KB gzip. No new runtime request.

## 7. Security and dependencies

**Security.**
- No secret shape in the delta; no new `dangerouslySetInnerHTML`, `eval` or
  `new Function` (the only sinks are still the build-time SVG constants).
- Static HTML: every value written into the 208 generated pages goes
  through `escapeHtml` / `jsonForScript` (`seo.test.ts`, 4 804 build checks).
- URLs carry only canonical destination ids (`/compare?ids=`); injection and
  over-long values are refused (browser checks).
- Sensitive data at rest: the optional Islamic-practice and halal answers
  are religion-related preferences. They are stored only in this browser's
  personalization profile (`wejhaty.personalization.v1`), are removed by
  "Reset preferences", and are never sent (no analytics event, no Worker
  call, not in the admin catalog, a URL, share text or page metadata —
  `Quiz.travelNeeds.test.tsx`, `travelNeeds.test.ts`). Accepted by design.
- The passport default from location is displayed only; it is never stored
  or sent unless the traveller continues with it (`passportDefault.test.tsx`).
- The Worker is unchanged; its CORS still allows exactly one origin.

**Dependencies** (`scripts/dep_audit.sh`, 2026-09-26):
- app: the same `csv-parse` moderate advisory through `ourairports-data-js`
  (build-time generator only, not shipped) — U15 DEFERRED. Patch/minor
  updates available (React 19.3, Vite 8.3, Vitest 5.0.2 and others);
  TypeScript 7 is a major version, not proposed. None applied during the
  release candidate.
- worker: 0 vulnerabilities; minor updates only.

## Summary (Pass 1)

| Priority | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | (D1 and H1 fixed; the Worker allow-list part of D1 is DEFERRED by design) |
| Medium | 3 | Q1, P1, F1 |
| Low | 2 new | P2, X8 |

## Pass 2 — applied after this report

Only findings in code v1.1 added, bounded, and covered by tests or by the
production smoke run:

| ID | Fix | Commit |
|---|---|---|
| P1 | One module, `app/scripts/lib/productionUrls.mjs`, holds the production site and Worker URLs; all 8 scripts import it (a command-line argument still overrides) | `e918f37` |
| P2 | `signals.ts` reads the importance values from `travelNeeds.ts` | `e918f37` |
| X8 | `TRAVEL_EVIDENCE_UPDATED_AT` removed | `e918f37` |

Q1 and F1 stay DEFERRED; the Worker allow-list (D1) waits for a live domain.
