# Wejhaty Agent Instructions

Vendor-neutral working instructions for any coding agent (Claude Code,
Codex, Gemini CLI, Cursor, Copilot agents, others) and for human
developers. How should any agent work on Wejhaty? For WHAT the project
currently is, see `PROJECT_STATE.md` — this file does not repeat that.

## Before substantial work

1. Read `PROJECT_STATE.md`.
2. Verify the current Git branch, HEAD, and working-tree cleanliness —
   do not trust remembered chat/session context for any of this.
3. Inspect the relevant current code/tests before making changes.
4. If `PROJECT_STATE.md` conflicts with current code/Git, current
   repository evidence wins (see that file's Source-of-Truth Priority).
5. Re-check external configuration (GitHub repo settings, Cloudflare
   account/binding state, provider credentials) if the task depends on
   it — the repository cannot prove current external state by itself.
6. Update `PROJECT_STATE.md` when a task materially changes project
   state (see that file's own Agent Handoff Rule for what counts).

## Working rules

- Scope discipline: do the requested task; do not perform an unrelated
  redesign, refactor, or "while I'm here" cleanup.
- Phase 14 (`app/src/engine/`) is the sole ranking authority — AI never
  ranks countries or sets scoring weights directly.
- Israel (IL/ISR) exclusion is absolute across every effective path.
  Monaco (MC/MCO) is a valid destination.
- Never fabricate a price (flight, hotel, accommodation) — real
  provider data or a clearly-labeled estimate only, never blended.
- Never send precise coordinates to the AI — coarse country name only,
  and only with a granted location.
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
