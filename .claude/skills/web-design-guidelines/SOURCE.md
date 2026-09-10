# Source

- **Upstream repository:** https://github.com/vercel-labs/agent-skills
- **Upstream skill path:** `skills/web-design-guidelines/`
- **Commit vendored:** `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28)
- **Skill metadata version:** 1.0.0 (per `SKILL.md`)
- **License:** MIT, per the repository's own `README.md` ("## License \ MIT").
  No separate `LICENSE` file exists at the repository root to copy verbatim —
  this is stated as-is rather than inventing license text upstream never
  published.

## What was vendored

Only `SKILL.md` — the entire skill. By design, this skill fetches its actual
rule set live from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
on every invocation rather than shipping a local copy, so there is nothing
else to vendor. This is the upstream design, not a Wejhaty simplification.

## Security review

`SKILL.md` contains no shell commands, no scripts, no dependencies. Its only
runtime action is a `WebFetch` of one specific, official Vercel-owned URL
(`vercel-labs/web-interface-guidelines`) followed by reading files the user
specifies — no credential access, no writes, no unrelated network calls.
