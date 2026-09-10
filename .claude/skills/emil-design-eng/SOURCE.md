# Source

- **Upstream repository:** https://github.com/emilkowalski/skills
- **Upstream skill path:** `skills/emil-design-eng/`
- **Commit vendored:** `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` (2026-08-21)
- **License:** MIT — see `LICENSE` in this directory (copied verbatim from
  the upstream repository root, `Copyright (c) 2026 Emil Kowalski`).
- **Original maintainer:** Emil Kowalski (creator of Sonner, Vaul; author of
  the animations.dev course this skill's philosophy is drawn from). Verified
  against the repository's own commit history — not a name-alike fork.

## What was vendored

Only `SKILL.md` — the entire skill (single-file, no supporting scripts or
assets upstream).

## Role in Wejhaty

DESIGN ENGINEERING / INTERACTION CRAFT reference — component-level polish,
animation-decision framework (should this animate at all, what easing, how
fast), CSS/spring technique detail (transform-origin, clip-path, momentum
math, `prefers-reduced-motion`). This is deliberately narrower and more
technical than `impeccable`'s own `animate`/`layout` commands, which are
high-level planning guidance ("write a motion thesis") without this level of
concrete technique — see the Phase 16.5-adjacent skills-addition report for
the side-by-side comparison. Use it to make the specific judgment calls
impeccable's own workflow needs, never to override Wejhaty's own product
identity or visual direction.

## Security review

Pure markdown reference — no shell commands, no scripts, no dependencies, no
network calls, no credential/secret access.

## Modifications after vendoring

None — vendored verbatim.
