# CLAUDE.md

## Skill activation

At the start of any task-oriented session — any interaction where you will use tools and produce deliverables — invoke the task-observer skill before beginning work.

## Skill usage policy

For substantial tasks, evaluate available project-local skills before implementation. Use relevant skills when they materially improve correctness or quality.

For specialized work such as UI/UX, frontend design, browser testing, visual QA, accessibility, React performance, debugging, security, API work, architecture, testing, or deployment, first consider existing skills under `.claude/skills/`. If an important capability appears to be missing, use the project-local `find-skill` skill to search for a suitable skill. Do NOT add or install a new third-party skill automatically unless the user's request explicitly authorizes it. Do not use `find-skill` for trivial tasks where specialized capabilities would not materially help.

In substantial final reports, state which skills were actually used and their purpose.

### Design-engineering skill roles

`impeccable` remains the design-direction/critique/audit workflow. Two narrower reference skills sit underneath it for Phase 17+ UI work:

- `emil-design-eng` — design-engineering polish: component feel, the animation-decision framework (should this animate, what easing, how fast), CSS/spring technique detail. Use for concrete implementation judgment calls, never to override Wejhaty's own product identity.
- `apple-design` — motion/interaction principles reference ONLY (springs, velocity handoff, momentum, rubber-banding, spatial consistency, reduced motion). **Never a mandate to make Wejhaty look or feel like an Apple product.** Do not use it to justify blanket glassmorphism, "Liquid Glass," iOS-chrome cloning, or rounded-everything styling. Invoke it only when a specific motion, gesture, or state-transition question would materially benefit from it — Wejhaty's own travel-product visual identity always wins.

Neither replaces `impeccable`; do not invoke every design skill on every UI task — pick only what the specific work needs.

## Project State Recovery

Before substantial work — and especially after context compaction/
reset, or when continuing an old/handed-off conversation:

1. Read `/PROJECT_STATE.md` (root, vendor-neutral — the canonical
   current-state snapshot for any agent).
2. Read `/AGENTS.md` (root, vendor-neutral working rules for any
   agent).
3. Verify the actual Git branch/HEAD against what those files claim.
4. Inspect relevant current code before implementing anything.
5. Then apply the Claude-specific skill policy in this file, below.

If `PROJECT_STATE.md` conflicts with current code/Git, current
repository state wins (see that file's own Source-of-Truth Priority).
Update `PROJECT_STATE.md` (not this file) whenever a task materially
changes roadmap status, architecture status, external-configuration
readiness, or the current phase.

This file (`CLAUDE.md`) and `.claude/skills/` hold Claude Code-specific
policy only — skill selection, Caveman, `impeccable`, `emil-design-eng`,
`apple-design`, `playwright-skill`, `find-skill`, and any other
Claude-specific workflow convention. Project-wide product truth
(non-negotiable rules, roadmap, architecture) belongs in the root
files above, not here — the repository remembers Wejhaty, not any one
agent's chat history (`PROJECT_STATE.md`'s own opening line).
