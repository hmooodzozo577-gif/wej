# Wejhaty Agent Instructions

Vendor-neutral working instructions for any coding agent (Claude Code,
Codex, Gemini CLI, Cursor, Copilot agents, others) and for human
developers. How should any agent work on Wejhaty? For WHAT the project
currently is, see `PROJECT_STATE.md` — this file does not repeat that.

Codex must also read and follow root `CODEX.md`, which records the user's
persistent autonomous engineering operating contract for this project.

## Before substantial work

1. Before making any code, configuration, design, or documentation change,
   tell the user what you intend to do. Read-only recovery and investigation
   may precede the explanation, but no mutation may. This is a persistent,
   explicit user instruction.
2. Read `PROJECT_STATE.md`.
3. Verify the current Git branch, HEAD, and working-tree cleanliness —
   do not trust remembered chat/session context for any of this.
4. Inspect the relevant current code/tests before making changes.
5. If `PROJECT_STATE.md` conflicts with current code/Git, current
   repository evidence wins (see that file's Source-of-Truth Priority).
6. Re-check external configuration (GitHub repo settings, Cloudflare
   account/binding state, provider credentials) if the task depends on
   it — the repository cannot prove current external state by itself.
7. Update `PROJECT_STATE.md` when a task materially changes project
   state (see that file's own Agent Handoff Rule for what counts).

## Working rules

- Scope discipline: do the requested task; do not perform an unrelated
  redesign, refactor, or "while I'm here" cleanup.
- Preserve accepted UI designs. Do not change the visual design, layout, or
  interaction presentation of an existing screen unless the user explicitly
  requests that design change. Behavioral fixes must reuse the accepted UI.
- Phase 14 (`app/src/engine/`) is the sole ranking authority. The interview is
  deterministic and must not introduce ranking fields or weights that Phase 14
  does not support.
- Israel (IL/ISR) exclusion is absolute across every effective path.
  Monaco (MC/MCO) is a valid destination.
- Never fabricate a price (flight, hotel, accommodation) — real
  provider data or a clearly-labeled estimate only, never blended.
- Precise coordinates stay in memory and must not be sent to external
  recommendation services.
- Never put a secret or API key in the frontend (`app/`) or a
  `VITE_*` variable — Worker-side only.
- Never infer religion, ethnicity, politics, personal values, or
  cultural tolerance from location, nationality, language, or locale.
- Preserve Arabic + English parity; Arabic stays the default language.
- Cancelled roadmap features (see `PROJECT_STATE.md`) stay cancelled
  unless the user explicitly reopens the topic.
- Do not start a new roadmap phase (e.g. Phase 17) without an explicit,
  current task instruction to do so.
- Use available environment-specific testing/review tools when useful
  for the task at hand — a generic agent should not assume access to
  any particular vendor's local skill/tool system (e.g. Claude Code's
  `.claude/skills/`, documented in `CLAUDE.md` for that environment
  only).
