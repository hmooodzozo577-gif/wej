# Source

- **Upstream repository:** https://github.com/vercel-labs/agent-skills
- **Upstream skill path:** `skills/react-best-practices/`
- **Commit vendored:** `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28)
- **Skill metadata version:** 1.0.0 (per `SKILL.md`); content dated January
  2026, Vercel Engineering (per `metadata.json`).
- **License:** MIT, per the repository's own `README.md` ("## License \ MIT").
  No separate `LICENSE` file exists at the repository root to copy verbatim —
  this is stated as-is rather than inventing license text upstream never
  published.

## What was vendored

`SKILL.md`, `AGENTS.md` (the single compiled reference document covering all
70 rules with explanations and before/after examples — the same content the
exploded `rules/*.md` directory represents, one rule per file), and
`metadata.json` (abstract + upstream references).

Deliberately NOT vendored: the exploded `rules/` directory (70+ individual
files whose content is already covered by the vendored `AGENTS.md` — vendoring
both would duplicate the same material twice), `README.md` (upstream
repository-maintenance documentation — `pnpm install`/`pnpm build`/`pnpm
validate` instructions for people editing the rules themselves, not relevant
to using the skill), `src/` (upstream build scripts that regenerate
`AGENTS.md` from `rules/`), `test-cases.json` (upstream's own LLM-evaluation
fixtures).

## Security review

`SKILL.md` and `AGENTS.md` are pure documentation — no scripts, no shell
commands, no dependencies, no network calls at use time.
