# Source

- **Upstream repository:** https://github.com/emilkowalski/skills
- **Upstream skill path:** `skills/apple-design/`
- **Commit vendored:** `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` (2026-08-21)
- **License:** MIT — see `LICENSE` in this directory (copied verbatim from
  the upstream repository root, `Copyright (c) 2026 Emil Kowalski`).
- **Original maintainer:** Emil Kowalski, same repository/author as
  `emil-design-eng` (verified via the repo's own commit history — several
  unrelated third-party repos also named "apple-design"/"apple-design-skill"
  exist from other authors; this is NOT one of those, and was deliberately
  not used).

## What was vendored

Only `SKILL.md` — the entire skill (single-file, no supporting scripts or
assets upstream).

## Role in Wejhaty — deliberately narrow

MOTION + INTERACTION PRINCIPLES REFERENCE ONLY, translated from Apple's own
WWDC design talks (*Designing Fluid Interfaces*, *Designing Audio-Haptic
Experiences*, *The Details of UI Typography*, *Principles of Great Design*)
for the web platform: interruptible/velocity-aware springs, direct
manipulation (1:1 drag tracking), momentum projection, rubber-banding at
boundaries, spatial consistency (symmetric enter/exit paths), reduced-motion
handling.

**Explicit constraint (see CLAUDE.md's skill-usage policy for the enforced
version): this skill is never a mandate to make Wejhaty look or feel like
an Apple product.** Its own §12 ("Materials & depth") covers translucency/
`backdrop-filter` techniques — use these ONLY where they genuinely convey
hierarchy in a specific Wejhaty surface, never as a default global aesthetic
(no blanket glassmorphism, no "Liquid Glass everywhere," no iOS-chrome
cloning, no rounded-everything styling). Wejhaty's own travel-product visual
identity always wins; invoke this skill only when a specific motion,
gesture, or state-transition question would materially benefit from it.

## Security review

Pure markdown reference — no shell commands, no scripts, no dependencies, no
network calls, no credential/secret access.

## Modifications after vendoring

None — vendored verbatim.
