# Anti-Koshary audit — pre-v1.1 (Pass 1, read-only)

Date: 2026-09-25. Commit audited: `df545670d1c2607dc6b37b8d509c741a1806c66b`
(`wejhaty-v1.0.0`). Skill: `anti-koshary` from `ismail9k/skills`, installed
project-local at `.claude/skills/anti-koshary/` (lock entry in
`skills-lock.json`). Nothing was changed during this pass.

## Skill safety review (before any use)

Files inspected without executing them: `SKILL.md`,
`references/structural-decay.md`, `references/security-checks.md`,
`scripts/dep_audit.sh`. There are no hooks, binaries or package metadata.

| Check | Result |
|---|---|
| Sends repository code to an external service | No. `dep_audit.sh` runs `npm outdated` and `npm audit`, which send the dependency list to the npm registry — the standard behaviour of those commands, not source code |
| Reads secrets or credentials | No. The security reference greps tracked files for secret shapes and says never to repeat a value |
| Modifies git config, pushes, deletes files | No git write, push, `rm` or network call besides npm |
| Edits files during the read-only pass | No. The skill forbids any change in Pass 1 and requires approval for Pass 2 |
| Installs dependencies | No. The script only runs tools that are already installed |
| Install scope | Project only (`--agent claude-code --copy`); telemetry disabled with `DO_NOT_TRACK=1 DISABLE_TELEMETRY=1`; nothing written to the user profile |

Verdict: **PASS**. The skill matches its documented purpose.

## Step 0 — orientation

- Stack: React 19 + TypeScript + Vite 8 (npm, `app/package-lock.json`);
  Cloudflare Worker in TypeScript (npm, `worker/package-lock.json`); Node
  build scripts (`app/scripts`, `worker/scripts`).
- Scope: `app/src`, `worker/src`, `app/scripts`, `worker/scripts`,
  `app/index.html`, `app/vite.config.ts`. The generated data and fixtures
  were excluded.
- Tests: frontend 1085/1085 (101 files), Worker 273/273 (16 files), both
  green on the audited commit. So claims below are backed by a real suite.
- Working tree: clean apart from the skill install itself.

## How the findings were interpreted

A finding is fixed during v1.1 only if it is real, bounded, protected by
tests and in code v1.1 touches anyway. Intentional boundaries are not
"duplication": frontend vs Worker validation (defence in depth), Phase 14,
Personal Match, the Passport boundary, the admin/public split, AR/EN string
structures and the privacy boundaries.

## 1. Layer collapse

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| L1 | Medium | `app/src/routes/Destination.tsx` (513 lines) holds the page plus inline `CountryInfoCard` and `OptionalPlanningInfo` | v1.1 adds Share, Favorite and Compare entry points here; inlining them would push the route past the point anyone reads it | v1.1: new controls go in their own components; existing code left as is |
| — | — | `worker/src/index.ts` dispatch | Checked: admin is matched before public handlers, body ceilings are applied before any handler; transport and rules are separate | No finding |
| — | — | `worker/src/adminPage.ts` (1561 lines) | A self-contained HTML page by design (its own CSP, no build step); admin semantics are frozen | No action |

## 2. Duplicated logic

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| D1 | High | The site origin and base path live in 6 places: `app/vite.config.ts:8` (`base: '/wej/'`), `app/src/App.tsx:16` (`basename="/wej"`), `worker/src/shared.ts:6` (`ALLOWED_ORIGIN`), `worker/src/cityDescriptions.ts:51` (User-Agent URL), 4 smoke-script defaults and 5 allow-list lines in `.github/workflows/production-smoke.yml` | A custom domain needs every copy changed; missing the Worker allow-list silently breaks every Worker call (CORS) | Fix in v1.1 (Stage 4.3/19.3): one site config for the app; the Worker allow-list becomes a set |
| D2 | Medium | `theme-color` values in `app/index.html:16` (`#EBE7DC` / `#101722`) and `app/src/components/ThemeSwitch.tsx:19` (`#F2EEE5` / `#111925`) | Already drifted: the browser chrome colour changes when React takes over. v1.1 adds a manifest `theme_color`, a third copy | Fix in v1.1: one pair of values shared by the bootstrap, ThemeSwitch and the manifest |
| D3 | Low | IL/ISR exclusion re-asserted in 5 generators, `app/src/home/heroDestination.ts:66` and `worker/src/shared.ts:15` | Most read `excludedCountriesData.json` or only assert; the Worker cannot import app data | Intentional defence in depth — keep |
| D4 | Low | Feedback/rating limits checked in the browser and again in the Worker | Security boundary | Intentional — keep |
| D5 | Medium | "Storage may throw" handled separately in `home/heroDestination.ts`, `components/SurpriseDestination.tsx`, `personalization/storage.ts`, and not at all in `ThemeSwitch.tsx` (see H1) | v1.1 Favorites would be a fifth copy | v1.1: one small safe-storage helper for new code; existing callers not churned |

