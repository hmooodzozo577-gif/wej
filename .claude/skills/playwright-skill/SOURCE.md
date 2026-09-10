# Source

Vendored from the upstream project-local Claude Code skill, unmodified except
where noted below.

- **Upstream repository:** https://github.com/lackeyjb/playwright-skill
- **Upstream skill path:** `skills/playwright-skill/`
- **Commit vendored:** `dd47a6a023e249eb1b36e9e943eab89d0900865d` (2026-08-14)
- **Upstream skill version:** 5.0.0 (per `package.json`/`SKILL.md` metadata)
- **License:** MIT — see `LICENSE` in this directory (copied verbatim from
  the upstream repository root, `Copyright (c) 2025 lackeyjb`).

## What was vendored

`SKILL.md`, `run.js`, `lib/helpers.js`, `API_REFERENCE.md`, `package.json`,
`package-lock.json`, `LICENSE` — the complete runtime the skill needs.
Deliberately NOT vendored: `.github/` (upstream CI), `tests/` (upstream's own
test suite), `.claude-plugin/` (marketplace metadata, not needed for a
project-local install), `CHANGELOG.md`, `CONTRIBUTING.md` (upstream
development docs).

## Wejhaty-specific setup note (not an upstream modification)

This environment already ships a pre-installed Chromium at
`/opt/pw-browsers/chromium` with `PLAYWRIGHT_BROWSERS_PATH` and
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` set (see the harness's own environment
notes) — the same convention this repository's own app/worker packages rely
on. Before running this skill's own `npm run setup` (which calls
`npx playwright install chromium`), prefer:

1. `cd .claude/skills/playwright-skill && npm install` (installs the
   `playwright` package only — the browser download is skipped by the
   already-set env var), then
2. set `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium/chrome-linux/chrome` (or
   the actual resolved binary path under `/opt/pw-browsers`) so the skill's
   `launchBrowser()` helper reuses the existing browser instead of trying to
   fetch a second copy.

Only fall back to the skill's own `npm run setup`/`install-all-browsers` if
that pre-installed browser is ever unavailable in a given environment.

`node_modules/` for this skill (created by step 1 above) is intentionally
git-ignored — see the repository's `.gitignore` addition made alongside this
skill's installation.

## Security review

Reviewed `SKILL.md`, `run.js`, `lib/helpers.js`, `package.json` before
vendoring. No `sudo`, no `curl | bash`, no credential/secret access, no
telemetry, no unrelated package installs. `package.json`'s only runtime
dependency is `playwright` itself. The skill explicitly instructs never to
invent or expose real credentials, and only to reuse an existing authenticated
browser session (`connectOverCDP`) when the user explicitly asks. `allowed-tools`
in the frontmatter is scoped to `Bash(node:*) Bash(npm:*) Read Write`.
