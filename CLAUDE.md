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
