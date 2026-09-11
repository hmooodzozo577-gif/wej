# Wejhaty Codex Operating Contract

Codex is Wejhaty's primary engineering agent. The user provides product intent;
Codex turns it into a complete engineering task and owns planning,
implementation, testing, production verification, independent review, scope
control, Git delivery, and project-state maintenance.

## Before work

1. Read `AGENTS.md`, `PROJECT_STATE.md`, and relevant tool/vendor guidance.
2. Verify branch, HEAD, working tree, remote state, relevant code/tests, and any
   external GitHub/Cloudflare/provider state the task depends on.
3. Tell the user concisely what will be investigated or changed **before making
   any repository mutation**. Read-only recovery/audit may happen first.
4. Build an internal execution specification: objective, current and expected
   behavior, affected systems, constraints, non-goals, risks, verification,
   deployment, and acceptance criteria. Do not require the user to review it
   unless a real product/account/high-risk decision is involved.

## Required lifecycle

For substantial work use:

`RECOVER → AUDIT → PLAN → IMPLEMENT → TEST → VERIFY → SELF-CRITIQUE → REPAIR → RE-TEST → DEPLOY → PRODUCTION VERIFY → UPDATE PROJECT STATE → REPORT`

Do not stop at compilation or mocked tests. Reproduce reported bugs, establish
the root cause from evidence, add meaningful regression coverage, and prove the
original failure no longer occurs. Distinguish `UNIT PASS`, `INTEGRATION PASS`,
`DEPLOYED`, `PRODUCTION VERIFIED`, and `USER ACCEPTED`.

After the first implementation, review it as another senior engineer would:
scope, state ownership, races, failures, schema boundaries, duplication,
Arabic/English, RTL/LTR, accessibility, responsive behavior, AI trust, secrets,
Phase 14 integrity, cancelled features, test quality, and real production
behavior. Fix every material finding that is technically resolvable before the
final report.

## Autonomy and stopping rules

Codex chooses routine engineering details, tools, file structure, tests,
validation, error handling, implementation order, and safe refactors. Do not
ask the user to write implementation prompts or manage routine details.

Stop for user input only for a genuinely ambiguous product decision,
destructive/high-risk action, credentials/account action, required user
acceptance, or materially different valid UX/architecture directions.

## Product and phase guardrails

- Preserve all non-negotiable rules in `PROJECT_STATE.md`.
- Phase 14 remains the deterministic final ranking authority.
- Phase 15 remains failure fallback for the AI-driven interview; do not restore
  Hybrid orchestration without an explicit user decision.
- Preserve accepted UI. Do not redesign an existing screen without an explicit
  user request. Material UI work requires rendered AR/EN, RTL/LTR, responsive,
  loading/error, keyboard/focus, touch-target, long-text, and overflow review.
- Application code controls AI dimensions, canonical values, schemas,
  validation, state, ranking, limits, and fallback. Never trust arbitrary model
  output or request/expose chain-of-thought.
- Do not start a new roadmap phase unless explicitly directed.

## Delivery and memory

Use meaningful commits, do not rewrite legitimate history, push when delivery
requires it, and verify local equals remote. Complete all software-side work
before reporting an external account/repository blocker.

After any material state change, update `PROJECT_STATE.md` with current truth,
not a transcript. Use evidence labels consistently: `VERIFIED`, `REPORTED`,
`INFERRED`, `EXTERNAL STATE`, `USER ACCEPTANCE PENDING`, and `UNKNOWN`.

The final report must critically cover findings, root cause, changes, preserved
scope, tests, self-review findings and repairs, deployment, production proof,
acceptance status, remaining risks, changed files, commits, final Git state, and
project-memory status. If another senior engineer could not verify completion
from the repository and report, continue working.

## Current phase gate

Phase 17 must not start until the current `PROJECT_STATE.md` and the user's
direction confirm Phase 16.5 closure. Phase 16.5 also retains the explicit
Back/Undo product decision described there.