## 3. Files that stopped being read

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| F1 | Medium | `app/src/styles/wejhaty.css` — 5570 lines, 47 changes in 60 days | Every feature edits one cascade; collisions are easy | DEFERRED: splitting risks the accepted visuals. v1.1 appends scoped sections only |
| F2 | Low | `app/src/data/types.ts` — 1010 lines, 29 changes in 60 days | Mostly the i18n string interfaces that force AR/EN parity | Keep: the size is the parity guard |

## 4. Dead code

Verified with a whole-repository search (code, tests and scripts).

| ID | Priority | Symbol | Decision |
|---|---|---|---|
| X1 | Low | `FlagThumb` (`app/src/components/flags/FlagIcon.tsx:83`) | DEFERRED — not in v1.1 code; tree-shaken |
| X2 | Low | `clearSuitabilityDetailMemo` (`app/src/countryIntelligence/detailClient.ts:57`) | DEFERRED |
| X3 | Low | `COUNTRY_INTELLIGENCE_GENERATED_AT` (`app/src/data/countryIntelligence.ts:40`) | DEFERRED |
| X4 | Low | `hasCityFacts` (`app/src/data/featuredCities.ts:41`) | DEFERRED |
| X5 | Low | `sourceOf` (`app/src/intelligence/sources.ts:48`) | DEFERRED |
| X6 | Low | `FeedbackStatus` type (`worker/src/analytics.ts:41`) | DEFERRED — admin frozen |
| X7 | Low | `loadOriginalEngine` (`app/src/engine/__tests__/loadOriginalEngine.ts:32`) | Protected Phase 14 test harness — no action |

About 90 further exports are used only inside their own file (types
and constants). Their `export` is harmless and not reported one by one.

## 5. Reusable pieces

Nothing beyond D5 that clearly pays for itself.

## 6. Health checks

| ID | Priority | What / where | Why it matters | Decision |
|---|---|---|---|---|
| H1 | High | `app/src/components/ThemeSwitch.tsx:10,48-49` reads and writes `localStorage` with no guard; ThemeSwitch renders in the header of every page | When storage is blocked (Safari "Block All Cookies", some privacy modes), `localStorage` access throws `SecurityError`, so the header — and the whole app — fails to render. The inline bootstrap in `index.html` already guards the same read | Fix in v1.1 with a regression test (v1.1 requires "storage disabled never crashes") |
| H2 | Medium | `app/src/App.tsx` has no catch-all route | An unknown path under the site renders an empty page, and SEO needs invalid routes to be noindex | Fix in v1.1 SEO work |

## 7. Security and dependencies

**Security.** No secret shape in tracked files, and no committed `.env`.
The only HTML sinks are `Icon.tsx` and `FlagIcon.tsx`, which render build-time
SVG constants, never user input. No `eval` or `new Function`. The Worker's
CORS allows exactly one origin, and the admin surface sends no CORS header.
Storage writes are the theme key, the anonymous session id, the Surprise
anti-repeat list and the local personalization profile. No credential or
passport data is stored.

**Dependencies** (`scripts/dep_audit.sh`):
- app: `csv-parse` moderate advisory through `ourairports-data-js`
  (build-time generator only, not shipped) — already U15 DEFERRED.
  Everything else is minor or patch updates; TypeScript 7 is a major
  version and not proposed.
- worker: 0 vulnerabilities; minor updates only.

## Summary

| Priority | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | D1, H1 |
| Medium | 5 | L1, D2, D5, F1, H2 |
| Low | 11 | D3, D4, F2, X1–X7 (X7 protected) |

Fix in v1.1 (bounded, tested, in touched code): D1, D2, D5 (new code only),
H1, H2, and L1 as a rule for new code. Everything else is DEFERRED or
intentional, as recorded above.
